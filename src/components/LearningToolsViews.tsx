import React, { useState } from 'react';
import {
  Award,
  Calendar,
  Download,
  Edit3,
  FileText,
  Flame,
  Layers,
  Mail,
  Plus,
  Send,
  Smartphone,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  BOARDS,
  CLASS_LEVELS,
  CORE_SUBJECTS,
  LANGUAGES,
  SAMPLE_FLASHCARDS,
} from '../data/curriculumSeed';
import {
  AssignmentItem,
  AssignmentSubmission,
  EducationBoard,
  SavedNote,
  StudyPlanTask,
  ThemeMode,
  UserProfile,
} from '../types/muse';
import { MuseWorkspaceState } from '../services/workspaceStore';
import { OfflineCacheStatus } from '../services/offlineCacheService';
import { detectWeakTopics, evaluateAchievements } from '../utils/academicEngine';
import { filterByStudentClass, prioritizeByClassAndProfile } from '../utils/curriculumFilter';
import {
  GEMINI_VOICE_PRESETS,
  pickPreferredSpeechVoice,
  resolveMuseVoicePreset,
} from '../utils/liveVoiceUtils';
import { PWAInstallButton } from './PWAStatusBar';

export { VideoAcademyView } from './VideoAcademyView';

/* ---------------- STUDY PLANNER ---------------- */
export const StudyPlannerView: React.FC<{
  profile: UserProfile;
  tasks: StudyPlanTask[];
  assignments: AssignmentItem[];
  onAddTask: (task: StudyPlanTask) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}> = ({ profile, tasks, assignments, onAddTask, onToggleTask, onDeleteTask }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState('17:30');
  const [taskType, setTaskType] = useState<StudyPlanTask['taskType']>('lesson');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('Enter a study task title (at least 2 characters).');
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    onAddTask({
      id: `plan_${Date.now()}`,
      uid: profile.uid,
      title: title.trim().slice(0, 140),
      subject,
      scheduledDate,
      scheduledTime,
      taskType,
      completed: false,
      reminderEnabled,
      createdAt: now,
      updatedAt: now,
    });
    setTitle('');
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const visibleTasks =
    viewMode === 'daily' ? tasks.filter((t) => t.scheduledDate === todayStr) : tasks;

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">Study Planner</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Organize daily schedules, weekly subject goals, revision slots, and assignment deadlines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
              viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
              viewMode === 'weekly' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
            }`}
          >
            All / Weekly ({tasks.length})
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <form onSubmit={handleCreate} className="lg:col-span-5 muse-card p-5 space-y-4 h-fit">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" /> Schedule Study Task
          </h2>
          {error && <div className="text-xs text-rose-400">{error}</div>}
          <div>
            <label htmlFor="plan-title" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Task Title
            </label>
            <input
              id="plan-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Practice 10 Pythagoras problems"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-sub" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Subject</label>
              <select
                id="plan-sub"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="plan-type" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Type</label>
              <select
                id="plan-type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as StudyPlanTask['taskType'])}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="lesson">Lesson</option>
                <option value="quiz">Quiz</option>
                <option value="revision">Revision</option>
                <option value="assignment">Assignment</option>
                <option value="exam">Exam Prep</option>
              </select>
            </div>
            <div>
              <label htmlFor="plan-date" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Date</label>
              <input
                id="plan-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
            </div>
            <div>
              <label htmlFor="plan-time" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Time</label>
              <input
                id="plan-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            Enable study reminder
          </label>
          <button type="submit" className="w-full py-2.5 rounded-xl text-xs font-semibold muse-btn-primary">
            Add to Study Plan
          </button>
        </form>

        <div className="lg:col-span-7 space-y-5">
          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base">
              {viewMode === 'daily' ? "Today's Tasks" : 'Weekly Schedule'} ({visibleTasks.length})
            </h2>
            {visibleTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No tasks scheduled for this view yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {visibleTasks.map((t) => (
                  <li key={t.id} className="muse-panel p-3.5 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={() => onToggleTask(t.id)}
                      />
                      <div>
                        <div className={`text-sm font-medium ${t.completed ? 'line-through text-[var(--text-muted)]' : ''}`}>
                          {t.title}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {t.subject} • {t.scheduledDate} at {t.scheduledTime} {t.reminderEnabled ? '• Reminder On' : ''}
                        </div>
                      </div>
                    </label>
                    <button
                      type="button"
                      aria-label={`Delete task ${t.title}`}
                      onClick={() => onDeleteTask(t.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" /> Upcoming Assignment Deadlines
            </h2>
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="muse-panel p-3 flex items-center justify-between text-xs">
                  <span className="font-semibold">{a.title} ({a.subject})</span>
                  <span className="text-amber-300">Due {a.dueDate}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- REVISION CENTRE ---------------- */
export const RevisionCenterView: React.FC<{
  workspace: MuseWorkspaceState;
  offlineStatus?: OfflineCacheStatus | null;
  isOnline?: boolean;
  onSaveNote: (note: SavedNote) => void;
  onDeleteNote?: (noteId: string) => void;
}> = ({ workspace, offlineStatus, isOnline = true, onSaveNote, onDeleteNote }) => {
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteSubject, setNoteSubject] = useState('Science');
  const [noteContent, setNoteContent] = useState('');

  const weakTopics = detectWeakTopics(workspace.attempts, workspace.questions);
  const prioritizedCards = React.useMemo(
    () =>
      workspace.profile
        ? prioritizeByClassAndProfile(SAMPLE_FLASHCARDS, workspace.profile)
        : SAMPLE_FLASHCARDS,
    [workspace.profile]
  );
  const card = prioritizedCards[cardIdx % prioritizedCards.length];

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    onSaveNote({
      id: `note_${Date.now()}`,
      subject: noteSubject,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      updatedAt: new Date().toISOString(),
    });
    setNoteTitle('');
    setNoteContent('');
  };

  return (
    <div className="space-y-6">
      <div className="muse-card p-5">
        <h1 className="font-display font-bold text-xl">Revision Centre</h1>
        <p className="text-xs text-[var(--text-muted)]">
          Active recall flashcards, chapter summaries, key definitions, and personal revision notes.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* Flashcard Deck */}
        <div className="lg:col-span-6 muse-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> Interactive Flashcards
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Card {(cardIdx % prioritizedCards.length) + 1} / {prioritizedCards.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[170px] muse-panel p-6 text-center flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 transition"
          >
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-400">
              {flipped ? 'Answer' : `${card.subject}${card.classLevel ? ` (Class ${card.classLevel})` : ''} • ${card.chapter}`}
            </span>
            <span className="text-base font-semibold">
              {flipped ? card.back : card.front}
            </span>
            <span className="text-xs text-[var(--text-muted)] mt-2">Click card to flip</span>
          </button>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCardIdx((i) => (i - 1 + prioritizedCards.length) % prioritizedCards.length);
                setFlipped(false);
              }}
              className="px-4 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              Previous Card
            </button>
            <button
              type="button"
              onClick={() => {
                setCardIdx((i) => (i + 1) % prioritizedCards.length);
                setFlipped(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
            >
              Next Card
            </button>
          </div>
        </div>

        {/* Weak Topics & Saved Notes */}
        <div className="lg:col-span-6 muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-400" /> Saved Notes ({workspace.savedNotes.length})
            </h2>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-[var(--accent-emerald)] border border-emerald-500/30 text-[11px] font-semibold">
              {isOnline
                ? `Offline Ready (${offlineStatus?.cachedNoteCount ?? workspace.savedNotes.length} cached)`
                : 'Offline Mode — Cached Notes'}
            </span>
          </div>

          {weakTopics.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <strong>Recommended Revision Focus:</strong> {weakTopics[0].topic} ({weakTopics[0].accuracy}% recent accuracy)
            </div>
          )}

          <form onSubmit={handleAddNote} className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                aria-label="Note title"
                className="col-span-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
              <select
                aria-label="Note subject"
                value={noteSubject}
                onChange={(e) => setNoteSubject(e.target.value)}
                className="px-2 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write key formulas, definitions, or reminders..."
              aria-label="Note content"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            />
            <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary">
              Save Note
            </button>
          </form>

          <ul className="space-y-2 max-h-[210px] overflow-y-auto">
            {workspace.savedNotes.map((n) => (
              <li key={n.id} className="muse-panel p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span>{n.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">{n.subject}</span>
                    {onDeleteNote && (
                      <button
                        type="button"
                        aria-label={`Delete note ${n.title}`}
                        onClick={() => onDeleteNote(n.id)}
                        className="text-[var(--text-muted)] hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{n.content}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ---------------- ASSIGNMENT CENTRE ---------------- */
export const AssignmentCenterView: React.FC<{
  profile: UserProfile;
  assignments: AssignmentItem[];
  submissions: AssignmentSubmission[];
  onSubmitAssignment: (sub: AssignmentSubmission) => void;
}> = ({ profile, assignments, submissions, onSubmitAssignment }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [myClassOnly, setMyClassOnly] = useState<boolean>(true);

  const visibleAssignments = React.useMemo(() => {
    const ranked = prioritizeByClassAndProfile(assignments, profile);
    return filterByStudentClass(ranked, profile.classLevel, myClassOnly);
  }, [assignments, profile, myClassOnly]);

  const handleSend = (asgn: AssignmentItem) => {
    const text = (drafts[asgn.id] || '').trim();
    if (text.length < 2) return;
    const now = new Date().toISOString();
    onSubmitAssignment({
      id: `sub_${asgn.id}_${profile.uid}`,
      assignmentId: asgn.id,
      studentUid: profile.uid,
      studentName: profile.displayName,
      content: text.slice(0, 4000),
      attachmentName: files[asgn.id],
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    });
  };

  return (
    <div className="space-y-5">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">Assignment Centre</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Class {profile.classLevel} homework assignments prioritized first — submit answers and read teacher feedback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMyClassOnly(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 ${
              myClassOnly
                ? 'bg-blue-600 text-white border-blue-500'
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
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
            }`}
          >
            All Classes
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visibleAssignments.map((asgn) => {
          const existing = submissions.find((s) => s.assignmentId === asgn.id);
          return (
            <div key={asgn.id} className="muse-card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {asgn.board} Class {asgn.classLevel} • {asgn.subject} • By {asgn.teacherName}
                  </div>
                  <h2 className="font-display font-bold text-lg">{asgn.title}</h2>
                </div>
                <div className="text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  Due: {asgn.dueDate}
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)]">{asgn.description}</p>
              {asgn.attachmentLabel && (
                <div className="text-xs text-blue-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Attachment: {asgn.attachmentLabel}
                </div>
              )}

              {existing ? (
                <div className="muse-panel p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 uppercase">
                      Status: {existing.status}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Submitted {new Date(existing.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{existing.content}</p>
                  {existing.attachmentName && (
                    <div className="text-xs text-blue-400">Uploaded file: {existing.attachmentName}</div>
                  )}
                  {existing.teacherFeedback && (
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs">
                      <strong>Teacher Feedback ({existing.grade || 'Reviewed'}):</strong> {existing.teacherFeedback}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 pt-2">
                  <textarea
                    rows={3}
                    value={drafts[asgn.id] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [asgn.id]: e.target.value }))}
                    placeholder="Write your assignment answer here..."
                    aria-label={`Submission for ${asgn.title}`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="file"
                      aria-label={`Attach file for ${asgn.title}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setFiles((f) => ({ ...f, [asgn.id]: file.name }));
                      }}
                      className="text-xs text-[var(--text-muted)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSend(asgn)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Assignment
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- ACHIEVEMENTS ---------------- */
export const AchievementsView: React.FC<{ workspace: MuseWorkspaceState }> = ({ workspace }) => {
  const profile = workspace.profile!;
  const badges = evaluateAchievements({
    completedLessonsCount: workspace.progress.filter((p) => p.completed).length,
    attempts: workspace.attempts,
    studyStreak: profile.studyStreak,
    completedStudyTasks: workspace.studyPlans.filter((t) => t.completed).length,
  });

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl">Achievements & Milestones</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Private personal milestones celebrating consistency and concept mastery—no public child rankings.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-sm font-bold">
          <Flame className="w-4 h-4" />
          {profile.studyStreak}-Day Study Streak
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((b) => (
          <div
            key={b.key}
            className={`muse-card p-5 space-y-2.5 border ${
              b.unlocked ? 'border-emerald-500/40' : 'opacity-75'
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  b.unlocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}
              >
                <Award className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-muted)]">{b.progressLabel}</span>
            </div>
            <h2 className="font-display font-bold text-base">{b.title}</h2>
            <p className="text-xs text-[var(--text-muted)]">{b.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- PROFILE & SETTINGS ---------------- */
export const ProfileSettingsView: React.FC<{
  profile: UserProfile;
  theme: ThemeMode;
  authMode?: 'unauthenticated' | 'demo' | 'firebase';
  offlineStatus?: OfflineCacheStatus | null;
  onSyncOfflineCache?: () => Promise<void> | void;
  onToggleTheme: () => void;
  onSaveProfile: (updated: UserProfile) => void;
  onExportData?: () => void;
  onResendVerification?: () => Promise<void>;
  onDeleteAccount: () => Promise<void> | void;
}> = ({
  profile,
  theme,
  authMode = 'demo',
  offlineStatus,
  onSyncOfflineCache,
  onToggleTheme,
  onSaveProfile,
  onExportData,
  onResendVerification,
  onDeleteAccount,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [board, setBoard] = useState<EducationBoard>(profile.board);
  const [classLevel, setClassLevel] = useState(profile.classLevel);
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferredLanguage);
  const [academicGoal, setAcademicGoal] = useState(profile.academicGoal);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.notificationsEnabled);
  const [nonEssentialNotifications, setNonEssentialNotifications] = useState(profile.nonEssentialNotifications);
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState(Boolean(profile.voiceAutoSpeak));
  const [speechRate, setSpeechRate] = useState(profile.speechRate ?? 1.0);
  const [speechPitch, setSpeechPitch] = useState(profile.speechPitch ?? 1.0);
  const [voicePreset, setVoicePreset] = useState(() => resolveMuseVoicePreset(profile.voicePreset));
  const [savedNotice, setSavedNotice] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) return;
    onSaveProfile({
      ...profile,
      displayName: displayName.trim().slice(0, 80),
      board,
      classLevel,
      preferredLanguage,
      academicGoal: academicGoal.trim().slice(0, 240),
      notificationsEnabled,
      nonEssentialNotifications,
      voiceAutoSpeak,
      speechRate,
      speechPitch,
      voicePreset,
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const previewVoiceSettings = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      "Hello! I'm Muse, your friendly AI assistant. This is how I sound with your selected voice preset, speed, and pitch."
    );
    const chosenVoice = pickPreferredSpeechVoice(window.speechSynthesis.getVoices(), preferredLanguage);
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.lang = chosenVoice?.lang || 'en-IN';
    utterance.rate = Math.min(2, Math.max(0.5, speechRate));
    utterance.pitch = Math.min(2, Math.max(0.5, speechPitch));
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">My Profile & Settings</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manage academic preferences, notification controls, appearance, and account lifecycle.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme
        </button>
      </div>

      <form onSubmit={handleSave} className="muse-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Display Name</label>
            <input
              id="prof-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            />
          </div>
          <div>
            <label htmlFor="prof-board" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Education Board</label>
            <select
              id="prof-board"
              value={board}
              onChange={(e) => setBoard(e.target.value as EducationBoard)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prof-class" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Class</label>
            <select
              id="prof-class"
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            >
              {CLASS_LEVELS.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prof-lang" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Language</label>
            <select
              id="prof-lang"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="prof-goal" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Academic Goal</label>
          <input
            id="prof-goal"
            type="text"
            value={academicGoal}
            onChange={(e) => setAcademicGoal(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div className="muse-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Nano AI Voice Preferences</span>
            </div>
            <span className="text-[11px] font-medium text-purple-300">
              Active Identity: Nano AI · {voicePreset} (Indian English default)
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={voiceAutoSpeak}
              onChange={(e) => setVoiceAutoSpeak(e.target.checked)}
            />
            <span>Automatically read AI Assistant replies aloud</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label htmlFor="prof-voice-preset" className="block text-[var(--text-muted)] font-medium">
                Nano Voice Preset (Gemini Live &amp; TTS)
              </label>
              <select
                id="prof-voice-preset"
                value={voicePreset}
                onChange={(e) => setVoicePreset(resolveMuseVoicePreset(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                {GEMINI_VOICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} — {preset.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-speech-rate" className="block text-[var(--text-muted)] font-medium">
                Voice Playback Speed
              </label>
              <select
                id="prof-speech-rate"
                value={String(speechRate)}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs tabular-nums"
              >
                <option value="0.85">0.85x Calm</option>
                <option value="1">1.0x Normal</option>
                <option value="1.2">1.2x Fast</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="prof-speech-pitch" className="text-[var(--text-muted)] font-medium">
                Voice Pitch
              </label>
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-purple-400 tabular-nums">
                  {speechPitch.toFixed(1)}x{' '}
                  {speechPitch < 0.9 ? '(Deeper)' : speechPitch > 1.1 ? '(Higher)' : '(Default)'}
                </span>
                <button
                  type="button"
                  onClick={previewVoiceSettings}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-500/40 text-[11px] font-semibold"
                >
                  Test Voice
                </button>
              </div>
            </div>
            <input
              id="prof-speech-pitch"
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechPitch}
              onChange={(e) => setSpeechPitch(Number(e.target.value))}
              aria-label="AI voice pitch"
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
              <span>0.5x Deeper</span>
              <span>1.0x Normal</span>
              <span>2.0x Higher</span>
            </div>
          </div>
        </div>

        <div className="muse-panel p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Notification Preferences
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
            />
            Essential alerts (upcoming tests, assignment deadlines, account updates)
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={nonEssentialNotifications}
              onChange={(e) => setNonEssentialNotifications(e.target.checked)}
            />
            Study reminders &amp; milestone celebration alerts
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="px-5 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary">
            Save Profile Changes
          </button>
          {savedNotice && <span className="text-xs text-emerald-400 font-semibold">Saved!</span>}
        </div>
      </form>

      {/* Account Verification & Privacy Data Export */}
      <div className="muse-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" />
            <span>Account Security &amp; Privacy Controls</span>
          </h2>
          {onExportData && (
            <button
              type="button"
              onClick={onExportData}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export My Data (JSON)</span>
            </button>
          )}
        </div>
        <div className="muse-panel p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold">Email Status: </span>
            <span className={profile.emailVerified ? 'text-emerald-400' : 'text-amber-400'}>
              {authMode === 'demo'
                ? 'Demo Workspace (Local)'
                : profile.emailVerified
                  ? `Verified (${profile.email || 'Account'})`
                  : `Pending Verification (${profile.email || 'Account'})`}
            </span>
          </div>
          {authMode === 'firebase' && !profile.emailVerified && onResendVerification && (
            <button
              type="button"
              onClick={async () => {
                await onResendVerification();
                setVerificationSent(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold"
            >
              {verificationSent ? 'Verification Email Sent' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>

      <div className="muse-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" /> Offline Storage, PWA &amp; Native Packaging
          </h2>
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            {onSyncOfflineCache && (
              <button
                type="button"
                onClick={() => onSyncOfflineCache()}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40"
              >
                Refresh Offline Cache
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2.5 text-xs">
          <div className="muse-panel p-3">
            <div className="text-[var(--text-muted)]">Service Worker</div>
            <div className="font-semibold mt-0.5">
              {offlineStatus?.swRegistered ? 'Active & Caching' : offlineStatus?.swSupported ? 'Initializing' : 'Cache Storage Only'}
            </div>
          </div>
          <div className="muse-panel p-3">
            <div className="text-[var(--text-muted)]">Cached My Lessons</div>
            <div className="font-semibold mt-0.5">{offlineStatus?.cachedLessonCount ?? 0} lessons</div>
          </div>
          <div className="muse-panel p-3">
            <div className="text-[var(--text-muted)]">Cached Saved Notes</div>
            <div className="font-semibold mt-0.5">{offlineStatus?.cachedNoteCount ?? 0} notes</div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Nano AI uses the Service Worker API and Cache Storage to keep your My Lessons, Saved Notes, and learning progress available without an internet connection.
        </p>
      </div>

      <div className="muse-card p-5 border border-rose-500/30 space-y-3">
        <h2 className="font-display font-bold text-base text-rose-400">Account Deletion</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Permanently remove your Nano AI profile and private account records.
        </p>
        {deleteError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
            {deleteError}
          </div>
        )}
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40"
          >
            Delete My Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true);
                setDeleteError(null);
                try {
                  await onDeleteAccount();
                } catch (err: unknown) {
                  const raw = err instanceof Error ? err.message : String(err);
                  if (raw.includes('requires-recent-login')) {
                    setDeleteError('For security, please sign out and sign back in right before deleting your account.');
                  } else {
                    setDeleteError(raw || 'Could not complete account deletion. Please try again.');
                  }
                } finally {
                  setDeleteLoading(false);
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting Account...' : 'Confirm Permanent Delete'}
            </button>
            <button
              type="button"
              disabled={deleteLoading}
              onClick={() => {
                setConfirmDelete(false);
                setDeleteError(null);
              }}
              className="px-3 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
