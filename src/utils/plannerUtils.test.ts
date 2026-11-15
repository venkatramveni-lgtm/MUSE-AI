import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarMonthGrid,
  buildNextRecurringTask,
  buildUserDataExportPayload,
  getWeekDates,
  sortTasksByPriorityAndTime,
  validateDocumentUpload,
} from './plannerUtils';
import { createInitialWorkspaceState } from '../services/workspaceStore';
import { StudyPlanTask } from '../types/muse';

test('getWeekDates returns 7 consecutive ISO dates starting Monday', () => {
  // 2026-11-15 is a Sunday
  const week = getWeekDates('2026-11-15');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-09');
  assert.equal(week[6], '2026-11-15');
});

test('buildCalendarMonthGrid builds a 42-cell Monday-aligned month grid', () => {
  const cells = buildCalendarMonthGrid(2026, 10, '2026-11-15'); // November 2026
  assert.equal(cells.length, 42);
  const todayCell = cells.find((c) => c.dateStr === '2026-11-15');
  assert.ok(todayCell);
  assert.equal(todayCell?.isToday, true);
  assert.equal(todayCell?.inCurrentMonth, true);
});

test('sortTasksByPriorityAndTime orders incomplete high-priority tasks before medium/low and completed', () => {
  const base: StudyPlanTask = {
    id: '1',
    uid: 'u1',
    title: 'Task',
    subject: 'Science',
    scheduledDate: '2026-11-15',
    scheduledTime: '18:00',
    taskType: 'lesson',
    priority: 'medium',
    recurrence: 'none',
    completed: false,
    reminderEnabled: false,
    createdAt: '',
    updatedAt: '',
  };
  const sorted = sortTasksByPriorityAndTime([
    { ...base, id: 'done', title: 'Done', priority: 'high', completed: true },
    { ...base, id: 'low', title: 'Low', priority: 'low' },
    { ...base, id: 'high', title: 'High', priority: 'high', scheduledTime: '19:00' },
    { ...base, id: 'med', title: 'Med', priority: 'medium', scheduledTime: '10:00' },
  ]);
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['high', 'med', 'low', 'done']
  );
});

test('buildNextRecurringTask generates next daily or weekly task and returns null for none', () => {
  const base: StudyPlanTask = {
    id: 't1',
    uid: 'u1',
    title: 'Revise Physics',
    subject: 'Science',
    scheduledDate: '2026-11-15',
    scheduledTime: '17:00',
    taskType: 'revision',
    priority: 'high',
    recurrence: 'daily',
    completed: true,
    reminderEnabled: true,
    createdAt: '',
    updatedAt: '',
  };
  const nextDaily = buildNextRecurringTask(base);
  assert.equal(nextDaily?.scheduledDate, '2026-11-16');
  assert.equal(nextDaily?.completed, false);

  const nextWeekly = buildNextRecurringTask({ ...base, recurrence: 'weekly' });
  assert.equal(nextWeekly?.scheduledDate, '2026-11-22');

  assert.equal(buildNextRecurringTask({ ...base, recurrence: 'none' }), null);
});

test('validateDocumentUpload rejects oversized or unsupported MIME types and accepts PDF/image/text', () => {
  assert.equal(validateDocumentUpload('application/pdf', 1024).valid, true);
  assert.equal(validateDocumentUpload('image/png', 2048).valid, true);
  assert.equal(validateDocumentUpload('text/plain', 500).valid, true);
  assert.equal(validateDocumentUpload('application/x-msdownload', 500).valid, false);
  assert.equal(validateDocumentUpload('application/pdf', 12 * 1024 * 1024).valid, false);
  assert.equal(validateDocumentUpload('application/pdf', 0).valid, false);
});

test('buildUserDataExportPayload includes profile, studyPlans, savedNotes, and progress', () => {
  const state = createInitialWorkspaceState('demo');
  const payload = buildUserDataExportPayload(state);
  assert.equal(payload.app, 'Muse AI');
  assert.ok(Array.isArray(payload.studyPlans));
  assert.ok(Array.isArray(payload.savedNotes));
});
