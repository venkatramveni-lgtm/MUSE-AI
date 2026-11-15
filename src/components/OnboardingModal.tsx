import React, { useState } from 'react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import { EducationBoard, UserProfile } from '../types/muse';
import { Check, ShieldAlert, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
  initialProfile: UserProfile;
  onComplete: (updated: UserProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialProfile,
  onComplete,
}) => {
  const [displayName, setDisplayName] = useState(initialProfile.displayName || '');
  const [classLevel, setClassLevel] = useState<number>(initialProfile.classLevel || 7);
  const [board, setBoard] = useState<EducationBoard>(initialProfile.board || 'CBSE');
  const [preferredLanguage, setPreferredLanguage] = useState(initialProfile.preferredLanguage || 'English');
  const [learningPreference, setLearningPreference] = useState(
    initialProfile.learningPreference || 'Visual & Step-by-step'
  );
  const [subjects, setSubjects] = useState<string[]>(
    initialProfile.subjects.length > 0 ? initialProfile.subjects : ['Mathematics', 'Science', 'English']
  );
  const [academicGoal, setAcademicGoal] = useState(
    initialProfile.academicGoal || 'Build strong conceptual clarity across core subjects'
  );
  const [guardianEmail, setGuardianEmail] = useState(initialProfile.guardianEmail || '');
  const [guardianConsent, setGuardianConsent] = useState(initialProfile.guardianConsentApproved);
  const [error, setError] = useState<string | null>(null);

  const toggleSubject = (sub: string) => {
    setSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setError('Please enter your display name (at least 2 characters).');
      return;
    }
    if (subjects.length === 0) {
      setError('Please select at least one subject to personalize your dashboard.');
      return;
    }
    if (!guardianConsent) {
      setError('Guardian consent acknowledgment is required for learners in Classes 1–12.');
      return;
    }
    setError(null);
    onComplete({
      ...initialProfile,
      displayName: displayName.trim().slice(0, 80),
      classLevel,
      board,
      preferredLanguage,
      learningPreference,
      subjects,
      academicGoal: academicGoal.trim().slice(0, 240) || 'Master school concepts',
      guardianEmail: guardianEmail.trim().slice(0, 160) || undefined,
      guardianConsentApproved: true,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-app)]">
      <div className="muse-card w-full max-w-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Student Onboarding
            </div>
            <h1 className="font-display text-2xl font-bold">Personalize Your Muse AI Workspace</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              We collect only your academic preferences—no unnecessary personal details.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-sm text-rose-400 flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="onb-name" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                Student Display Name
              </label>
              <input
                id="onb-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Aarav Sharma"
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="onb-board" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                Education Board
              </label>
              <select
                id="onb-board"
                value={board}
                onChange={(e) => setBoard(e.target.value as EducationBoard)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
              >
                {BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="onb-class" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                Class (1–12)
              </label>
              <select
                id="onb-class"
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="onb-lang" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                Preferred Language
              </label>
              <select
                id="onb-lang"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="onb-style" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
              Learning Style Preference
            </label>
            <select
              id="onb-style"
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="Visual & Step-by-step">Visual & Step-by-step (Diagrams + 3D Models)</option>
              <option value="Real-world Examples">Real-world Examples & Analogies</option>
              <option value="Practice & Quiz Focused">Practice & Quiz Focused</option>
              <option value="Quick Revision Summaries">Quick Revision Summaries</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Subjects
            </span>
            <div className="flex flex-wrap gap-2">
              {CORE_SUBJECTS.map((sub) => {
                const active = subjects.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubject(sub)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
                      active
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="onb-goal" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
              Academic Goal
            </label>
            <input
              id="onb-goal"
              type="text"
              value={academicGoal}
              onChange={(e) => setAcademicGoal(e.target.value)}
              maxLength={240}
              placeholder="e.g., Score 90%+ in Science & Mathematics this term"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="muse-panel p-4 space-y-3">
            <label htmlFor="onb-guardian-email" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Parent / Guardian Email (Optional for Parent Portal Linking)
            </label>
            <input
              id="onb-guardian-email"
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
            />
            <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={guardianConsent}
                onChange={(e) => setGuardianConsent(e.target.checked)}
                className="mt-0.5 rounded border-[var(--border-subtle)]"
              />
              <span>
                I confirm that a parent or legal guardian has reviewed and approved age-appropriate AI learning and progress tracking for this student profile.
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold text-sm muse-btn-primary"
          >
            Save Preferences & Enter Muse AI
          </button>
        </form>
      </div>
    </div>
  );
};
