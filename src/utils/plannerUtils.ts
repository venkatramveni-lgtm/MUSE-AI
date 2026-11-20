import { AssignmentItem, LearningProgress, LessonItem, StudyPlanTask, TaskPriority } from '../types/muse';
import { TopicWeakness } from './academicEngine';
import { MuseWorkspaceState } from '../services/workspaceStore';

export interface CalendarDayCell {
  dateStr: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function getWeekDates(anchorDateStr: string): string[] {
  const anchor = parseIsoDate(anchorDateStr);
  const day = anchor.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + mondayOffset);
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    days.push(formatIsoDate(cur));
  }
  return days;
}

export function buildCalendarMonthGrid(year: number, monthIndex: number, todayStr = formatIsoDate(new Date())): CalendarDayCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0 = Sun
  const leadDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Monday start
  const gridStart = new Date(year, monthIndex, 1 - leadDays);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const cur = new Date(gridStart);
    cur.setDate(gridStart.getDate() + i);
    const dateStr = formatIsoDate(cur);
    cells.push({
      dateStr,
      dayOfMonth: cur.getDate(),
      inCurrentMonth: cur.getMonth() === monthIndex && cur.getFullYear() === year,
      isToday: dateStr === todayStr,
    });
  }
  return cells;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortTasksByPriorityAndTime(tasks: StudyPlanTask[]): StudyPlanTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pA = PRIORITY_RANK[a.priority || 'medium'];
    const pB = PRIORITY_RANK[b.priority || 'medium'];
    if (pA !== pB) return pA - pB;
    const dateCmp = a.scheduledDate.localeCompare(b.scheduledDate);
    if (dateCmp !== 0) return dateCmp;
    return (a.scheduledTime || '23:59').localeCompare(b.scheduledTime || '23:59');
  });
}

export function buildNextRecurringTask(task: StudyPlanTask): StudyPlanTask | null {
  if (!task.recurrence || task.recurrence === 'none') return null;
  const baseDate = parseIsoDate(task.scheduledDate);
  baseDate.setDate(baseDate.getDate() + (task.recurrence === 'daily' ? 1 : 7));
  const nextDateStr = formatIsoDate(baseDate);
  const now = new Date().toISOString();
  return {
    ...task,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    scheduledDate: nextDateStr,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export interface SmartTaskSuggestion {
  id: string;
  title: string;
  subject: string;
  taskType: StudyPlanTask['taskType'];
  priority: TaskPriority;
  scheduledDate: string;
  scheduledTime: string;
  reason: string;
}

export function buildSmartTaskSuggestions(params: {
  weakTopics: TopicWeakness[];
  lessons: LessonItem[];
  progress: LearningProgress[];
  assignments: AssignmentItem[];
  existingTasks: StudyPlanTask[];
  todayStr?: string;
}): SmartTaskSuggestion[] {
  const {
    weakTopics,
    lessons,
    progress,
    assignments,
    existingTasks,
    todayStr = formatIsoDate(new Date()),
  } = params;

  const activeTitles = new Set(
    existingTasks.filter((t) => !t.completed).map((t) => t.title.toLowerCase())
  );
  const completedLessonIds = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));
  const suggestions: SmartTaskSuggestion[] = [];

  for (const wt of weakTopics.filter((w) => w.accuracy < 80).slice(0, 2)) {
    const title = `Revise weak topic: ${wt.topic}`;
    if (!activeTitles.has(title.toLowerCase())) {
      suggestions.push({
        id: `sug_weak_${wt.topic}`,
        title,
        subject: wt.subject,
        taskType: 'revision',
        priority: 'high',
        scheduledDate: todayStr,
        scheduledTime: '17:00',
        reason: `${wt.accuracy}% accuracy across ${wt.attemptsCount} attempt(s)`,
      });
    }
  }

  for (const asgn of assignments.slice(0, 2)) {
    const title = `Complete assignment: ${asgn.title}`;
    if (!activeTitles.has(title.toLowerCase())) {
      suggestions.push({
        id: `sug_asgn_${asgn.id}`,
        title,
        subject: asgn.subject,
        taskType: 'assignment',
        priority: 'high',
        scheduledDate: asgn.dueDate || todayStr,
        scheduledTime: '18:00',
        reason: `Due ${asgn.dueDate}`,
      });
    }
  }

  for (const lesson of lessons) {
    if (suggestions.length >= 4) break;
    if (completedLessonIds.has(lesson.id)) continue;
    const title = `Study lesson: ${lesson.title}`;
    if (!activeTitles.has(title.toLowerCase())) {
      suggestions.push({
        id: `sug_lesson_${lesson.id}`,
        title,
        subject: lesson.subject,
        taskType: 'lesson',
        priority: 'medium',
        scheduledDate: todayStr,
        scheduledTime: '19:00',
        reason: `${lesson.subject} • ${lesson.chapter}`,
      });
    }
  }

  return suggestions.slice(0, 4);
}

function escapeIcsText(val: string): string {
  return String(val || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsLocalDateTime(dateStr: string, timeStr?: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const [hh = '17', mm = '00'] = (timeStr || '17:00').split(':');
  return `${cleanDate}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`;
}

export function buildPlannerIcs(tasks: StudyPlanTask[], assignments: AssignmentItem[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Muse AI//Smart Study Planner//EN',
    'CALSCALE:GREGORIAN',
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

  for (const task of tasks) {
    const start = formatIcsLocalDateTime(task.scheduledDate, task.scheduledTime || '17:00');
    const [hRaw = '17', mRaw = '00'] = (task.scheduledTime || '17:00').split(':');
    const endHour = String((Number(hRaw) + 1) % 24).padStart(2, '0');
    const end = `${task.scheduledDate.replace(/-/g, '')}T${endHour}${mRaw.padStart(2, '0')}00`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(task.id)}@muse-ai.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcsText(`[${task.subject}] ${task.title}`)}`,
      `DESCRIPTION:${escapeIcsText(`Type: ${task.taskType} | Priority: ${task.priority || 'medium'}`)}`,
      `STATUS:${task.completed ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  }

  for (const asgn of assignments) {
    if (!asgn.dueDate) continue;
    const dateCompact = asgn.dueDate.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:asgn_${escapeIcsText(asgn.id)}@muse-ai.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateCompact}`,
      `SUMMARY:${escapeIcsText(`Due: ${asgn.title} (${asgn.subject})`)}`,
      `DESCRIPTION:${escapeIcsText(asgn.description)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function getDueReminderTasks(
  tasks: StudyPlanTask[],
  now: Date,
  alreadyTriggeredIds: Set<string>
): StudyPlanTask[] {
  const todayStr = formatIsoDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return tasks.filter((t) => {
    if (t.completed || !t.reminderEnabled) return false;
    if (t.scheduledDate !== todayStr) return false;
    if (alreadyTriggeredIds.has(t.id)) return false;

    const [hhStr, mmStr] = (t.scheduledTime || '').split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return false;
    const taskMinutes = hh * 60 + mm;
    // Trigger if scheduled time is now or up to 120 minutes past due today
    return currentMinutes >= taskMinutes && currentMinutes - taskMinutes <= 120;
  });
}

export const SUPPORTED_DOC_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateDocumentUpload(
  mimeType: string,
  byteSize: number
): { valid: boolean; reason?: string } {
  if (byteSize <= 0) {
    return { valid: false, reason: 'The selected file is empty.' };
  }
  if (byteSize > MAX_UPLOAD_BYTES) {
    return { valid: false, reason: 'File exceeds the 8 MB upload limit.' };
  }
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (!SUPPORTED_DOC_MIME_TYPES.includes(normalized as (typeof SUPPORTED_DOC_MIME_TYPES)[number])) {
    return {
      valid: false,
      reason: 'Unsupported file type. Upload a PDF, PNG, JPG, WEBP, TXT, MD, or CSV document.',
    };
  }
  return { valid: true };
}

export function buildUserDataExportPayload(workspace: MuseWorkspaceState) {
  return {
    exportedAt: new Date().toISOString(),
    app: 'Muse AI',
    profile: workspace.profile,
    studyPlans: workspace.studyPlans,
    savedNotes: workspace.savedNotes,
    progress: workspace.progress,
    attempts: workspace.attempts,
    conversations: workspace.conversations,
    uploadedDocs: workspace.uploadedDocs,
  };
}

