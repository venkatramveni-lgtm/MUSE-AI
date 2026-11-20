import type { MuseWorkspaceState } from '../services/workspaceStore';
import {
  computeSubjectProgress,
  detectWeakTopics,
  evaluateAchievements,
} from './academicEngine';

export type ParentActivityCategory =
  | 'lesson'
  | 'quiz'
  | 'planner'
  | 'assignment'
  | 'note'
  | 'ai_session'
  | 'visual'
  | 'guide';

export interface ParentActivityEntry {
  id: string;
  dateKey: string;
  timestamp: string;
  category: ParentActivityCategory;
  title: string;
  detail: string;
  subject?: string;
  statusLabel: string;
}

export interface ParentDailyDigest {
  dateKey: string;
  lessonsCompleted: number;
  lessonsStudied: number;
  quizzesTaken: number;
  averageQuizPercentage: number | null;
  tasksCompleted: number;
  tasksScheduledTotal: number;
  assignmentsSubmitted: number;
  notesSaved: number;
  aiSessionsActive: number;
  visualsCreated: number;
  guidesSaved: number;
  totalActions: number;
  entries: ParentActivityEntry[];
  headlineSummary: string;
}

export interface ParentDayGroup {
  dateKey: string;
  entries: ParentActivityEntry[];
  completedCount: number;
}

export function extractDateKey(isoOrDate?: string | null): string {
  if (!isoOrDate || typeof isoOrDate !== 'string') return '';
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return '';
}

export function getTodayDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildParentDailyActivityFeed(
  workspace: MuseWorkspaceState
): ParentActivityEntry[] {
  const entries: ParentActivityEntry[] = [];
  const lessonMap = new Map(workspace.lessons.map((l) => [l.id, l]));
  const assignmentMap = new Map(workspace.assignments.map((a) => [a.id, a]));

  for (const p of workspace.progress) {
    const dateKey = extractDateKey(p.lastStudiedAt);
    if (!dateKey) continue;
    const lesson = lessonMap.get(p.lessonId);
    entries.push({
      id: `act_prog_${p.lessonId}_${dateKey}`,
      dateKey,
      timestamp: p.lastStudiedAt,
      category: 'lesson',
      title: lesson?.title || `Lesson ${p.lessonId}`,
      detail: lesson
        ? `${lesson.board} Class ${lesson.classLevel} • ${lesson.chapter}`
        : `Subject: ${p.subject}`,
      subject: p.subject,
      statusLabel: p.completed ? 'Completed' : p.bookmarked ? 'Bookmarked' : 'Studied',
    });
  }

  for (const attempt of workspace.attempts) {
    const dateKey = extractDateKey(attempt.submittedAt);
    if (!dateKey) continue;
    const modeLabel =
      attempt.mode === 'weekly_test'
        ? 'Weekly Test'
        : attempt.mode === 'practice'
          ? 'Practice Set'
          : 'Daily Quiz';
    entries.push({
      id: `act_quiz_${attempt.id}`,
      dateKey,
      timestamp: attempt.submittedAt,
      category: 'quiz',
      title: `${modeLabel}: ${attempt.assessmentTitle}`,
      detail: `Scored ${attempt.score}/${attempt.total} (${attempt.percentage}%) in ${attempt.subject}`,
      subject: attempt.subject,
      statusLabel: `${attempt.percentage}% (${attempt.score}/${attempt.total})`,
    });
  }

  for (const task of workspace.studyPlans) {
    const updatedKey = extractDateKey(task.updatedAt);
    const createdKey = extractDateKey(task.createdAt);
    const dateKey = task.completed
      ? updatedKey || task.scheduledDate || createdKey
      : task.scheduledDate || updatedKey || createdKey;
    if (!dateKey) continue;
    entries.push({
      id: `act_plan_${task.id}`,
      dateKey,
      timestamp: task.updatedAt || `${dateKey}T${task.scheduledTime || '09:00'}:00.000Z`,
      category: 'planner',
      title: task.title,
      detail: `Scheduled ${task.scheduledDate}${task.scheduledTime ? ` at ${task.scheduledTime}` : ''} • ${task.taskType} (${task.priority} priority)`,
      subject: task.subject,
      statusLabel: task.completed ? 'Completed' : 'Scheduled',
    });
  }

  for (const sub of workspace.submissions) {
    const dateKey = extractDateKey(sub.submittedAt);
    if (!dateKey) continue;
    const asgn = assignmentMap.get(sub.assignmentId);
    entries.push({
      id: `act_sub_${sub.id}`,
      dateKey,
      timestamp: sub.submittedAt,
      category: 'assignment',
      title: asgn ? asgn.title : `Assignment ${sub.assignmentId}`,
      detail: sub.content.slice(0, 120) + (sub.content.length > 120 ? '...' : ''),
      subject: asgn?.subject,
      statusLabel: sub.grade ? `${sub.status} (${sub.grade})` : sub.status,
    });
  }

  for (const note of workspace.savedNotes) {
    const dateKey = extractDateKey(note.updatedAt);
    if (!dateKey) continue;
    entries.push({
      id: `act_note_${note.id}`,
      dateKey,
      timestamp: note.updatedAt,
      category: 'note',
      title: `Note: ${note.title}`,
      detail: note.content.slice(0, 110) + (note.content.length > 110 ? '...' : ''),
      subject: note.subject,
      statusLabel: 'Saved Note',
    });
  }

  for (const thread of workspace.conversations) {
    const dateKey = extractDateKey(thread.updatedAt);
    if (!dateKey) continue;
    const msgCount = thread.messages.length;
    entries.push({
      id: `act_ai_${thread.id}`,
      dateKey,
      timestamp: thread.updatedAt,
      category: 'ai_session',
      title: `AI Assistant: ${thread.title}`,
      detail: `${msgCount} message${msgCount === 1 ? '' : 's'} discussed in ${thread.subject}`,
      subject: thread.subject,
      statusLabel: `${msgCount} msgs`,
    });
  }

  for (const vis of workspace.generatedVisuals) {
    const dateKey = extractDateKey(vis.createdAt);
    if (!dateKey) continue;
    entries.push({
      id: `act_vis_${vis.id}`,
      dateKey,
      timestamp: vis.createdAt,
      category: 'visual',
      title: `Visual Diagram: ${vis.title}`,
      detail: `${vis.subject} • ${vis.topic}`,
      subject: vis.subject,
      statusLabel: 'Generated',
    });
  }

  for (const gl of workspace.savedGuideLinks) {
    const dateKey = extractDateKey(gl.createdAt);
    if (!dateKey) continue;
    entries.push({
      id: `act_guide_${gl.id}`,
      dateKey,
      timestamp: gl.createdAt,
      category: 'guide',
      title: `Saved Guide: ${gl.title}`,
      detail: `Class ${gl.classLevel} • ${gl.subject} • ${gl.channelName}`,
      subject: gl.subject,
      statusLabel: 'Guide Link',
    });
  }

  return entries.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
  });
}

export function buildParentDailyDigest(
  workspace: MuseWorkspaceState,
  targetDateKey: string
): ParentDailyDigest {
  const allEntries = buildParentDailyActivityFeed(workspace);
  const dayEntries = allEntries.filter((e) => e.dateKey === targetDateKey);

  const lessonsCompleted = workspace.progress.filter(
    (p) => p.completed && extractDateKey(p.lastStudiedAt) === targetDateKey
  ).length;
  const lessonsStudied = workspace.progress.filter(
    (p) => extractDateKey(p.lastStudiedAt) === targetDateKey
  ).length;

  const dayAttempts = workspace.attempts.filter(
    (a) => extractDateKey(a.submittedAt) === targetDateKey
  );
  const quizzesTaken = dayAttempts.length;
  const averageQuizPercentage =
    quizzesTaken > 0
      ? Math.round(dayAttempts.reduce((acc, a) => acc + a.percentage, 0) / quizzesTaken)
      : null;

  const scheduledForDay = workspace.studyPlans.filter(
    (t) =>
      t.scheduledDate === targetDateKey ||
      (t.completed && extractDateKey(t.updatedAt) === targetDateKey)
  );
  const tasksCompleted = scheduledForDay.filter((t) => t.completed).length;
  const tasksScheduledTotal = scheduledForDay.length;

  const assignmentsSubmitted = dayEntries.filter((e) => e.category === 'assignment').length;
  const notesSaved = dayEntries.filter((e) => e.category === 'note').length;
  const aiSessionsActive = dayEntries.filter((e) => e.category === 'ai_session').length;
  const visualsCreated = dayEntries.filter((e) => e.category === 'visual').length;
  const guidesSaved = dayEntries.filter((e) => e.category === 'guide').length;

  const parts: string[] = [];
  if (lessonsCompleted > 0) parts.push(`${lessonsCompleted} lesson${lessonsCompleted === 1 ? '' : 's'} completed`);
  if (quizzesTaken > 0) {
    parts.push(
      `${quizzesTaken} quiz${quizzesTaken === 1 ? '' : 'zes'} taken${averageQuizPercentage !== null ? ` (${averageQuizPercentage}% avg)` : ''}`
    );
  }
  if (tasksCompleted > 0) parts.push(`${tasksCompleted} planner task${tasksCompleted === 1 ? '' : 's'} done`);
  if (assignmentsSubmitted > 0) parts.push(`${assignmentsSubmitted} assignment${assignmentsSubmitted === 1 ? '' : 's'} submitted`);
  if (notesSaved > 0) parts.push(`${notesSaved} note${notesSaved === 1 ? '' : 's'} saved`);
  if (aiSessionsActive > 0) parts.push(`${aiSessionsActive} AI study session${aiSessionsActive === 1 ? '' : 's'}`);
  if (visualsCreated > 0) parts.push(`${visualsCreated} visual${visualsCreated === 1 ? '' : 's'} generated`);
  if (guidesSaved > 0) parts.push(`${guidesSaved} guide link${guidesSaved === 1 ? '' : 's'} saved`);

  const headlineSummary =
    parts.length > 0
      ? `On ${targetDateKey}: ${parts.join(', ')}.`
      : `No completed learning actions recorded on ${targetDateKey} yet.`;

  return {
    dateKey: targetDateKey,
    lessonsCompleted,
    lessonsStudied,
    quizzesTaken,
    averageQuizPercentage,
    tasksCompleted,
    tasksScheduledTotal,
    assignmentsSubmitted,
    notesSaved,
    aiSessionsActive,
    visualsCreated,
    guidesSaved,
    totalActions: dayEntries.length,
    entries: dayEntries,
    headlineSummary,
  };
}

export function groupActivitiesByDay(
  entries: ParentActivityEntry[]
): ParentDayGroup[] {
  const map = new Map<string, ParentActivityEntry[]>();
  for (const entry of entries) {
    const existing = map.get(entry.dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.dateKey, [entry]);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayEntries]) => ({
      dateKey,
      entries: dayEntries,
      completedCount: dayEntries.filter((e) => e.statusLabel !== 'Scheduled').length,
    }));
}

export function buildComprehensiveParentReportText(
  workspace: MuseWorkspaceState,
  todayKey: string = getTodayDateKey()
): string {
  const profile = workspace.profile;
  const activeLink = workspace.parentLinks[0];
  const digest = buildParentDailyDigest(workspace, todayKey);
  const allEntries = buildParentDailyActivityFeed(workspace);
  const dayGroups = groupActivitiesByDay(allEntries);
  const subjectProgress = computeSubjectProgress(
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
    studyStreak: profile?.studyStreak ?? 0,
    completedStudyTasks: completedTasksCount,
  }).filter((b) => b.unlocked);

  const lines: string[] = [
    `NANO AI — PARENT & GUARDIAN COMPLETE DAILY REPORT`,
    `Generated Date: ${todayKey}`,
    `Student: ${activeLink?.studentDisplayName || profile?.displayName || 'Student'}`,
    `Class & Board: Class ${profile?.classLevel ?? 7} (${profile?.board ?? 'CBSE'}) • Language: ${profile?.preferredLanguage ?? 'English'}`,
    `Academic Goal: ${profile?.academicGoal ?? 'Build strong concept clarity'}`,
    `Guardian Consent: ${activeLink?.consentGranted ? 'Active' : 'Paused'}`,
    ``,
    `--- TODAY'S SUMMARY (${todayKey}) ---`,
    digest.headlineSummary,
    `• Lessons Completed Today: ${digest.lessonsCompleted} (${digest.lessonsStudied} studied)`,
    `• Quizzes/Tests Today: ${digest.quizzesTaken}${digest.averageQuizPercentage !== null ? ` (Avg ${digest.averageQuizPercentage}%)` : ''}`,
    `• Planner Tasks Done Today: ${digest.tasksCompleted}/${digest.tasksScheduledTotal}`,
    `• Assignments Submitted Today: ${digest.assignmentsSubmitted}`,
    `• Notes Saved Today: ${digest.notesSaved} • AI Study Sessions Today: ${digest.aiSessionsActive}`,
    ``,
    `--- OVERALL ACTIVITY SNAPSHOT ---`,
    `• Total Lessons Completed: ${completedLessonsCount}/${workspace.lessons.length}`,
    `• Study Streak: ${profile?.studyStreak ?? 0} days`,
    `• Total Quizzes & Tests Taken: ${workspace.attempts.length}`,
    `• Videos Watched: ${workspace.watchedVideoIds.length} • Images Studied: ${workspace.studiedImageIds.length}`,
    `• Saved Notes: ${workspace.savedNotes.length} • Offline Lessons Ready: ${workspace.offlineLessonIds.length}`,
    `• Unlocked Badges (${badges.length}): ${badges.map((b) => b.title).join(', ') || 'None yet'}`,
    ``,
    `--- SUBJECT PROGRESS ---`,
    ...subjectProgress.map(
      (s) =>
        `• ${s.subject}: ${s.completedLessons}/${s.totalLessons} lessons (${s.lessonPercentage}%) | Quiz Avg: ${
          s.averageQuizScore !== null ? `${s.averageQuizScore}%` : 'No quiz yet'
        }`
    ),
    ``,
    `--- TOPICS NEEDING EXTRA PRACTICE ---`,
    ...(weakTopics.slice(0, 5).length > 0
      ? weakTopics.slice(0, 5).map((w) => `• ${w.topic} (${w.subject}): ${w.accuracy}% accuracy`)
      : ['• No weak topics flagged yet.']),
    ``,
    `--- DAY-BY-DAY ACTIVITY LOG (WHAT WAS DONE EVERY DAY) ---`,
    ...(dayGroups.length > 0
      ? dayGroups.flatMap((g) => [
          `[${g.dateKey}] (${g.entries.length} activities)`,
          ...g.entries.map((e) => `  - [${e.category.toUpperCase()}] ${e.title} — ${e.statusLabel} (${e.detail})`),
        ])
      : ['• No dated activity recorded yet.']),
  ];

  return lines.join('\n');
}
