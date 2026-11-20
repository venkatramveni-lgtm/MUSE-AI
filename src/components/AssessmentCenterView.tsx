import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  AssessmentConfig,
  AssessmentMode,
  DifficultyLevel,
  QuestionItem,
  QuizAttempt,
  UserProfile,
} from '../types/muse';
import { auth, authFetch } from '../services/firebaseClient';
import { detectWeakTopics, gradeAssessment } from '../utils/academicEngine';
import { filterByStudentClass, prioritizeByClassAndProfile } from '../utils/curriculumFilter';

interface AssessmentCenterViewProps {
  mode: AssessmentMode;
  profile: UserProfile;
  assessments: AssessmentConfig[];
  questions: QuestionItem[];
  attempts: QuizAttempt[];
  onRecordAttempt: (attempt: QuizAttempt) => void;
}

export const AssessmentCenterView: React.FC<AssessmentCenterViewProps> = ({
  mode,
  profile,
  assessments,
  questions,
  attempts,
  onRecordAttempt,
}) => {
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentConfig | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QuestionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [timerEnabled, setTimerEnabled] = useState(mode === 'weekly_test');
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<QuizAttempt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Practice Centre adaptive filters
  const [myClassOnly, setMyClassOnly] = useState<boolean>(true);
  const [practiceSubject, setPracticeSubject] = useState<string>('ALL');
  const [practiceDifficulty, setPracticeDifficulty] = useState<DifficultyLevel | 'ALL'>('ALL');

  const modeAssessments = useMemo(() => {
    const byMode = assessments.filter((a) => a.mode === mode);
    const ranked = prioritizeByClassAndProfile(byMode, profile);
    return filterByStudentClass(ranked, profile.classLevel, myClassOnly);
  }, [assessments, mode, profile, myClassOnly]);

  const modeAttempts = useMemo(
    () => attempts.filter((a) => a.mode === mode).slice().reverse(),
    [attempts, mode]
  );

  const weakTopics = useMemo(
    () => detectWeakTopics(attempts, questions),
    [attempts, questions]
  );

  const autoSubmittedRef = React.useRef(false);

  // Reset active session if user switches between Daily Quiz / Weekly Tests / Practice Centre
  useEffect(() => {
    setSelectedAssessment(null);
    setActiveQuestions([]);
    setLastResult(null);
    setConfirmSubmit(false);
    setErrorMsg(null);
    autoSubmittedRef.current = false;
  }, [mode]);

  useEffect(() => {
    if (!selectedAssessment || !timerEnabled || lastResult) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedAssessment, timerEnabled, lastResult]);

  useEffect(() => {
    if (
      selectedAssessment &&
      timerEnabled &&
      secondsLeft === 0 &&
      !lastResult &&
      !submitting &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      setErrorMsg('Time expired — automatically submitting your answers.');
      submitAssessment();
    }
  });

  const startAssessment = (config: AssessmentConfig, customQuestions?: QuestionItem[]) => {
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const resolved = customQuestions
      ? customQuestions
      : config.questionIds.map((id) => qMap.get(id)).filter((q): q is QuestionItem => Boolean(q));

    // Weekly tests randomize question order
    const ordered =
      config.mode === 'weekly_test'
        ? [...resolved].sort(() => Math.random() - 0.5)
        : resolved;

    if (ordered.length === 0) {
      setErrorMsg('No questions available for this selection yet.');
      return;
    }

    setSelectedAssessment(config);
    setActiveQuestions(ordered);
    setCurrentIdx(0);
    setAnswers({});
    setSecondsLeft(config.durationMinutes * 60);
    setConfirmSubmit(false);
    setLastResult(null);
    setErrorMsg(null);
    autoSubmittedRef.current = false;
  };

  const startAdaptivePractice = (topicFilter?: string) => {
    const rankedQuestions = prioritizeByClassAndProfile(questions, profile);
    const classScoped = filterByStudentClass(rankedQuestions, profile.classLevel, myClassOnly);
    let pool = classScoped.filter((q) => {
      if (practiceSubject !== 'ALL' && q.subject !== practiceSubject) return false;
      if (practiceDifficulty !== 'ALL' && q.difficulty !== practiceDifficulty) return false;
      if (topicFilter && q.topic !== topicFilter) return false;
      return true;
    });
    if (pool.length === 0) {
      pool = rankedQuestions.filter((q) => {
        if (practiceSubject !== 'ALL' && q.subject !== practiceSubject) return false;
        if (practiceDifficulty !== 'ALL' && q.difficulty !== practiceDifficulty) return false;
        if (topicFilter && q.topic !== topicFilter) return false;
        return true;
      });
    }
    if (pool.length === 0) pool = rankedQuestions.slice(0, 4);

    const cfg: AssessmentConfig = {
      id: `practice_${Date.now()}`,
      title: topicFilter ? `Adaptive Practice: ${topicFilter}` : 'Personalized Practice Set',
      mode: 'practice',
      board: profile.board,
      classLevel: profile.classLevel,
      subject: pool[0]?.subject || 'Science',
      durationMinutes: 8,
      questionIds: pool.map((q) => q.id),
    };
    startAssessment(cfg, pool);
  };

  const submitAssessment = async () => {
    if (!selectedAssessment || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let graded: { score: number; total: number; percentage: number; results: QuizAttempt['results'] };
      if (!auth.currentUser) {
        graded = gradeAssessment(activeQuestions, answers);
      } else {
        const resp = await authFetch('/api/assessments/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: activeQuestions.map((q) => q.id),
            answers,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setErrorMsg(data.error || 'Could not grade assessment on server.');
          return;
        }
        graded = data;
      }

      const attempt: QuizAttempt = {
        id: `att_${Date.now()}`,
        uid: profile.uid,
        assessmentId: selectedAssessment.id,
        assessmentTitle: selectedAssessment.title,
        mode: selectedAssessment.mode,
        subject: selectedAssessment.subject,
        score: graded.score,
        total: graded.total,
        percentage: graded.percentage,
        results: graded.results,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      };
      onRecordAttempt(attempt);
      setLastResult(attempt);
      setConfirmSubmit(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error submitting assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const titleByMode =
    mode === 'daily_quiz'
      ? 'Daily Quiz'
      : mode === 'weekly_test'
        ? 'Weekly Tests & Examinations'
        : 'Adaptive Practice Centre';

  // Active Result Review Screen
  if (lastResult && selectedAssessment) {
    return (
      <div className="space-y-5">
        <div className="muse-card p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Server-Verified Result • Immutable Record
            </div>
            <h1 className="font-display text-2xl font-bold mt-1">{lastResult.assessmentTitle}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Score: {lastResult.score} / {lastResult.total} ({lastResult.percentage}%)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => startAssessment(selectedAssessment, activeQuestions)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedAssessment(null);
                setLastResult(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
            >
              Back to {titleByMode}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {lastResult.results.map((res, idx) => (
            <div key={res.questionId} className="muse-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold">
                  Q{idx + 1}. {res.prompt}
                </div>
                {res.isCorrect ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 flex items-center gap-1 shrink-0">
                    <XCircle className="w-3.5 h-3.5" /> Needs Review
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Your Answer: <span className="text-[var(--text-primary)]">{res.userAnswer}</span> • Correct Answer:{' '}
                <span className="text-emerald-400 font-semibold">{res.correctAnswerDisplay}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] muse-panel p-3">
                <strong>Explanation:</strong> {res.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active Question-by-Question Screen
  if (selectedAssessment && activeQuestions.length > 0) {
    const q = activeQuestions[currentIdx];
    const currentAnswer = answers[q.id];
    const answeredCount = activeQuestions.filter((item) => {
      const a = answers[item.id];
      return Array.isArray(a) ? a.some(Boolean) : typeof a === 'string' && a.trim().length > 0;
    }).length;

    return (
      <div className="space-y-5">
        <div className="muse-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--text-muted)]">
              Question {currentIdx + 1} of {activeQuestions.length} • {q.topic} ({q.difficulty})
            </div>
            <h1 className="font-display font-bold text-lg">{selectedAssessment.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
              />
              Timer
            </label>
            {timerEnabled && (
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {formatTimer(secondsLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar & Question Navigator */}
        <div className="muse-card p-4 space-y-3">
          <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${((currentIdx + 1) / activeQuestions.length) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeQuestions.map((item, idx) => {
              const ans = answers[item.id];
              const isAnswered = Array.isArray(ans)
                ? ans.some(Boolean)
                : typeof ans === 'string' && ans.trim().length > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold border ${
                    idx === currentIdx
                      ? 'bg-blue-600 text-white border-blue-500'
                      : isAnswered
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Question Card */}
        <div className="muse-card p-6 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            {q.type.replace('_', ' ')}
          </div>
          <h2 className="font-display text-lg font-bold">{q.prompt}</h2>

          {(q.type === 'mcq' || q.type === 'true_false') && q.options && (
            <div className="grid gap-2.5">
              {q.options.map((opt) => {
                const selected = currentAnswer === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`text-left px-4 py-3 rounded-xl border text-sm transition ${
                      selected
                        ? 'bg-blue-600/20 border-blue-500 text-[var(--text-primary)] font-semibold'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-blue-500/40'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'fill_blank' && (
            <input
              type="text"
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Type your exact answer..."
              aria-label="Fill in the blank answer"
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
            />
          )}

          {q.type === 'short_answer' && (
            <textarea
              rows={3}
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Write a brief, clear scientific or mathematical explanation..."
              aria-label="Short answer response"
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
            />
          )}

          {q.type === 'match' && q.pairs && (
            <div className="space-y-3">
              {q.pairs.map((pair, pIdx) => {
                const currentArr = Array.isArray(currentAnswer)
                  ? currentAnswer
                  : q.pairs!.map(() => '');
                const choices = q.pairs!.map((p) => p.right);
                return (
                  <div key={pair.left} className="muse-panel p-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium">{pair.left}</span>
                    <select
                      aria-label={`Match for ${pair.left}`}
                      value={currentArr[pIdx] || ''}
                      onChange={(e) => {
                        const next = [...currentArr];
                        next[pIdx] = e.target.value;
                        setAnswers((prev) => ({ ...prev, [q.id]: next }));
                      }}
                      className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                    >
                      <option value="">Select match...</option>
                      {choices.map((ch) => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-2">
              {currentIdx < activeQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.min(activeQuestions.length - 1, i + 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : !confirmSubmit ? (
                <button
                  type="button"
                  onClick={() => setConfirmSubmit(true)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary"
                >
                  Review & Submit ({answeredCount}/{activeQuestions.length} answered)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(false)}
                    className="px-3 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submitAssessment}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {submitting ? 'Grading on Server...' : 'Confirm Final Submit'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Selector + History Screen
  return (
    <div className="space-y-6">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl">{titleByMode}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {mode === 'practice'
              ? `Adaptive practice engine calibrated for Class ${profile.classLevel} (${profile.board}).`
              : `Class ${profile.classLevel} daily quizzes & exams prioritized automatically; submitted records are immutable.`}
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

      {mode === 'practice' ? (
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 muse-card p-5 space-y-4">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Configure Custom Practice Session
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="prac-sub" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Subject
                </label>
                <select
                  id="prac-sub"
                  value={practiceSubject}
                  onChange={(e) => setPracticeSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  <option value="ALL">All Subjects</option>
                  {Array.from(new Set(questions.map((q) => q.subject))).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prac-diff" className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Difficulty
                </label>
                <select
                  id="prac-diff"
                  value={practiceDifficulty}
                  onChange={(e) => setPracticeDifficulty(e.target.value as DifficultyLevel | 'ALL')}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                >
                  <option value="ALL">Mixed Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startAdaptivePractice()}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary"
            >
              Start Practice Set
            </button>
          </div>

          <div className="lg:col-span-5 muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base">Weak-Topic Recommendations</h2>
            {weakTopics.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No weak topics recorded yet. Complete a quiz or practice set to generate real topic recommendations.
              </p>
            ) : (
              <ul className="space-y-2">
                {weakTopics.slice(0, 4).map((w) => (
                  <li key={w.topic} className="muse-panel p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold">{w.topic}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {w.subject} • {w.accuracy}% accuracy
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startAdaptivePractice(w.topic)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold muse-btn-primary"
                    >
                      Train
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {modeAssessments.map((a) => (
            <div key={a.id} className="muse-card p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{a.board} • Class {a.classLevel} • {a.subject}</span>
                  <span>{a.durationMinutes} mins</span>
                </div>
                <h2 className="font-display font-bold text-base">{a.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {a.questionIds.length} questions • Auto-graded with detailed explanations
                </p>
              </div>
              <button
                type="button"
                onClick={() => startAssessment(a)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold muse-btn-primary flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="w-4 h-4" />
                {mode === 'weekly_test' ? 'Begin Examination' : 'Start Daily Quiz'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attempt History */}
      <div className="muse-card p-5 space-y-3">
        <h2 className="font-display font-bold text-base">Assessment History ({modeAttempts.length})</h2>
        {modeAttempts.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            No submitted attempts in this module yet.
          </p>
        ) : (
          <div className="space-y-2">
            {modeAttempts.map((att) => (
              <div key={att.id} className="muse-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{att.assessmentTitle}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {att.subject} • Submitted {new Date(att.submittedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm font-bold text-blue-400">
                  {att.score}/{att.total} ({att.percentage}%)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
