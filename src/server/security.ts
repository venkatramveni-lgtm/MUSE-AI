import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { SAMPLE_QUESTIONS } from '../data/curriculumSeed';
import type { QuestionItem } from '../types/muse';
import { gradeAssessment, type GradeAssessmentResponse } from '../utils/academicEngine';
import { SimpleTTLCache } from '../utils/educationHubUtils';

const BOOTSTRAPPED_ADMIN_EMAIL = 'venkatramveni@gmail.com';
const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const FIREBASE_JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface AuthenticatedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  rawToken: string;
}

export interface StoredEducationQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface StoredEducationQuizSession {
  uid: string;
  questions: StoredEducationQuizQuestion[];
  createdAt: string;
}

let cachedFirebaseConfig: { projectId?: string; firestoreDatabaseId?: string } | null = null;

export function getServerFirebaseConfig(): { projectId: string; firestoreDatabaseId: string } {
  if (!cachedFirebaseConfig) {
    try {
      const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const raw = fs.readFileSync(cfgPath, 'utf8');
      cachedFirebaseConfig = JSON.parse(raw) as {
        projectId?: string;
        firestoreDatabaseId?: string;
      };
    } catch {
      cachedFirebaseConfig = {};
    }
  }
  return {
    projectId: String(cachedFirebaseConfig?.projectId || process.env.GOOGLE_CLOUD_PROJECT || '').trim(),
    firestoreDatabaseId: String(cachedFirebaseConfig?.firestoreDatabaseId || '(default)').trim(),
  };
}

export function extractBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length >= 20 ? token : null;
}

export function extractWebSocketToken(req: IncomingMessage): string | null {
  try {
    const rawUrl = req.url || '';
    const url = new URL(rawUrl, 'http://localhost');
    const queryToken = url.searchParams.get('token')?.trim();
    if (queryToken && queryToken.length >= 20) return queryToken;
  } catch {
    // ignore malformed URL
  }

  const protoHeader = req.headers['sec-websocket-protocol'];
  if (typeof protoHeader === 'string') {
    const parts = protoHeader.split(',').map((s) => s.trim());
    for (const part of parts) {
      if (part.startsWith('bearer.') && part.length > 27) {
        return part.slice(7);
      }
    }
  }

  return extractBearerToken(req.headers.authorization);
}

export function isValidWebSocketOrigin(req: IncomingMessage): boolean {
  const originHeader = req.headers.origin;
  if (!originHeader || typeof originHeader !== 'string') {
    return false;
  }
  try {
    const originUrl = new URL(originHeader);
    if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') {
      return false;
    }
    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host.trim() : '';
    if (hostHeader && originUrl.host === hostHeader) {
      return true;
    }
    if (
      originUrl.hostname === 'localhost' ||
      originUrl.hostname === '127.0.0.1' ||
      originUrl.hostname.endsWith('.run.app')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getSafeRateLimitKey(req: Pick<Request, 'ip' | 'socket'>, authUid?: string): string {
  if (authUid && authUid.trim()) {
    return `uid:${authUid.trim()}`;
  }
  const remoteAddr = req.socket?.remoteAddress || req.ip || 'unknown';
  return `ip:${String(remoteAddr).trim() || 'unknown'}`;
}

export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId?: string
): Promise<AuthenticatedFirebaseUser> {
  const projectId = expectedProjectId || getServerFirebaseConfig().projectId;
  if (!projectId) {
    throw new Error('Firebase projectId is not configured on the server.');
  }

  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub || sub.length > 128) {
    throw new Error('Invalid Firebase token subject.');
  }

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    rawToken: token,
  };
}

export async function checkFirestoreAdminRegistry(uid: string, bearerToken: string): Promise<boolean> {
  const { projectId, firestoreDatabaseId } = getServerFirebaseConfig();
  if (!projectId || !firestoreDatabaseId) return false;
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(firestoreDatabaseId)}/documents/admins/${encodeURIComponent(uid)}`;
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function isVerifiedAdminUser(user: AuthenticatedFirebaseUser): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return checkFirestoreAdminRegistry(user.uid, user.rawToken);
}

export interface AuthedRequest extends Request {
  authUser?: AuthenticatedFirebaseUser;
}

export function createFirebaseAuthMiddleware(
  verifyFn: (token: string) => Promise<AuthenticatedFirebaseUser> = verifyFirebaseIdToken
) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        errorCode: 'AUTH_REQUIRED',
        error: 'Authentication required. Please sign in to access this Muse AI feature.',
      });
      return;
    }
    try {
      const user = await verifyFn(token);
      req.authUser = user;
      next();
    } catch {
      res.status(401).json({
        errorCode: 'INVALID_TOKEN',
        error: 'Invalid or expired authentication session. Please sign in again.',
      });
    }
  };
}

export function createAdminAuthMiddleware(
  verifyFn: (token: string) => Promise<AuthenticatedFirebaseUser> = verifyFirebaseIdToken,
  isAdminFn: (user: AuthenticatedFirebaseUser) => Promise<boolean> = isVerifiedAdminUser
) {
  const requireAuth = createFirebaseAuthMiddleware(verifyFn);
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, async () => {
      if (!req.authUser) return;
      const allowed = await isAdminFn(req.authUser);
      if (!allowed) {
        res.status(403).json({
          errorCode: 'ADMIN_FORBIDDEN',
          error: 'Administrator privileges with verified email are required.',
        });
        return;
      }
      next();
    });
  };
}

export function createEducationQuizSessionStore(ttlMs = 30 * 60 * 1000) {
  const cache = new SimpleTTLCache<StoredEducationQuizSession>(ttlMs);
  return {
    createSession(uid: string, questions: StoredEducationQuizQuestion[]): string {
      const quizSessionId = `edqs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      cache.set(quizSessionId, {
        uid,
        questions: questions.map((q) => ({ ...q, options: [...q.options] })),
        createdAt: new Date().toISOString(),
      });
      return quizSessionId;
    },
    getSession(quizSessionId: string): StoredEducationQuizSession | null {
      return cache.get(quizSessionId);
    },
    gradeSubmission(
      quizSessionId: string,
      uid: string,
      answers: Record<string, string>
    ):
      | {
          ok: true;
          score: number;
          total: number;
          percentage: number;
          results: Array<{
            questionId: string;
            prompt: string;
            userAnswer: string;
            correctAnswer: string;
            isCorrect: boolean;
            explanation: string;
          }>;
          submittedAt: string;
        }
      | { ok: false; status: number; error: string } {
      const session = cache.get(quizSessionId);
      if (!session) {
        return { ok: false, status: 404, error: 'Quiz session expired or not found. Generate a new quiz to submit.' };
      }
      if (session.uid !== uid) {
        return { ok: false, status: 403, error: 'You cannot submit another learner’s quiz session.' };
      }

      let score = 0;
      const results = session.questions.map((q, idx) => {
        const qid = String(q.id || idx);
        const userAns = typeof answers?.[qid] === 'string' ? answers[qid] : '';
        const isCorrect =
          userAns.trim().length > 0 &&
          userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
        if (isCorrect) score += 1;
        return {
          questionId: qid,
          prompt: q.prompt,
          userAnswer: userAns,
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation,
        };
      });

      const total = session.questions.length;
      return {
        ok: true,
        score,
        total,
        percentage: total > 0 ? Math.round((score / total) * 100) : 0,
        results,
        submittedAt: new Date().toISOString(),
      };
    },
  };
}

export function gradeServerAuthoritativeAssessment(
  questionIds: unknown,
  answers: unknown,
  authoritativeBank: QuestionItem[] = SAMPLE_QUESTIONS
):
  | { ok: true; graded: GradeAssessmentResponse }
  | { ok: false; status: number; error: string } {
  if (!Array.isArray(questionIds) || questionIds.length === 0 || typeof answers !== 'object' || answers === null) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid assessment payload: questionIds and answers are required.',
    };
  }

  const bankById = new Map<string, QuestionItem>();
  for (const q of authoritativeBank) {
    bankById.set(q.id, q);
  }

  const seen = new Set<string>();
  const targetQuestions: QuestionItem[] = [];
  for (const rawId of questionIds) {
    const qid = String(rawId || '').trim();
    if (!qid || seen.has(qid)) continue;
    const found = bankById.get(qid);
    if (found) {
      seen.add(qid);
      targetQuestions.push(found);
    }
  }

  if (targetQuestions.length === 0) {
    return {
      ok: false,
      status: 404,
      error: 'No verified curriculum questions matched the submitted questionIds.',
    };
  }

  const graded = gradeAssessment(targetQuestions, answers as Record<string, string | string[]>);
  return { ok: true, graded };
}
