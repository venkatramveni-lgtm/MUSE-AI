import React, { useEffect, useState } from 'react';
import {
  Ban,
  BookOpen,
  CheckCircle2,
  ClipboardPlus,
  Download,
  Flag,
  Globe,
  ListVideo,
  Plus,
  RefreshCw,
  Shield,
  Users,
  Video,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import {
  ApprovedChannelEntry,
  AssignmentItem,
  EducationBoard,
  EducationContentReport,
  EducationPlaylistItem,
  EducationVideoItem,
  LessonItem,
  QuestionItem,
  UserRole,
} from '../types/muse';
import { MuseWorkspaceState } from '../services/workspaceStore';
import { computeSubjectProgress } from '../utils/academicEngine';

/* ---------------- PARENT PORTAL ---------------- */
export const ParentPortalView: React.FC<{
  workspace: MuseWorkspaceState;
  onToggleConsent: (linkId: string) => void;
}> = ({ workspace, onToggleConsent }) => {
  const activeLink = workspace.parentLinks[0];
  const profile = workspace.profile!;
  const subjectProgress = computeSubjectProgress(
    workspace.lessons,
    workspace.progress,
    workspace.attempts
  );

  const downloadParentReport = () => {
    const lines = [
      `MUSE AI GUARDIAN PROGRESS REPORT`,
      `Student: ${profile.displayName} (${profile.board} Class ${profile.classLevel})`,
      `Guardian Consent: ${activeLink?.consentGranted ? 'Active' : 'Revoked'}`,
      `Lessons Completed: ${workspace.progress.filter((p) => p.completed).length}`,
      `Assessments Submitted: ${workspace.attempts.length}`,
      ...subjectProgress.map((s) => `- ${s.subject}: ${s.lessonPercentage}% lessons`),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parent_report_${profile.uid}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Parent & Guardian Portal
          </div>
          <h1 className="font-display font-bold text-xl">
            Linked Student: {activeLink?.studentDisplayName || profile.displayName}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Access restricted strictly to authorized parent-student links with explicit guardian consent.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadParentReport}
          className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Download Child Report
        </button>
      </div>

      {activeLink && (
        <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-base">Privacy & Guardian Consent</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Current Link Status: <strong>{activeLink.status}</strong> • Consent: <strong>{activeLink.consentGranted ? 'Granted' : 'Paused'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleConsent(activeLink.id)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
          >
            {activeLink.consentGranted ? 'Pause Access Consent' : 'Grant Access Consent'}
          </button>
        </div>
      )}

      {!activeLink?.consentGranted ? (
        <div className="muse-card p-6 text-sm font-medium text-[var(--accent-amber)]">
          Student academic details are hidden while guardian link consent is paused.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base">Subject Academic Progress</h2>
            {subjectProgress.map((s) => (
              <div key={s.subject} className="muse-panel p-3 flex items-center justify-between text-xs">
                <span className="font-semibold">{s.subject}</span>
                <span>
                  {s.completedLessons}/{s.totalLessons} lessons •{' '}
                  {s.averageQuizScore !== null ? `${s.averageQuizScore}% quiz avg` : 'No quiz yet'}
                </span>
              </div>
            ))}
          </div>

          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base">Assignment & Exam Status</h2>
            <div className="space-y-2">
              {workspace.assignments.map((a) => {
                const sub = workspace.submissions.find((s) => s.assignmentId === a.id);
                return (
                  <div key={a.id} className="muse-panel p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-[var(--text-muted)]">Due {a.dueDate}</div>
                    </div>
                    <span className={sub ? 'text-[var(--accent-emerald)] font-semibold' : 'text-[var(--accent-amber)] font-semibold'}>
                      {sub ? sub.status : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- TEACHER PORTAL ---------------- */
export const TeacherPortalView: React.FC<{
  workspace: MuseWorkspaceState;
  onCreateAssignment: (a: AssignmentItem) => void;
  onCreateQuestionAndQuiz: (q: QuestionItem, quizTitle: string) => void;
  onReviewSubmission: (submissionId: string, feedback: string, grade: string) => void;
}> = ({ workspace, onCreateAssignment, onCreateQuestionAndQuiz, onReviewSubmission }) => {
  const profile = workspace.profile!;
  const [asgnTitle, setAsgnTitle] = useState('');
  const [asgnDesc, setAsgnDesc] = useState('');
  const [asgnSubject, setAsgnSubject] = useState('Science');
  const [asgnBoard, setAsgnBoard] = useState<EducationBoard>('CBSE');
  const [asgnClass, setAsgnClass] = useState(7);
  const [asgnDue, setAsgnDue] = useState('2026-11-28');

  const [quizTitle, setQuizTitle] = useState('');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qCorrect, setQCorrect] = useState('A');
  const [qExpl, setQExpl] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [gradeDraft, setGradeDraft] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const handleCreateAsgn = (e: React.FormEvent) => {
    e.preventDefault();
    if (asgnTitle.trim().length < 3 || asgnDesc.trim().length < 5) return;
    onCreateAssignment({
      id: `asgn_${Date.now()}`,
      teacherUid: profile.uid,
      teacherName: profile.displayName,
      title: asgnTitle.trim(),
      description: asgnDesc.trim(),
      subject: asgnSubject,
      board: asgnBoard,
      classLevel: asgnClass,
      dueDate: asgnDue,
      createdAt: new Date().toISOString(),
    });
    setAsgnTitle('');
    setAsgnDesc('');
    setNotice('Assignment published to Assignment Centre.');
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim() || !qPrompt.trim() || !qOptA.trim() || !qOptB.trim()) return;
    const correctText = qCorrect === 'A' ? qOptA.trim() : qOptB.trim();
    const newQ: QuestionItem = {
      id: `q_teacher_${Date.now()}`,
      board: asgnBoard,
      classLevel: asgnClass,
      subject: asgnSubject,
      chapter: 'Teacher Custom Unit',
      topic: quizTitle.trim(),
      type: 'mcq',
      difficulty: 'medium',
      prompt: qPrompt.trim(),
      options: [qOptA.trim(), qOptB.trim()],
      correctAnswer: correctText,
      explanation: qExpl.trim() || `Correct option is ${correctText}.`,
      createdBy: profile.uid,
    };
    onCreateQuestionAndQuiz(newQ, quizTitle.trim());
    setQuizTitle('');
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQExpl('');
    setNotice('Quiz published to Daily Quiz!');
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Teacher Portal
          </div>
          <h1 className="font-display font-bold text-xl">Class, Quiz & Assignment Management</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Create real assignments and quizzes, review student submissions, and track class results.
          </p>
        </div>
        {notice && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
            {notice}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <form onSubmit={handleCreateAsgn} className="muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <ClipboardPlus className="w-4 h-4 text-blue-400" /> Create Assignment
          </h2>
          <input
            type="text"
            value={asgnTitle}
            onChange={(e) => setAsgnTitle(e.target.value)}
            placeholder="Assignment title..."
            aria-label="Assignment title"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <textarea
            rows={2}
            value={asgnDesc}
            onChange={(e) => setAsgnDesc(e.target.value)}
            placeholder="Assignment instructions..."
            aria-label="Assignment description"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Teacher assignment board"
              value={asgnBoard}
              onChange={(e) => setAsgnBoard(e.target.value as EducationBoard)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              aria-label="Teacher assignment class"
              value={asgnClass}
              onChange={(e) => setAsgnClass(Number(e.target.value))}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select
              aria-label="Teacher assignment subject"
              value={asgnSubject}
              onChange={(e) => setAsgnSubject(e.target.value)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input
            type="date"
            aria-label="Assignment due date"
            value={asgnDue}
            onChange={(e) => setAsgnDue(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
            Publish Assignment
          </button>
        </form>

        <form onSubmit={handleCreateQuiz} className="muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" /> Quick Quiz Builder
          </h2>
          <input
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Quiz title (e.g., Force & Motion Check)..."
            aria-label="Quiz title"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <input
            type="text"
            value={qPrompt}
            onChange={(e) => setQPrompt(e.target.value)}
            placeholder="Question prompt..."
            aria-label="Quiz question prompt"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={qOptA}
              onChange={(e) => setQOptA(e.target.value)}
              placeholder="Option A"
              aria-label="Option A"
              className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
            <input
              type="text"
              value={qOptB}
              onChange={(e) => setQOptB(e.target.value)}
              placeholder="Option B"
              aria-label="Option B"
              className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Correct option"
              value={qCorrect}
              onChange={(e) => setQCorrect(e.target.value)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="A">Correct: A</option>
              <option value="B">Correct: B</option>
            </select>
            <input
              type="text"
              value={qExpl}
              onChange={(e) => setQExpl(e.target.value)}
              placeholder="Answer explanation..."
              aria-label="Answer explanation"
              className="col-span-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
            Publish Quiz
          </button>
        </form>
      </div>

      {/* Student Submissions Review */}
      <div className="muse-card p-5 space-y-3">
        <h2 className="font-display font-bold text-base">
          Student Submissions ({workspace.submissions.length})
        </h2>
        {workspace.submissions.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            No student assignment submissions received yet.
          </p>
        ) : (
          <div className="space-y-3">
            {workspace.submissions.map((sub) => (
              <div key={sub.id} className="muse-panel p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{sub.studentName}</span>
                  <span className="uppercase font-semibold text-blue-400">{sub.status}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{sub.content}</p>
                {sub.status !== 'reviewed' ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <input
                      type="text"
                      value={feedbackDraft[sub.id] || ''}
                      onChange={(e) => setFeedbackDraft((d) => ({ ...d, [sub.id]: e.target.value }))}
                      placeholder="Write teacher feedback..."
                      aria-label="Teacher feedback"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                    />
                    <input
                      type="text"
                      value={gradeDraft[sub.id] || 'A'}
                      onChange={(e) => setGradeDraft((g) => ({ ...g, [sub.id]: e.target.value }))}
                      placeholder="Grade"
                      aria-label="Grade"
                      className="w-20 px-2 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onReviewSubmission(
                          sub.id,
                          feedbackDraft[sub.id] || 'Good work!',
                          gradeDraft[sub.id] || 'A'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold muse-btn-primary"
                    >
                      Mark Reviewed
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-[var(--accent-emerald)]">
                    Feedback ({sub.grade}): {sub.teacherFeedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- ADMIN PANEL ---------------- */
export const AdminPanelView: React.FC<{
  workspace: MuseWorkspaceState;
  onAddLesson: (lesson: LessonItem) => void;
  onSwitchDemoRole: (role: UserRole) => void;
}> = ({ workspace, onAddLesson, onSwitchDemoRole }) => {
  const [title, setTitle] = useState('');
  const [board, setBoard] = useState<EducationBoard>('CBSE');
  const [classLevel, setClassLevel] = useState(7);
  const [subject, setSubject] = useState('Science');
  const [chapter, setChapter] = useState('');
  const [summary, setSummary] = useState('');

  // Education Hub Admin state
  const [edContentLoading, setEdContentLoading] = useState(false);
  const [edNotice, setEdNotice] = useState<string | null>(null);
  const [edError, setEdError] = useState<string | null>(null);
  const [approvedChannels, setApprovedChannels] = useState<ApprovedChannelEntry[]>([]);
  const [curatedVideos, setCuratedVideos] = useState<EducationVideoItem[]>([]);
  const [curatedPlaylists, setCuratedPlaylists] = useState<EducationPlaylistItem[]>([]);
  const [blockedVideoIds, setBlockedVideoIds] = useState<string[]>([]);
  const [reports, setReports] = useState<EducationContentReport[]>([]);
  const [telemetry, setTelemetry] = useState<{
    youtubeConfigured: boolean;
    quotaUsedToday: number;
    quotaDate: string;
    cacheEntries: number;
    lastApiError: string | null;
  } | null>(null);

  // Admin forms
  const [vidUrl, setVidUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');
  const [vidBoard, setVidBoard] = useState('CBSE');
  const [vidClass, setVidClass] = useState(7);
  const [vidSubject, setVidSubject] = useState('Science');
  const [vidChapter, setVidChapter] = useState('');
  const [vidLang, setVidLang] = useState('English');
  const [vidFeatured, setVidFeatured] = useState(true);

  const [plUrl, setPlUrl] = useState('');
  const [plTitle, setPlTitle] = useState('');

  const [chTitle, setChTitle] = useState('');
  const [chHandle, setChHandle] = useState('');
  const [chGovt, setChGovt] = useState(false);

  const [blockInput, setBlockInput] = useState('');

  const [customKind, setCustomKind] = useState<'board' | 'subject' | 'language'>('subject');
  const [customValue, setCustomValue] = useState('');
  const [customNative, setCustomNative] = useState('');

  const loadAdminEducationState = async () => {
    setEdContentLoading(true);
    try {
      const resp = await fetch('/api/admin/education/content');
      if (!resp.ok) return;
      const data = await resp.json();
      setApprovedChannels(data.approvedChannels || []);
      setCuratedVideos(data.curatedVideos || []);
      setCuratedPlaylists(data.curatedPlaylists || []);
      setBlockedVideoIds(data.blockedVideoIds || []);
      setReports(data.reports || []);
      setTelemetry(data.telemetry || null);
    } catch {
      // ignore transient load failure
    } finally {
      setEdContentLoading(false);
    }
  };

  useEffect(() => {
    loadAdminEducationState();
  }, []);

  const postAdminAction = async (kind: string, payload: Record<string, unknown>, successMsg: string) => {
    setEdError(null);
    setEdNotice(null);
    try {
      const resp = await fetch('/api/admin/education/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setEdError(data.error || 'Admin update failed.');
        return false;
      }
      setEdNotice(successMsg);
      await loadAdminEducationState();
      return true;
    } catch {
      setEdError('Network error communicating with server.');
      return false;
    }
  };

  const handleReportDecision = async (reportId: string, status: 'removed' | 'dismissed') => {
    setEdError(null);
    const resp = await fetch(`/api/admin/education/content/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (resp.ok) {
      setEdNotice(status === 'removed' ? 'Video blocked and removed from results.' : 'Report dismissed.');
      await loadAdminEducationState();
    }
  };

  const handleUnblockVideo = async (videoId: string) => {
    const resp = await fetch(`/api/admin/education/content/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unblock: true }),
    });
    if (resp.ok) {
      setEdNotice(`Unblocked video ${videoId}.`);
      await loadAdminEducationState();
    }
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || summary.trim().length < 10) return;
    onAddLesson({
      id: `lesson_admin_${Date.now()}`,
      board,
      classLevel,
      subject,
      chapter: chapter.trim() || 'Core Chapter',
      topic: title.trim(),
      title: title.trim(),
      language: 'English',
      introduction: summary.trim(),
      objectives: ['Master core concepts introduced in this unit.'],
      explanation: [summary.trim()],
      definitions: [],
      examples: [],
      diagramType: 'grammar',
      keyPoints: [summary.trim()],
      summary: summary.trim(),
      practiceExercises: ['Discuss this topic with Muse AI Teacher.'],
      relatedTopics: [],
      isSampleContent: true,
      durationMinutes: 15,
    });
    setTitle('');
    setChapter('');
    setSummary('');
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Administration Panel
          </div>
          <h1 className="font-display font-bold text-xl">Curriculum, Role & Audit Controls</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manage boards, classes, lessons, curated Education Hub videos, moderation reports, and audit logs.
          </p>
        </div>
        {workspace.authMode === 'demo' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Demo Role:</span>
            {(['student', 'parent', 'teacher', 'admin'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSwitchDemoRole(r)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize ${
                  workspace.profile?.role === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Platform Analytics */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Curriculum Lessons</div>
          <div className="font-display text-2xl font-bold mt-1">{workspace.lessons.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Question Bank Items</div>
          <div className="font-display text-2xl font-bold mt-1">{workspace.questions.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Curated Hub Videos</div>
          <div className="font-display text-2xl font-bold mt-1">{curatedVideos.length}</div>
        </div>
        <div className="muse-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Open Moderation Reports</div>
          <div className="font-display text-2xl font-bold mt-1">
            {reports.filter((r) => r.status === 'open').length}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <form onSubmit={handleAddLesson} className="lg:col-span-5 muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base">Add Curriculum Lesson</h2>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson title..."
            aria-label="Admin lesson title"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Admin lesson board"
              value={board}
              onChange={(e) => setBoard(e.target.value as EducationBoard)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              aria-label="Admin lesson class"
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value))}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select
              aria-label="Admin lesson subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Chapter name..."
            aria-label="Admin lesson chapter"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Lesson explanation & summary (min 10 characters)..."
            aria-label="Admin lesson summary"
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
          />
          <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
            Publish Lesson to Academy
          </button>
        </form>

        <div className="lg:col-span-7 muse-card p-5 space-y-3">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Audit Logs &amp; Security Controls
          </h2>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {workspace.auditLogs.slice().reverse().map((log) => (
              <div key={log.id} className="muse-panel p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold">{log.action}</div>
                  <div className="text-[var(--text-muted)]">
                    {log.actorName} • {log.targetPath}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-[var(--accent-emerald)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Firestore Rules v2, PII Isolation, Role Escalation Guard &amp; AI Safety Filters Active.</span>
          </div>
        </div>
      </div>

      {/* EDUCATION HUB ADMIN MANAGEMENT */}
      <section aria-label="Education Hub Management" className="muse-card p-5 space-y-5 border border-blue-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Education Hub Management &amp; YouTube API Monitor
            </div>
            <h2 className="font-display font-bold text-lg">
              Curated Videos, Playlists, Approved Channels &amp; Moderation
            </h2>
          </div>
          <button
            type="button"
            onClick={loadAdminEducationState}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${edContentLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {telemetry && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">YouTube Data API v3</div>
              <div className={`font-bold mt-0.5 ${telemetry.youtubeConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {telemetry.youtubeConfigured ? 'Configured (Server Secret)' : 'Not Configured Yet'}
              </div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Daily Quota Used</div>
              <div className="font-bold mt-0.5 tabular-nums">{telemetry.quotaUsedToday} units ({telemetry.quotaDate})</div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Cached Queries</div>
              <div className="font-bold mt-0.5 tabular-nums">{telemetry.cacheEntries} active</div>
            </div>
            <div className="muse-panel p-3">
              <div className="text-[var(--text-muted)]">Blocked Videos</div>
              <div className="font-bold mt-0.5 tabular-nums">{blockedVideoIds.length} blocked</div>
            </div>
          </div>
        )}

        {edNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
            {edNotice}
          </div>
        )}
        {edError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-300">
            {edError}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Add Verified YouTube Video */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await postAdminAction(
                'video',
                {
                  urlOrId: vidUrl,
                  title: vidTitle,
                  board: vidBoard,
                  classLevel: vidClass,
                  subject: vidSubject,
                  chapter: vidChapter,
                  language: vidLang,
                  isFeatured: vidFeatured,
                },
                'Verified YouTube video added to Education Hub!'
              );
              if (ok) {
                setVidUrl('');
                setVidTitle('');
                setVidChapter('');
              }
            }}
            className="muse-panel p-4 space-y-3"
          >
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-400" /> Add Curated YouTube Video
            </h3>
            <input
              type="text"
              value={vidUrl}
              onChange={(e) => setVidUrl(e.target.value)}
              placeholder="YouTube Video URL or 11-char ID (e.g. https://www.youtube.com/watch?v=...)"
              aria-label="YouTube video URL or ID"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
            />
            <input
              type="text"
              value={vidTitle}
              onChange={(e) => setVidTitle(e.target.value)}
              placeholder="Lesson title..."
              aria-label="Curated video title"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                aria-label="Curated video board"
                value={vidBoard}
                onChange={(e) => setVidBoard(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                aria-label="Curated video class"
                value={vidClass}
                onChange={(e) => setVidClass(Number(e.target.value))}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select
                aria-label="Curated video subject"
                value={vidSubject}
                onChange={(e) => setVidSubject(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                aria-label="Curated video language"
                value={vidLang}
                onChange={(e) => setVidLang(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={vidChapter}
                onChange={(e) => setVidChapter(e.target.value)}
                placeholder="Chapter (optional)"
                aria-label="Curated video chapter"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={vidFeatured}
                  onChange={(e) => setVidFeatured(e.target.checked)}
                />
                <span>Featured</span>
              </label>
              <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
                Add Video
              </button>
            </div>
          </form>

          {/* Add Playlist & Approve Channel & Block Video */}
          <div className="space-y-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'playlist',
                  {
                    urlOrId: plUrl,
                    title: plTitle,
                    board: vidBoard,
                    classLevel: vidClass,
                    subject: vidSubject,
                    language: vidLang,
                  },
                  'Curated YouTube playlist added!'
                );
                if (ok) {
                  setPlUrl('');
                  setPlTitle('');
                }
              }}
              className="muse-panel p-4 space-y-2.5"
            >
              <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
                <ListVideo className="w-4 h-4 text-purple-400" /> Add Curated YouTube Playlist
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={plUrl}
                  onChange={(e) => setPlUrl(e.target.value)}
                  placeholder="Playlist URL or PL... ID"
                  aria-label="YouTube playlist URL or ID"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
                <input
                  type="text"
                  value={plTitle}
                  onChange={(e) => setPlTitle(e.target.value)}
                  placeholder="Playlist title..."
                  aria-label="Playlist title"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <button type="submit" className="px-3.5 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary">
                Add Playlist ({vidBoard} Cl {vidClass} {vidSubject})
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'channel',
                  {
                    channelTitle: chTitle,
                    handle: chHandle,
                    boards: [vidBoard],
                    languages: [vidLang],
                    subjects: [vidSubject],
                    officialGovernment: chGovt,
                  },
                  'Educator channel approved!'
                );
                if (ok) {
                  setChTitle('');
                  setChHandle('');
                }
              }}
              className="muse-panel p-4 space-y-2.5"
            >
              <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" /> Approve Trusted Channel ({approvedChannels.length})
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  placeholder="Channel name (e.g. SCERT Odisha)"
                  aria-label="Approved channel name"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
                <input
                  type="text"
                  value={chHandle}
                  onChange={(e) => setChHandle(e.target.value)}
                  placeholder="@handle (optional)"
                  aria-label="Channel handle"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={chGovt}
                    onChange={(e) => setChGovt(e.target.checked)}
                  />
                  <span>Official Government Channel</span>
                </label>
                <button type="submit" className="px-3.5 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary">
                  Approve Channel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Custom Board / Subject / Language + Moderation Queue */}
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="muse-panel p-4 space-y-3">
            <h3 className="font-display font-bold text-sm">
              Extend Boards, Subjects &amp; Languages
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!customValue.trim()) return;
                const payload =
                  customKind === 'board'
                    ? { name: customValue.trim() }
                    : customKind === 'subject'
                      ? { subject: customValue.trim(), board: vidBoard, classLevel: vidClass }
                      : { name: customValue.trim(), nativeLabel: customNative.trim() || customValue.trim() };
                const ok = await postAdminAction(
                  customKind,
                  payload,
                  `Added custom ${customKind}: ${customValue.trim()}`
                );
                if (ok) {
                  setCustomValue('');
                  setCustomNative('');
                }
              }}
              className="flex flex-wrap gap-2"
            >
              <select
                aria-label="Custom metadata kind"
                value={customKind}
                onChange={(e) => setCustomKind(e.target.value as 'board' | 'subject' | 'language')}
                className="px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="subject">Subject ({vidBoard} Cl {vidClass})</option>
                <option value="board">Board</option>
                <option value="language">Language</option>
              </select>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={`Enter ${customKind} name...`}
                aria-label="Custom metadata value"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              {customKind === 'language' && (
                <input
                  type="text"
                  value={customNative}
                  onChange={(e) => setCustomNative(e.target.value)}
                  placeholder="Native script"
                  aria-label="Language native script"
                  className="w-28 px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                />
              )}
              <button type="submit" className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
                Add
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAdminAction(
                  'block_video',
                  { videoId: blockInput },
                  'Video blocked from Education Hub results.'
                );
                if (ok) setBlockInput('');
              }}
              className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]"
            >
              <input
                type="text"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="Block YouTube URL or Video ID..."
                aria-label="Block YouTube video ID"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Block Video
              </button>
            </form>

            {blockedVideoIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {blockedVideoIds.map((bid) => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => handleUnblockVideo(bid)}
                    className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  >
                    Blocked: {bid} (Unblock)
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student Reports Moderation Queue */}
          <div className="muse-panel p-4 space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-rose-400" /> Reported Videos Moderation Queue ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No reported videos awaiting review. Curated playlists: {curatedPlaylists.length}.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {reports.map((rep) => (
                  <div key={rep.id} className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">{rep.videoTitle} ({rep.videoId})</span>
                      <span className="uppercase text-[10px] font-bold text-amber-400">{rep.status}</span>
                    </div>
                    <div className="text-[var(--text-muted)]">Reason: {rep.reason}</div>
                    {rep.status === 'open' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'removed')}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold"
                        >
                          Remove &amp; Block Video
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportDecision(rep.id, 'dismissed')}
                          className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
