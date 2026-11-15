import { ImageLessonItem, VideoCategory, VideoLesson } from '../types/muse';

export type ImageCollectionFilter = 'all' | 'bookmarked' | 'studied';
export type VideoCollectionFilter = 'all' | 'bookmarked' | 'watched';

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'Step-by-Step Tutorial',
  'Concept Explained',
  'Visual Lab & 3D',
  'Exam & Revision Guide',
];

export function filterImageLibrary(
  images: ImageLessonItem[],
  opts: {
    board: string;
    classLevel: string;
    subject: string;
    search: string;
    collectionFilter: ImageCollectionFilter;
    studiedIds: string[];
    bookmarkedIds: string[];
  }
): ImageLessonItem[] {
  const q = opts.search.trim().toLowerCase();
  const studiedSet = new Set(opts.studiedIds);
  const bookmarkedSet = new Set(opts.bookmarkedIds);

  return images.filter((img) => {
    if (opts.collectionFilter === 'bookmarked' && !bookmarkedSet.has(img.id)) return false;
    if (opts.collectionFilter === 'studied' && !studiedSet.has(img.id)) return false;
    if (opts.board !== 'ALL' && img.board !== opts.board) return false;
    if (opts.classLevel !== 'ALL' && img.classLevel !== Number(opts.classLevel)) return false;
    if (opts.subject !== 'ALL' && img.subject !== opts.subject) return false;
    if (q) {
      const hay = `${img.title} ${img.subject} ${img.chapter} ${img.summary} ${img.hotspots.map((h) => h.label).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterVideoLibrary(
  videos: VideoLesson[],
  opts: {
    subject: string;
    category?: 'ALL' | VideoCategory;
    board?: string;
    classLevel?: string;
    search: string;
    collectionFilter: VideoCollectionFilter;
    watchedIds: string[];
    bookmarkedIds: string[];
  }
): VideoLesson[] {
  const q = opts.search.trim().toLowerCase();
  const watchedSet = new Set(opts.watchedIds);
  const bookmarkedSet = new Set(opts.bookmarkedIds);

  return videos.filter((v) => {
    const effectiveCategory = v.category || 'Concept Explained';
    if (opts.collectionFilter === 'bookmarked' && !bookmarkedSet.has(v.id)) return false;
    if (opts.collectionFilter === 'watched' && !watchedSet.has(v.id)) return false;
    if (opts.subject !== 'ALL' && v.subject !== opts.subject) return false;
    if (opts.category && opts.category !== 'ALL' && effectiveCategory !== opts.category) return false;
    if (opts.board && opts.board !== 'ALL' && v.board !== opts.board) return false;
    if (opts.classLevel && opts.classLevel !== 'ALL' && v.classLevel !== Number(opts.classLevel)) {
      return false;
    }
    if (q) {
      const hay = `${v.title} ${v.subject} ${v.chapter} ${effectiveCategory} ${v.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function groupVideosByCategory(
  videos: VideoLesson[]
): { category: VideoCategory; items: VideoLesson[] }[] {
  return VIDEO_CATEGORIES.map((category) => ({
    category,
    items: videos.filter((v) => (v.category || 'Concept Explained') === category),
  })).filter((group) => group.items.length > 0);
}

export function clampZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(2.5, Math.max(1, Math.round(scale * 100) / 100));
}

export function computeVideoCaptionIndex(progressPct: number, captionCount: number): number {
  if (captionCount <= 0) return -1;
  const clamped = Math.min(100, Math.max(0, Number(progressPct) || 0));
  return Math.min(captionCount - 1, Math.floor((clamped / 100) * captionCount));
}

export function sanitizeEducationalSvg(rawSvg: string, fallbackTitle = 'Concept Visual'): string {
  if (typeof rawSvg !== 'string') return buildFallbackConceptSvg(fallbackTitle);
  const trimmed = rawSvg.trim();
  const startIdx = trimmed.search(/<svg[\s>]/i);
  const endIdx = trimmed.toLowerCase().lastIndexOf('</svg>');
  if (startIdx < 0 || endIdx < startIdx) {
    return buildFallbackConceptSvg(fallbackTitle);
  }

  let svg = trimmed.slice(startIdx, endIdx + 6);
  // Strip executable tags and event handlers
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');

  if (!/<svg[\s\S]*>/i.test(svg)) {
    return buildFallbackConceptSvg(fallbackTitle);
  }
  return svg;
}

export function buildFallbackConceptSvg(title: string): string {
  const safeTitle = String(title || 'Muse AI Visual')
    .replace(/[<>&"']/g, '')
    .slice(0, 64);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" role="img" aria-label="${safeTitle}">
  <rect width="640" height="320" rx="18" fill="#0f172a"/>
  <rect x="44" y="96" width="150" height="92" rx="14" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/>
  <text x="119" y="147" text-anchor="middle" fill="#eff6ff" font-size="14" font-family="sans-serif">Core Input</text>
  <path d="M198 142 L238 142" stroke="#93c5fd" stroke-width="3"/>
  <rect x="244" y="96" width="152" height="92" rx="14" fill="#4c1d95" stroke="#a78bfa" stroke-width="2"/>
  <text x="320" y="147" text-anchor="middle" fill="#f5f3ff" font-size="14" font-family="sans-serif">Key Mechanism</text>
  <path d="M400 142 L440 142" stroke="#c4b5fd" stroke-width="3"/>
  <rect x="446" y="96" width="150" height="92" rx="14" fill="#065f46" stroke="#34d399" stroke-width="2"/>
  <text x="521" y="147" text-anchor="middle" fill="#ecfdf5" font-size="14" font-family="sans-serif">Outcome</text>
  <text x="320" y="54" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">${safeTitle}</text>
</svg>`;
}
