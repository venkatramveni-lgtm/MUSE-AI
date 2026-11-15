import React from 'react';
import { Award, BarChart3, CheckCircle2, Download, Flame, TrendingUp } from 'lucide-react';
import { MuseWorkspaceState } from '../services/workspaceStore';
import {
  computeSubjectProgress,
  detectWeakTopics,
  evaluateAchievements,
} from '../utils/academicEngine';

interface PerformanceCenterViewProps {
  workspace: MuseWorkspaceState;
}

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
      `MUSE AI PROGRESS REPORT`,
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
    a.download = `muse_ai_progress_report_${profile.uid}.txt`;
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
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h2 className="font-display font-bold text-base">Assessment Score Trend</h2>
          </div>

          {workspace.attempts.length === 0 ? (
            <div className="muse-panel p-6 text-center text-xs text-[var(--text-muted)]">
              Complete a Daily Quiz, Weekly Test, or Practice Set in Learning Studio to visualize your score trend.
            </div>
          ) : (
            <svg viewBox="0 0 460 180" className="w-full" role="img" aria-label="Assessment score trend chart">
              <rect
                x="0"
                y="0"
                width="460"
                height="180"
                rx="12"
                fill="var(--bg-elevated)"
                stroke="var(--border-subtle)"
              />
              {[25, 50, 75, 100].map((tick) => {
                const y = 150 - tick * 1.2;
                return (
                  <g key={tick}>
                    <line x1="40" y1={y} x2="440" y2={y} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                    <text x="8" y={y + 4} fill="var(--text-muted)" fontSize="10">{tick}%</text>
                  </g>
                );
              })}
              {workspace.attempts.slice(-8).map((att, idx, arr) => {
                const barWidth = 34;
                const gap = (390 - arr.length * barWidth) / Math.max(1, arr.length + 1);
                const x = 40 + gap + idx * (barWidth + gap);
                const h = Math.max(6, att.percentage * 1.2);
                const y = 150 - h;
                return (
                  <g key={att.id}>
                    <rect x={x} y={y} width={barWidth} height={h} rx="6" fill="var(--accent-blue)" />
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="600">
                      {att.percentage}%
                    </text>
                    <text x={x + barWidth / 2} y="168" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                      #{idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
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
