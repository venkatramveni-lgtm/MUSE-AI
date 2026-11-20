import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfflineCacheSnapshot,
  isMatchingOfflineSnapshot,
  mergeOfflineProgressAndNotes,
  OfflineUserSnapshot,
} from './offlineCache';
import { SAMPLE_LESSONS } from '../data/curriculumSeed';
import type { UserProfile } from '../types/muse';

function makeProfile(uid: string): UserProfile {
  return {
    uid,
    displayName: `User ${uid}`,
    role: 'student',
    board: 'CBSE',
    classLevel: 7,
    preferredLanguage: 'English',
    learningPreference: 'Visual',
    academicGoal: 'Master Science',
    subjects: ['Science', 'Mathematics'],
    guardianConsentApproved: true,
    onboardingComplete: true,
    theme: 'dark',
    studyStreak: 3,
    notificationsEnabled: true,
    nonEssentialNotifications: true,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };
}

test('isMatchingOfflineSnapshot rejects missing, empty, or mismatched UIDs to prevent cross-account leakage', () => {
  const profileA = makeProfile('uid_alpha');
  const snapshotA = buildOfflineCacheSnapshot({
    profile: profileA,
    lessons: SAMPLE_LESSONS,
    offlineLessonIds: [],
    progress: [],
    savedNotes: [],
    studyPlans: [],
    attempts: [],
    nowIso: '2026-11-16T10:00:00Z',
  });

  assert.equal(isMatchingOfflineSnapshot(snapshotA, 'uid_alpha'), true);
  assert.equal(isMatchingOfflineSnapshot(snapshotA, 'uid_beta'), false);
  assert.equal(isMatchingOfflineSnapshot(snapshotA, ''), false);
  assert.equal(isMatchingOfflineSnapshot(snapshotA, undefined), false);

  const tampered: OfflineUserSnapshot = {
    ...snapshotA,
    uid: 'uid_beta',
  };
  assert.equal(isMatchingOfflineSnapshot(tampered, 'uid_beta'), false);
});

test('mergeOfflineProgressAndNotes preserves completion and newest note edits', () => {
  const merged = mergeOfflineProgressAndNotes({
    baseProgress: [
      {
        lessonId: 'lesson_1',
        subject: 'Science',
        completed: false,
        bookmarked: true,
        lastStudiedAt: '2026-11-14T10:00:00Z',
      },
    ],
    cachedProgress: [
      {
        lessonId: 'lesson_1',
        subject: 'Science',
        completed: true,
        bookmarked: false,
        lastStudiedAt: '2026-11-15T10:00:00Z',
      },
    ],
    baseNotes: [
      {
        id: 'n1',
        subject: 'Science',
        title: 'Old Title',
        content: 'Old',
        updatedAt: '2026-11-14T08:00:00Z',
      },
    ],
    cachedNotes: [
      {
        id: 'n1',
        subject: 'Science',
        title: 'Updated Offline Note',
        content: 'New content',
        updatedAt: '2026-11-15T09:00:00Z',
      },
    ],
  });

  assert.equal(merged.progress.length, 1);
  assert.equal(merged.progress[0].completed, true);
  assert.equal(merged.savedNotes[0].title, 'Updated Offline Note');
});
