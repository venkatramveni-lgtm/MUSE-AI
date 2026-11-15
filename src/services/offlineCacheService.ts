import { registerSW } from 'virtual:pwa-register';
import {
  buildOfflineCacheSnapshot,
  OfflineUserSnapshot,
} from '../utils/offlineCache';
import {
  LearningProgress,
  LessonItem,
  QuizAttempt,
  SavedNote,
  StudyPlanTask,
  UserProfile,
} from '../types/muse';

const OFFLINE_CACHE_NAME = 'muse-offline-user-data-v1';
const ESSENTIAL_CURRICULUM_API = '/api/offline/curriculum';

export interface OfflineCacheStatus {
  swSupported: boolean;
  swRegistered: boolean;
  cacheStorageSupported: boolean;
  cachedLessonCount: number;
  cachedNoteCount: number;
  cachedProgressCount: number;
  lastSyncedAt: string | null;
}

let swRegisteredFlag = false;
let swRegistrationInitialized = false;

function getSnapshotCacheKey(uid: string): string {
  return `/__offline/snapshot/${encodeURIComponent(uid)}.json`;
}

const LATEST_UID_CACHE_KEY = '/__offline/latest-uid.json';

export function initServiceWorkerRegistration(
  onStatusChange?: (registered: boolean) => void
): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    onStatusChange?.(false);
    return;
  }
  if (swRegistrationInitialized) {
    onStatusChange?.(swRegisteredFlag);
    return;
  }
  swRegistrationInitialized = true;

  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        swRegisteredFlag = Boolean(registration);
        onStatusChange?.(swRegisteredFlag);
        if (navigator.onLine) {
          prefetchEssentialCurriculum().catch(() => {});
        }
      },
      onRegisterError() {
        swRegisteredFlag = false;
        onStatusChange?.(false);
      },
    });
  } catch {
    swRegisteredFlag = false;
    onStatusChange?.(false);
  }
}

export async function prefetchEssentialCurriculum(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine) return false;
  try {
    const resp = await fetch(ESSENTIAL_CURRICULUM_API, { method: 'GET' });
    if (!resp.ok) return false;
    if ('caches' in window) {
      const cache = await window.caches.open(OFFLINE_CACHE_NAME);
      await cache.put(ESSENTIAL_CURRICULUM_API, resp.clone());
    }
    return true;
  } catch {
    return false;
  }
}

export async function syncOfflineSnapshotToCache(params: {
  profile: UserProfile;
  lessons: LessonItem[];
  offlineLessonIds: string[];
  progress: LearningProgress[];
  savedNotes: SavedNote[];
  studyPlans: StudyPlanTask[];
  attempts: QuizAttempt[];
}): Promise<OfflineUserSnapshot | null> {
  const snapshot = buildOfflineCacheSnapshot(params);

  if (typeof window === 'undefined' || !('caches' in window)) {
    return snapshot;
  }

  try {
    const cache = await window.caches.open(OFFLINE_CACHE_NAME);
    const snapshotResponse = new Response(JSON.stringify(snapshot), {
      headers: {
        'Content-Type': 'application/json',
        'X-Muse-Offline-Cached-At': snapshot.cachedAt,
      },
    });
    await cache.put(getSnapshotCacheKey(snapshot.uid), snapshotResponse);

    const latestPtrResponse = new Response(
      JSON.stringify({ uid: snapshot.uid, cachedAt: snapshot.cachedAt }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    await cache.put(LATEST_UID_CACHE_KEY, latestPtrResponse);
    return snapshot;
  } catch {
    return snapshot;
  }
}

export async function readOfflineSnapshotFromCache(
  uid?: string
): Promise<OfflineUserSnapshot | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(OFFLINE_CACHE_NAME);
    let targetUid = uid;
    if (!targetUid) {
      const ptrResp = await cache.match(LATEST_UID_CACHE_KEY);
      if (ptrResp) {
        const ptr = (await ptrResp.json()) as { uid?: string };
        targetUid = ptr.uid;
      }
    }
    if (!targetUid) return null;
    const resp = await cache.match(getSnapshotCacheKey(targetUid));
    if (!resp) return null;
    const data = (await resp.json()) as OfflineUserSnapshot;
    if (!data || !data.profile) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearOfflineCacheForUser(uid: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(OFFLINE_CACHE_NAME);
    await cache.delete(getSnapshotCacheKey(uid));
  } catch {
    // Ignore
  }
}

export async function getOfflineCacheStatus(uid?: string): Promise<OfflineCacheStatus> {
  const swSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const cacheStorageSupported = typeof window !== 'undefined' && 'caches' in window;
  let swActive = swRegisteredFlag;
  if (swSupported && !swActive) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      swActive = Boolean(reg);
    } catch {
      swActive = false;
    }
  }
  const snapshot = await readOfflineSnapshotFromCache(uid);
  return {
    swSupported,
    swRegistered: swActive,
    cacheStorageSupported,
    cachedLessonCount: snapshot?.lessons.length ?? 0,
    cachedNoteCount: snapshot?.savedNotes.length ?? 0,
    cachedProgressCount: snapshot?.progress.length ?? 0,
    lastSyncedAt: snapshot?.cachedAt ?? null,
  };
}
