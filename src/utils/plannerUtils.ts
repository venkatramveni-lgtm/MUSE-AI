import { StudyPlanTask, TaskPriority } from '../types/muse';
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
