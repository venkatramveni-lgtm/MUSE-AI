import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Box,
  Calendar,
  CheckCircle2,
  CloudOff,
  Download,
  Globe,
  HardDriveDownload,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, LANGUAGES } from '../data/curriculumSeed';
import { LearningProgress, LessonItem, UserProfile } from '../types/muse';
import { filterMyLessons, LessonCollectionFilter } from '../utils/offlineCache';
import { filterByStudentClass, prioritizeByClassAndProfile } from '../utils/curriculumFilter';
import { XRSpatialLab } from './XRSpatialLab';

interface LessonAcademyViewProps {
  profile: UserProfile;
  lessons: LessonItem[];
  progress: LearningProgress[];
  offlineLessonIds: string[];
  initialLessonId?: string | null;
  initialCollectionFilter?: LessonCollectionFilter;
  isOnline?: boolean;
  swReady?: boolean;
  onToggleComplete: (lesson: LessonItem) => void;
  onToggleBookmark: (lesson: LessonItem) => void;
  onToggleOfflineLesson: (lesson: LessonItem) => void;
  onSyncOfflineCache?: () => Promise<void> | void;
  onAskAITeacher: (subject?: string) => void;
  onScheduleLesson?: (lesson: LessonItem) => void;
  onFindVideos?: (lesson: LessonItem) => void;
}

const LessonSvgDiagram: React.FC<{ type: LessonItem['diagramType'] }> = ({ type }) => {
  if (type === 'photosynthesis') {
    return (
      <svg viewBox="0 0 420 170" className="w-full max-w-lg mx-auto" role="img" aria-label="Photosynthesis process diagram">
        <rect x="0" y="0" width="420" height="170" rx="14" fill="#0f172a" />
        <circle cx="58" cy="46" r="24" fill="#fbbf24" />
        <text x="58" y="88" textAnchor="middle" fill="#fde68a" fontSize="11">Sunlight</text>
        <path d="M88 48 L155 72" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="4 3" />
        <ellipse cx="220" cy="85" rx="68" ry="38" fill="#16a34a" stroke="#86efac" strokeWidth="2" />
        <text x="220" y="82" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">Chloroplast</text>
        <text x="220" y="99" textAnchor="middle" fill="#dcfce7" fontSize="10">CO2 + H2O</text>
        <path d="M292 80 L355 58" stroke="#38bdf8" strokeWidth="2.5" />
        <text x="362" y="54" fill="#7dd3fc" fontSize="11">Oxygen (O2)</text>
        <path d="M292 94 L355 118" stroke="#a78bfa" strokeWidth="2.5" />
        <text x="360" y="122" fill="#ddd6fe" fontSize="11">Glucose</text>
      </svg>
    );
  }
  if (type === 'pythagoras') {
    return (
      <svg viewBox="0 0 420 170" className="w-full max-w-lg mx-auto" role="img" aria-label="Pythagoras 3-4-5 right triangle diagram">
        <rect x="0" y="0" width="420" height="170" rx="14" fill="#0f172a" />
        <polygon points="150,125 270,125 150,35" fill="#1d4ed8" fillOpacity="0.45" stroke="#60a5fa" strokeWidth="2.5" />
        <rect x="150" y="113" width="12" height="12" fill="none" stroke="#f8fafc" strokeWidth="1.5" />
        <text x="128" y="85" fill="#93c5fd" fontSize="12">a = 3</text>
        <text x="205" y="145" fill="#c4b5fd" fontSize="12">b = 4</text>
        <text x="225" y="72" fill="#6ee7b7" fontSize="12">c = 5 (a² + b² = c²)</text>
      </svg>
    );
  }
  if (type === 'motion') {
    return (
      <svg viewBox="0 0 420 170" className="w-full max-w-lg mx-auto" role="img" aria-label="Newton laws of motion and acceleration diagram">
        <rect x="0" y="0" width="420" height="170" rx="14" fill="#0f172a" />
        <polygon points="65,135 280,135 65,55" fill="#1e3a8a" fillOpacity="0.45" stroke="#60a5fa" strokeWidth="2" />
        <rect x="135" y="72" width="44" height="28" rx="5" transform="rotate(20 135 72)" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.5" />
        <path d="M190 92 L285 126" stroke="#f59e0b" strokeWidth="3" />
        <text x="292" y="130" fill="#fde68a" fontSize="11" fontWeight="bold">F = m × a</text>
        <text x="290" y="55" fill="#93c5fd" fontSize="11">v = u + at</text>
        <text x="290" y="75" fill="#6ee7b7" fontSize="11">s = ut + ½at²</text>
        <text x="290" y="95" fill="#c4b5fd" fontSize="11">v² - u² = 2as</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 420 150" className="w-full max-w-lg mx-auto" role="img" aria-label="Concept flow diagram">
      <rect x="0" y="0" width="420" height="150" rx="14" fill="#0f172a" />
      <rect x="26" y="48" width="105" height="52" rx="10" fill="#1e3a8a" stroke="#60a5fa" />
      <text x="78" y="78" textAnchor="middle" fill="#eff6ff" fontSize="11">Core Input</text>
      <path d="M135 74 L162 74" stroke="#94a3b8" strokeWidth="2" />
      <rect x="164" y="48" width="105" height="52" rx="10" fill="#4c1d95" stroke="#a78bfa" />
      <text x="216" y="78" textAnchor="middle" fill="#f5f3ff" fontSize="11">Process</text>
      <path d="M273 74 L300 74" stroke="#94a3b8" strokeWidth="2" />
      <rect x="302" y="48" width="96" height="52" rx="10" fill="#065f46" stroke="#34d399" />
      <text x="350" y="78" textAnchor="middle" fill="#ecfdf5" fontSize="11">Outcome</text>
    </svg>
  );
};

export const LessonAcademyView: React.FC<LessonAcademyViewProps> = ({
  profile,
  lessons,
  progress,
  offlineLessonIds,
  initialLessonId,
  initialCollectionFilter = 'all',
  isOnline = true,
  swReady = false,
  onToggleComplete,
  onToggleBookmark,
  onToggleOfflineLesson,
  onSyncOfflineCache,
  onAskAITeacher,
  onScheduleLesson,
  onFindVideos,
}) => {
  const [boardFilter, setBoardFilter] = useState<string>('ALL');
  const [myClassOnly, setMyClassOnly] = useState<boolean>(!initialLessonId);
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [language, setLanguage] = useState<string>(profile.preferredLanguage || 'English');
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] =
    useState<LessonCollectionFilter>(initialCollectionFilter);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    () =>
      initialLessonId ||
      prioritizeByClassAndProfile(lessons, profile)[0]?.id ||
      lessons[0]?.id ||
      ''
  );
  const [activeTab, setActiveTab] = useState<'lesson' | 'spatial'>('lesson');

  const progressMap = useMemo(
    () => new Map(progress.map((p) => [p.lessonId, p])),
    [progress]
  );

  const offlineSet = useMemo(() => new Set(offlineLessonIds), [offlineLessonIds]);

  const myLessonsCount = useMemo(
    () => filterMyLessons(lessons, progress, offlineLessonIds, 'my_lessons').length,
    [lessons, progress, offlineLessonIds]
  );

  const subjectsAvailable = useMemo(
    () => Array.from(new Set(lessons.map((l) => l.subject))),
    [lessons]
  );

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCollection = filterMyLessons(lessons, progress, offlineLessonIds, collectionFilter);
    const prioritized = prioritizeByClassAndProfile(byCollection, profile);
    const classScoped =
      classFilter === 'ALL'
        ? filterByStudentClass(prioritized, profile.classLevel, myClassOnly)
        : prioritized;

    return classScoped.filter((l) => {
      if (boardFilter !== 'ALL' && l.board !== boardFilter) return false;
      if (classFilter !== 'ALL' && l.classLevel !== Number(classFilter)) return false;
      if (subjectFilter !== 'ALL' && l.subject !== subjectFilter) return false;
      if (q) {
        const hay = `${l.title} ${l.subject} ${l.chapter} ${l.topic} ${l.board}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    lessons,
    progress,
    offlineLessonIds,
    collectionFilter,
    profile,
    myClassOnly,
    boardFilter,
    classFilter,
    subjectFilter,
    search,
  ]);

  const activeLesson =
    filteredLessons.find((l) => l.id === selectedLessonId) ||
    filteredLessons[0] ||
    lessons.find((l) => l.id === selectedLessonId) ||
    lessons[0];
  const activeProg = activeLesson ? progressMap.get(activeLesson.id) : undefined;

  const downloadNotes = (lesson: LessonItem) => {
    const text = [
      `NANO AI — STUDY NOTES (${lesson.isSampleContent ? 'SAMPLE CONTENT' : 'CURRICULUM'})`,
      `Hierarchy: ${lesson.board} -> Class ${lesson.classLevel} -> ${lesson.subject} -> ${lesson.chapter} -> ${lesson.topic}`,
      `Title: ${lesson.title}`,
      `Language Preference: ${language}`,
      '',
      'LEARNING OBJECTIVES:',
      ...lesson.objectives.map((o) => `- ${o}`),
      '',
      'EXPLANATION:',
      ...lesson.explanation,
      '',
      'KEY DEFINITIONS:',
      ...lesson.definitions.map((d) => `- ${d.term}: ${d.meaning}`),
      '',
      'SUMMARY:',
      lesson.summary,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lesson.id}_notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Hierarchy & Filter Bar */}
      <div className="muse-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl">Lesson Academy</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Structured Navigation: Board → Class → Subject → Chapter → Topic → Lesson
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMyClassOnly((m) => !m);
                setClassFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                myClassOnly && classFilter === 'ALL'
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              My Class ({profile.classLevel})
            </button>
            <button
              type="button"
              onClick={() => {
                setCollectionFilter('all');
                setMyClassOnly(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                collectionFilter === 'all' && !myClassOnly
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              All Lessons ({lessons.length})
            </button>
            <button
              type="button"
              onClick={() => setCollectionFilter('my_lessons')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                collectionFilter === 'my_lessons'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              My Lessons ({myLessonsCount})
            </button>
            <button
              type="button"
              onClick={() =>
                setCollectionFilter((c) => (c === 'bookmarked' ? 'all' : 'bookmarked'))
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 ${
                collectionFilter === 'bookmarked'
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Bookmarked
            </button>
            {onSyncOfflineCache && (
              <button
                type="button"
                onClick={async () => {
                  await onSyncOfflineCache();
                  setSyncNotice(
                    `${offlineLessonIds.length} My Lessons & progress cached via Service Worker`
                  );
                  setTimeout(() => setSyncNotice(null), 3500);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                {syncNotice || `Cache My Lessons (${offlineLessonIds.length})`}
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <select
                aria-label="Lesson Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {!isOnline && (
          <div className="p-2.5 rounded-xl bg-amber-600 text-white text-xs font-medium flex items-center gap-2">
            <CloudOff className="w-4 h-4 shrink-0" />
            <span>
              You are offline. Viewing Service Worker cached lessons and progress ({swReady ? 'SW Active' : 'Cache Storage Ready'}).
            </span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons, chapters, topics..."
              aria-label="Search lessons"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            aria-label="Filter by Board"
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="ALL">All Boards</option>
            {BOARDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            aria-label="Filter by Class"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              if (e.target.value !== 'ALL') setMyClassOnly(false);
            }}
            className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="ALL">All Classes (1–12)</option>
            {CLASS_LEVELS.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <select
            aria-label="Filter by Subject"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="ALL">All Subjects</option>
            {subjectsAvailable.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* Curriculum Tree / List */}
        <aside className="lg:col-span-4 muse-card p-4 space-y-2.5 h-fit">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Matching Lessons ({filteredLessons.length})
          </div>
          {filteredLessons.length === 0 ? (
            <div className="muse-panel p-4 text-xs text-[var(--text-muted)]">
              No lessons match your current filters. Clear filters to explore all curriculum units.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {filteredLessons.map((lesson) => {
                const prog = progressMap.get(lesson.id);
                const selected = lesson.id === activeLesson?.id;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLessonId(lesson.id);
                        setActiveTab('lesson');
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selected
                          ? 'bg-[var(--bg-subtle)] border-blue-500/50'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{lesson.board} • Class {lesson.classLevel} • {lesson.subject}</span>
                        <div className="flex items-center gap-1">
                          {offlineSet.has(lesson.id) && (
                            <span
                              title="Cached for offline reading"
                              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-[var(--accent-emerald)] font-semibold"
                            >
                              Offline
                            </span>
                          )}
                          {prog?.bookmarked && <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          {prog?.completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                      </div>
                      <div className="text-sm font-semibold mt-1">{lesson.title}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {lesson.chapter} → {lesson.topic}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Active Lesson Content */}
        {activeLesson && (
          <article className="lg:col-span-8 muse-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-md bg-[var(--bg-subtle)] text-blue-400 font-semibold">
                    {activeLesson.board} → Class {activeLesson.classLevel} → {activeLesson.subject}
                  </span>
                  {activeLesson.isSampleContent && (
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      Sample Educational Content
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl font-bold">{activeLesson.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Chapter: {activeLesson.chapter} • Topic: {activeLesson.topic} • Est. {activeLesson.durationMinutes} mins
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleOfflineLesson(activeLesson)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                    offlineSet.has(activeLesson.id)
                      ? 'bg-emerald-500/15 text-[var(--accent-emerald)] border-emerald-500/40'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                  }`}
                >
                  <HardDriveDownload className="w-3.5 h-3.5" />
                  {offlineSet.has(activeLesson.id) ? 'Saved Offline' : 'Save Offline'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(activeLesson)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                    activeProg?.bookmarked
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {activeProg?.bookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleComplete(activeLesson)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    activeProg?.completed
                      ? 'bg-emerald-600 text-white'
                      : 'muse-btn-primary'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {activeProg?.completed ? 'Completed' : 'Mark Complete'}
                </button>
              </div>
            </div>

            {/* Lesson vs 3D XR Spatial Lab Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('lesson')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                    activeTab === 'lesson'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Lesson Guide
                </button>
                {activeLesson.xrModelId && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('spatial')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      activeTab === 'spatial'
                        ? 'bg-purple-600 text-white'
                        : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D / XR Spatial Model
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadNotes(activeLesson)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Study Notes
                </button>
                {onScheduleLesson && (
                  <button
                    type="button"
                    onClick={() => onScheduleLesson(activeLesson)}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-emerald-500/40 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Schedule in Planner
                  </button>
                )}
                {onFindVideos && (
                  <button
                    type="button"
                    onClick={() => onFindVideos(activeLesson)}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-sky-500/40 flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5 text-sky-400" />
                    Matching Videos
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAskAITeacher(activeLesson.subject)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-subtle)] text-blue-400 border border-blue-500/30 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Discuss with AI Teacher
                </button>
              </div>
            </div>

            {activeTab === 'spatial' && activeLesson.xrModelId ? (
              <XRSpatialLab modelId={activeLesson.xrModelId} title={activeLesson.title} />
            ) : (
              <div className="space-y-5 text-sm">
                {language !== 'English' && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                    Preferred Language set to <strong>{language}</strong>. Sample lesson text is currently authored in English; ask Nano AI Teacher in {language} for bilingual explanations!
                  </div>
                )}

                <section className="space-y-2">
                  <h3 className="font-display font-bold text-base">Introduction</h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{activeLesson.introduction}</p>
                </section>

                <section className="muse-panel p-4 space-y-2">
                  <h3 className="font-display font-bold text-sm uppercase tracking-wider text-blue-400">
                    Learning Objectives
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]">
                    {activeLesson.objectives.map((obj) => (
                      <li key={obj}>{obj}</li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-2.5">
                  <h3 className="font-display font-bold text-base">Detailed Explanation</h3>
                  {activeLesson.explanation.map((para, idx) => (
                    <p key={idx} className="text-[var(--text-secondary)] leading-relaxed">
                      {para}
                    </p>
                  ))}
                </section>

                <section className="space-y-2">
                  <h3 className="font-display font-bold text-base">Concept Diagram</h3>
                  <LessonSvgDiagram type={activeLesson.diagramType} />
                </section>

                <section className="grid sm:grid-cols-2 gap-4">
                  <div className="muse-panel p-4 space-y-2">
                    <h3 className="font-display font-bold text-sm text-purple-400">Important Definitions</h3>
                    <dl className="space-y-2">
                      {activeLesson.definitions.map((d) => (
                        <div key={d.term}>
                          <dt className="font-semibold text-xs">{d.term}</dt>
                          <dd className="text-xs text-[var(--text-muted)]">{d.meaning}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="muse-panel p-4 space-y-2">
                    <h3 className="font-display font-bold text-sm text-emerald-400">Worked Examples</h3>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {activeLesson.examples.map((ex) => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="muse-panel p-4 space-y-2">
                  <h3 className="font-display font-bold text-sm">Key Points & Chapter Summary</h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-[var(--text-secondary)]">
                    {activeLesson.keyPoints.map((kp) => (
                      <li key={kp}>{kp}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                    <strong>Summary:</strong> {activeLesson.summary}
                  </p>
                </section>

                <section className="grid sm:grid-cols-2 gap-4">
                  <div className="muse-panel p-4 space-y-2">
                    <h3 className="font-display font-bold text-sm">Practice Exercises</h3>
                    <ul className="list-decimal pl-4 space-y-1 text-xs text-[var(--text-secondary)]">
                      {activeLesson.practiceExercises.map((pe) => (
                        <li key={pe}>{pe}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="muse-panel p-4 space-y-2">
                    <h3 className="font-display font-bold text-sm">Related Topics</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {activeLesson.relatedTopics.map((rt) => (
                        <span key={rt} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                          {rt}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
};
