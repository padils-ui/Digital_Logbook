import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpenText, IdCard, Megaphone, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateMy, getTodayIso } from '@/lib/week-window';
import type { AcademicCalendarRow } from '@/lib/types';
import { AcademicCalendarWidget } from '@/components/dashboard/academic-calendar-widget';
import { AttendanceTodayWidget } from '@/components/dashboard/attendance-today-widget';
import { UpcomingEventsCard } from '@/components/dashboard/upcoming-events-card';

export const metadata: Metadata = { title: 'Papan Pemuka' };

interface AttendanceStatusRow {
  student_id: string;
  status: string;
}

export default async function DashboardPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const today = getTodayIso();

  const [students, classes, logs, announcements, calendar, attendance] = await Promise.all([
    admin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('daily_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('log_date', today),
    admin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('academic_calendar')
      .select('id, tenant_id, date, event_name, is_holiday, created_at')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin
      .from('attendance')
      .select('student_id, status')
      .eq('tenant_id', tenantId)
      .eq('date', today),
  ]);

  const calendarEntries = (calendar.data ?? []) as AcademicCalendarRow[];
  const upcomingEntries = calendarEntries.filter((entry) => entry.date >= today);

  const attendanceRows = (attendance.data ?? []) as AttendanceStatusRow[];
  const totalStudents = students.count ?? 0;
  const hadir = attendanceRows.filter((row) => row.status === 'Hadir').length;
  const lewat = attendanceRows.filter((row) => row.status === 'Lewat').length;
  const tidakHadir = attendanceRows.filter((row) => row.status === 'Tidak Hadir').length;

  const stats = [
    {
      label: 'Jumlah Anak',
      value: totalStudents,
      icon: Users,
      tone: 'bg-brand-50 text-brand-700',
      href: '/admin/students',
    },
    {
      label: 'Jumlah Kelas',
      value: classes.count ?? 0,
      icon: BookOpenText,
      tone: 'bg-emerald-50 text-emerald-700',
      href: '/admin/classes',
    },
    {
      label: 'Log Harian',
      value: logs.count ?? 0,
      icon: IdCard,
      tone: 'bg-amber-50 text-amber-700',
      href: '/teacher',
    },
    {
      label: 'Pengumuman',
      value: announcements.count ?? 0,
      icon: Megaphone,
      tone: 'bg-purple-50 text-purple-700',
      href: '/dashboard',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Papan Pemuka Pentadbir
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Selamat datang, {profile?.full_name ?? 'Pentadbir'}.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${stat.tone}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-2xl font-bold text-slate-900 transition-colors group-hover:text-brand-600">
                {stat.value}
              </p>
              <p className="text-xs text-slate-500 transition-colors group-hover:text-brand-600">
                {stat.label}
              </p>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AcademicCalendarWidget entries={calendarEntries} today={today} />
        </div>
        <div className="space-y-6">
          <AttendanceTodayWidget
            present={hadir}
            late={lewat}
            absent={tidakHadir}
            totalStudents={totalStudents}
            dateLabel={formatDateMy(today)}
          />
          <UpcomingEventsCard entries={upcomingEntries} />
        </div>
      </div>
    </div>
  );
}
