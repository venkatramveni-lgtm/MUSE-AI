import {
  LearningProgress,
  LessonItem,
  QuizAttempt,
  SavedNote,
  StudyPlanTask,
  UserProfile,
} from '../types/muse';

export type LessonCollectionFilter = 'all' | 'my_lessons' | 'bookmarked' | 'offline_saved';

export interface OfflineUserSnapshot {
  version: number;
  uid: string;
  cachedAt: string;
  profile: UserProfile;
  lessons: LessonItem[];
  offlineLessonIds: string[];
  progress: LearningProgress[];
  savedNotes: SavedNote[];
  studyPlans: StudyPlanTask[];
  attempts: QuizAttempt[];
}

export function isMatchingOfflineSnapshot(
  snapshot: OfflineUserSnapshot | null | undefined,
  uid?: string
): snapshot is OfflineUserSnapshot {
  if (!uid || !uid.trim() || uid === 'demo_guest' || !snapshot || !snapshot.profile) return false;
  return snapshot.uid === uid && snapshot.profile.uid === uid;
}

export function getEssentialLessonIds(
  lessons: LessonItem[],
  profile: Pick<UserProfile, 'board' | 'classLevel' | 'subjects'>,
  progress: LearningProgress[],
  explicitOfflineIds: string[] = []
): string[] {
  const idSet = new Set<string>(explicitOfflineIds);

  // Include all bookmarked or completed lessons in My Lessons
  for (const p of progress) {
    if (p.bookmarked || p.completed) {
      idSet.add(p.lessonId);
    }
  }

  // Always include essential lessons matching the student's board/class or enrolled subjects
  for (const l of lessons) {
    if (
      (l.board === profile.board && l.classLevel === profile.classLevel) ||
      profile.subjects.includes(l.subject)
    ) {
      idSet.add(l.id);
    }
  }

  // Ensure at least the first 3 core lessons are always cached for offline fallback
  for (const l of lessons.slice(0, 3)) {
    idSet.add(l.id);
  }

  return Array.from(idSet);
}

export function filterMyLessons(
  lessons: LessonItem[],
  progress: LearningProgress[],
  offlineLessonIds: string[],
  mode: LessonCollectionFilter
): LessonItem[] {
  if (mode === 'all') return lessons;

  const progressMap = new Map(progress.map((p) => [p.lessonId, p]));
  const offlineSet = new Set(offlineLessonIds);

  if (mode === 'bookmarked') {
    return lessons.filter((l) => Boolean(progressMap.get(l.id)?.bookmarked));
  }

  if (mode === 'offline_saved') {
    return lessons.filter((l) => offlineSet.has(l.id));
  }

  // 'my_lessons': Bookmarked, completed, or saved for offline access
  return lessons.filter((l) => {
    const p = progressMap.get(l.id);
    return Boolean(p?.bookmarked || p?.completed || offlineSet.has(l.id));
  });
}

export function buildOfflineCacheSnapshot(params: {
  profile: UserProfile;
  lessons: LessonItem[];
  offlineLessonIds: string[];
  progress: LearningProgress[];
  savedNotes: SavedNote[];
  studyPlans: StudyPlanTask[];
  attempts: QuizAttempt[];
  nowIso?: string;
}): OfflineUserSnapshot {
  const essentialIds = getEssentialLessonIds(
    params.lessons,
    params.profile,
    params.progress,
    params.offlineLessonIds
  );
  const essentialSet = new Set(essentialIds);
  const cachedLessons = params.lessons.filter((l) => essentialSet.has(l.id));

  return {
    version: 1,
    uid: params.profile.uid,
    cachedAt: params.nowIso || new Date().toISOString(),
    profile: params.profile,
    lessons: cachedLessons,
    offlineLessonIds: essentialIds,
    progress: [...params.progress],
    savedNotes: [...params.savedNotes],
    studyPlans: [...params.studyPlans],
    attempts: [...params.attempts],
  };
}

export function mergeOfflineProgressAndNotes(params: {
  baseProgress: LearningProgress[];
  cachedProgress: LearningProgress[];
  baseNotes: SavedNote[];
  cachedNotes: SavedNote[];
}): { progress: LearningProgress[]; savedNotes: SavedNote[] } {
  const progMap = new Map<string, LearningProgress>();
  for (const item of [...params.baseProgress, ...params.cachedProgress]) {
    const existing = progMap.get(item.lessonId);
    if (!existing) {
      progMap.set(item.lessonId, item);
      continue;
    }
    const existingTime = Date.parse(existing.lastStudiedAt) || 0;
    const nextTime = Date.parse(item.lastStudiedAt) || 0;
    progMap.set(item.lessonId, {
      ...(nextTime >= existingTime ? item : existing),
      completed: existing.completed || item.completed,
      bookmarked: nextTime >= existingTime ? item.bookmarked : existing.bookmarked,
    });
  }

  const notesMap = new Map<string, SavedNote>();
  for (const note of [...params.baseNotes, ...params.cachedNotes]) {
    const existing = notesMap.get(note.id);
    if (!existing) {
      notesMap.set(note.id, note);
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt) || 0;
    const nextTime = Date.parse(note.updatedAt) || 0;
    notesMap.set(note.id, nextTime >= existingTime ? note : existing);
  }

  const sortedNotes = Array.from(notesMap.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );

  return {
    progress: Array.from(progMap.values()),
    savedNotes: sortedNotes,
  };
}
