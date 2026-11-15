import type { EducationRelevanceLabel, EducationVideoItem } from '../types/muse';

export function extractYouTubeVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const vParam = u.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function extractYouTubePlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  if (/^(PL|UU|OL|RD)[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const listParam = u.searchParams.get('list');
    if (listParam && /^[a-zA-Z0-9_-]{10,}$/.test(listParam)) return listParam;
  } catch {
    return null;
  }
  return null;
}

export function parseIso8601Duration(iso: string): { label: string; seconds: number } {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
  if (!match) return { label: 'Lesson', seconds: 0 };
  const hours = Number(match[1] || 0);
  const mins = Number(match[2] || 0);
  const secs = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + mins * 60 + secs;
  const label =
    hours > 0
      ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${mins}:${String(secs).padStart(2, '0')}`;
  return { label, seconds: totalSeconds };
}

export function buildYouTubeEducationQuery(params: {
  board: string;
  classLevel: number;
  subject: string;
  chapter?: string;
  language?: string;
  query?: string;
}): string {
  const parts: string[] = [];
  if (params.query && params.query.trim()) {
    parts.push(params.query.trim());
  }
  const boardToken =
    params.board === 'State Board' ? 'SCERT State Board' : params.board;
  parts.push(boardToken);
  parts.push(`Class ${Math.min(12, Math.max(1, Math.round(params.classLevel || 7)))}`);
  if (params.subject && params.subject !== 'ALL') {
    parts.push(params.subject);
  }
  if (params.chapter && params.chapter.trim()) {
    parts.push(params.chapter.trim());
  }
  if (params.language && params.language !== 'English' && params.language !== 'ALL') {
    parts.push(`in ${params.language}`);
  }
  parts.push('lesson explanation');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function scoreVideoRelevance(
  video: Pick<EducationVideoItem, 'title' | 'description' | 'channelTitle' | 'isApprovedChannel' | 'isFeatured'>,
  criteria: {
    board: string;
    classLevel: number;
    subject: string;
    chapter?: string;
    language?: string;
    query?: string;
  }
): { score: number; relevanceLabel: EducationRelevanceLabel } {
  const haystack = `${video.title} ${video.description} ${video.channelTitle}`.toLowerCase();
  let score = 15;

  const classRegex = new RegExp(`(class\\s*${criteria.classLevel}|std\\s*${criteria.classLevel}|grade\\s*${criteria.classLevel})`, 'i');
  if (classRegex.test(haystack)) score += 25;

  const boardShort = criteria.board.replace(/state board/i, '').trim().toLowerCase();
  if (boardShort && haystack.includes(boardShort)) score += 20;
  if (criteria.board === 'CBSE' && haystack.includes('ncert')) score += 15;

  if (criteria.subject && haystack.includes(criteria.subject.toLowerCase())) score += 20;
  if (criteria.chapter) {
    const chapterWords = criteria.chapter
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const hits = chapterWords.filter((w) => haystack.includes(w)).length;
    score += Math.min(20, hits * 7);
  }
  if (criteria.language && criteria.language !== 'English' && haystack.includes(criteria.language.toLowerCase())) {
    score += 10;
  }
  if (criteria.query && haystack.includes(criteria.query.toLowerCase())) {
    score += 15;
  }
  if (video.isApprovedChannel) score += 15;
  if (video.isFeatured) score += 10;

  let relevanceLabel: EducationRelevanceLabel = 'Additional Learning';
  if (score >= 75) relevanceLabel = 'Highly Relevant';
  else if (score >= 55) relevanceLabel = 'Curriculum Matched';
  else if (score >= 35) relevanceLabel = 'Related Lessons';

  return { score: Math.min(100, score), relevanceLabel };
}

export class SimpleTTLCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
