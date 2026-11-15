# Muse AI — Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths in Firestore are explicitly denied (`allow read, write: if false`).
2. **Role Escalation Prevention**: A newly registering user can only create `/users/{userId}` with `role == 'student'` or `'parent'` (never `'teacher'` or `'admin'`). Only verified Admins can promote roles or manage `/admins/{adminId}`.
3. **Bootstrapped Admin Verification**: Admin privilege via email (`venkatramveni@gmail.com`) requires BOTH `request.auth.token.email == 'venkatramveni@gmail.com'` AND `request.auth.token.email_verified == true`.
4. **PII Isolation (Split Collection)**: Sensitive fields (`email`, `guardianEmail`) are stored exclusively in `/users/{userId}/private/info` and are readable/writable only by the owner (`request.auth.uid == userId`) or a verified Admin.
5. **Immutable Official Scores**: Documents in `/quizAttempts/{attemptId}` are immutable once created (`allow update, delete: if false` for students; only Admin may correct/delete). Students can only create attempts for their own `uid` with `status == 'submitted'` and bounded `score <= total`.
6. **Parent Authorization**: Parents can only read student progress or attempts if an active, consented `/parentLinks/{parentUid}_{studentUid}` document exists (`consentGranted == true && status == 'active'`), or via owner/admin.
7. **Master Gate on Subcollections**: `/conversations/{conversationId}/messages/{messageId}` verifies ownership via `get(/databases/$(database)/documents/conversations/$(conversationId)).data.uid == request.auth.uid`.
8. **Assignment Submission Terminal Locking**: Once a submission reaches `status == 'reviewed'`, students cannot overwrite it (`existing().status != 'reviewed'`), and only the assignment's teacher (or Admin) can transition a submission to `'reviewed'` with feedback/grade.
9. **Temporal Integrity & Path ID Guarding**: All IDs match `^[a-zA-Z0-9_\\-]+$` (max 128 chars), all strings enforce explicit `.size()` bounds, and `createdAt` / `updatedAt` / `submittedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Role Self-Escalation**: Student creates `/users/stu1` with `{ ..., role: "admin" }` -> `PERMISSION_DENIED`.
2. **Role Mutation Attack**: Student updates `/users/stu1` changing `role` from `"student"` to `"teacher"` -> `PERMISSION_DENIED`.
3. **Ghost Field Injection (Shadow Update)**: Student updates `/users/stu1` with `{ displayName: "Aarav", isVerifiedAdmin: true }` -> `PERMISSION_DENIED`.
4. **Email Spoofing Without Verification**: Unverified auth token (`email_verified: false`, `email: "venkatramveni@gmail.com"`) attempts admin write -> `PERMISSION_DENIED`.
5. **Cross-User PII Read**: Student B attempts `get` on `/users/stuA/private/info` -> `PERMISSION_DENIED`.
6. **Score Tampering (Post-Submit Update)**: Student updates `/quizAttempts/att1` changing `score` from `4` to `10` -> `PERMISSION_DENIED`.
7. **Forged Attempt Identity**: Student A creates `/quizAttempts/att2` with `uid: "stuB"` -> `PERMISSION_DENIED`.
8. **Client-Side Timestamp Backdating**: User creates `/studyPlans/p1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized ID / String)**: User writes `/studyPlans/${"a".repeat(200)}` or injects 50KB `title` -> `PERMISSION_DENIED`.
10. **Blanket Query Scraping**: Student attempts `list` on `/studyPlans` without filtering `where('uid', '==', auth.uid)` -> `PERMISSION_DENIED`.
11. **Orphaned Message Injection**: User B creates `/conversations/convA/messages/m1` under User A's conversation -> `PERMISSION_DENIED`.
12. **Reviewed Submission Tampering**: Student updates `/submissions/sub1` after `status == 'reviewed'` -> `PERMISSION_DENIED`.
