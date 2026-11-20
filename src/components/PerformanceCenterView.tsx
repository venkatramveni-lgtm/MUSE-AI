import React from 'react';
import { Award, BarChart3, CheckCircle2, Download, Flame, TrendingUp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MuseWorkspaceState } from '../services/workspaceStore';
import {
  buildQuizTrendChartData,
  computeSubjectProgress,
  detectWeakTopics,
  evaluateAchievements,
  QuizTrendPoint,
} from '../utils/academicEngine';

interface PerformanceCenterViewProps {
  workspace: MuseWorkspaceState;
}

const QuizTrendTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: QuizTrendPoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-3 text-xs space-y-1 min-w-[180px]">
      <div className="font-display font-bold text-[var(--text-primary)] truncate max-w-[220px]">
        {point.title}
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">
        {point.subject} · {point.shortDate}
      </div>
      <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 tabular-nums">
        <span className="text-[var(--text-secondary)]">Score</span>
        <span className="font-bold text-blue-400">
          {point.percentage}% ({point.score}/{point.total})
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 tabular-nums">
        <span className="text-[var(--text-secondary)]">Running Avg</span>
        <span className="font-semibold text-emerald-400">{point.cumulativeAvg}%</span>
      </div>
    </div>
  );
};

export const PerformanceCenterView: React.FC<PerformanceCenterViewProps> = ({
  workspace,
}) => {
  const profile = workspace.profile!;
  const subjectStats = computeSubjectProgress(
    workspace.lessons,
    workspace.progress,
    workspace.attempts
  );
  const weakTopics = detectWeakTopics(workspace.attempts, workspace.questions);
  const completedLessonsCount = workspace.progress.filter((p) => p.completed).length;
  const completedTasksCount = workspace.studyPlans.filter((t) => t.completed).length;
  const badges = evaluateAchievements({
    completedLessonsCount,
    attempts: workspace.attempts,
    studyStreak: profile.studyStreak,
    completedStudyTasks: completedTasksCount,
  });

  const overallAvg =
    workspace.attempts.length > 0
      ? Math.round(
          workspace.attempts.reduce((sum, a) => sum + a.percentage, 0) / workspace.attempts.length
        )
      : null;

  const trendData = React.useMemo(
    () => buildQuizTrendChartData(workspace.attempts, 16),
    [workspace.attempts]
  );
  const latestScore = trendData.length > 0 ? trendData[trendData.length - 1].percentage : null;
  const bestScore =
    trendData.length > 0 ? Math.max(...trendData.map((d) => d.percentage)) : null;

  // Weekly productivity activity counts from real saved data (last 7 days)
  const weeklyActivity = React.useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dt = new Date();
      dt.setDate(dt.getDate() - offset);
      const iso = dt.toISOString().slice(0, 10);
      const label = dt.toLocaleDateString(undefined, { weekday: 'short' });
      const tasksDone = workspace.studyPlans.filter(
        (t) => t.completed && t.scheduledDate === iso
      ).length;
      const quizzesDone = workspace.attempts.filter(
        (a) => a.submittedAt.slice(0, 10) === iso
      ).length;
      const lessonsDone = workspace.progress.filter(
        (p) => p.completed && p.lastStudiedAt.slice(0, 10) === iso
      ).length;
      days.push({ label, count: tasksDone + quizzesDone + lessonsDone });
    }
    return days;
  }, [workspace.studyPlans, workspace.attempts, workspace.progress]);

  const maxDailyCount = Math.max(1, ...weeklyActivity.map((d) => d.count));

  const downloadReport = () => {
    const report = [
      `NANO AI PROGRESS REPORT`,
      `Learner: ${profile.displayName} (${profile.board} · Class ${profile.classLevel})`,
      `Generated: ${new Date().toLocaleString()}`,
      `Completed Lessons: ${completedLessonsCount} / ${workspace.lessons.length}`,
      `Completed Study Tasks: ${completedTasksCount} / ${workspace.studyPlans.length}`,
      `Total Assessments Taken: ${workspace.attempts.length}`,
      `Average Assessment Score: ${overallAvg !== null ? `${overallAvg}%` : 'No attempts yet'}`,
      `Unlocked Badges: ${badges.filter((b) => b.unlocked).length} / ${badges.length}`,
      '',
      'SUBJECT BREAKDOWN:',
      ...subjectStats.map(
        (s) =>
          `- ${s.subject}: ${s.completedLessons}/${s.totalLessons} lessons (${s.lessonPercentage}%), Quiz Avg: ${s.averageQuizScore !== null ? `${s.averageQuizScore}%` : 'N/A'}`
      ),
      '',
      'TOPICS NEEDING REVISION:',
      ...(weakTopics.length > 0
        ? weakTopics.map((w) => `- ${w.topic} (${w.subject}): ${w.accuracy}% accuracy`)
        : ['- None recorded yet']),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nano_ai_progress_report_${profile.uid}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl">Progress Center</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Weekly activity, completed tasks, learning sessions, personal goals, and real achievement milestones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5 text-amber-300 text-xs font-bold tabular-nums">
            <Flame className="w-4 h-4" />
            <span>{profile.studyStreak}-Day Streak</span>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Tasks Completed</div>
          <div className="font-display text-2xl font-bold mt-1 tabular-nums">
            {completedTasksCount} / {workspace.studyPlans.length}
          </div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Lessons Completed</div>
          <div className="font-display text-2xl font-bold mt-1 tabular-nums">
            {completedLessonsCount} / {workspace.lessons.length}
          </div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Average Quiz Score</div>
          <div className="font-display text-2xl font-bold mt-1 tabular-nums">
            {overallAvg !== null ? `${overallAvg}%` : '—'}
          </div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Achievements Unlocked</div>
          <div className="font-display text-2xl font-bold mt-1 tabular-nums">
            {badges.filter((b) => b.unlocked).length} / {badges.length}
          </div>
        </div>
      </div>

      {/* Weekly Activity + Score Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 min-w-0 muse-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h2 className="font-display font-bold text-base">Weekly Productivity &amp; Activity</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Last 7 days</span>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4">
            {weeklyActivity.map((day, idx) => {
              const heightPct = day.count > 0 ? Math.max(18, Math.round((day.count / maxDailyCount) * 100)) : 8;
              return (
                <div key={`${day.label}-${idx}`} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] tabular-nums">
                    {day.count}
                  </span>
                  <div className="w-full max-w-[32px] h-24 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        day.count > 0 ? 'bg-gradient-to-t from-blue-600 to-purple-500' : 'bg-[var(--bg-elevated)]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 min-w-0 muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="font-display font-bold text-base">Assessment Score Trend</h2>
            </div>
            {trendData.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] tabular-nums">
                <span className="text-blue-400 font-semibold">Latest: {latestScore}%</span>
                <span className="text-emerald-400 font-semibold">Best: {bestScore}%</span>
              </div>
            )}
          </div>

          {trendData.length === 0 ? (
            <div className="muse-panel p-6 text-center text-xs text-[var(--text-muted)]">
              Complete a Daily Quiz, Weekly Test, or Practice Set in Assessments to visualize your interactive score trend over time.
            </div>
          ) : (
            <div className="space-y-2.5">
              <div
                data-testid="performance-trend-chart"
                aria-label="Assessment score trend chart"
                className="w-full h-[220px] min-w-0 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="museQuizScoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      padding={{ left: 16, right: 16 }}
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<QuizTrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="percentage"
                      name="Quiz Score"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#museQuizScoreGrad)"
                      dot={{ r: 4, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: '#60a5fa', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeAvg"
                      name="Running Avg"
                      stroke="#10b981"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    <span>Quiz Score (%)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 border-t-2 border-dashed border-emerald-400 inline-block" />
                    <span>Running Average (%)</span>
                  </span>
                </div>
                <span className="tabular-nums">Showing {trendData.length} attempt{trendData.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subject Mastery & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 min-w-0 muse-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <h2 className="font-display font-bold text-base">Subject Progress &amp; Focus Areas</h2>
          </div>

          <div className="space-y-3">
            {subjectStats.map((s) => (
              <div key={s.subject} className="muse-panel p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{s.subject}</span>
                  <span className="tabular-nums">
                    {s.lessonPercentage}% lessons · {s.averageQuizScore !== null ? `${s.averageQuizScore}% quiz` : 'No quiz yet'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    style={{ width: `${Math.max(4, s.lessonPercentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {weakTopics.length > 0 && (
            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-amber)]">
                Topics Requiring Revision
              </h3>
              {weakTopics.slice(0, 3).map((w) => (
                <div key={w.topic} className="text-xs flex items-center justify-between">
                  <span>{w.topic}</span>
                  <span className="text-[var(--accent-amber)] font-semibold tabular-nums">{w.accuracy}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 min-w-0 muse-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Daily Achievements &amp; Milestones</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)]">Personal milestones</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((b) => (
              <div
                key={b.key}
                className={`muse-panel p-3.5 space-y-1.5 border ${
                  b.unlocked ? 'border-emerald-500/40' : 'opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-sm">{b.title}</span>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] tabular-nums">
                    {b.progressLabel}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
