import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Box,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Image as ImageIcon,
  Layers,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import { IMAGE_ASSET_BY_KEY } from '../data/academyMedia';
import {
  GeneratedVisualDiagram,
  ImageLessonItem,
  SavedNote,
  UploadedDocItem,
  UserProfile,
} from '../types/muse';
import {
  clampZoomScale,
  filterImageLibrary,
  ImageCollectionFilter,
} from '../utils/academyUtils';
import { validateDocumentUpload } from '../utils/plannerUtils';
import { XRSpatialLab } from './XRSpatialLab';

interface ImageAcademyViewProps {
  profile: UserProfile;
  images: ImageLessonItem[];
  studiedIds: string[];
  bookmarkedIds: string[];
  generatedVisuals: GeneratedVisualDiagram[];
  uploadedDocs: UploadedDocItem[];
  onToggleStudied: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onSaveGeneratedVisual: (visual: GeneratedVisualDiagram) => void;
  onSaveUploadedDoc: (doc: UploadedDocItem) => void;
  onSaveNote: (note: SavedNote) => void;
  onOpenLesson: (lessonId: string) => void;
  onAskAITeacher: (subject?: string, initialPrompt?: string) => void;
}

export const ImageAcademyView: React.FC<ImageAcademyViewProps> = ({
  profile,
  images,
  studiedIds,
  bookmarkedIds,
  generatedVisuals,
  uploadedDocs,
  onToggleStudied,
  onToggleBookmark,
  onSaveGeneratedVisual,
  onSaveUploadedDoc,
  onSaveNote,
  onOpenLesson,
  onAskAITeacher,
}) => {
  const [studioMode, setStudioMode] = useState<'library' | 'ai_visuals'>('library');
  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [collectionFilter, setCollectionFilter] = useState<ImageCollectionFilter>('all');

  const [selectedId, setSelectedId] = useState<string>(images[0]?.id || '');
  const [activeHotspotIdx, setActiveHotspotIdx] = useState(0);
  const [showHotspots, setShowHotspots] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [show3DCompanion, setShow3DCompanion] = useState(false);
  const [brokenImgIds, setBrokenImgIds] = useState<Record<string, boolean>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // AI Visual Diagram Studio state
  const [diagramTopic, setDiagramTopic] = useState('Human Heart Blood Circulation');
  const [diagramSubject, setDiagramSubject] = useState(profile.subjects[0] || 'Science');
  const [diagramLanguage, setDiagramLanguage] = useState(profile.preferredLanguage || 'English');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const studiedSet = useMemo(() => new Set(studiedIds), [studiedIds]);
  const bookmarkedSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const filteredImages = useMemo(
    () =>
      filterImageLibrary(images, {
        board: boardFilter,
        classLevel: classFilter,
        subject: subjectFilter,
        search,
        collectionFilter,
        studiedIds,
        bookmarkedIds,
      }),
    [images, boardFilter, classFilter, subjectFilter, search, collectionFilter, studiedIds, bookmarkedIds]
  );

  const activeImage =
    images.find((img) => img.id === selectedId) || filteredImages[0] || images[0];

  const activeHotspot =
    activeImage?.hotspots[activeHotspotIdx] || activeImage?.hotspots[0] || null;

  const activeAssetUrl = activeImage ? IMAGE_ASSET_BY_KEY[activeImage.mediaKey] : '';

  const handleSelectImage = (img: ImageLessonItem) => {
    setSelectedId(img.id);
    setActiveHotspotIdx(0);
    setZoomScale(1);
    setShow3DCompanion(false);
  };

  const handleDownloadVisual = (img: ImageLessonItem) => {
    const src = IMAGE_ASSET_BY_KEY[img.mediaKey];
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `${img.id}.jpg`;
    a.click();
  };

  const handleGenerateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagramTopic.trim() || diagramLoading) return;
    setDiagramLoading(true);
    setDiagramError(null);
    try {
      const resp = await fetch('/api/ai/visual-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: diagramTopic.trim(),
          subject: diagramSubject,
          board: profile.board,
          classLevel: profile.classLevel,
          language: diagramLanguage,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setDiagramError(data.error || 'Could not generate AI visual diagram.');
        return;
      }
      onSaveGeneratedVisual({
        id: `vis_${Date.now()}`,
        title: data.title || diagramTopic.trim(),
        topic: diagramTopic.trim(),
        subject: diagramSubject,
        summary: data.summary || '',
        keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
        hotspots: Array.isArray(data.hotspots) ? data.hotspots : [],
        svgMarkup: data.svgMarkup || '',
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setDiagramError(err instanceof Error ? err.message : 'Network error generating visual diagram.');
    } finally {
      setDiagramLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateDocumentUpload(file.type || 'image/png', file.size);
    if (!check.valid) {
      setPhotoError(check.reason || 'Invalid image file.');
      return;
    }
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || '');
          const idx = res.indexOf(',');
          resolve(idx >= 0 ? res.slice(idx + 1) : res);
        };
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'image/png',
          base64Data,
          action: 'extract',
          language: diagramLanguage,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setPhotoError(data.error || 'Could not analyze uploaded textbook photo.');
        return;
      }
      onSaveUploadedDoc({
        id: `doc_img_${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'image/png',
        summary: data.summary,
        keyPoints: data.keyPoints || [],
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Photo explanation failed.');
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="muse-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl">Image Academy</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Interactive curriculum illustrations, labeled concept hotspots, textbook photo analysis, and AI concept diagrams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStudioMode('library')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                studioMode === 'library'
                  ? 'muse-btn-primary'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Visual Library ({images.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('ai_visuals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                studioMode === 'ai_visuals'
                  ? 'muse-btn-primary'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Diagram &amp; Photo Studio</span>
            </button>
          </div>
        </div>

        {studioMode === 'library' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: `All Visuals (${images.length})` },
                  { id: 'bookmarked', label: `Bookmarked (${bookmarkedIds.length})` },
                  { id: 'studied', label: `Studied (${studiedIds.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCollectionFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                    collectionFilter === tab.id
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search diagrams, chapters, labels..."
                  aria-label="Search Image Academy visuals"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <select
                aria-label="Filter visuals by board"
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
                aria-label="Filter visuals by class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Classes (1–10)</option>
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              <select
                aria-label="Filter visuals by subject"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Subjects</option>
                {Array.from(new Set(images.map((i) => i.subject))).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {studioMode === 'library' && (
        <div className="grid lg:grid-cols-12 gap-5">
          {/* Gallery List */}
          <aside className="lg:col-span-4 space-y-3">
            {filteredImages.length === 0 ? (
              <div className="muse-card p-5 text-xs text-[var(--text-muted)]">
                No educational visuals match these filters. Clear filters to view all Muse Image Academy plates.
              </div>
            ) : (
              filteredImages.map((img) => {
                const thumbSrc = IMAGE_ASSET_BY_KEY[img.mediaKey];
                const isSelected = img.id === activeImage?.id;
                const isStudied = studiedSet.has(img.id);
                const isBookmarked = bookmarkedSet.has(img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSelectImage(img)}
                    className={`w-full text-left muse-card p-3 flex items-center gap-3 border transition ${
                      isSelected ? 'border-blue-500 bg-[var(--bg-subtle)]' : 'hover:border-blue-500/40'
                    }`}
                  >
                    <div className="w-24 aspect-[4/3] rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                      {!brokenImgIds[img.id] && thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenImgIds((b) => ({ ...b, [img.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                        <span className="truncate">{img.board} · Class {img.classLevel} · {img.subject}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {isBookmarked && <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          {isStudied && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </span>
                      </div>
                      <div className="text-sm font-semibold line-clamp-2">{img.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {img.hotspots.length} interactive labels
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          {/* Interactive Visual Inspection Stage */}
          {activeImage && (
            <div className="lg:col-span-8 space-y-5">
              <div className="muse-card p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--text-muted)]">
                      {activeImage.board} · Class {activeImage.classLevel} · {activeImage.subject} · {activeImage.chapter}
                    </div>
                    <h2 className="font-display font-bold text-xl">{activeImage.title}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(activeImage.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border flex items-center gap-1.5 ${
                        bookmarkedSet.has(activeImage.id)
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{bookmarkedSet.has(activeImage.id) ? 'Bookmarked' : 'Bookmark'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStudied(activeImage.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        studiedSet.has(activeImage.id)
                          ? 'bg-emerald-600 text-white'
                          : 'muse-btn-primary'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{studiedSet.has(activeImage.id) ? 'Studied' : 'Mark Studied'}</span>
                    </button>
                  </div>
                </div>

                {/* Stage Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-label="Zoom out visual"
                      onClick={() => setZoomScale((z) => clampZoomScale(z - 0.25))}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs flex items-center gap-1"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                      <span>Zoom Out</span>
                    </button>
                    <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] px-1">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      aria-label="Zoom in visual"
                      onClick={() => setZoomScale((z) => clampZoomScale(z + 0.25))}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs flex items-center gap-1"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Zoom In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHotspots((s) => !s)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1.5"
                    >
                      {showHotspots ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{showHotspots ? 'Labels: ON' : 'Labels: OFF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadVisual(activeImage)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Zoomable Visual Plate with Interactive Hotspot Pins */}
                <div className="relative rounded-xl overflow-auto border border-[var(--border-subtle)] bg-slate-950">
                  <div
                    className="relative mx-auto transition-transform duration-200 origin-center"
                    style={{ transform: `scale(${zoomScale})` }}
                  >
                    {!brokenImgIds[activeImage.id] && activeAssetUrl ? (
                      <img
                        src={activeAssetUrl}
                        alt={activeImage.title}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImgIds((b) => ({ ...b, [activeImage.id]: true }))}
                        className="w-full h-auto block object-contain max-h-[460px]"
                      />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 flex flex-col items-center justify-center gap-2 p-6 text-center">
                        <ImageIcon className="w-10 h-10 text-blue-300" />
                        <div className="font-display font-bold text-base text-white">{activeImage.title}</div>
                        <p className="text-xs text-slate-300 max-w-md">{activeImage.summary}</p>
                      </div>
                    )}

                    {showHotspots &&
                      activeImage.hotspots.map((hs, idx) => {
                        const isActive = idx === activeHotspotIdx;
                        return (
                          <button
                            key={hs.id}
                            type="button"
                            aria-label={`Inspect ${hs.label}`}
                            onClick={() => setActiveHotspotIdx(idx)}
                            style={{ left: `${hs.xPercent}%`, top: `${hs.yPercent}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 shadow-lg transition ${
                              isActive
                                ? 'bg-blue-600 text-white border-white scale-110'
                                : 'bg-slate-900/90 text-blue-200 border-blue-400 hover:scale-105'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Concept Hotspot Deck */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeImage.hotspots.map((hs, idx) => (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setActiveHotspotIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                          idx === activeHotspotIdx
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {idx + 1}. {hs.label}
                      </button>
                    ))}
                  </div>

                  {activeHotspot && (
                    <div className="muse-panel p-4 space-y-1">
                      <div className="text-xs font-semibold text-blue-400">
                        Selected Concept Label · {activeHotspot.label}
                      </div>
                      <p className="text-sm text-[var(--text-primary)]">{activeHotspot.detail}</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{activeImage.summary}</p>

                <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                  {activeImage.keyTakeaways.map((tk) => (
                    <li key={tk} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{tk}</span>
                    </li>
                  ))}
                </ul>

                {/* Quick Connected Muse Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                  {activeImage.linkedLessonId && (
                    <button
                      type="button"
                      onClick={() => onOpenLesson(activeImage.linkedLessonId!)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                      <span>Open Linked Lesson</span>
                    </button>
                  )}
                  {activeImage.xrModelId && (
                    <button
                      type="button"
                      onClick={() => setShow3DCompanion((s) => !s)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-purple-500/40 flex items-center gap-1.5"
                    >
                      <Box className="w-3.5 h-3.5 text-purple-400" />
                      <span>{show3DCompanion ? 'Hide 3D Model' : 'Launch 3D XR Model'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onAskAITeacher(
                        activeImage.subject,
                        `Explain the visual diagram "${activeImage.title}" step by step, including ${activeImage.hotspots.map((h) => h.label).join(', ')}.`
                      )
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Explain with Muse AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNote({
                        id: `note_img_${Date.now()}`,
                        subject: activeImage.subject,
                        title: `Visual Notes: ${activeImage.title}`,
                        content: `${activeImage.summary}\n\nKey Labels:\n${activeImage.hotspots.map((h) => `- ${h.label}: ${h.detail}`).join('\n')}`,
                        updatedAt: new Date().toISOString(),
                      });
                      setSavedNotice('Saved to Notes!');
                      window.setTimeout(() => setSavedNotice(null), 2200);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{savedNotice || 'Save Key Labels to Notes'}</span>
                  </button>
                </div>
              </div>

              {show3DCompanion && activeImage.xrModelId && (
                <XRSpatialLab
                  modelId={activeImage.xrModelId}
                  title={`3D Companion: ${activeImage.title}`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {studioMode === 'ai_visuals' && (
        <div className="grid lg:grid-cols-12 gap-5">
          {/* AI Concept Diagram Composer */}
          <div className="lg:col-span-7 muse-card p-5 space-y-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>AI Concept Diagram Generator</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Enter any school topic and Muse AI generates a labeled SVG concept diagram with clickable takeaways.
            </p>

            <form onSubmit={handleGenerateDiagram} className="space-y-3">
              <div>
                <label htmlFor="img-studio-topic" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Topic to Visualize
                </label>
                <input
                  id="img-studio-topic"
                  type="text"
                  value={diagramTopic}
                  onChange={(e) => setDiagramTopic(e.target.value)}
                  placeholder="e.g., Human Heart Blood Circulation, Volcano Cross-Section, Ohm's Law Circuit"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  aria-label="Diagram subject"
                  value={diagramSubject}
                  onChange={(e) => setDiagramSubject(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  {CORE_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Diagram language"
                  value={diagramLanguage}
                  onChange={(e) => setDiagramLanguage(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={diagramLoading || !diagramTopic.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary disabled:opacity-50"
              >
                {diagramLoading ? 'Creating Visual Diagram...' : 'Generate Visual Diagram'}
              </button>
            </form>

            {diagramError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {diagramError}
              </div>
            )}

            <div className="space-y-4">
              {generatedVisuals.length === 0 ? (
                <div className="muse-panel p-4 text-xs text-[var(--text-muted)]">
                  Your AI-generated labeled concept diagrams will appear here ready to save into Notes.
                </div>
              ) : (
                generatedVisuals.map((vis) => (
                  <div key={vis.id} className="muse-panel p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-[var(--text-muted)]">{vis.subject}</div>
                        <h3 className="font-display font-bold text-base">{vis.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveNote({
                            id: `note_vis_${Date.now()}`,
                            subject: vis.subject,
                            title: vis.title,
                            content: `${vis.summary}\n\n${vis.keyTakeaways.join('\n')}`,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                      >
                        Save to Notes
                      </button>
                    </div>
                    <div
                      className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-slate-950"
                      dangerouslySetInnerHTML={{ __html: vis.svgMarkup }}
                    />
                    <p className="text-xs text-[var(--text-secondary)]">{vis.summary}</p>
                    {vis.hotspots.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {vis.hotspots.map((h) => (
                          <div key={h.label} className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                            <div className="font-semibold text-blue-400">{h.label}</div>
                            <div className="text-[var(--text-muted)] mt-0.5">{h.detail}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upload & Explain Textbook Image */}
          <div className="lg:col-span-5 muse-card p-5 space-y-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-purple-400" />
              <span>Upload &amp; Explain Textbook Image</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Upload any science diagram, geometry figure, map, or textbook page image (PNG, JPG, WEBP) to extract labels and study notes.
            </p>

            <label className="block p-5 rounded-xl border border-dashed border-purple-500/40 bg-[var(--bg-elevated)] text-center cursor-pointer hover:border-purple-400">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                aria-label="Upload textbook or diagram image"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <div className="text-xs font-semibold text-purple-300">
                {photoLoading ? 'Analyzing Image with Gemini...' : 'Click to Upload Diagram / Textbook Photo (max 8 MB)'}
              </div>
            </label>

            {photoError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {photoError}
              </div>
            )}

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {uploadedDocs.filter((d) => d.mimeType.startsWith('image/')).length === 0 ? (
                <div className="muse-panel p-4 text-xs text-[var(--text-muted)]">
                  Analyzed textbook photos and extracted visual takeaways appear here.
                </div>
              ) : (
                uploadedDocs
                  .filter((d) => d.mimeType.startsWith('image/'))
                  .map((doc) => (
                    <div key={doc.id} className="muse-panel p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold truncate">{doc.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onSaveNote({
                              id: `note_photo_${Date.now()}`,
                              subject: diagramSubject,
                              title: `Photo Notes: ${doc.name}`,
                              content: doc.summary,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                          className="text-emerald-400 font-semibold hover:underline shrink-0"
                        >
                          Save Note
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{doc.summary}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
