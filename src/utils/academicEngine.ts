import {
  AchievementBadge,
  BLUEPRINT_LIMITS,
  GradedQuestionResult,
  LearningProgress,
  LessonItem,
  QuestionItem,
  QuizAttempt,
} from '../types/muse';

export interface GradeAssessmentResponse {
  score: number;
  total: number;
  percentage: number;
  results: GradedQuestionResult[];
}

export function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function gradeAssessment(
  questions: QuestionItem[],
  submittedAnswers: Record<string, string | string[]>
): GradeAssessmentResponse {
  const results: GradedQuestionResult[] = [];
  let score = 0;

  for (const q of questions) {
    const rawAns = submittedAnswers[q.id];
    let isCorrect = false;
    let userAnswerStr = '';
    let correctDisplay = '';

    if (q.type === 'match' && Array.isArray(q.correctAnswer)) {
      const expectedArr = q.correctAnswer;
      const providedArr = Array.isArray(rawAns)
        ? rawAns
        : typeof rawAns === 'string' && rawAns.length > 0
          ? rawAns.split('|')
          : [];
      userAnswerStr = providedArr.join(' | ') || 'No answer';
      correctDisplay = expectedArr.join(' | ');
      isCorrect =
        providedArr.length === expectedArr.length &&
        expectedArr.every((val, idx) => normalizeAnswer(providedArr[idx]) === normalizeAnswer(val));
    } else if (q.type === 'short_answer') {
      const text = typeof rawAns === 'string' ? rawAns.trim() : '';
      userAnswerStr = text || 'No answer';
      const expectedStr = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer.join(', ');
      correctDisplay = expectedStr;
      const normalized = normalizeAnswer(text);
      const keywords = q.keywords && q.keywords.length > 0 ? q.keywords : [expectedStr];
      isCorrect = keywords.some((kw) => normalized.includes(normalizeAnswer(kw)));
    } else {
      const text = typeof rawAns === 'string' ? rawAns.trim() : '';
      userAnswerStr = text || 'No answer';
      const expectedStr = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer[0] ?? '';
      correctDisplay = expectedStr;
      isCorrect = normalizeAnswer(text) === normalizeAnswer(expectedStr) && normalizedNotEmpty(text);
    }

    if (isCorrect) score += 1;

    results.push({
      questionId: q.id,
      prompt: q.prompt,
      topic: q.topic,
      userAnswer: userAnswerStr,
      correctAnswerDisplay: correctDisplay,
      isCorrect,
      explanation: q.explanation,
    });
  }

  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return { score, total, percentage, results };
}

function normalizedNotEmpty(val: string): boolean {
  return val.trim().length > 0;
}

export interface TopicWeakness {
  topic: string;
  subject: string;
  accuracy: number;
  attemptsCount: number;
}

export function detectWeakTopics(
  attempts: QuizAttempt[],
  questions: QuestionItem[]
): TopicWeakness[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const bucket = new Map<string, { subject: string; correct: number; total: number }>();

  for (const attempt of attempts) {
    for (const res of attempt.results) {
      const q = questionById.get(res.questionId);
      const topic = res.topic || q?.topic || 'General';
      const subject = q?.subject || attempt.subject;
      const current = bucket.get(topic) ?? { subject, correct: 0, total: 0 };
      current.total += 1;
      if (res.isCorrect) current.correct += 1;
      bucket.set(topic, current);
    }
  }

  const weak: TopicWeakness[] = [];
  for (const [topic, stats] of bucket.entries()) {
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    weak.push({
      topic,
      subject: stats.subject,
      accuracy,
      attemptsCount: stats.total,
    });
  }

  return weak.sort((a, b) => a.accuracy - b.accuracy);
}

export interface SubjectProgressSummary {
  subject: string;
  completedLessons: number;
  totalLessons: number;
  lessonPercentage: number;
  averageQuizScore: number | null;
}

export function computeSubjectProgress(
  lessons: LessonItem[],
  progressList: LearningProgress[],
  attempts: QuizAttempt[]
): SubjectProgressSummary[] {
  const progressByLesson = new Map(progressList.map((p) => [p.lessonId, p]));
  const subjectsMap = new Map<string, { completed: number; total: number }>();

  for (const lesson of lessons) {
    const entry = subjectsMap.get(lesson.subject) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (progressByLesson.get(lesson.id)?.completed) {
      entry.completed += 1;
    }
    subjectsMap.set(lesson.subject, entry);
  }

  const quizBySubject = new Map<string, number[]>();
  for (const attempt of attempts) {
    const arr = quizBySubject.get(attempt.subject) ?? [];
    arr.push(attempt.percentage);
    quizBySubject.set(attempt.subject, arr);
  }

  const summaries: SubjectProgressSummary[] = [];
  for (const [subject, counts] of subjectsMap.entries()) {
    const scores = quizBySubject.get(subject) ?? [];
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    summaries.push({
      subject,
      completedLessons: counts.completed,
      totalLessons: counts.total,
      lessonPercentage: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      averageQuizScore: avg,
    });
  }

  return summaries;
}

export function evaluateAchievements(params: {
  completedLessonsCount: number;
  attempts: QuizAttempt[];
  studyStreak: number;
  completedStudyTasks: number;
}): AchievementBadge[] {
  const { completedLessonsCount, attempts, studyStreak, completedStudyTasks } = params;
  const highScoreCount = attempts.filter((a) => a.percentage >= 80).length;

  return [
    {
      key: 'first_lesson',
      title: 'Curious Scholar',
      description: 'Complete your first lesson in Lesson Academy.',
      category: 'lessons',
      unlocked: completedLessonsCount >= 1,
      progressLabel: `${Math.min(completedLessonsCount, 1)}/1 lessons`,
    },
    {
      key: 'lesson_explorer',
      title: 'Chapter Explorer',
      description: 'Complete 3 structured curriculum lessons.',
      category: 'lessons',
      unlocked: completedLessonsCount >= 3,
      progressLabel: `${Math.min(completedLessonsCount, 3)}/3 lessons`,
    },
    {
      key: 'quiz_starter',
      title: 'Quiz Challenger',
      description: 'Submit your first Daily Quiz or Weekly Test.',
      category: 'quizzes',
      unlocked: attempts.length >= 1,
      progressLabel: `${Math.min(attempts.length, 1)}/1 attempts`,
    },
    {
      key: 'mastery_80',
      title: 'Concept Mastery',
      description: 'Score 80% or higher on an assessment.',
      category: 'mastery',
      unlocked: highScoreCount >= 1,
      progressLabel: `${Math.min(highScoreCount, 1)}/1 high score`,
    },
    {
      key: 'streak_3',
      title: 'Steady Momentum',
      description: 'Maintain a 3-day learning streak.',
      category: 'streak',
      unlocked: studyStreak >= 3,
      progressLabel: `${Math.min(studyStreak, 3)}/3 days`,
    },
    {
      key: 'planner_pro',
      title: 'Organized Learner',
      description: 'Complete 3 tasks in your Study Planner.',
      category: 'streak',
      unlocked: completedStudyTasks >= 3,
      progressLabel: `${Math.min(completedStudyTasks, 3)}/3 tasks`,
    },
  ];
}

export interface SafetyValidationResult {
  allowed: boolean;
  reason?: string;
}

const BLOCKED_INJECTION_PATTERNS = [
  /ignore (all|previous|prior) instructions/i,
  /reveal (your|the) system prompt/i,
  /act as (a )?(hacker|jailbreak|dan)/i,
  /bypass (safety|rules|guardrails)/i,
];

const BLOCKED_HARMFUL_PATTERNS = [
  /\b(self[- ]?harm|suicide|bomb[- ]?making|weapon|explicit porn)\b/i,
];

export function validateAcademicInputSafety(prompt: string): SafetyValidationResult {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Please enter a question or topic for Muse AI.' };
  }
  if (trimmed.length > 4000) {
    return { allowed: false, reason: 'Question exceeds the 4,000-character limit.' };
  }
  for (const pattern of BLOCKED_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Prompt blocked by Muse AI safety guard: please ask a genuine, constructive question.',
      };
    }
  }
  for (const pattern of BLOCKED_HARMFUL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Muse AI is restricted to safe, constructive questions.',
      };
    }
  }
  return { allowed: true };
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return BLUEPRINT_LIMITS.ID_REGEX.test(cleaned) && cleaned.length > 0 ? cleaned : 'item_1';
}

export function truncateForBlueprint(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export interface QuizTrendPoint {
  index: number;
  id: string;
  label: string;
  shortDate: string;
  title: string;
  subject: string;
  mode: QuizAttempt['mode'];
  score: number;
  total: number;
  percentage: number;
  cumulativeAvg: number;
}

export function buildQuizTrendChartData(attempts: QuizAttempt[], limit = 16): QuizTrendPoint[] {
  if (!attempts || attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => {
    const tA = Date.parse(a.submittedAt) || 0;
    const tB = Date.parse(b.submittedAt) || 0;
    return tA - tB;
  });

  const sliced = sorted.slice(-Math.max(1, limit));
  let runningSum = 0;

  return sliced.map((att, idx) => {
    const pct = Math.min(100, Math.max(0, Math.round(Number(att.percentage) || 0)));
    runningSum += pct;
    const cumulativeAvg = Math.round(runningSum / (idx + 1));
    const parsedDate = Date.parse(att.submittedAt);
    const shortDate = Number.isFinite(parsedDate)
      ? new Date(parsedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : `#${idx + 1}`;
    return {
      index: idx + 1,
      id: att.id,
      label: `#${idx + 1} · ${shortDate}`,
      shortDate,
      title: att.assessmentTitle || `${att.subject} Quiz`,
      subject: att.subject,
      mode: att.mode,
      score: att.score,
      total: att.total,
      percentage: pct,
      cumulativeAvg,
    };
  });
}

