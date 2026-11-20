import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import {
  createAdminAuthMiddleware,
  createEducationQuizSessionStore,
  createFirebaseAuthMiddleware,
  extractBearerToken,
  extractWebSocketToken,
  getSafeRateLimitKey,
  gradeServerAuthoritativeAssessment,
  isValidWebSocketOrigin,
  type AuthenticatedFirebaseUser,
  type AuthedRequest,
} from './security';

function makeMockRes() {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

test('extractBearerToken parses valid bearer JWT strings and rejects malformed headers', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken('Basic abc123'), null);
  assert.equal(extractBearerToken('Bearer short'), null);
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.sig1234567890';
  assert.equal(extractBearerToken(`Bearer ${jwt}`), jwt);
});

test('extractWebSocketToken supports bearer subprotocol and query token', () => {
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.sig1234567890';
  const reqProto = {
    url: '/api/live-voice',
    headers: { 'sec-websocket-protocol': `bearer.${jwt}` },
  } as unknown as IncomingMessage;
  assert.equal(extractWebSocketToken(reqProto), jwt);

  const reqQuery = {
    url: `/api/live-voice?token=${encodeURIComponent(jwt)}`,
    headers: {},
  } as unknown as IncomingMessage;
  assert.equal(extractWebSocketToken(reqQuery), jwt);
});

test('isValidWebSocketOrigin rejects missing or untrusted origins and allows matching host', () => {
  assert.equal(isValidWebSocketOrigin({ headers: {} } as unknown as IncomingMessage), false);
  assert.equal(
    isValidWebSocketOrigin({ headers: { origin: 'https://evil.example', host: 'localhost:3000' } } as unknown as IncomingMessage),
    false
  );
  assert.equal(
    isValidWebSocketOrigin({ headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } } as unknown as IncomingMessage),
    true
  );
});

test('getSafeRateLimitKey ignores spoofable x-forwarded-for headers and keys by auth uid or socket address', () => {
  const req = {
    headers: { 'x-forwarded-for': '1.2.3.4' },
    socket: { remoteAddress: '10.0.0.5' },
    ip: '10.0.0.5',
  } as unknown as Pick<Request, 'ip' | 'socket'>;

  assert.equal(getSafeRateLimitKey(req, 'uid_student_1'), 'uid:uid_student_1');
  assert.equal(getSafeRateLimitKey(req), 'ip:10.0.0.5');
});

test('createFirebaseAuthMiddleware and createAdminAuthMiddleware enforce 401 and 403 boundaries', async () => {
  const studentUser: AuthenticatedFirebaseUser = {
    uid: 'stu_1',
    email: 'student@example.com',
    emailVerified: true,
    rawToken: 'header.payload.signature123456',
  };
  const adminUser: AuthenticatedFirebaseUser = {
    uid: 'adm_1',
    email: 'venkatramveni@gmail.com',
    emailVerified: true,
    rawToken: 'header.payload.signature123456',
  };

  const requireAuth = createFirebaseAuthMiddleware(async (t) =>
    t.includes('admin') ? adminUser : studentUser
  );
  const requireAdmin = createAdminAuthMiddleware(
    async (t) => (t.includes('admin') ? adminUser : studentUser),
    async (u) => u.email === 'venkatramveni@gmail.com' && u.emailVerified
  );

  // Unauthenticated request returns 401
  {
    const req = { headers: {} } as AuthedRequest;
    const { res, state } = makeMockRes();
    let nextCalled = false;
    await requireAuth(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 401);
  }

  // Non-admin verified user gets 403 on admin endpoint
  {
    const req = {
      headers: { authorization: 'Bearer header.student.token_1234567890' },
    } as AuthedRequest;
    const { res, state } = makeMockRes();
    let nextCalled = false;
    await requireAdmin(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 403);
  }

  // Admin user passes admin middleware
  {
    const req = {
      headers: { authorization: 'Bearer header.admin.token_1234567890' },
    } as AuthedRequest;
    const { res } = makeMockRes();
    let nextCalled = false;
    await requireAdmin(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    assert.equal(nextCalled, true);
  }
});

test('EducationQuizSessionStore prevents cross-user submission and grades only stored server answers', () => {
  const store = createEducationQuizSessionStore(60_000);
  const sessionId = store.createSession('stu_owner', [
    {
      id: 'q0',
      prompt: 'What gas do plants release during photosynthesis?',
      options: ['Oxygen', 'Nitrogen', 'Carbon monoxide', 'Argon'],
      correctAnswer: 'Oxygen',
      explanation: 'Plants release oxygen as a byproduct.',
    },
  ]);

  const forbidden = store.gradeSubmission(sessionId, 'stu_attacker', { q0: 'Oxygen' });
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.status, 403);
  }

  const missing = store.gradeSubmission('nonexistent_id', 'stu_owner', { q0: 'Oxygen' });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.status, 404);
  }

  const graded = store.gradeSubmission(sessionId, 'stu_owner', { q0: 'Oxygen' });
  assert.equal(graded.ok, true);
  if (graded.ok) {
    assert.equal(graded.score, 1);
    assert.equal(graded.percentage, 100);
  }
});

test('gradeServerAuthoritativeAssessment ignores client question objects and grades strictly against SAMPLE_QUESTIONS', () => {
  const wrongResult = gradeServerAuthoritativeAssessment(['q_photo_1'], { q_photo_1: 'Haemoglobin' });
  assert.equal(wrongResult.ok, true);
  if (wrongResult.ok) {
    assert.equal(wrongResult.graded.score, 0);
    assert.equal(wrongResult.graded.percentage, 0);
  }

  const rightResult = gradeServerAuthoritativeAssessment(['q_photo_1'], { q_photo_1: 'Chlorophyll' });
  assert.equal(rightResult.ok, true);
  if (rightResult.ok) {
    assert.equal(rightResult.graded.score, 1);
    assert.equal(rightResult.graded.percentage, 100);
  }
});
