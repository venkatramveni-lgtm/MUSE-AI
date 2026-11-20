import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, createInitialWorkspaceState } from '../services/workspaceStore';
import {
  buildComprehensiveParentReportText,
  buildParentDailyActivityFeed,
  buildParentDailyDigest,
  extractDateKey,
  groupActivitiesByDay,
} from './parentPortalUtils';

test('extractDateKey parses ISO timestamps and plain dates cleanly', () => {
  assert.equal(extractDateKey('2026-11-18T08:15:00.000Z'), '2026-11-18');
  assert.equal(extractDateKey('2026-11-17'), '2026-11-17');
  assert.equal(extractDateKey(''), '');
  assert.equal(extractDateKey(undefined), '');
});

test('buildParentDailyDigest & groupActivitiesByDay summarize daily student work across all categories', () => {
  const ws = createInitialWorkspaceState('demo');
  ws.profile = createDefaultProfile({
    uid: 'stu_parent_test',
    displayName: 'Aarav',
    classLevel: 9,
    onboardingComplete: true,
  });

  ws.progress = [
    {
      lessonId: ws.lessons[0].id,
      subject: ws.lessons[0].subject,
      completed: true,
      bookmarked: true,
      lastStudiedAt: '2026-11-18T09:00:00.000Z',
    },
  ];
  ws.attempts = [
    {
      id: 'att_today',
      uid: 'stu_parent_test',
      assessmentId: 'daily_c9',
      assessmentTitle: 'Class 9 Physics Daily Quiz',
      mode: 'daily_quiz',
      subject: 'Physics',
      score: 4,
      total: 5,
      percentage: 80,
      results: [],
      status: 'submitted',
      submittedAt: '2026-11-18T10:30:00.000Z',
    },
    {
      id: 'att_yesterday',
      uid: 'stu_parent_test',
      assessmentId: 'weekly_c9',
      assessmentTitle: 'Class 9 Maths Weekly Test',
      mode: 'weekly_test',
      subject: 'Mathematics',
      score: 5,
      total: 5,
      percentage: 100,
      results: [],
      status: 'submitted',
      submittedAt: '2026-11-17T16:00:00.000Z',
    },
  ];
  ws.studyPlans = [
    {
      id: 'plan_today_done',
      uid: 'stu_parent_test',
      title: 'Revise Newton Second Law',
      subject: 'Physics',
      scheduledDate: '2026-11-18',
      scheduledTime: '17:00',
      taskType: 'lesson',
      priority: 'high',
      recurrence: 'none',
      completed: true,
      reminderEnabled: true,
      createdAt: '2026-11-18T07:00:00.000Z',
      updatedAt: '2026-11-18T11:00:00.000Z',
    },
  ];
  ws.savedNotes = [
    {
      id: 'note_today',
      subject: 'Biology',
      title: 'Mitochondria Key Points',
      content: 'Powerhouse of the cell generating ATP.',
      updatedAt: '2026-11-18T12:00:00.000Z',
    },
  ];

  const todayDigest = buildParentDailyDigest(ws, '2026-11-18');
  assert.equal(todayDigest.lessonsCompleted, 1);
  assert.equal(todayDigest.quizzesTaken, 1);
  assert.equal(todayDigest.averageQuizPercentage, 80);
  assert.equal(todayDigest.tasksCompleted, 1);
  assert.equal(todayDigest.notesSaved, 1);
  assert.match(todayDigest.headlineSummary, /1 lesson completed/);
  assert.match(todayDigest.headlineSummary, /1 quiz taken \(80% avg\)/);

  const feed = buildParentDailyActivityFeed(ws);
  const grouped = groupActivitiesByDay(feed);
  assert.ok(grouped.length >= 2);
  assert.equal(grouped[0].dateKey, '2026-11-18');
  assert.ok(grouped.some((g) => g.dateKey === '2026-11-17'));

  const report = buildComprehensiveParentReportText(ws, '2026-11-18');
  assert.match(report, /NANO AI — PARENT & GUARDIAN COMPLETE DAILY REPORT/);
  assert.match(report, /TODAY'S SUMMARY \(2026-11-18\)/);
  assert.match(report, /DAY-BY-DAY ACTIVITY LOG/);
  assert.match(report, /Class 9 Physics Daily Quiz/);
});
