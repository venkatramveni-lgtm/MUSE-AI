import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Flag,
  Globe,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import {
  ApprovedChannelEntry,
  EducationBoard,
  EducationContentReport,
  EducationPlaylistItem,
  EducationVideoItem,
  LessonItem,
  UserRole,
} from '../types/muse';
import { MuseWorkspaceState } from '../services/workspaceStore';
import { authFetch } from '../services/firebaseClient';
import {
  computeSubjectProgress,
  detectWeakTopics,
  evaluateAchievements,
} from '../utils/academicEngine';
import {
  buildComprehensiveParentReportText,
  buildParentDailyActivityFeed,
  buildParentDailyDigest,
  getTodayDateKey,
  groupActivitiesByDay,
  ParentActivityCategory,
} from '../utils/parentPortalUtils';

/* ---------------- PARENT PORTAL ---------------- */
export const ParentPortalView: React.FC<{
  workspace: MuseWorkspaceState;
  onToggleConsent: (linkId: string) => void;
}> = ({ workspace, onToggleConsent }) => {
  const activeLink = workspace.parentLinks[0];
  const profile = workspace.profile!;
  const todayKey = getTodayDateKey();

  const [dayScope, setDayScope] = useState<'today' | 'last7' | 'all' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(todayKey);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ParentActivityCategory>('all');
  const [portalSection, setPortalSection] = useState<
    'overview' | 'daily_log' | 'academics' | 'planner' | 'media_ai'
  >('overview');

  const selectedDateKey = dayScope === 'custom' ? customDate || todayKey : todayKey;

  const subjectProgress = useMemo(
    () => computeSubjectProgress(workspace.lessons, workspace.progress, workspace.attempts),
    [workspace.lessons, workspace.progress, workspace.attempts]
  );

  const weakTopics = useMemo(
    () => detectWeakTopics(workspace.attempts, workspace.questions),
    [workspace.attempts, workspace.questions]
  );

  const completedLessonsCount = workspace.progress.filter((p) => p.completed).length;
  const completedTasksCount = workspace.studyPlans.filter((t) => t.completed).length;

  const achievements = useMemo(
    () =>
      evaluateAchievements({
        completedLessonsCount,
        attempts: workspace.attempts,
        studyStreak: profile.studyStreak,
        completedStudyTasks: completedTasksCount,
      }),
    [completedLessonsCount, workspace.attempts, profile.studyStreak, completedTasksCount]
  );

  const todayDigest = useMemo(
    () => buildParentDailyDigest(workspace, selectedDateKey),
    [workspace, selectedDateKey]
  );

  const fullActivityFeed = useMemo(
    () => buildParentDailyActivityFeed(workspace),
    [workspace]
  );

  const filteredDayGroups = useMemo(() => {
    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 6);
    const cutoff7Key = getTodayDateKey(cutoff7);

    const matching = fullActivityFeed.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (dayScope === 'today') return item.dateKey === todayKey;
      if (dayScope === 'custom') return item.dateKey === (customDate || todayKey);
      if (dayScope === 'last7') return item.dateKey >= cutoff7Key;
      return true;
    });

    return groupActivitiesByDay(matching);
  }, [fullActivityFeed, categoryFilter, dayScope, todayKey, customDate]);

  const watchedVideos = useMemo(
    () => workspace.videos.filter((v) => workspace.watchedVideoIds.includes(v.id)),
    [workspace.videos, workspace.watchedVideoIds]
  );

  const studiedImages = useMemo(
    () => workspace.images.filter((img) => workspace.studiedImageIds.includes(img.id)),
    [workspace.images, workspace.studiedImageIds]
  );

  const overallQuizAvg =
    workspace.attempts.length > 0
      ? Math.round(
          workspace.attempts.reduce((sum, a) => sum + a.percentage, 0) / workspace.attempts.length
        )
      : null;

  const downloadParentReport = () => {
    const text = buildComprehensiveParentReportText(workspace, todayKey);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nano_ai_parent_report_${profile.uid}_${todayKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryBadgeLabel = (cat: ParentActivityCategory) => {
    switch (cat) {
      case 'lesson':
        return 'Lesson';
      case 'quiz':
        return 'Quiz/Test';
      case 'planner':
        return 'Planner';
      case 'assignment':
        return 'Assignment';
      case 'note':
        return 'Note';
      case 'ai_session':
        return 'AI Session';
      case 'visual':
        return 'Visual/Image';
      case 'guide':
        return 'Guide Link';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Nano AI Parent &amp; Guardian Portal • Live Daily Updates ({todayKey})
          </div>
          <h1 className="font-display font-bold text-xl">
            Linked Student: {activeLink?.studentDisplayName || profile.displayName}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Class {profile.classLevel} • {profile.board} • Language: {profile.preferredLanguage} • Goal: {profile.academicGoal}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadParentReport}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Download Complete Daily Report
        </button>
      </div>

      {/* Guardian Consent Banner */}
      {activeLink && (
        <div className="muse-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-base">Privacy &amp; Guardian Consent</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Current Link Status: <strong>{activeLink.status}</strong> • Consent:{' '}
              <strong>{activeLink.consentGranted ? 'Granted' : 'Paused'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleConsent(activeLink.id)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] whitespace-nowrap shrink-0"
          >
            {activeLink.consentGranted ? 'Pause Access Consent' : 'Grant Access Consent'}
          </button>
        </div>
      )}

      {!activeLink?.consentGranted ? (
        <div className="muse-card p-6 text-sm font-medium text-[var(--accent-amber)]">
          Student academic details are hidden while guardian link consent is paused.
        </div>
      ) : (
        <>
          {/* Today's Daily Report Card (updates automatically every day) */}
          <div className="muse-card p-5 space-y-4 border border-blue-500/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> What Was Done Today ({selectedDateKey})
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  {todayDigest.headlineSummary}
                </p>
              </div>
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                Streak:{' '}
                <strong className="text-amber-400">
                  {profile.studyStreak} {profile.studyStreak === 1 ? 'day' : 'days'}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">Lessons Done Today</div>
                <div className="font-display text-xl font-bold mt-1 text-emerald-400">
                  {todayDigest.lessonsCompleted}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {todayDigest.lessonsStudied} studied ({completedLessonsCount} total)
                </div>
              </div>
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">Quizzes Today</div>
                <div className="font-display text-xl font-bold mt-1 text-blue-400">
                  {todayDigest.quizzesTaken}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {todayDigest.averageQuizPercentage !== null
                    ? `${todayDigest.averageQuizPercentage}% today avg`
                    : overallQuizAvg !== null
                      ? `${overallQuizAvg}% overall avg`
                      : 'None today'}
                </div>
              </div>
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">Planner Tasks</div>
                <div className="font-display text-xl font-bold mt-1 text-purple-400">
                  {todayDigest.tasksCompleted}/{todayDigest.tasksScheduledTotal}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {completedTasksCount}/{workspace.studyPlans.length} all-time done
                </div>
              </div>
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">Homework &amp; Notes</div>
                <div className="font-display text-xl font-bold mt-1 text-amber-400">
                  {todayDigest.assignmentsSubmitted + todayDigest.notesSaved}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {workspace.submissions.length} submissions • {workspace.savedNotes.length} notes
                </div>
              </div>
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">AI &amp; Guides Today</div>
                <div className="font-display text-xl font-bold mt-1 text-cyan-400">
                  {todayDigest.aiSessionsActive + todayDigest.guidesSaved}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {workspace.conversations.length} AI chats • {workspace.savedGuideLinks.length} guides
                </div>
              </div>
              <div className="muse-panel p-3">
                <div className="text-[var(--text-muted)]">Videos &amp; Visuals</div>
                <div className="font-display text-xl font-bold mt-1 text-rose-400">
                  {workspace.watchedVideoIds.length + workspace.studiedImageIds.length + workspace.generatedVisuals.length}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {workspace.watchedVideoIds.length} videos • {workspace.studiedImageIds.length + workspace.generatedVisuals.length} visuals
                </div>
              </div>
            </div>
          </div>

          {/* Section Switcher */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Complete Overview' },
              { id: 'daily_log', label: `Every Day Activity Log (${fullActivityFeed.length})` },
              { id: 'academics', label: 'Subjects, Quizzes & Weak Topics' },
              { id: 'planner', label: 'Planner & Assignments' },
              { id: 'media_ai', label: 'Videos, Notes, Visuals & AI History' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setPortalSection(
                    tab.id as 'overview' | 'daily_log' | 'academics' | 'planner' | 'media_ai'
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                  portalSection === tab.id
                    ? 'muse-btn-primary border-transparent'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* EVERY DAY ACTIVITY LOG */}
          {(portalSection === 'overview' || portalSection === 'daily_log') && (
            <section className="muse-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Day-by-Day Activity Log (Every Day What Was Done)</span>
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Automatically records every lesson, quiz score, planner task, assignment, note, visual, guide link, and AI study session by date.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'today', label: 'Today' },
                      { id: 'last7', label: 'Last 7 Days' },
                      { id: 'all', label: 'All Days' },
                      { id: 'custom', label: 'Pick Date' },
                    ] as const
                  ).map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setDayScope(scope.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                        dayScope === scope.id
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                  {dayScope === 'custom' && (
                    <input
                      type="date"
                      aria-label="Filter parent activity by date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'all',
                    'lesson',
                    'quiz',
                    'planner',
                    'assignment',
                    'note',
                    'ai_session',
                    'visual',
                    'guide',
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border whitespace-nowrap shrink-0 ${
                      categoryFilter === cat
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {cat === 'all' ? 'All Activities' : categoryBadgeLabel(cat)}
                  </button>
                ))}
              </div>

              {filteredDayGroups.length === 0 ? (
                <div className="muse-panel p-4 text-xs text-[var(--text-muted)]">
                  No matching learning activity found for this date filter. Switch to{' '}
                  <button
                    type="button"
                    onClick={() => setDayScope('all')}
                    className="text-blue-400 font-semibold underline"
                  >
                    All Days
                  </button>{' '}
                  to inspect full history.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDayGroups.map((group) => (
                    <div key={group.dateKey} className="muse-panel p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
                        <div className="font-display font-bold text-sm text-[var(--text-primary)]">
                          {group.dateKey === todayKey ? `Today — ${group.dateKey}` : group.dateKey}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {group.entries.length} activity item{group.entries.length === 1 ? '' : 's'} •{' '}
                          {group.completedCount} completed/logged
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {group.entries.map((entry) => (
                          <li
                            key={entry.id}
                            className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                                  {categoryBadgeLabel(entry.category)}
                                </span>
                                {entry.subject && (
                                  <span className="text-[10px] font-semibold text-teal-400">
                                    • {entry.subject}
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-[var(--text-primary)]">
                                {entry.title}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">{entry.detail}</div>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                              {entry.statusLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SUBJECTS, QUIZZES & WEAK TOPICS */}
          {(portalSection === 'overview' || portalSection === 'academics') && (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="muse-card p-5 space-y-3">
                <h2 className="font-display font-bold text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Subject Academic Progress</span>
                </h2>
                {subjectProgress.map((s) => (
                  <div key={s.subject} className="muse-panel p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.subject}</span>
                      <span>
                        {s.completedLessons}/{s.totalLessons} lessons ({s.lessonPercentage}%) •{' '}
                        {s.averageQuizScore !== null ? `${s.averageQuizScore}% quiz avg` : 'No quiz yet'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, s.lessonPercentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="muse-card p-5 space-y-4">
                <div>
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-blue-400" />
                    <span>All Quiz &amp; Exam Attempts ({workspace.attempts.length})</span>
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Every submitted Daily Quiz, Weekly Test, and Adaptive Practice session.
                  </p>
                </div>
                {workspace.attempts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">No quiz attempts submitted yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {workspace.attempts
                      .slice()
                      .reverse()
                      .map((att) => (
                        <div
                          key={att.id}
                          className="muse-panel p-3 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-semibold">{att.assessmentTitle}</div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {att.subject} • {att.submittedAt.slice(0, 10)}
                            </div>
                          </div>
                          <span
                            className={`font-bold ${
                              att.percentage >= 75 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {att.score}/{att.total} ({att.percentage}%)
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                  <h3 className="font-display font-bold text-sm">Focus Topics for Home Revision</h3>
                  {weakTopics.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Weak topics will appear automatically as quizzes are graded.
                    </p>
                  ) : (
                    weakTopics.slice(0, 4).map((wt) => (
                      <div
                        key={wt.topic}
                        className="muse-panel p-2.5 flex items-center justify-between text-xs"
                      >
                        <span>
                          <strong>{wt.topic}</strong> ({wt.subject})
                        </span>
                        <span className="font-semibold text-amber-400">{wt.accuracy}% accuracy</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PLANNER & ASSIGNMENTS */}
          {(portalSection === 'overview' || portalSection === 'planner') && (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="muse-card p-5 space-y-3">
                <h2 className="font-display font-bold text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>Study Planner Tasks ({completedTasksCount}/{workspace.studyPlans.length} Done)</span>
                </h2>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {workspace.studyPlans.map((task) => (
                    <div
                      key={task.id}
                      className="muse-panel p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{task.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {task.subject} • {task.scheduledDate} {task.scheduledTime || ''} • {task.priority} priority
                        </div>
                      </div>
                      <span
                        className={`font-semibold shrink-0 ${
                          task.completed ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="muse-card p-5 space-y-3">
                <h2 className="font-display font-bold text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Assignment &amp; Homework Status ({workspace.assignments.length})</span>
                </h2>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {workspace.assignments.map((a) => {
                    const sub = workspace.submissions.find((s) => s.assignmentId === a.id);
                    return (
                      <div key={a.id} className="muse-panel p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{a.title}</span>
                          <span
                            className={
                              sub
                                ? 'text-[var(--accent-emerald)] font-semibold'
                                : 'text-[var(--accent-amber)] font-semibold'
                            }
                          >
                            {sub ? (sub.grade ? `${sub.status} (${sub.grade})` : sub.status) : 'Pending'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          Class {a.classLevel} • {a.subject} • Due {a.dueDate}
                        </div>
                        {sub && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Submitted ({sub.submittedAt.slice(0, 10)}): {sub.content.slice(0, 120)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIDEOS, NOTES, VISUALS, GUIDES, AI SESSIONS & ACHIEVEMENTS */}
          {(portalSection === 'overview' || portalSection === 'media_ai') && (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="muse-card p-5 space-y-4">
                <div>
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    <span>AI Study Sessions &amp; Saved Notes</span>
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Recent AI Assistant topics explored and offline study notes saved.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-blue-400">
                    AI Conversations ({workspace.conversations.length})
                  </div>
                  {workspace.conversations.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No AI sessions recorded yet.</p>
                  ) : (
                    workspace.conversations.slice(0, 5).map((c) => (
                      <div key={c.id} className="muse-panel p-3 text-xs flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.title}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {c.subject} • {c.messages.length} messages
                          </div>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                          {c.updatedAt.slice(0, 10)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="text-xs font-semibold text-emerald-400">
                    Saved Notes ({workspace.savedNotes.length})
                  </div>
                  {workspace.savedNotes.map((n) => (
                    <div key={n.id} className="muse-panel p-3 text-xs space-y-0.5">
                      <div className="flex justify-between gap-2 font-semibold">
                        <span>{n.title}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">{n.updatedAt.slice(0, 10)}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">{n.content}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="muse-card p-5 space-y-4">
                <div>
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>Videos Watched, Visuals, Guides &amp; Badges</span>
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Complete media, offline lessons ({workspace.offlineLessonIds.length} ready), saved guide channels, and unlocked milestones.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="muse-panel p-3">
                    <div className="text-[var(--text-muted)]">Videos Watched</div>
                    <div className="font-bold mt-0.5">{watchedVideos.length} watched</div>
                    {watchedVideos.slice(0, 2).map((v) => (
                      <div key={v.id} className="text-[11px] text-blue-400 truncate mt-0.5">
                        • {v.title}
                      </div>
                    ))}
                  </div>
                  <div className="muse-panel p-3">
                    <div className="text-[var(--text-muted)]">Visuals &amp; Diagrams</div>
                    <div className="font-bold mt-0.5">
                      {studiedImages.length} studied • {workspace.generatedVisuals.length} created
                    </div>
                    {workspace.generatedVisuals.slice(0, 2).map((vis) => (
                      <div key={vis.id} className="text-[11px] text-purple-400 truncate mt-0.5">
                        • {vis.title}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-teal-400">
                    Saved Guide Links ({workspace.savedGuideLinks.length})
                  </div>
                  {workspace.savedGuideLinks.slice(0, 4).map((gl) => (
                    <div key={gl.id} className="muse-panel p-2.5 text-xs flex justify-between gap-2">
                      <span className="truncate font-medium">{gl.title}</span>
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                        Class {gl.classLevel} • {gl.channelName}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Achievements &amp; Milestones
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {achievements.map((b) => (
                      <div
                        key={b.key}
                        className={`p-2.5 rounded-xl border text-[11px] ${
                          b.unlocked
                            ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        <div className="font-bold">{b.title}</div>
                        <div>{b.unlocked ? 'Unlocked' : b.progressLabel}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};



/* ---------------- ADMIN PANEL ---------------- */
export const AdminPanelView: React.FC<{
  workspace: MuseWorkspaceState;
  onAddLesson: (lesson: LessonItem) => void;
  onSwitchDemoRole: (role: UserRole) => void;
}> = ({ workspace, onAddLesson, onSwitchDemoRole }) => {
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState<EducationBoard>('CBSE');
  const [classLevel, setClassLevel] = useState(7);
  const [subject, setSubject] = useState('Science');
  const [chapter, setChapter] = useState('');
  const [summary, setSummary] = useState('');

  // Education Hub Admin state
  const [edContentLoading, setEdContentLoading] = useState(false);
  const [edNotice, setEdNotice] = useState<string | null>(null);
  const [edError, setEdError] = useState<string | null>(null);
  const [approvedChannels, setApprovedChannels] = useState<ApprovedChannelEntry[]>([]);
  const [curatedVideos, setCuratedVideos] = useState<EducationVideoItem[]>([]);
  const [curatedPlaylists, setCuratedPlaylists] = useState<EducationPlaylistItem[]>([]);
  const [blockedVideoIds, setBlockedVideoIds] = useState<string[]>([]);
  const [reports, setReports] = useState<EducationContentReport[]>([]);
  const [telemetry, setTelemetry] = useState<{
    youtubeConfigured: boolean;
    quotaUsedToday: number;
    quotaDate: string;
    cacheEntries: number;
    lastApiError: string | null;
  } | null>(null);

  // Admin forms
  const [vidUrl, setVidUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');
  const [vidBoard, setVidBoard] = useState('CBSE');
  const [vidClass, setVidClass] = useState(7);
  const [vidSubject, setVidSubject] = useState('Science');
  const [vidChapter, setVidChapter] = useState('');
  const [vidLang, setVidLang] = useState('English');
  const [vidFeatured, setVidFeatured] = useState(true);

  const [plUrl, setPlUrl] = useState('');
  const [plTitle, setPlTitle] = useState('');

  const [chTitle, setChTitle] = useState('');
  const [chHandle, setChHandle] = useState('');
  const [chGovt, setChGovt] = useState(false);

  const [blockInput, setBlockInput] = useState('');

  const [customKind, setCustomKind] = useState<'board' | 'subject' | 'language'>('subject');
  const [customValue, setCustomValue] = useState('');
  const [customNative, setCustomNative] = useState('');

  const loadAdminEducationState = async () => {
    setEdContentLoading(true);
    try {
      const resp = await authFetch('/api/admin/education/content');
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setEdError(err.error || 'Administrator privileges with verified email are required.');
        return;
      }
      const data = await resp.json();
      setApprovedChannels(data.approvedChannels || []);
      setCuratedVideos(data.curatedVideos || []);
      setCuratedPlaylists(data.curatedPlaylists || []);
      setBlockedVideoIds(data.blockedVideoIds || []);
      setReports(data.reports || []);
      setTelemetry(data.telemetry || null);
    } catch {
      // ignore transient load failure
    } finally {
      setEdContentLoading(false);
    }
  };

  useEffect(() => {
    loadAdminEducationState();
  }, []);

  const postAdminAction = async (kind: string, payload: Record<string, unknown>, successMsg: string) => {
    setEdError(null);
    setEdNotice(null);
    try {
      const resp = await authFetch('/api/admin/education/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setEdError(data.error || 'Admin update failed.');
        return false;
      }
      setEdNotice(successMsg);
      await loadAdminEducationState();
      return true;
    } catch {
      setEdError('Network error communicating with server.');
      return false;
    }
  };

  const handleReportDecision = async (reportId: string, status: 'removed' | 'dismissed') => {
    setEdError(null);
    const resp = await authFetch(`/api/admin/education/content/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (resp.ok) {
      setEdNotice(status === 'removed' ? 'Video blocked and removed from results.' : 'Report dismissed.');
      await loadAdminEducationState();
    } else {
      const err = await resp.json().catch(() => ({}));
      setEdError(err.error || 'Admin permission required.');
    }
  };

  const handleUnblockVideo = async (videoId: string) => {
    const resp = await authFetch(`/api/admin/education/content/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unblock: true }),
    });
    if (resp.ok) {
      setEdNotice(`Unblocked video ${videoId}.`);
      await loadAdminEducationState();
    } else {
      const err = await resp.json().catch(() => ({}));
      setEdError(err.error || 'Admin permission required.');
    }
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || summary.trim().length < 10) return;
    onAddLesson({
      id: `lesson_admin_${Date.now()}`,
      board,
      classLevel,
      subject,
      chapter: chapter.trim() || 'Core Chapter',
      topic: title.trim(),
      title: title.trim(),
      language: 'English',
      introduction: summary.trim(),
      objectives: ['Master core concepts introduced in this unit.'],
      explanation: [summary.trim()],
      definitions: [],
      examples: [],
      diagramType: 'grammar',
      keyPoints: [summary.trim()],
      summary: summary.trim(),
      practiceExercises: ['Discuss this topic with Muse AI Teacher.'],
      relatedTopics: [],
      isSampleContent: true,
      durationMinutes: 15,
    });
    setTitle('');
    setChapter('');
    setSummary('');
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Administration Panel
          </div>
          <h1 className="font-display font-bold text-xl">Curriculum, Role & Audit Controls</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manage boards, classes, lessons, curated Education Hub videos, moderation reports, and audit logs.
          </p>
        </div>
        {workspace.authMode === 'demo' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Demo Role:</span>
            {(['student', 'parent', 'admin'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSwitchDemoRole(r)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize ${
                  workspace.profile?.role === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Platform Analytics */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Curriculum Lessons</div>
          <div className="font-display text-2xl font-bold mt-1">{workspace.lessons.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Question Bank Items</div>
          <div className="font-display text-2xl font-bold mt-1">{workspace.questions.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Curated Hub Videos</div>
          <div className="font-display text-2xl font-bold mt-1">{curatedVideos.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Open Moderation Reports</div>
          <div className="font-display text-2xl font-bold mt-1">
            {reports.filter((r) => r.status === 'open').length}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <form onSubmit={handleAddLesson} className="lg:col-span-5 muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base">Add Curriculum Lesson</h2>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson title..."
            aria-label="Admin lesson title"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Admin lesson board"
              value={board}
              onChange={(e) => setBoard(e.target.value as EducationBoard)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              aria-label="Admin lesson class"
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value))}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select
              aria-label="Admin lesson subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Chapter name..."
            aria-label="Admin lesson chapter"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Lesson explanation & summary (min 10 characters)..."
            aria-label="Admin lesson summary"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
            Publish Lesson to Academy
          </button>
        </form>

        <div className="lg:col-span-7 muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Audit Logs &amp; Security Controls
          </h2>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {workspace.auditLogs.slice().reverse().map((log) => (
              <div key={log.id} className="muse-panel p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold">{log.action}</div>
                  <div className="text-[var(--text-muted)]">
                    {log.actorName} • {log.targetPath}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-[var(--accent-emerald)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Firestore Rules v2, PII Isolation, Role Escalation Guard &amp; AI Safety Filters Active.</span>
          </div>
        </div>
      </div>

      {/* EDUCATION HUB ADMIN MANAGEMENT */}
      <section aria-label="Education Hub Management" className="muse-card p-5 space-y-5 border border-blue-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Education Hub Management &amp; YouTube API Monitor
            </div>
            <h2 className="font-display font-bold text-lg">
              Curated Videos, Playlists, Approved Channels &amp; Moderation
            </h2>
          </div>
          <button
            type="button"
            onClick={loadAdminEducationState}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${edContentLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {telemetry && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">YouTube Data API v3</div>
              <div className={`font-bold mt-0.5 ${telemetry.youtubeConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {telemetry.youtubeConfigured ? 'Configured (Server Secret)' : 'Not Configured Yet'}
              </div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Daily Quota Used</div>
              <div className="font-bold mt-0.5 tabular-nums">{telemetry.quotaUsedToday} units ({telemetry.quotaDate})</div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Cached Queries</div>
              <div className="font-bold mt-0.5 tabular-nums">{telemetry.cacheEntries} active</div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Blocked Videos</div>
              <div className="font-bold mt-0.5 tabular-nums">{blockedVideoIds.length} blocked</div>
            </div>
          </div>
        )}

        {edNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
            {edNotice}
          </div>
        )}
        {edError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-300">
            {edError}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Add Verified YouTube Video */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await postAdminAction(
                'video',
                {
                  urlOrId: vidUrl,
                  title: vidTitle,
                  board: vidBoard,
                  classLevel: vidClass,
                  subject: vidSubject,
                  chapter: vidChapter,
                  language: vidLang,
                  isFeatured: vidFeatured,
                },
                'Verified YouTube video added to Education Hub!'
              );
              if (ok) {
                setVidUrl('');
                setVidTitle('');
                setVidChapter('');
              }
            }}
            className="muse-panel p-4 space-y-3"
          >
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-400" /> Add Curated YouTube Video
            </h3>
            <input
              type="text"
              value={vidUrl}
              onChange={(e) => setVidUrl(e.target.value)}
              placeholder="YouTube Video URL or 11-char ID (e.g. https://www.youtube.com/watch?v=...)"
              aria-label="YouTube video URL or ID"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
            />
            <input
              type="text"
              value={vidTitle}
              onChange={(e) => setVidTitle(e.target.value)}
              placeholder="Lesson title..."
              aria-label="Curated video title"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                aria-label="Curated video board"
                value={vidBoard}
                onChange={(e) => setVidBoard(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                aria-label="Curated video class"
                value={vidClass}
                onChange={(e) => setVidClass(Number(e.target.value))}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select
                aria-label="Curated video subject"
                value={vidSubject}
                onChange={(e) => setVidSubject(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                aria-label="Curated video language"
                value={vidLang}
                onChange={(e) => setVidLang(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={vidChapter}
                onChange={(e) => setVidChapter(e.target.value)}
                placeholder="Chapter (optional)"
                aria-label="Curated video chapter"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={vidFeatured}
                  onChange={(e) => setVidFeatured(e.target.checked)}
                />
                <span>Featured</span>
              </label>
              <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
                Add Video
              </button>
            </div>
          </form>

          {/* Add Playlist & Approve Channel & Block Video */}
          <div className="space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'playlist',
                  {
                    urlOrId: plUrl,
                    title: plTitle,
                    board: vidBoard,
                    classLevel: vidClass,
                    subject: vidSubject,
                    language: vidLang,
                  },
                  'Curated YouTube playlist added!'
                );
                if (ok) {
                  setPlUrl('');
                  setPlTitle('');
                }
              }}
              className="muse-panel p-4 space-y-2.5"
            >
              <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
                <ListVideo className="w-4 h-4 text-purple-400" /> Add Curated YouTube Playlist
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={plUrl}
                  onChange={(e) => setPlUrl(e.target.value)}
                  placeholder="Playlist URL or PL... ID"
                  aria-label="YouTube playlist URL or ID"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
                <input
                  type="text"
                  value={plTitle}
                  onChange={(e) => setPlTitle(e.target.value)}
                  placeholder="Playlist title..."
                  aria-label="Playlist title"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <button type="submit" className="px-3.5 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary">
                Add Playlist ({vidBoard} Cl {vidClass} {vidSubject})
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'channel',
                  {
                    channelTitle: chTitle,
                    handle: chHandle,
                    boards: [vidBoard],
                    languages: [vidLang],
                    subjects: [vidSubject],
                    officialGovernment: chGovt,
                  },
                  'Educator channel approved!'
                );
                if (ok) {
                  setChTitle('');
                  setChHandle('');
                }
              }}
              className="muse-panel p-4 space-y-2.5"
            >
              <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" /> Approve Trusted Channel ({approvedChannels.length})
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  placeholder="Channel name (e.g. SCERT Odisha)"
                  aria-label="Approved channel name"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
                <input
                  type="text"
                  value={chHandle}
                  onChange={(e) => setChHandle(e.target.value)}
                  placeholder="@handle (optional)"
                  aria-label="Channel handle"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={chGovt}
                    onChange={(e) => setChGovt(e.target.checked)}
                  />
                  <span>Official Government Channel</span>
                </label>
                <button type="submit" className="px-3.5 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary">
                  Approve Channel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Custom Board / Subject / Language + Moderation Queue */}
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="muse-panel p-4 space-y-3">
            <h3 className="font-display font-bold text-sm">
              Extend Boards, Subjects &amp; Languages
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!customValue.trim()) return;
                const payload =
                  customKind === 'board'
                    ? { name: customValue.trim() }
                    : customKind === 'subject'
                      ? { subject: customValue.trim(), board: vidBoard, classLevel: vidClass }
                      : { name: customValue.trim(), nativeLabel: customNative.trim() || customValue.trim() };
                const ok = await postAdminAction(
                  customKind,
                  payload,
                  `Added custom ${customKind}: ${customValue.trim()}`
                );
                if (ok) {
                  setCustomValue('');
                  setCustomNative('');
                }
              }}
              className="flex flex-wrap gap-2"
            >
              <select
                aria-label="Custom metadata kind"
                value={customKind}
                onChange={(e) => setCustomKind(e.target.value as 'board' | 'subject' | 'language')}
                className="px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="subject">Subject ({vidBoard} Cl {vidClass})</option>
                <option value="board">Board</option>
                <option value="language">Language</option>
              </select>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={`Enter ${customKind} name...`}
                aria-label="Custom metadata value"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              {customKind === 'language' && (
                <input
                  type="text"
                  value={customNative}
                  onChange={(e) => setCustomNative(e.target.value)}
                  placeholder="Native script"
                  aria-label="Language native script"
                  className="w-28 px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              )}
              <button type="submit" className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
                Add
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'block_video',
                  { videoId: blockInput },
                  'Video blocked from Education Hub results.'
                );
                if (ok) setBlockInput('');
              }}
              className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]"
            >
              <input
                type="text"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="Block YouTube URL or Video ID..."
                aria-label="Block YouTube video ID"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Block Video
              </button>
            </form>

            {blockedVideoIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {blockedVideoIds.map((bid) => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => handleUnblockVideo(bid)}
                    className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  >
                    Blocked: {bid} (Unblock)
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student Reports Moderation Queue */}
          <div className="muse-panel p-4 space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-rose-400" /> Reported Videos Moderation Queue ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No reported videos awaiting review. Curated playlists: {curatedPlaylists.length}.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {reports.map((rep) => (
                  <div key={rep.id} className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">{rep.videoTitle} ({rep.videoId})</span>
                      <span className="uppercase text-[10px] font-bold text-amber-400">{rep.status}</span>
                    </div>
                    <div className="text-[var(--text-muted)]">Reason: {rep.reason}</div>
                    {rep.status === 'open' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'removed')}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold"
                        >
                          Remove &amp; Block Video
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'dismissed')}
                          className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
