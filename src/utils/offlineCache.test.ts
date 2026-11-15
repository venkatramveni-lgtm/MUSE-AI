import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_LESSONS } from '../data/curriculumSeed';
import { createDefaultProfile } from '../services/workspaceStore';
import {
  buildOfflineCacheSnapshot,
  filterMyLessons,
  getEssentialLessonIds,
  mergeOfflineProgressAndNotes,
} from './offlineCache';

test('getEssentialLessonIds includes student board/class lessons, progress lessons, and explicit offline lessons', () => {
  const profile = createDefaultProfile({
    board: 'CBSE',
    classLevel: 7,
    subjects: ['Science'],
  });
  const ids = getEssentialLessonIds(
    SAMPLE_LESSONS,
    profile,
    [
      {
        lessonId: SAMPLE_LESSONS[SAMPLE_LESSONS.length - 1].id,
        subject: 'Mathematics',
        completed: false,
        bookmarked: true,
        lastStudiedAt: '2026-11-14T10:00:00.000Z',
      },
    ],
    ['custom_offline_1']
  );

  assert.ok(ids.includes('custom_offline_1'));
  assert.ok(ids.includes(SAMPLE_LESSONS[0].id));
  assert.ok(ids.includes(SAMPLE_LESSONS[SAMPLE_LESSONS.length - 1].id));
});

test('filterMyLessons filters bookmarked, offline_saved, and combined my_lessons accurately', () => {
  const l0 = SAMPLE_LESSONS[0];
  const l1 = SAMPLE_LESSONS[1];
  const l2 = SAMPLE_LESSONS[2];

  const progress = [
    {
      lessonId: l0.id,
      subject: l0.subject,
      completed: true,
      bookmarked: false,
      lastStudiedAt: '2026-11-14T10:00:00.000Z',
    },
    {
      lessonId: l1.id,
      subject: l1.subject,
      completed: false,
      bookmarked: true,
      lastStudiedAt: '2026-11-14T11:00:00.000Z',
    },
  ];

  const myLessons = filterMyLessons([l0, l1, l2], progress, [l2.id], 'my_lessons');
  assert.deepEqual(
    myLessons.map((l) => l.id),
    [l0.id, l1.id, l2.id]
  );

  const bookmarkedOnly = filterMyLessons([l0, l1, l2], progress, [l2.id], 'bookmarked');
  assert.deepEqual(
    bookmarkedOnly.map((l) => l.id),
    [l1.id]
  );

  const offlineOnly = filterMyLessons([l0, l1, l2], progress, [l2.id], 'offline_saved');
  assert.deepEqual(
    offlineOnly.map((l) => l.id),
    [l2.id]
  );
});

test('buildOfflineCacheSnapshot packages essential lessons, progress, and saved notes', () => {
  const profile = createDefaultProfile({ uid: 'student_offline_1' });
  const snapshot = buildOfflineCacheSnapshot({
    profile,
    lessons: SAMPLE_LESSONS,
    offlineLessonIds: [SAMPLE_LESSONS[0].id],
    progress: [
      {
        lessonId: SAMPLE_LESSONS[0].id,
        subject: SAMPLE_LESSONS[0].subject,
        completed: true,
        bookmarked: true,
        lastStudiedAt: '2026-11-14T12:00:00.000Z',
      },
    ],
    savedNotes: [
      {
        id: 'note_1',
        subject: 'Science',
        title: 'Offline Cell Note',
        content: 'Chloroplasts perform photosynthesis.',
        updatedAt: '2026-11-14T12:00:00.000Z',
      },
    ],
    studyPlans: [],
    attempts: [],
    nowIso: '2026-11-14T12:05:00.000Z',
  });

  assert.equal(snapshot.uid, 'student_offline_1');
  assert.equal(snapshot.cachedAt, '2026-11-14T12:05:00.000Z');
  assert.ok(snapshot.lessons.length >= 3);
  assert.equal(snapshot.savedNotes.length, 1);
  assert.equal(snapshot.progress[0].completed, true);
});

test('mergeOfflineProgressAndNotes preserves newer offline edits and completed statuses', () => {
  const merged = mergeOfflineProgressAndNotes({
    baseProgress: [
      {
        lessonId: 'l1',
        subject: 'Science',
        completed: false,
        bookmarked: false,
        lastStudiedAt: '2026-11-14T08:00:00.000Z',
      },
    ],
    cachedProgress: [
      {
        lessonId: 'l1',
        subject: 'Science',
        completed: true,
        bookmarked: true,
        lastStudiedAt: '2026-11-14T10:00:00.000Z',
      },
    ],
    baseNotes: [
      {
        id: 'n1',
        subject: 'Science',
        title: 'Old Note',
        content: 'Old content',
        updatedAt: '2026-11-14T08:00:00.000Z',
      },
    ],
    cachedNotes: [
      {
        id: 'n1',
        subject: 'Science',
        title: 'Updated Offline Note',
        content: 'New offline content',
        updatedAt: '2026-11-14T10:30:00.000Z',
      },
      {
        id: 'n2',
        subject: 'Mathematics',
        title: 'Pythagoras',
        content: 'a^2 + b^2 = c^2',
        updatedAt: '2026-11-14T11:00:00.000Z',
      },
    ],
  });

  assert.equal(merged.progress.length, 1);
  assert.equal(merged.progress[0].completed, true);
  assert.equal(merged.progress[0].bookmarked, true);
  assert.equal(merged.savedNotes.length, 2);
  assert.equal(merged.savedNotes[0].id, 'n2');
  assert.equal(merged.savedNotes[1].title, 'Updated Offline Note');
});
