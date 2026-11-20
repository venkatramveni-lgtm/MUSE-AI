import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  History,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS } from '../data/curriculumSeed';
import {
  AssignmentItem,
  LearningProgress,
  LessonItem,
  QuestionItem,
  QuizAttempt,
  StudyPlanTask,
  TaskPriority,
  TaskRecurrence,
  UserProfile,
} from '../types/muse';
import { detectWeakTopics } from '../utils/academicEngine';
import {
  buildCalendarMonthGrid,
  buildPlannerIcs,
  buildSmartTaskSuggestions,
  formatIsoDate,
  getWeekDates,
  sortTasksByPriorityAndTime,
} from '../utils/plannerUtils';

interface SmartPlannerViewProps {
  profile: UserProfile;
  tasks: StudyPlanTask[];
  assignments: AssignmentItem[];
  lessons?: LessonItem[];
  progress?: LearningProgress[];
  attempts?: QuizAttempt[];
  questions?: QuestionItem[];
  initialTaskDraft?: { title: string; subject: string } | null;
  onConsumeTaskDraft?: () => void;
  onAddTask: (task: StudyPlanTask) => void;
  onUpdateTask: (task: StudyPlanTask) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

type PlannerTab = 'daily' | 'weekly' | 'monthly' | 'completed';

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

export const SmartPlannerView: React.FC<SmartPlannerViewProps> = ({
  profile,
  tasks,
  assignments,
  lessons = [],
  progress = [],
  attempts = [],
  questions = [],
  initialTaskDraft,
  onConsumeTaskDraft,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const todayStr = formatIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<PlannerTab>('daily');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState('17:30');
  const [taskType, setTaskType] = useState<StudyPlanTask['taskType']>('lesson');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notifPerm, setNotifPerm] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  useEffect(() => {
    if (initialTaskDraft) {
      setTitle(initialTaskDraft.title);
      setSubject(initialTaskDraft.subject || 'Mathematics');
      setScheduledDate(todayStr);
      onConsumeTaskDraft?.();
    }
  }, [initialTaskDraft, onConsumeTaskDraft, todayStr]);

  const smartSuggestions = useMemo(() => {
    const weakTopics = detectWeakTopics(attempts, questions);
    return buildSmartTaskSuggestions({
      weakTopics,
      lessons,
      progress,
      assignments,
      existingTasks: tasks,
      todayStr,
    });
  }, [attempts, questions, lessons, progress, assignments, tasks, todayStr]);

  const handleExportIcs = () => {
    const ics = buildPlannerIcs(tasks, assignments);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muse_study_schedule_${todayStr}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubject('Mathematics');
    setScheduledDate(selectedDate);
    setScheduledTime('17:30');
    setTaskType('lesson');
    setPriority('medium');
    setRecurrence('none');
    setReminderEnabled(true);
    setError(null);
  };

  const startEdit = (task: StudyPlanTask) => {
    setEditingId(task.id);
    setTitle(task.title);
    setSubject(task.subject);
    setScheduledDate(task.scheduledDate);
    setScheduledTime(task.scheduledTime || '17:30');
    setTaskType(task.taskType);
    setPriority(task.priority || 'medium');
    setRecurrence(task.recurrence || 'none');
    setReminderEnabled(task.reminderEnabled);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('Enter a study task title (at least 2 characters).');
      return;
    }
    setError(null);
    const now = new Date().toISOString();

    if (editingId) {
      const existing = tasks.find((t) => t.id === editingId);
      if (existing) {
        onUpdateTask({
          ...existing,
          title: title.trim().slice(0, 140),
          subject,
          scheduledDate,
          scheduledTime,
          taskType,
          priority,
          recurrence,
          reminderEnabled,
          updatedAt: now,
        });
      }
      resetForm();
      return;
    }

    onAddTask({
      id: `plan_${Date.now()}`,
      uid: profile.uid,
      title: title.trim().slice(0, 140),
      subject,
      scheduledDate,
      scheduledTime,
      taskType,
      priority,
      recurrence,
      completed: false,
      reminderEnabled,
      createdAt: now,
      updatedAt: now,
    });
    resetForm();
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPerm('unsupported');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
    } catch {
      // Ignore permission rejection
    }
  };

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const [anchorYear, anchorMonth] = useMemo(() => {
    const parts = selectedDate.split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), (parts[1] || 1) - 1];
  }, [selectedDate]);
  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(anchorYear, anchorMonth, todayStr),
    [anchorYear, anchorMonth, todayStr]
  );

  const visibleTasks = useMemo(() => {
    const sorted = sortTasksByPriorityAndTime(tasks);
    if (viewMode === 'daily') {
      return sorted.filter((t) => t.scheduledDate === selectedDate);
    }
    if (viewMode === 'weekly') {
      return sorted.filter((t) => weekDates.includes(t.scheduledDate));
    }
    if (viewMode === 'completed') {
      return sorted.filter((t) => t.completed);
    }
    return sorted.filter((t) => t.scheduledDate === selectedDate);
  }, [tasks, viewMode, selectedDate, weekDates]);

  const monthLabel = new Date(anchorYear, anchorMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl">Smart Planner</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Daily timetable, weekly schedule, monthly calendar, priorities, recurring tasks, and reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportIcs}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export .ics</span>
          </button>
          {[
            { id: 'daily' as const, label: 'Daily' },
            { id: 'weekly' as const, label: 'Weekly' },
            { id: 'monthly' as const, label: 'Monthly' },
            { id: 'completed' as const, label: `Completed (${tasks.filter((t) => t.completed).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                viewMode === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Browser Notification Permission Bar */}
      <div className="muse-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Bell className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            {notifPerm === 'granted'
              ? 'Browser reminders are enabled. Scheduled tasks with reminders alert you automatically.'
              : notifPerm === 'denied'
                ? 'Browser notifications are blocked in site settings; in-app notifications remain active.'
                : notifPerm === 'unsupported'
                  ? 'In-app reminders are active (Browser Notification API unavailable here).'
                  : 'Enable browser notifications to get timely study and exam reminders.'}
          </span>
        </div>
        {notifPerm === 'default' && (
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/40 font-semibold"
          >
            Enable Browser Reminders
          </button>
        )}
      </div>

      {/* Smart Task Suggestions */}
      {smartSuggestions.length > 0 && (
        <div className="muse-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Smart Study Suggestions (From Weak Topics, Lessons &amp; Deadlines)</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {smartSuggestions.map((sug) => (
              <div key={sug.id} className="muse-panel p-3.5 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-blue-400">{sug.subject}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${PRIORITY_STYLE[sug.priority]}`}>
                      {sug.priority}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2">{sug.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{sug.reason}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date().toISOString();
                    onAddTask({
                      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                      uid: profile.uid,
                      title: sug.title,
                      subject: sug.subject,
                      scheduledDate: sug.scheduledDate,
                      scheduledTime: sug.scheduledTime,
                      taskType: sug.taskType,
                      priority: sug.priority,
                      recurrence: 'none',
                      completed: false,
                      reminderEnabled: true,
                      createdAt: now,
                      updatedAt: now,
                    });
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30"
                >
                  + Schedule ({sug.scheduledTime})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Create / Edit Task Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 min-w-0 muse-card p-5 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              {editingId ? <Edit3 className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-blue-400" />}
              <span>{editingId ? 'Edit Task' : 'Create Study Task'}</span>
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-[var(--text-muted)] hover:text-white flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {error && <div role="alert" className="text-xs text-rose-400">{error}</div>}

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
              <label htmlFor="plan-sub" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Subject
              </label>
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
              <label htmlFor="plan-type" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Category
              </label>
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
              <label htmlFor="plan-priority" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Priority
              </label>
              <select
                id="plan-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div>
              <label htmlFor="plan-recurrence" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Repeat Schedule
              </label>
              <select
                id="plan-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="none">One-time</option>
                <option value="daily">Repeat Daily</option>
                <option value="weekly">Repeat Weekly</option>
              </select>
            </div>

            <div>
              <label htmlFor="plan-date" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Date
              </label>
              <input
                id="plan-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="plan-time" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Time
              </label>
              <input
                id="plan-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            <span>Enable reminder notification at scheduled time</span>
          </label>

          <button type="submit" className="w-full py-2.5 rounded-xl text-xs font-semibold muse-btn-primary">
            {editingId ? 'Save Task Changes' : 'Add to Smart Planner'}
          </button>
        </form>

        {/* Right: Calendar & Timetable */}
        <div className="lg:col-span-7 min-w-0 space-y-5">
          {viewMode === 'weekly' && (
            <div className="muse-card p-4 sm:p-5 space-y-3">
              <h2 className="font-display font-bold text-base">Weekly Timetable Strip</h2>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {weekDates.map((d) => {
                  const count = tasks.filter((t) => t.scheduledDate === d && !t.completed).length;
                  const dt = new Date(`${d}T12:00:00`);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={`p-1 sm:p-2 rounded-xl border text-center space-y-1 ${
                        d === selectedDate
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="text-[10px] uppercase text-[var(--text-muted)]">
                        {dt.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-sm font-bold tabular-nums">{dt.getDate()}</div>
                      <div className="text-[10px] text-blue-400 tabular-nums">{count} due</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'monthly' && (
            <div className="muse-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display font-bold text-base">{monthLabel}</h2>
                <span className="text-xs text-[var(--text-muted)]">Select any day to view or add tasks</span>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] font-semibold text-[var(--text-muted)]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {monthGrid.map((cell) => {
                  const dayCount = tasks.filter((t) => t.scheduledDate === cell.dateStr).length;
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                        setScheduledDate(cell.dateStr);
                      }}
                      className={`p-1 sm:p-2 rounded-lg sm:rounded-xl border text-left min-h-[46px] sm:min-h-[54px] flex flex-col justify-between ${
                        cell.dateStr === selectedDate
                          ? 'border-blue-500 bg-blue-600/20'
                          : cell.inCurrentMonth
                            ? 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                            : 'border-transparent bg-[var(--bg-elevated)]/40 opacity-50'
                      }`}
                    >
                      <span className={`text-[11px] sm:text-xs font-semibold tabular-nums ${cell.isToday ? 'text-blue-400' : ''}`}>
                        {cell.dayOfMonth}
                      </span>
                      {dayCount > 0 && (
                        <span className="text-[9px] sm:text-[10px] leading-tight text-blue-400 font-semibold tabular-nums">
                          {dayCount} task{dayCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="muse-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                {viewMode === 'completed' ? <History className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-blue-400" />}
                <span>
                  {viewMode === 'completed'
                    ? 'Completed Task History'
                    : viewMode === 'weekly'
                      ? 'This Week’s Tasks'
                      : `Schedule for ${selectedDate}`}
                </span>
              </h2>
              {viewMode === 'daily' && (
                <input
                  type="date"
                  aria-label="Filter daily schedule date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setScheduledDate(e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs tabular-nums"
                />
              )}
            </div>

            {visibleTasks.length === 0 ? (
              <div className="muse-panel p-5 text-xs text-[var(--text-muted)]">
                {viewMode === 'completed'
                  ? 'No completed tasks yet. Check off a study task to build your completion history.'
                  : 'No tasks scheduled for this date. Use the form on the left to add one.'}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {visibleTasks.map((t) => {
                  const prio = t.priority || 'medium';
                  return (
                    <li key={t.id} className="muse-panel p-3.5 flex items-center justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={() => onToggleTask(t.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className={`text-sm font-semibold ${t.completed ? 'line-through text-[var(--text-muted)]' : ''}`}>
                            {t.title}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-2 tabular-nums">
                            <span>{t.subject}</span>
                            <span>·</span>
                            <span>{t.scheduledDate} at {t.scheduledTime || 'Anytime'}</span>
                            <span>·</span>
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${PRIORITY_STYLE[prio]}`}>
                              {prio}
                            </span>
                            {t.recurrence && t.recurrence !== 'none' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-purple-400 font-semibold">
                                <Repeat className="w-3 h-3" /> {t.recurrence}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label={`Edit task ${t.title}`}
                          onClick={() => startEdit(t)}
                          className="p-2 text-[var(--text-muted)] hover:text-blue-400"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete task ${t.title}`}
                          onClick={() => onDeleteTask(t.id)}
                          className="p-2 text-[var(--text-muted)] hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Upcoming Assignment Deadlines</span>
            </h2>
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="muse-panel p-3 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {a.title} ({a.subject})
                  </span>
                  <span className="text-amber-300 tabular-nums flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Due {a.dueDate}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
