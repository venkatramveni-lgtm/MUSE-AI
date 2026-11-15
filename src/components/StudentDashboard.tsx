import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Mic,
  Play,
  Search,
  Sparkles,
  Target,
  Trophy,
  Video,
  FileText,
} from 'lucide-react';
import { AppModuleId } from '../types/muse';
import { MuseWorkspaceState } from '../services/workspaceStore';
import { IMAGE_ASSET_BY_KEY, VIDEO_THUMBNAIL_BY_ID } from '../data/academyMedia';
import {
  computeSubjectProgress,
  detectWeakTopics,
  evaluateAchievements,
} from '../utils/academicEngine';
import { formatIsoDate, sortTasksByPriorityAndTime } from '../utils/plannerUtils';

interface StudentDashboardProps {
  workspace: MuseWorkspaceState;
  onNavigate: (module: AppModuleId, contextLessonId?: string) => void;
  onAskPrompt: (prompt: string) => void;
  onToggleTask: (taskId: string) => void;
}

const SUGGESTED_AI_ACTIVITIES = [
  {
    title: 'Generate a Labeled Concept Diagram',
    desc: 'Create interactive SVG science & math diagrams in Image Academy',
    module: 'image_academy' as AppModuleId,
  },
  {
    title: 'Practice Voice Q&A in Your Language',
    desc: 'Speak a question aloud and hear spoken Gemini answers',
    module: 'voice_ai' as AppModuleId,
  },
  {
    title: 'Explore Classes 1–12 Education Hub',
    desc: '28 Indian boards, 23 languages, YouTube lessons & AI Video Tutor',
    module: 'education_hub' as AppModuleId,
  },
];

const OLD_DASHBOARD_MODULES: {
  id: AppModuleId;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}[] = [
  {
    id: 'education_hub',
    title: 'Education Hub (Cl 1–12)',
    desc: 'All 28 boards, 23 languages, video lessons & AI Tutor',
    icon: GraduationCap,
    accent: 'text-blue-400',
  },
  {
    id: 'lesson_academy',
    title: 'Learning Academy',
    desc: 'Structured chapters, diagrams & 3D XR models',
    icon: BookOpen,
    accent: 'text-emerald-400',
  },
  {
    id: 'video_academy',
    title: 'Video Academy',
    desc: 'Visual walkthroughs, voice narration & captions',
    icon: Video,
    accent: 'text-sky-400',
  },
  {
    id: 'image_academy',
    title: 'Image Academy',
    desc: 'Interactive hotspot diagrams & AI Visual Studio',
    icon: ImageIcon,
    accent: 'text-amber-400',
  },
  {
    id: 'daily_quiz',
    title: 'Daily Quiz',
    desc: '5-minute concept checks with explanations',
    icon: ClipboardCheck,
    accent: 'text-purple-400',
  },
  {
    id: 'weekly_tests',
    title: 'Weekly Tests',
    desc: 'Timed exam simulations & rubric review',
    icon: Award,
    accent: 'text-rose-400',
  },
  {
    id: 'practice_centre',
    title: 'Practice Centre',
    desc: 'Adaptive topic drills by difficulty',
    icon: Target,
    accent: 'text-blue-400',
  },
  {
    id: 'assignment_centre',
    title: 'Assignment Centre',
    desc: 'Submit homework & read teacher feedback',
    icon: FileText,
    accent: 'text-indigo-400',
  },
  {
    id: 'revision_centre',
    title: 'Revision Centre',
    desc: 'Offline Saved Notes & flip flashcards',
    icon: Layers,
    accent: 'text-teal-400',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    desc: 'Study streak milestones & badges',
    icon: Trophy,
    accent: 'text-amber-300',
  },
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  workspace,
  onNavigate,
  onAskPrompt,
  onToggleTask,
}) => {
  const [aiQuery, setAiQuery] = useState('');
  const [brokenMediaIds, setBrokenMediaIds] = useState<Record<string, boolean>>({});
  const profile = workspace.profile!;
  const todayStr = formatIsoDate(new Date());

  const completedLessons = workspace.progress.filter((p) => p.completed);
  const completedTasksCount = workspace.studyPlans.filter((t) => t.completed).length;
  const pendingTasks = sortTasksByPriorityAndTime(workspace.studyPlans).filter((t) => !t.completed);
  const todaysSchedule = sortTasksByPriorityAndTime(
    workspace.studyPlans.filter((t) => t.scheduledDate === todayStr)
  ).slice(0, 4);

  const subjectProgress = computeSubjectProgress(
    workspace.lessons,
    workspace.progress,
    workspace.attempts
  );
  const weakTopics = detectWeakTopics(workspace.attempts, workspace.questions);
  const badges = evaluateAchievements({
    completedLessonsCount: completedLessons.length,
    attempts: workspace.attempts,
    studyStreak: profile.studyStreak,
    completedStudyTasks: completedTasksCount,
  });

  const nextLesson =
    workspace.lessons.find(
      (l) =>
        l.board === profile.board &&
        !workspace.progress.some((p) => p.lessonId === l.id && p.completed)
    ) || workspace.lessons[0];

  const featuredLessons = workspace.lessons.slice(0, 3);
  const featuredVideos = workspace.videos.slice(0, 3);
  const featuredImages = workspace.images.slice(0, 3);

  const recentConversations = workspace.conversations.slice(0, 3);
  const taskCompletionPct =
    workspace.studyPlans.length > 0
      ? Math.round((completedTasksCount / workspace.studyPlans.length) * 100)
      : 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) {
      onNavigate('ai_teacher');
      return;
    }
    const prompt = aiQuery.trim();
    setAiQuery('');
    onAskPrompt(prompt);
  };

  return (
    <div className="space-y-6">
      {/* MUSE AI Welcome & Prominent AI Search Hero */}
      <section className="muse-gradient-hero text-white rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MUSE AI · Think Smarter. Learn Faster. Do More.</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              Welcome back, {profile.displayName}
            </h1>
            <p className="text-sm text-slate-200 max-w-2xl">
              {profile.board} · Class {profile.classLevel} · {profile.preferredLanguage} · Goal: {profile.academicGoal}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-amber-300" />
              <div>
                <div className="text-[11px] text-slate-300">Study Streak</div>
                <div className="font-display font-bold text-sm tabular-nums">
                  {profile.studyStreak} {profile.studyStreak === 1 ? 'Day' : 'Days'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Large AI Search Bar + Voice Search Mic Button */}
        <form
          onSubmit={handleSearchSubmit}
          className="rounded-2xl bg-slate-950/70 border border-white/20 p-2 flex flex-wrap sm:flex-nowrap items-center gap-2 shadow-xl"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0 px-2">
            <Search className="w-4 h-4 text-blue-300 shrink-0" />
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ask Muse AI anything — explain a concept, solve homework, write code, or plan your day..."
              aria-label="Home AI search bar"
              className="w-full bg-transparent py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              aria-label="Open Voice AI Microphone Search"
              onClick={() => onNavigate('voice_ai')}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4 text-blue-300" />
              <span>Voice Search</span>
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Bot className="w-4 h-4 text-blue-600" />
              <span>Ask AI</span>
            </button>
          </div>
        </form>

        {/* Quick Action Buttons — MUSE Academies + Core AI Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('lesson_academy')}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-300" /> Learning Academy
          </button>
          <button
            type="button"
            onClick={() => onNavigate('video_academy')}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Video className="w-3.5 h-3.5 text-sky-300" /> Video Academy
          </button>
          <button
            type="button"
            onClick={() => onNavigate('image_academy')}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-300" /> Image Academy
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai_teacher')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5 text-blue-300" /> AI Assistant
          </button>
          <button
            type="button"
            onClick={() => onNavigate('voice_ai')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Mic className="w-3.5 h-3.5 text-purple-300" /> Voice AI
          </button>
          <button
            type="button"
            onClick={() => onNavigate('education_hub')}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-200" /> Education Hub (Cl 1–12)
          </button>
          <button
            type="button"
            onClick={() => onNavigate('study_planner')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-300" /> Smart Planner
          </button>
        </div>
      </section>

      {/* MUSE APP CONTENT FIRST: Featured Learning, Video & Image Academies */}
      <section aria-label="MUSE App Content First" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-lg">MUSE App Content First</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Explore MUSE Learning Academy chapters, Video Academy walkthroughs, and Image Academy visual diagrams first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('learning_studio')}
            className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            Open Full Learning Studio <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Learning Academy Featured Lessons */}
        <div className="muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h3 className="font-display font-bold text-base">
                Learning Academy ({workspace.lessons.length} Lessons)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lesson_academy')}
              className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
            >
              View All Lessons <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredLessons.map((lesson) => {
              const isDone = workspace.progress.some((p) => p.lessonId === lesson.id && p.completed);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onNavigate('lesson_academy', lesson.id)}
                  className="text-left muse-panel p-4 space-y-2.5 hover:border-emerald-500/50 transition flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{lesson.board} Class {lesson.classLevel} · {lesson.subject}</span>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <h4 className="font-display font-bold text-sm text-[var(--text-primary)] line-clamp-1">
                      {lesson.title}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {lesson.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 text-emerald-400 font-semibold">
                    <span>{lesson.durationMinutes} min · {lesson.xrModelId ? '3D XR Model' : 'Diagram'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Video Academy Featured Walkthroughs */}
        <div className="muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-sky-400" />
              <h3 className="font-display font-bold text-base">
                Video Academy ({workspace.videos.length} Walkthroughs)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('video_academy')}
              className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
            >
              Open Video Academy <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredVideos.map((vid) => {
              const thumbSrc = VIDEO_THUMBNAIL_BY_ID[vid.id];
              const isBroken = brokenMediaIds[vid.id];
              return (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => onNavigate('video_academy')}
                  className="text-left muse-panel overflow-hidden hover:border-sky-500/50 transition flex flex-col justify-between"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden">
                    {thumbSrc && !isBroken ? (
                      <img
                        src={thumbSrc}
                        alt={`${vid.title} video walkthrough preview`}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenMediaIds((b) => ({ ...b, [vid.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 flex items-center justify-center">
                        <Video className="w-8 h-8 text-sky-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end justify-between p-3">
                      <span className="text-[11px] font-semibold text-white">
                        {vid.subject} · {vid.durationLabel}
                      </span>
                      <span className="w-7 h-7 rounded-full bg-blue-600/90 text-white flex items-center justify-center">
                        <Play className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h4 className="font-display font-bold text-sm text-[var(--text-primary)] line-clamp-1">
                      {vid.title}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {vid.chapter} · {vid.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Image Academy Featured Interactive Plates */}
        <div className="muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-base">
                Image Academy ({workspace.images.length} Visual Plates &amp; AI Studio)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('image_academy')}
              className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
            >
              Open Image Academy <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredImages.map((img) => {
              const imgSrc = IMAGE_ASSET_BY_KEY[img.mediaKey];
              const isBroken = brokenMediaIds[img.id];
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onNavigate('image_academy')}
                  className="text-left muse-panel overflow-hidden hover:border-amber-500/50 transition flex flex-col justify-between"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden">
                    {imgSrc && !isBroken ? (
                      <img
                        src={imgSrc}
                        alt={img.title}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenMediaIds((b) => ({ ...b, [img.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 to-purple-950 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-amber-300" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent p-3 flex items-center justify-between text-[11px] text-slate-200">
                      <span>{img.subject} · {img.hotspots.length} hotspots</span>
                      <span className="font-semibold text-amber-300">Inspect</span>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h4 className="font-display font-bold text-sm text-[var(--text-primary)] line-clamp-1">
                      {img.title}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {img.chapter} · {img.summary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Old Dashboard Academies & Centres Directory */}
        <div className="muse-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base">
              All MUSE Academies &amp; Study Centres
            </h3>
            <span className="text-xs text-[var(--text-muted)]">Direct access to every classic dashboard module</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {OLD_DASHBOARD_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="muse-panel p-3.5 text-left hover:border-blue-500/40 transition flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                    <mod.icon className={`w-4 h-4 ${mod.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {mod.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] line-clamp-1">
                      {mod.desc}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Productivity Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="muse-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Daily Productivity
            </span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl tabular-nums">{taskCompletionPct}%</div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
              {completedTasksCount} of {workspace.studyPlans.length} tasks done · {pendingTasks.length} pending
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('study_planner')}
            className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1"
          >
            Open Smart Planner <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="muse-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Continue Learning
            </span>
            <BookOpen className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm line-clamp-1">{nextLesson.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {nextLesson.subject} · {nextLesson.chapter}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('lesson_academy', nextLesson.id)}
            className="text-xs font-semibold text-purple-400 hover:underline flex items-center gap-1"
          >
            Open Lesson <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="muse-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Quizzes &amp; Practice
            </span>
            <ClipboardCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm">5-Min Concept Check</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
              {workspace.attempts.length} attempt{workspace.attempts.length === 1 ? '' : 's'} recorded
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('daily_quiz')}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
          >
            Start Daily Quiz <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="muse-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Achievements
            </span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm tabular-nums">
              {badges.filter((b) => b.unlocked).length} / {badges.length} Badges
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
              {completedLessons.length} lessons completed
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('performance_centre')}
            className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
          >
            View Progress Center <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Today's Schedule, Pending Tasks & Subject Progress */}
        <div className="lg:col-span-7 min-w-0 space-y-6">
          <div className="muse-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h2 className="font-display font-bold text-base">Today&apos;s Schedule &amp; Pending Tasks</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('study_planner')}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                Manage All
              </button>
            </div>

            {todaysSchedule.length === 0 && pendingTasks.length === 0 ? (
              <div className="muse-panel p-4 text-sm text-[var(--text-muted)]">
                No tasks scheduled yet. Add your daily goals in Smart Planner.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {(todaysSchedule.length > 0 ? todaysSchedule : pendingTasks.slice(0, 4)).map((task) => (
                  <li key={task.id} className="muse-panel px-4 py-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask(task.id)}
                      />
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${task.completed ? 'line-through text-[var(--text-muted)]' : ''}`}>
                          {task.title}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] tabular-nums">
                          {task.subject} · {task.scheduledTime || 'Anytime'} · {task.priority || 'medium'} priority
                        </div>
                      </div>
                    </label>
                    <span className="text-[11px] font-semibold text-blue-400 capitalize shrink-0">
                      {task.taskType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="muse-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base">Subject Mastery Overview</h2>
              <button
                type="button"
                onClick={() => onNavigate('performance_centre')}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                Full Progress Report
              </button>
            </div>
            <div className="space-y-3.5">
              {subjectProgress.map((sub) => (
                <div key={sub.subject} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-semibold">{sub.subject}</span>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      {sub.completedLessons}/{sub.totalLessons} lessons ({sub.lessonPercentage}%)
                      {sub.averageQuizScore !== null ? ` · Quiz avg ${sub.averageQuizScore}%` : ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                      style={{ width: `${Math.max(4, sub.lessonPercentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent AI Conversations & Suggested AI Activities */}
        <div className="lg:col-span-5 min-w-0 space-y-6">
          <div className="muse-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Recent AI Conversations</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('ai_teacher')}
                className="text-xs font-medium text-blue-400 hover:underline"
              >
                Open Assistant
              </button>
            </div>

            {recentConversations.length === 0 ? (
              <div className="muse-panel p-4 space-y-2.5">
                <p className="text-xs text-[var(--text-secondary)]">
                  No recent AI threads yet. Ask a question in the search bar above or start a conversation.
                </p>
                <button
                  type="button"
                  onClick={() => onAskPrompt('Explain Newton’s Second Law with a cricket ball example.')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
                >
                  Try Sample Question
                </button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {recentConversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('ai_teacher')}
                      className="w-full text-left muse-panel p-3.5 hover:border-blue-500/40 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{conv.title}</div>
                        <div className="text-xs text-[var(--text-muted)] tabular-nums">
                          {conv.subject} · {conv.messages.length} messages
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base">Suggested AI Activities</h2>
            <div className="space-y-2.5">
              {SUGGESTED_AI_ACTIVITIES.map((act) => (
                <button
                  key={act.title}
                  type="button"
                  onClick={() => onNavigate(act.module)}
                  className="w-full text-left muse-panel p-3.5 hover:border-blue-500/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">{act.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{act.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
              ))}
            </div>

            {weakTopics.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <div className="text-xs font-semibold text-amber-400">Priority Revision Focus</div>
                <div className="muse-panel p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    {weakTopics[0].topic} ({weakTopics[0].accuracy}% accuracy)
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('practice_centre')}
                    className="text-blue-400 font-semibold hover:underline"
                  >
                    Practise →
                  </button>
                </div>
              </div>
            )}
          </div>

          {completedLessons.length > 0 && (
            <div className="muse-card p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{completedLessons.length} Lessons Completed</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('lesson_academy')}
                className="text-blue-400 hover:underline"
              >
                Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
