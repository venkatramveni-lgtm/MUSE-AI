import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  Link2,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import { DEFAULT_APPROVED_CHANNELS, OFFICIAL_EDUCATION_PORTALS } from '../data/educationRegistry';
import { authFetch } from '../services/firebaseClient';
import { SavedGuideLink, SavedNote, UserProfile } from '../types/muse';
import { filterByStudentClass, prioritizeByClassAndProfile } from '../utils/curriculumFilter';

interface GuidesViewProps {
  profile: UserProfile;
  savedGuideLinks: SavedGuideLink[];
  onAddGuideLink: (link: SavedGuideLink) => void;
  onDeleteGuideLink: (id: string) => void;
  onSaveNote: (note: SavedNote) => void;
  onAskAITeacher?: (subject?: string, prompt?: string) => void;
}

interface GeneratedQuizQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export const GuidesView: React.FC<GuidesViewProps> = ({
  profile,
  savedGuideLinks,
  onAddGuideLink,
  onDeleteGuideLink,
  onSaveNote,
  onAskAITeacher,
}) => {
  const [boardFilter, setBoardFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [myClassOnly, setMyClassOnly] = useState<boolean>(true);
  const [portalSearch, setPortalSearch] = useState('');

  // Custom Guide Video / Channel form
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkChannel, setLinkChannel] = useState('');
  const [linkClassLevel, setLinkClassLevel] = useState<number>(profile.classLevel || 9);
  const [linkSubject, setLinkSubject] = useState<string>(profile.subjects[0] || 'Science');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Study Material & Daily Quiz Pack generator
  const [materialTopic, setMaterialTopic] = useState(
    profile.classLevel === 9
      ? 'Newton’s Laws of Motion & Cell Organelles'
      : `Class ${profile.classLevel} Core Concept Mastery`
  );
  const [materialSubject, setMaterialSubject] = useState<string>(
    profile.subjects[0] || 'Science'
  );
  const [materialLanguage, setMaterialLanguage] = useState<string>(
    profile.preferredLanguage || 'English'
  );
  const [materialGuideUrl, setMaterialGuideUrl] = useState<string>(
    'http://www.youtube.com/@WORKBOOKGURUJI'
  );
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState('');
  const [packNotes, setPackNotes] = useState('');
  const [packTakeaways, setPackTakeaways] = useState<string[]>([]);
  const [packCards, setPackCards] = useState<{ front: string; back: string }[]>([]);
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);
  const [packQuiz, setPackQuiz] = useState<GeneratedQuizQuestion[]>([]);
  const [quizSelections, setQuizSelections] = useState<Record<number, string>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const visiblePortals = useMemo(() => {
    const q = portalSearch.trim().toLowerCase();
    return OFFICIAL_EDUCATION_PORTALS.filter((p) => {
      if (boardFilter !== 'ALL' && !p.boards.includes(boardFilter)) return false;
      if (
        languageFilter !== 'ALL' &&
        !p.languages.some((l) => l.toLowerCase() === languageFilter.toLowerCase())
      ) {
        return false;
      }
      if (q) {
        const hay = `${p.title} ${p.provider} ${p.description} ${p.badge}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [boardFilter, languageFilter, portalSearch]);

  const visibleGuideLinks = useMemo(() => {
    const prioritized = prioritizeByClassAndProfile(savedGuideLinks, profile);
    return filterByStudentClass(prioritized, profile.classLevel, myClassOnly);
  }, [savedGuideLinks, profile, myClassOnly]);

  const handleSaveCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = linkTitle.trim();
    const cleanUrl = linkUrl.trim();
    if (cleanTitle.length < 3) {
      setLinkError('Enter a descriptive title (at least 3 characters).');
      return;
    }
    if (!/^https?:\/\/.+/i.test(cleanUrl)) {
      setLinkError('Enter a valid http:// or https:// YouTube or guide URL.');
      return;
    }
    setLinkError(null);
    onAddGuideLink({
      id: `guide_${Date.now()}`,
      title: cleanTitle.slice(0, 140),
      url: cleanUrl.slice(0, 500),
      channelName: linkChannel.trim().slice(0, 80) || 'Student Guide Link',
      classLevel: linkClassLevel,
      subject: linkSubject,
      createdAt: new Date().toISOString(),
    });
    setLinkTitle('');
    setLinkUrl('');
    setLinkChannel('');
  };

  const handleGeneratePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTopic.trim() || genLoading) return;
    setGenLoading(true);
    setGenError(null);
    setSavedNotice(null);

    try {
      const resp = await authFetch('/api/ai/study-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: materialTopic.trim(),
          guideUrl: materialGuideUrl.trim() || undefined,
          subject: materialSubject,
          board: profile.board,
          classLevel: profile.classLevel,
          language: materialLanguage,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setGenError(data.error || 'Could not generate study material & daily quiz pack.');
        return;
      }
      setPackTitle(data.title || materialTopic.trim());
      setPackNotes(data.notesMarkdown || '');
      setPackTakeaways(Array.isArray(data.keyTakeaways) ? data.keyTakeaways : []);
      setPackCards(Array.isArray(data.flashcards) ? data.flashcards : []);
      setPackQuiz(Array.isArray(data.quiz) ? data.quiz : []);
      setQuizSelections({});
      setFlippedIdx(null);
    } catch (err: unknown) {
      setGenError(
        err instanceof Error ? err.message : 'Network error generating study material.'
      );
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="muse-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-400" />
              <span>Guides — Video Channels, DIKSHA, PM eVIDYA &amp; Study Pack Studio</span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Direct verified access to @WORKBOOKGURUJI, DIKSHA, PM eVIDYA 200 Educational TV Channels, NCERT CIET streams, plus Class {profile.classLevel} Study Material &amp; Daily Quiz generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMyClassOnly(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                myClassOnly
                  ? 'bg-teal-600 text-white border-teal-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              My Class ({profile.classLevel})
            </button>
            <button
              type="button"
              onClick={() => setMyClassOnly(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
                !myClassOnly
                  ? 'bg-teal-600 text-white border-teal-500'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              All Classes
            </button>
          </div>
        </div>

        {/* Featured @WORKBOOKGURUJI Channel Spotlight */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-rose-950/60 via-slate-900/90 to-indigo-950/70 border border-rose-500/35 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-300">
              <PlayCircle className="w-4 h-4" />
              <span>Featured Guide Video Channel</span>
            </div>
            <h2 className="font-display font-bold text-lg text-white">
              WORKBOOKGURUJI (@WORKBOOKGURUJI)
            </h2>
            <p className="text-xs text-slate-200 leading-relaxed">
              Curated chapter guides, workbook step-by-step solutions, and exam walk-through videos. Open the channel directly or generate Class {profile.classLevel} study notes &amp; daily quiz questions around any video topic below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="http://www.youtube.com/@WORKBOOKGURUJI"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Open @WORKBOOKGURUJI</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => {
                setMaterialGuideUrl('http://www.youtube.com/@WORKBOOKGURUJI');
                setMaterialTopic(`Class ${profile.classLevel} Workbook Guide & Practice`);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 whitespace-nowrap shrink-0"
            >
              Use Channel in Study Generator
            </button>
          </div>
        </div>
      </div>

      {/* Official Portals Grid: DIKSHA & PM eVIDYA */}
      <section className="muse-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-base">
              Official National &amp; State Guides ({visiblePortals.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Verified DIKSHA &amp; PM eVIDYA links for Classes 1–12 across CBSE, NCERT, and State Boards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <input
              type="text"
              value={portalSearch}
              onChange={(e) => setPortalSearch(e.target.value)}
              placeholder="Filter portals..."
              aria-label="Filter guide portals"
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs w-40"
            />
            <select
              aria-label="Filter portals by board"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Boards</option>
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter portals by language"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Languages</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visiblePortals.map((portal) => (
            <div key={portal.id} className="muse-panel p-4 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-teal-400">
                  <span>{portal.provider}</span>
                  <span className="text-[var(--text-muted)]">{portal.classRange}</span>
                </div>
                <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                  {portal.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {portal.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Visit Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMaterialGuideUrl(portal.url);
                    setMaterialTopic(`${portal.badge}: Class ${profile.classLevel} ${materialSubject}`);
                  }}
                  className="text-xs font-semibold text-teal-400 hover:underline"
                >
                  Study with Nano AI →
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Approved Educational Channels Directory ({DEFAULT_APPROVED_CHANNELS.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {DEFAULT_APPROVED_CHANNELS.map((ch) => (
              <div key={ch.id} className="muse-panel p-3 text-xs space-y-1">
                <div className="font-semibold text-[var(--text-primary)] flex items-center justify-between gap-2">
                  <span className="truncate">{ch.channelTitle}</span>
                  <span className="text-[11px] text-blue-400 shrink-0">{ch.handle}</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {ch.boards.slice(0, 3).join(', ')} · {ch.languages.slice(0, 3).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two-Column Interactive Workspace: Saved Video/Channel Links + AI Study Material & Daily Quiz Pack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Saved Guide Links */}
        <section className="lg:col-span-5 muse-card p-5 space-y-4 h-fit">
          <div>
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              <span>Saved Guide Videos &amp; Channel Links ({visibleGuideLinks.length})</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Add your teacher or channel video links organized by class and subject.
            </p>
          </div>

          <form onSubmit={handleSaveCustomLink} className="space-y-2.5">
            {linkError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {linkError}
              </div>
            )}
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Video or Guide Title (e.g., Class 9 Gravitation Guide)"
              aria-label="Guide link title"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://www.youtube.com/..."
              aria-label="Guide link URL"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={linkChannel}
                onChange={(e) => setLinkChannel(e.target.value)}
                placeholder="Channel name"
                aria-label="Guide channel name"
                className="px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
              <select
                aria-label="Guide link class"
                value={linkClassLevel}
                onChange={(e) => setLinkClassLevel(Number(e.target.value))}
                className="px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
              <select
                aria-label="Guide link subject"
                value={linkSubject}
                onChange={(e) => setLinkSubject(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-semibold muse-btn-primary flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Guide Link</span>
            </button>
          </form>

          <ul className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {visibleGuideLinks.map((gl) => (
              <li key={gl.id} className="muse-panel p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-teal-400 font-semibold">
                      Class {gl.classLevel} · {gl.subject} · {gl.channelName}
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {gl.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete saved guide ${gl.title}`}
                    onClick={() => onDeleteGuideLink(gl.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-rose-400 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <a
                    href={gl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Video/Channel</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setMaterialTopic(gl.title);
                      setMaterialSubject(gl.subject);
                      setMaterialGuideUrl(gl.url);
                    }}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    Generate Study Material →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Study Material + Daily Quiz Pack Generator */}
        <section className="lg:col-span-7 muse-card p-5 space-y-4">
          <div>
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Generate Study Material &amp; Daily Quiz Pack</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Enter any Class {profile.classLevel} topic or paste a guide video URL to create structured study notes, active-recall flashcards, and an interactive Daily Quiz.
            </p>
          </div>

          <form onSubmit={handleGeneratePack} className="space-y-3">
            <div>
              <label htmlFor="guide-pack-topic" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Topic or Chapter Title
              </label>
              <input
                id="guide-pack-topic"
                type="text"
                value={materialTopic}
                onChange={(e) => setMaterialTopic(e.target.value)}
                placeholder="e.g., Equations of Motion, Plant Cell Organelles, Heron's Formula"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
              />
            </div>

            <div>
              <label htmlFor="guide-pack-url" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Reference Guide / Video URL (Optional)
              </label>
              <input
                id="guide-pack-url"
                type="url"
                value={materialGuideUrl}
                onChange={(e) => setMaterialGuideUrl(e.target.value)}
                placeholder="http://www.youtube.com/@WORKBOOKGURUJI"
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                aria-label="Study material subject"
                value={materialSubject}
                onChange={(e) => setMaterialSubject(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                aria-label="Study material language"
                value={materialLanguage}
                onChange={(e) => setMaterialLanguage(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={genLoading || !materialTopic.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary disabled:opacity-50"
              >
                {genLoading
                  ? 'Generating Notes, Cards & Daily Quiz...'
                  : 'Generate Study Material & Daily Quiz Pack'}
              </button>
              {onAskAITeacher && (
                <button
                  type="button"
                  onClick={() =>
                    onAskAITeacher(
                      materialSubject,
                      `Explain ${materialTopic} for Class ${profile.classLevel} (${profile.board}) with key formulas and practice problems.`
                    )
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                >
                  Open in AI Assistant →
                </button>
              )}
            </div>
          </form>

          {genError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
              {genError}
            </div>
          )}

          {packTitle && (
            <div className="muse-panel p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <h3 className="font-display font-bold text-base">{packTitle}</h3>
                {packNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNote({
                        id: `note_guide_${Date.now()}`,
                        subject: materialSubject,
                        title: packTitle,
                        content: packNotes,
                        updatedAt: new Date().toISOString(),
                      });
                      setSavedNotice('Saved to My Notes!');
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                  >
                    {savedNotice || 'Save Notes Offline'}
                  </button>
                )}
              </div>

              {packNotes && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Structured Study Notes
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {packNotes}
                  </div>
                </div>
              )}

              {packTakeaways.length > 0 && (
                <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                  {packTakeaways.map((kt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{kt}</span>
                    </li>
                  ))}
                </ul>
              )}

              {packCards.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Revision Flashcards
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {packCards.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFlippedIdx(flippedIdx === idx ? null : idx)}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-left space-y-1 hover:border-purple-500/40"
                      >
                        <div className="text-[10px] uppercase font-semibold text-purple-400">
                          {flippedIdx === idx ? 'Answer' : `Card ${idx + 1} · Tap to Flip`}
                        </div>
                        <div className="text-xs font-medium">
                          {flippedIdx === idx ? c.back : c.front}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {packQuiz.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Daily Quiz Check ({packQuiz.length} Questions)
                  </div>
                  {packQuiz.map((q, idx) => {
                    const picked = quizSelections[idx];
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2"
                      >
                        <div className="text-xs font-semibold">
                          {idx + 1}. {q.prompt}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map((opt) => {
                            const isPicked = picked === opt;
                            const isCorrect = opt === q.correctAnswer;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setQuizSelections((s) => ({ ...s, [idx]: opt }))}
                                className={`px-3 py-1.5 rounded-lg text-left text-xs border ${
                                  picked
                                    ? isCorrect
                                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                                      : isPicked
                                        ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                                        : 'border-[var(--border-subtle)] opacity-70'
                                    : 'border-[var(--border-subtle)] hover:border-blue-500/40'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {picked && (
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
