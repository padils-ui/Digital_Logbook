import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpenText,
  HeartPulse,
  IdCard,
  Megaphone,
  PieChart,
  Users,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, formatDateMy, formatDateShort, getTodayIso } from '@/lib/week-window';
import type {
  AcademicCalendarRow,
  Announcement,
  AppUser,
  AttendanceTrendPoint,
  ClassAttendanceSummary,
  ClassRow,
  ClassTeacherRow,
  DistributionSlice,
  Student,
  TeacherLogStatusRow,
} from '@/lib/types';
import { AcademicCalendarWidget } from '@/components/dashboard/academic-calendar-widget';
import { AnnouncementWidget } from '@/components/dashboard/announcement-widget';
import { AttendanceTodayWidget } from '@/components/dashboard/attendance-today-widget';
import { AttendanceTrendChart } from '@/components/dashboard/attendance-trend-chart';
import { ClassPerformanceCards } from '@/components/dashboard/class-performance-cards';
import { DistributionDonutCard } from '@/components/dashboard/distribution-donut-card';
import { TeacherLogStatusTable } from '@/components/dashboard/teacher-log-status-table';
import { UpcomingEventsCard } from '@/components/dashboard/upcoming-events-card';

export const metadata: Metadata = { title: 'Papan Pemuka' };

/** Baris kehadiran hari ini (termasuk catatan sebab ketidakhadiran). */
interface TodayAttendanceRow {
  student_id: string;
  status: string;
  catatan: string | null;
}

/** Baris kehadiran bagi siri trend 7 hari. */
interface TrendAttendanceRow {
  date: string;
  status: string;
}

/** Log harian hari ini — digunakan untuk status penyiapan log. */
interface TodayLogRow {
  student_id: string;
  teacher_id: string;
}

/** Log harian bagi siri trend 7 hari. */
interface TrendLogRow {
  log_date: string;
  student_id: string;
}

/** Warna donut pecahan kehadiran: Hadir / Lewat / Tidak Hadir. */
const ATTENDANCE_PALETTE = ['#10b981', '#f59e0b', '#f43f5e'];

/** Warna donut sebab ketidakhadiran. */
const ABSENCE_PALETTE = ['#f43f5e', '#f59e0b', '#94a3b8'];

/** Label kategori sebab ketidakhadiran. */
const ABSENCE_LABELS = ['Demam/Sakit', 'Urusan Keluarga', 'Tanpa Sebab'] as const;

/**
 * Kelaskan catatan kehadiran kepada kategori sebab ketidakhadiran.
 *
 * Jadual `attendance` tiada lajur sebab khusus, jadi kategori diterbitkan
 * daripada kata kunci dalam `catatan`.
 */
function classifyAbsence(note: string | null): (typeof ABSENCE_LABELS)[number] {
  const text = (note ?? '').toLowerCase();
  if (text.includes('demam') || text.includes('sakit') || text.includes('fever')) {
    return 'Demam/Sakit';
  }
  if (
    text.includes('urusan') ||
    text.includes('keluarga') ||
    text.includes('cuti') ||
    text.includes('balik')
  ) {
    return 'Urusan Keluarga';
  }
  return 'Tanpa Sebab';
}

export default async function DashboardPage() {
  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id ?? '';

  // Klien admin (service role) untuk bacaan selamat — memintas rekursi RLS
  // pada jadual `users`. Setiap pertanyaan ditapis mengikut tenant_id.
  const admin = createAdminClient();

  const today = getTodayIso();
  const trendStart = addDays(today, -6);

  const [
    studentsRes,
    classesRes,
    todayLogsRes,
    announcementsRes,
    calendarRes,
    todayAttendanceRes,
    trendAttendanceRes,
    trendLogsRes,
    teachersRes,
    classTeachersRes,
  ] = await Promise.all([
    admin
      .from('students')
      .select('id, tenant_id, class_id, full_name')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    admin
      .from('classes')
      .select('id, tenant_id, class_name, year, created_at')
      .eq('tenant_id', tenantId)
      .order('class_name'),
    admin
      .from('daily_logs')
      .select('student_id, teacher_id')
      .eq('tenant_id', tenantId)
      .eq('log_date', today),
    admin
      .from('announcements')
      .select(
        'id, tenant_id, title, content, target_class_id, created_by, created_at, is_pinned'
      )
      .eq('tenant_id', tenantId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    admin
      .from('academic_calendar')
      .select('id, tenant_id, date, event_name, is_holiday, created_at')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true }),
    admin
      .from('attendance')
      .select('student_id, status, catatan')
      .eq('tenant_id', tenantId)
      .eq('date', today),
    admin
      .from('attendance')
      .select('date, status')
      .eq('tenant_id', tenantId)
      .gte('date', trendStart)
      .lte('date', today),
    admin
      .from('daily_logs')
      .select('log_date, student_id')
      .eq('tenant_id', tenantId)
      .gte('log_date', trendStart)
      .lte('log_date', today),
    admin
      .from('users')
      .select('id, tenant_id, full_name, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['teacher', 'admin_papn'])
      .order('full_name'),
    admin
      .from('class_teachers')
      .select('id, tenant_id, class_id, teacher_id, created_at')
      .eq('tenant_id', tenantId),
  ]);

  const students = (studentsRes.data ?? []) as Pick<
    Student,
    'id' | 'tenant_id' | 'class_id' | 'full_name'
  >[];
  const classes = (classesRes.data ?? []) as ClassRow[];
  const todayLogs = (todayLogsRes.data ?? []) as TodayLogRow[];
  const announcements = (announcementsRes.data ?? []) as Announcement[];
  const calendarEntries = (calendarRes.data ?? []) as AcademicCalendarRow[];
  const todayAttendance = (todayAttendanceRes.data ?? []) as TodayAttendanceRow[];
  const trendAttendance = (trendAttendanceRes.data ?? []) as TrendAttendanceRow[];
  const trendLogs = (trendLogsRes.data ?? []) as TrendLogRow[];
  const teachers = (teachersRes.data ?? []) as Pick<
    AppUser,
    'id' | 'tenant_id' | 'full_name'
  >[];
  const classTeachers = (classTeachersRes.data ?? []) as ClassTeacherRow[];

  const upcomingEntries = calendarEntries.filter((entry) => entry.date >= today);
  const pinnedAnnouncements = announcements.filter((item) => item.is_pinned);

  const totalStudents = students.length;
  const hadir = todayAttendance.filter((row) => row.status === 'Hadir').length;
  const lewat = todayAttendance.filter((row) => row.status === 'Lewat').length;
  const tidakHadir = todayAttendance.filter(
    (row) => row.status === 'Tidak Hadir'
  ).length;

  const statusByStudent = new Map(
    todayAttendance.map((row) => [row.student_id, row.status])
  );
  const loggedStudentIds = new Set(todayLogs.map((row) => row.student_id));

  // ── Prestasi kehadiran mengikut kelas ────────────────────────
  const classSummaries: ClassAttendanceSummary[] = classes.map((kelas) => {
    const members = students.filter((student) => student.class_id === kelas.id);
    let classHadir = 0;
    let classLewat = 0;
    let classTidakHadir = 0;
    let logsToday = 0;

    members.forEach((member) => {
      const status = statusByStudent.get(member.id);
      if (status === 'Hadir') classHadir += 1;
      else if (status === 'Lewat') classLewat += 1;
      else if (status === 'Tidak Hadir') classTidakHadir += 1;
      if (loggedStudentIds.has(member.id)) logsToday += 1;
    });

    const total = members.length;
    return {
      class_id: kelas.id,
      class_name: kelas.class_name,
      total_students: total,
      hadir: classHadir,
      lewat: classLewat,
      tidak_hadir: classTidakHadir,
      peratus:
        total > 0
          ? Math.round(((classHadir + classLewat) / total) * 100)
          : 0,
      logs_today: logsToday,
      log_lengkap: total > 0 && logsToday >= total,
    };
  });

  // ── Trend 7 hari terakhir ────────────────────────────────────
  const trendPoints: AttendanceTrendPoint[] = Array.from(
    { length: 7 },
    (_, index) => {
      const date = addDays(trendStart, index);
      const attendanceForDay = trendAttendance.filter((row) => row.date === date);
      const presentForDay = attendanceForDay.filter(
        (row) => row.status === 'Hadir' || row.status === 'Lewat'
      ).length;
      const loggedForDay = new Set(
        trendLogs
          .filter((row) => row.log_date === date)
          .map((row) => row.student_id)
      ).size;

      return {
        date,
        label: formatDateShort(date),
        peratus_kehadiran:
          totalStudents > 0
            ? Math.round((presentForDay / totalStudents) * 100)
            : 0,
        peratus_log:
          totalStudents > 0
            ? Math.round((loggedForDay / totalStudents) * 100)
            : 0,
      };
    }
  );

  // ── Pecahan kehadiran & sebab ketidakhadiran hari ini ────────
  const attendanceSlices: DistributionSlice[] = [
    { label: 'Hadir', value: hadir },
    { label: 'Lewat', value: lewat },
    { label: 'Tidak Hadir', value: tidakHadir },
  ];

  const absenceCounts: Record<string, number> = {
    'Demam/Sakit': 0,
    'Urusan Keluarga': 0,
    'Tanpa Sebab': 0,
  };
  todayAttendance
    .filter((row) => row.status === 'Tidak Hadir')
    .forEach((row) => {
      absenceCounts[classifyAbsence(row.catatan)] += 1;
    });
  const absenceSlices: DistributionSlice[] = ABSENCE_LABELS.map((label) => ({
    label,
    value: absenceCounts[label],
  }));

  // ── Status kemaskini log pendidik ────────────────────────────
  const classNameById = new Map(classes.map((kelas) => [kelas.id, kelas.class_name]));
  const teachersWithLogToday = new Set(todayLogs.map((row) => row.teacher_id));
  const teacherRows: TeacherLogStatusRow[] = teachers.map((teacher) => {
    const assigned = classTeachers
      .filter((link) => link.teacher_id === teacher.id)
      .map((link) => classNameById.get(link.class_id))
      .filter((name): name is string => Boolean(name));

    return {
      teacher_id: teacher.id,
      teacher_name: teacher.full_name,
      class_names: assigned.length > 0 ? assigned.join(', ') : 'Belum ditugaskan',
      lengkap: teachersWithLogToday.has(teacher.id),
    };
  });

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
      value: classes.length,
      icon: BookOpenText,
      tone: 'bg-emerald-50 text-emerald-700',
      href: '/admin/classes',
    },
    {
      label: 'Log Harian',
      value: todayLogs.length,
      icon: IdCard,
      tone: 'bg-amber-50 text-amber-700',
      href: '/teacher',
    },
    {
      label: 'Pengumuman',
      value: announcements.length,
      icon: Megaphone,
      tone: 'bg-purple-50 text-purple-700',
      href: '/admin/tetapan',
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
        <div className="space-y-6 lg:col-span-2">
          <AttendanceTrendChart points={trendPoints} />
          <ClassPerformanceCards
            summaries={classSummaries}
            dateLabel={formatDateMy(today)}
          />
          <TeacherLogStatusTable rows={teacherRows} />
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
          <DistributionDonutCard
            title="Pecahan Kehadiran Hari Ini"
            subtitle={formatDateMy(today)}
            icon={PieChart}
            iconTone="bg-brand-50 text-brand-700"
            slices={attendanceSlices}
            palette={ATTENDANCE_PALETTE}
          />
          <DistributionDonutCard
            title="Analisis Sebab Ketidakhadiran"
            subtitle="Berdasarkan catatan kehadiran"
            icon={HeartPulse}
            iconTone="bg-rose-50 text-rose-700"
            slices={absenceSlices}
            palette={ABSENCE_PALETTE}
          />
          <AnnouncementWidget announcements={pinnedAnnouncements} />
          <UpcomingEventsCard entries={upcomingEntries} />
        </div>
      </div>
    </div>
  );
}
