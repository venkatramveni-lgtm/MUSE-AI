import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Box,
  Calendar,
  CheckCircle2,
  KeyRound,
  Mail,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ThemeMode } from '../types/muse';

interface LandingAuthViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onGoogleSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onLaunchDemo: () => void;
  authLoading: boolean;
  authError: string | null;
  authSuccess: string | null;
}

type AuthTab = 'signin' | 'signup' | 'reset';

export const LandingAuthView: React.FC<LandingAuthViewProps> = ({
  theme,
  onToggleTheme,
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onResetPassword,
  onLaunchDemo,
  authLoading,
  authError,
  authSuccess,
}) => {
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (authTab === 'reset') {
      await onResetPassword(trimmedEmail);
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (authTab === 'signup') {
      if (displayName.trim().length < 2) {
        setLocalError('Please enter your name (at least 2 characters).');
        return;
      }
      await onEmailSignUp(trimmedEmail, password, displayName.trim());
    } else {
      await onEmailSignIn(trimmedEmail, password);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl muse-btn-primary flex items-center justify-center font-display font-bold text-lg">
              M
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">Muse AI</div>
              <div className="text-xs text-[var(--text-muted)]">Think Smarter. Learn Faster. Do More.</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50"
            >
              {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            </button>
            <button
              type="button"
              onClick={onLaunchDemo}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50"
            >
              Try Demo
            </button>
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={authLoading}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold muse-btn-primary disabled:opacity-50"
            >
              {authLoading ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="muse-gradient-hero text-white py-12 sm:py-18 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Assistant · Voice AI · Smart Planner · Learning Studio</span>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Think Smarter. Learn Faster. Do More.
              </h1>
              <p className="text-base sm:text-lg text-slate-200 max-w-2xl leading-relaxed">
                Muse AI unifies a Gemini-powered AI Assistant with PDF &amp; image analysis, real-time Voice AI, an interactive Smart Planner, 3D XR Learning Studio, and live progress analytics in one calm, focused workspace.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={onLaunchDemo}
                  className="px-6 py-3.5 rounded-xl text-sm font-semibold bg-white text-slate-900 hover:bg-blue-50 flex items-center gap-2 shadow-lg"
                >
                  <span>Launch Demo Workspace</span>
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={authLoading}
                  className="px-6 py-3.5 rounded-xl text-sm font-semibold bg-blue-600/35 border border-blue-300/40 text-white hover:bg-blue-600/50 flex items-center gap-2 disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </div>
            </div>

            {/* Right: Explicit Firebase Auth Card (Sign In / Create Account / Reset Password) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-950/75 border border-white/15 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                  {[
                    { id: 'signin' as const, label: 'Sign In' },
                    { id: 'signup' as const, label: 'Create Account' },
                    { id: 'reset' as const, label: 'Reset Password' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setAuthTab(tab.id);
                        setLocalError(null);
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                        authTab === tab.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-100 leading-relaxed"
                  >
                    {activeError}
                  </div>
                )}

                {authSuccess && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 leading-relaxed"
                  >
                    {authSuccess}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  {authTab === 'signup' && (
                    <div>
                      <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        id="auth-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Aarav Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  {authTab !== 'reset' && (
                    <div>
                      <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold muse-btn-primary disabled:opacity-50"
                  >
                    {authLoading
                      ? 'Working...'
                      : authTab === 'signup'
                        ? 'Create Account & Send Verification'
                        : authTab === 'reset'
                          ? 'Send Password Reset Email'
                          : 'Sign In with Email'}
                  </button>
                </form>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                  <span>Instant Google Sign-In</span>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={authLoading}
                    className="text-blue-300 font-semibold hover:underline"
                  >
                    Continue with Google →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              icon: Bot,
              title: 'AI Assistant',
              desc: 'Ask anything, summarize PDFs & images, read answers aloud, and explore follow-up questions.',
            },
            {
              icon: Mic,
              title: 'Voice AI',
              desc: 'Speak naturally with live microphone dictation, animated waveform, and spoken Gemini replies.',
            },
            {
              icon: Calendar,
              title: 'Smart Planner',
              desc: 'Daily, weekly, and monthly calendars with task priorities, recurring schedules, and reminders.',
            },
            {
              icon: BookOpen,
              title: 'Learning Studio',
              desc: 'AI Notes, Flashcards & Quiz generators paired with structured lessons and 3D XR labs.',
            },
            {
              icon: Award,
              title: 'Progress & Security',
              desc: 'Real task & quiz analytics, offline PWA caching, JSON data export, and Firestore isolation.',
            },
          ].map((card) => (
            <div key={card.title} className="muse-card p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] text-blue-400 flex items-center justify-center">
                <card.icon className="w-4 h-4" />
              </div>
              <h2 className="font-display font-bold text-sm">{card.title}</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-400" />
              <span>Includes 3D XR Spatial Lab (Plant Cell, Solar System, Atom, Pythagoras, Water Cycle)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Offline PWA Cache ready for My Lessons &amp; Saved Notes</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
