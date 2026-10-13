import { createClient } from '@/lib/supabase/server';
import { LogSummaryCard } from '@/components/parent/log-summary-card';
import { redirect } from 'next/navigation';

export interface GroupedDailyReport {
  date: string;
  studentId: string;
  studentName: string;
  logIds: string[];
  isReviewed: boolean;
  parentComment: string | null;
  entries: any[];
}

export default async function ParentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const db = supabase as any;

  // 1. Fetch student IDs linked to parent
  const { data: studentParents } = await db
    .from('student_parents')
    .select('student_id')
    .eq('parent_id', user.id);

  const studentIds = (studentParents || []).map((sp: any) => sp.student_id);

  let rawLogs: any[] = [];

  // 2. Fetch all raw logs for linked students
  if (studentIds.length > 0) {
    const { data } = await db
      .from('daily_logs')
      .select(`
        *,
        students (
          full_name
        )
      `)
      .in('student_id', studentIds)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: true });

    rawLogs = data || [];
  }

  // 3. Group raw logs by date and student
  const groupedMap = new Map<string, GroupedDailyReport>();

  rawLogs.forEach((log: any) => {
    const key = `${log.log_date}_${log.student_id}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        date: log.log_date,
        studentId: log.student_id,
        studentName: log.students?.full_name || 'Anak',
        logIds: [],
        isReviewed: true, // Default to true, set false if any log is unreviewed
        parentComment: null,
        entries: [],
      });
    }

    const group = groupedMap.get(key)!;
    group.logIds.push(log.id);
    group.entries.push(log);

    // If any single log entry for the day is not reviewed, the daily report is pending
    if (!log.parent_reviewed) {
      group.isReviewed = false;
    }

    // Capture existing parent comment
    if (log.parent_comment) {
      group.parentComment = log.parent_comment;
    }
  });

  const dailyReports = Array.from(groupedMap.values());
  const pendingCount = dailyReports.filter((report) => !report.isReviewed).length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Laporan Log Harian</h1>
          <p className="text-xs text-slate-500 mt-1">
            Semak dan berikan ulasan bagi laporan harian anak anda.
          </p>
        </div>
        {pendingCount > 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-semibold w-fit">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingCount} Laporan Harian Memerlukan Ulasan
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-semibold w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Semua Laporan Telah Disahkan
          </div>
        )}
      </div>

      {/* Grouped Daily Report List */}
      {dailyReports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Tiada log harian dijumpai buat masa ini.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dailyReports.map((report) => (
            <LogSummaryCard key={`${report.date}_${report.studentId}`} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}