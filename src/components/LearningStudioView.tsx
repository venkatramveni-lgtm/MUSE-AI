import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FileUp,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Video,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import {
  AssessmentMode,
  AssignmentSubmission,
  GeneratedVisualDiagram,
  LessonItem,
  QuizAttempt,
  SavedNote,
  UploadedDocItem,
  VideoCategory,
  VideoLesson,
} from '../types/muse';
import { MuseWorkspaceState } from '../services/workspaceStore';
import { authFetch } from '../services/firebaseClient';
import { OfflineCacheStatus } from '../services/offlineCacheService';
import { LessonCollectionFilter } from '../utils/offlineCache';
import { VIDEO_CATEGORIES } from '../utils/academyUtils';
import { validateDocumentUpload } from '../utils/plannerUtils';
import { LessonAcademyView } from './LessonAcademyView';
import { AssessmentCenterView } from './AssessmentCenterView';
import { ImageAcademyView } from './ImageAcademyView';
import { AssignmentCenterView, RevisionCenterView, VideoAcademyView } from './LearningToolsViews';

export type StudioTabId =
  | 'ai_studio'
  | 'lessons'
  | 'videos'
  | 'images'
  | 'assessments'
  | 'assignments'
  | 'revision';

interface LearningStudioViewProps {
  workspace: MuseWorkspaceState;
  initialTab?: StudioTabId;
  initialAssessmentMode?: AssessmentMode;
  lessonContextId?: string | null;
  lessonCollectionFilter?: LessonCollectionFilter;
  isOnline: boolean;
  swReady: boolean;
  offlineStatus: OfflineCacheStatus | null;
  onToggleComplete: (lesson: LessonItem) => void;
  onToggleBookmark: (lesson: LessonItem) => void;
  onToggleOfflineLesson: (lesson: LessonItem) => void;
  onSyncOfflineCache: () => Promise<void> | void;
  onAskAITeacher: (subject?: string, initialPrompt?: string) => void;
  onAskDocFollowUp?: (doc: UploadedDocItem, subject?: string) => void;
  onRecordAttempt: (attempt: QuizAttempt) => void;
  onMarkVideoWatched: (id: string) => void;
  onToggleVideoBookmark: (id: string) => void;
  onAddCustomVideo?: (video: VideoLesson) => void;
  onToggleStudiedImage: (id: string) => void;
  onToggleImageBookmark: (id: string) => void;
  onSaveGeneratedVisual: (visual: GeneratedVisualDiagram) => void;
  onOpenLesson?: (lessonId: string) => void;
  onSubmitAssignment: (sub: AssignmentSubmission) => void;
  onSaveNote: (note: SavedNote) => void;
  onDeleteNote: (noteId: string) => void;
  onSaveUploadedDoc: (doc: UploadedDocItem) => void;
  onScheduleLesson?: (lesson: LessonItem) => void;
  onFindVideos?: (lesson: LessonItem) => void;
}

interface GeneratedQuizQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export const LearningStudioView: React.FC<LearningStudioViewProps> = ({
  workspace,
  initialTab = 'ai_studio',
  initialAssessmentMode = 'daily_quiz',
  lessonContextId,
  lessonCollectionFilter,
  isOnline,
  swReady,
  offlineStatus,
  onToggleComplete,
  onToggleBookmark,
  onToggleOfflineLesson,
  onSyncOfflineCache,
  onAskAITeacher,
  onAskDocFollowUp,
  onRecordAttempt,
  onMarkVideoWatched,
  onToggleVideoBookmark,
  onAddCustomVideo,
  onToggleStudiedImage,
  onToggleImageBookmark,
  onSaveGeneratedVisual,
  onOpenLesson,
  onSubmitAssignment,
  onSaveNote,
  onDeleteNote,
  onSaveUploadedDoc,
  onScheduleLesson,
  onFindVideos,
}) => {
  const profile = workspace.profile!;
  const [activeTab, setActiveTab] = useState<StudioTabId>(initialTab);
  const [assessMode, setAssessMode] = useState<AssessmentMode>(initialAssessmentMode);
  const [videoCategory, setVideoCategory] = useState<'ALL' | VideoCategory>('ALL');

  // Sync external navigation jumps cleanly
  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setAssessMode(initialAssessmentMode);
  }, [initialAssessmentMode]);

  // AI Learning Studio Generator State
  const [topic, setTopic] = useState(
    profile.classLevel === 9
      ? 'Newton’s Laws of Motion & Cell Organelles'
      : 'Newton’s Laws of Motion'
  );
  const [genKind, setGenKind] = useState<'notes' | 'flashcards' | 'quiz' | 'complete_pack'>('complete_pack');
  const [guideUrl, setGuideUrl] = useState('');
  const [subject, setSubject] = useState(profile.subjects[0] || 'Science');
  const [language, setLanguage] = useState(profile.preferredLanguage || 'English');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [generatedTakeaways, setGeneratedTakeaways] = useState<string[]>([]);
  const [generatedCards, setGeneratedCards] = useState<{ front: string; back: string }[]>([]);
  const [flippedCardIdx, setFlippedCardIdx] = useState<number | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<GeneratedQuizQuestion[]>([]);
  const [quizSelections, setQuizSelections] = useState<Record<number, string>>({});

  // Document & Image Analyzer State
  const [docAction, setDocAction] = useState<'summarize' | 'extract' | 'notes'>('notes');
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const runStudioGenerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || genLoading) return;
    setGenLoading(true);
    setGenError(null);
    try {
      const resp = await authFetch('/api/ai/studio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          kind: genKind,
          guideUrl: guideUrl.trim() || undefined,
          subject,
          board: profile.board,
          classLevel: profile.classLevel,
          language,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setGenError(data.error || 'Failed to generate study material.');
        return;
      }
      setGeneratedTitle(data.title || topic);
      setGeneratedNotes(data.notesMarkdown || '');
      setGeneratedTakeaways(Array.isArray(data.keyTakeaways) ? data.keyTakeaways : []);
      setGeneratedCards(Array.isArray(data.flashcards) ? data.flashcards : []);
      setGeneratedQuiz(Array.isArray(data.quiz) ? data.quiz : []);
      setQuizSelections({});
      setFlippedCardIdx(null);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Network error generating content.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const check = validateDocumentUpload(file.type || 'text/plain', file.size);
    if (!check.valid) {
      setDocError(check.reason || 'Invalid file.');
      return;
    }

    setDocError(null);
    setDocLoading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('Could not read selected file.'));
        reader.readAsDataURL(file);
      });

      const resp = await authFetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          base64Data,
          action: docAction,
          language,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setDocError(data.error || 'Could not analyze uploaded document.');
        return;
      }

      onSaveUploadedDoc({
        id: `doc_${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        summary: data.summary,
        keyPoints: data.keyPoints || [],
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : 'Document processing failed.');
    } finally {
      setDocLoading(false);
    }
  };

  const tabs: { id: StudioTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ai_studio', label: 'AI Generators & Docs', icon: Sparkles },
    { id: 'lessons', label: 'Learning Academy', icon: BookOpen },
    { id: 'videos', label: 'Video Academy', icon: Video },
    { id: 'images', label: 'Image Academy', icon: ImageIcon },
    { id: 'assessments', label: 'Quizzes & Tests', icon: ClipboardCheck },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'revision', label: 'Notes & Flashcards', icon: Layers },
  ];

  return (
    <div className="space-y-5">
      {/* Studio Sub-navigation Header */}
      <div className="muse-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">Learning Studio</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Learning Academy · Video Academy · Image Academy · AI Generators · Quizzes &amp; Revision
          </p>
        </div>

        <div role="tablist" aria-label="Learning Studio sections" className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'muse-btn-primary'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'ai_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* AI Notes / Flashcards / Quiz Generator */}
          <div className="lg:col-span-7 min-w-0 muse-card p-5 space-y-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>AI Homework, Notes, Flashcard &amp; Quiz Generator</span>
            </h2>

            <form onSubmit={runStudioGenerator} className="space-y-3">
              <div>
                <label htmlFor="studio-topic" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Topic or Chapter
                </label>
                <input
                  id="studio-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter any topic, chapter, or homework question..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
                />
              </div>

              <div>
                <label htmlFor="studio-guide-url" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Reference Video / Guide URL (Optional — e.g. @WORKBOOKGURUJI or DIKSHA)
                </label>
                <input
                  id="studio-guide-url"
                  type="url"
                  value={guideUrl}
                  onChange={(e) => setGuideUrl(e.target.value)}
                  placeholder="http://www.youtube.com/@WORKBOOKGURUJI"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  aria-label="Studio output type"
                  value={genKind}
                  onChange={(e) =>
                    setGenKind(
                      e.target.value as 'notes' | 'flashcards' | 'quiz' | 'complete_pack'
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  <option value="complete_pack">Complete Study Pack (Notes + Cards + Daily Quiz)</option>
                  <option value="notes">Structured Notes &amp; Summary</option>
                  <option value="flashcards">Active-Recall Flashcards</option>
                  <option value="quiz">5-Question Practice Quiz</option>
                </select>

                <select
                  aria-label="Studio subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  {CORE_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  aria-label="Studio language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={genLoading || !topic.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary disabled:opacity-50"
                >
                  {genLoading ? 'Generating with Gemini...' : 'Generate Study Material'}
                </button>
                <button
                  type="button"
                  onClick={() => onAskAITeacher(subject, `Explain ${topic} step by step with examples.`)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                >
                  Deep-Dive in AI Assistant →
                </button>
              </div>
            </form>

            {genError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {genError}
              </div>
            )}

            {generatedTitle && (
              <div className="muse-panel p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-base">{generatedTitle}</h3>
                  {generatedNotes && (
                    <button
                      type="button"
                      onClick={() =>
                        onSaveNote({
                          id: `note_ai_${Date.now()}`,
                          subject,
                          title: generatedTitle,
                          content: generatedNotes,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    >
                      Save to My Notes
                    </button>
                  )}
                </div>

                {generatedNotes && (
                  <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {generatedNotes}
                  </div>
                )}

                {generatedTakeaways.length > 0 && (
                  <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                    {generatedTakeaways.map((k, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{k}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {generatedCards.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {generatedCards.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFlippedCardIdx(flippedCardIdx === idx ? null : idx)}
                        className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-left space-y-1 hover:border-blue-500/40"
                      >
                        <div className="text-[10px] uppercase font-semibold text-blue-400">
                          {flippedCardIdx === idx ? 'Answer' : `Card ${idx + 1} · Tap to Flip`}
                        </div>
                        <div className="text-xs font-medium">
                          {flippedCardIdx === idx ? c.back : c.front}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {generatedQuiz.length > 0 && (
                  <div className="space-y-3">
                    {generatedQuiz.map((q, idx) => {
                      const picked = quizSelections[idx];
                      return (
                        <div key={idx} className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
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
          </div>

          {/* Document & Image AI Analyzer */}
          <div className="lg:col-span-5 min-w-0 muse-card p-5 space-y-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-purple-400" />
              <span>Document &amp; Image AI Analyzer</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Upload a PDF, textbook photo (PNG/JPG/WEBP), or text note to generate summaries, key extracts, or study notes.
            </p>

            <div className="space-y-2.5">
              <select
                aria-label="Document analysis action"
                value={docAction}
                onChange={(e) => setDocAction(e.target.value as 'summarize' | 'extract' | 'notes')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="notes">Convert into Study Notes</option>
                <option value="summarize">Summarize Document</option>
                <option value="extract">Extract Key Formulas &amp; Facts</option>
              </select>

              <label className="block p-4 rounded-xl border border-dashed border-blue-500/40 bg-[var(--bg-elevated)] text-center cursor-pointer hover:border-blue-400">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
                  aria-label="Upload PDF, image, or text document"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
                <div className="text-xs font-semibold text-blue-400">
                  {docLoading ? 'Analyzing file with Gemini...' : 'Click to Upload PDF, Image, or Text (max 8 MB)'}
                </div>
              </label>
            </div>

            {docError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {docError}
              </div>
            )}

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto">
              {workspace.uploadedDocs.length === 0 ? (
                <div className="muse-panel p-4 text-xs text-[var(--text-muted)]">
                  Analyzed documents and extracted study notes appear here.
                </div>
              ) : (
                workspace.uploadedDocs.map((doc) => (
                  <div key={doc.id} className="muse-panel p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--text-primary)] truncate">{doc.name}</span>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {onAskDocFollowUp && (
                          <button
                            type="button"
                            onClick={() => onAskDocFollowUp(doc, subject)}
                            className="text-blue-400 font-semibold hover:underline"
                          >
                            Ask AI Follow-Up
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onSaveNote({
                              id: `note_doc_${Date.now()}`,
                              subject,
                              title: `Notes: ${doc.name}`,
                              content: doc.summary,
                              updatedAt: new Date().toISOString(),
                            })
                          }
                          className="text-emerald-400 font-semibold hover:underline"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{doc.summary}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dedicated Video Academy & Organized Tutorials Quick Launcher inside Learning Studio */}
          <div className="lg:col-span-12 muse-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base flex items-center gap-2">
                  <Video className="w-4 h-4 text-sky-400" />
                  <span>Video Academy &amp; Guided Tutorials ({workspace.videos.length})</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Browse organized video walkthroughs and step-by-step tutorials filtered by category, board, and subject.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVideoCategory('ALL');
                  setActiveTab('videos');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary whitespace-nowrap shrink-0"
              >
                Open Video Academy Tab
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {VIDEO_CATEGORIES.map((category) => {
                const items = workspace.videos.filter(
                  (v) => (v.category || 'Concept Explained') === category
                );
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setVideoCategory(category);
                      setActiveTab('videos');
                    }}
                    className="text-left muse-panel p-3.5 space-y-1.5 hover:border-sky-500/50 transition"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-sky-400">
                      <span>{category}</span>
                      <span className="tabular-nums text-[var(--text-muted)]">{items.length}</span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {items[0] ? items[0].title : 'Curated video walkthroughs & tutorials'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lessons' && (
        <LessonAcademyView
          profile={profile}
          lessons={workspace.lessons}
          progress={workspace.progress}
          offlineLessonIds={workspace.offlineLessonIds}
          initialLessonId={lessonContextId}
          initialCollectionFilter={lessonCollectionFilter}
          isOnline={isOnline}
          swReady={swReady}
          onToggleComplete={onToggleComplete}
          onToggleBookmark={onToggleBookmark}
          onToggleOfflineLesson={onToggleOfflineLesson}
          onSyncOfflineCache={onSyncOfflineCache}
          onAskAITeacher={(sub?: string) => onAskAITeacher(sub)}
          onScheduleLesson={onScheduleLesson}
          onFindVideos={onFindVideos}
        />
      )}

      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'daily_quiz' as const, label: 'Daily Quiz' },
              { id: 'weekly_test' as const, label: 'Weekly Exam' },
              { id: 'practice' as const, label: 'Practice Sets' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAssessMode(m.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                  assessMode === m.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <AssessmentCenterView
            mode={assessMode}
            profile={profile}
            assessments={workspace.assessments}
            questions={workspace.questions}
            attempts={workspace.attempts}
            onRecordAttempt={onRecordAttempt}
          />
        </div>
      )}

      {activeTab === 'videos' && (
        <VideoAcademyView
          profile={profile}
          videos={workspace.videos}
          watchedIds={workspace.watchedVideoIds}
          bookmarkedIds={workspace.bookmarkedVideoIds}
          initialCategory={videoCategory}
          onMarkWatched={onMarkVideoWatched}
          onToggleBookmark={onToggleVideoBookmark}
          onAddCustomVideo={onAddCustomVideo}
          onAskAITeacher={(sub?: string, prompt?: string) => onAskAITeacher(sub, prompt)}
        />
      )}

      {activeTab === 'images' && (
        <ImageAcademyView
          profile={profile}
          images={workspace.images}
          studiedIds={workspace.studiedImageIds}
          bookmarkedIds={workspace.bookmarkedImageIds}
          generatedVisuals={workspace.generatedVisuals}
          uploadedDocs={workspace.uploadedDocs}
          onToggleStudied={onToggleStudiedImage}
          onToggleBookmark={onToggleImageBookmark}
          onSaveGeneratedVisual={onSaveGeneratedVisual}
          onSaveUploadedDoc={onSaveUploadedDoc}
          onSaveNote={onSaveNote}
          onOpenLesson={(lessonId) => {
            if (onOpenLesson) {
              onOpenLesson(lessonId);
            } else {
              setActiveTab('lessons');
            }
          }}
          onAskAITeacher={(sub?: string, prompt?: string) => onAskAITeacher(sub, prompt)}
          onAskDocFollowUp={onAskDocFollowUp}
        />
      )}

      {activeTab === 'assignments' && (
        <AssignmentCenterView
          profile={profile}
          assignments={workspace.assignments}
          submissions={workspace.submissions}
          onSubmitAssignment={onSubmitAssignment}
        />
      )}

      {activeTab === 'revision' && (
        <RevisionCenterView
          workspace={workspace}
          offlineStatus={offlineStatus}
          isOnline={isOnline}
          onSaveNote={onSaveNote}
          onDeleteNote={onDeleteNote}
        />
      )}
    </div>
  );
};
