import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  BookOpen,
  ClipboardCheck,
  Compass,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react';
import { AppModuleId } from '../types/muse';

interface GuidedArrowsOverlayProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (module: AppModuleId) => void;
}

interface GuideStep {
  id: string;
  direction: 'left' | 'down' | 'up';
  badge: string;
  title: string;
  instruction: string;
  choices: {
    label: string;
    actionHint: string;
    targetModule?: AppModuleId;
  }[];
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'sidebar',
    direction: 'left',
    badge: 'Step 1 of 3 • Look Left ←',
    title: 'Select What You Want to Do from the Sidebar',
    instruction:
      'Follow the ← arrow to the left navigation menu (or tap ☰ top-left on mobile) to pick any learning tool:',
    choices: [
      {
        label: 'AI Teacher (ChatGPT Mode)',
        actionHint: 'Ask ANY question — school, coding, science, math, or general curiosity',
        targetModule: 'ai_teacher',
      },
      {
        label: 'Learning Academy (My Lessons & 3D XR)',
        actionHint: 'Study chapters, inspect 3D models & tap "Save Offline" for internet-free reading',
        targetModule: 'lesson_academy',
      },
      {
        label: 'Education Hub (Classes 1–12 · 28 Boards · 23 Languages)',
        actionHint: 'Watch board-matched YouTube lessons & ask Muse AI Tutor side-by-side',
        targetModule: 'education_hub',
      },
      {
        label: 'Voice AI (Live Talk Real-Time Conversation)',
        actionHint: 'Speak naturally with waveform feedback, smart voice commands & instant spoken replies',
        targetModule: 'voice_ai',
      },
      {
        label: 'Video Academy & Image Academy',
        actionHint: 'Watch animated walkthroughs or explore high-res hotspot diagrams & AI visuals',
        targetModule: 'image_academy',
      },
      {
        label: 'Daily Quiz, Weekly Tests & Revision',
        actionHint: 'Practise instant-graded questions, flashcards, and offline Saved Notes',
        targetModule: 'daily_quiz',
      },
    ],
  },
  {
    id: 'ai_composer',
    direction: 'down',
    badge: 'Step 2 of 3 • Look Down ↓',
    title: 'Ask Anything in the ChatGPT-Style AI Composer',
    instruction:
      'Inside AI Teacher, follow the ↓ arrow to the floating composer bar at the bottom of the screen:',
    choices: [
      {
        label: '1. Subject → "Any Topic / General" (or pick Math, Science, etc.)',
        actionHint: 'Allows open-ended ChatGPT-style questions on any subject or skill',
        targetModule: 'ai_teacher',
      },
      {
        label: '2. Mode → "Answer Anything" or "Step-by-step"',
        actionHint: 'Controls whether Muse AI answers directly or breaks down steps',
      },
      {
        label: '3. Type your question → Press Enter or click ↑ Send',
        actionHint: 'Follow-up question chips appear automatically below each answer',
      },
    ],
  },
  {
    id: 'header_tools',
    direction: 'up',
    badge: 'Step 3 of 3 • Look Up ↑',
    title: 'Quick Tools in the Top Header Bar',
    instruction:
      'Follow the ↑ arrow to the top header anytime to search, check offline readiness, or switch themes:',
    choices: [
      {
        label: 'Search Bar (Top-Left)',
        actionHint: 'Jump straight to any lesson, video, or practice question',
      },
      {
        label: 'Online / Offline Pill & Notifications (Top-Right)',
        actionHint: 'Confirms My Lessons and Saved Notes are cached offline by Service Worker',
      },
      {
        label: 'Theme Switcher & Guide Arrows Button (Top-Right)',
        actionHint: 'Switch Light / Dark mode or reopen these directional arrows anytime',
      },
    ],
  },
];

export const GuidedArrowsOverlay: React.FC<GuidedArrowsOverlayProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const [stepIdx, setStepIdx] = useState(0);

  if (!open) return null;

  const step = GUIDE_STEPS[stepIdx] ?? GUIDE_STEPS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Muse AI Visual Arrow Instructions"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      {/* Directional Edge Pointer Anchors on Desktop/Mobile */}
      {step.direction === 'left' && (
        <div className="hidden lg:flex fixed left-64 top-36 items-center gap-2 pointer-events-none z-50 animate-pulse">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg border border-blue-300/40">
            <ArrowLeft className="w-5 h-5" />
            <span>Select module here</span>
          </div>
        </div>
      )}

      {step.direction === 'up' && (
        <div className="fixed top-16 right-8 flex items-center gap-2 pointer-events-none z-50 animate-pulse">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg border border-blue-300/40">
            <ArrowUp className="w-5 h-5" />
            <span>Header Search, Theme &amp; Offline status</span>
          </div>
        </div>
      )}

      {step.direction === 'down' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-50 animate-pulse">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg border border-blue-300/40">
            <ArrowDown className="w-5 h-5" />
            <span>Bottom ChatGPT composer: Type ANY question &amp; press Enter</span>
          </div>
        </div>
      )}

      <div className="muse-card w-full max-w-2xl p-5 sm:p-6 space-y-5 relative shadow-2xl border border-blue-500/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              {step.direction === 'left' && <ArrowLeft className="w-5 h-5" />}
              {step.direction === 'down' && <ArrowDown className="w-5 h-5" />}
              {step.direction === 'up' && <ArrowUp className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
                {step.badge}
              </div>
              <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
                {step.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Guide Arrows"
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">{step.instruction}</p>

        {/* Visual Step Choice Cards with Arrows */}
        <div className="space-y-2.5">
          {step.choices.map((c, idx) => (
            <div
              key={c.label}
              className="muse-panel p-3.5 flex items-center justify-between gap-3 border border-[var(--border-subtle)]"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 flex-wrap">
                    <span>{c.label}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{c.actionHint}</div>
                </div>
              </div>

              {c.targetModule && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(c.targetModule!);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary shrink-0 flex items-center gap-1"
                >
                  <span>Select</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Quick Flow Summary Row */}
        <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" /> Learning Academy
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
            <Video className="w-3.5 h-3.5 text-sky-400" /> Video Academy
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Image Academy
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
            <ClipboardCheck className="w-3.5 h-3.5 text-purple-400" /> Quiz &amp; Revision
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
            <Bot className="w-3.5 h-3.5 text-blue-400" /> AI Assistant
          </span>
        </div>

        {/* Step Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {GUIDE_STEPS.map((gs, i) => (
              <button
                key={gs.id}
                type="button"
                aria-label={`Guide step ${i + 1}`}
                onClick={() => setStepIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === stepIdx ? 'w-7 bg-blue-500' : 'w-2 bg-[var(--border-subtle)]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {stepIdx < GUIDE_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.min(GUIDE_STEPS.length - 1, i + 1))}
                className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1"
              >
                <span>Next Arrow</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onNavigate('ai_teacher');
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Open AI Teacher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
