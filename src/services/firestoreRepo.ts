import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebaseClient';
import {
  AssignmentItem,
  AssignmentSubmission,
  ConversationThread,
  LearningProgress,
  NotificationItem,
  QuizAttempt,
  StudyPlanTask,
  UserProfile,
} from '../types/muse';
import { sanitizeId, truncateForBlueprint } from '../utils/academicEngine';

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const safeUid = sanitizeId(uid);
  const userPath = `users/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'users', safeUid));
    if (!snap.exists()) return null;
    const data = snap.data();

    let privateData: Record<string, unknown> = {};
    try {
      const privSnap = await getDoc(doc(db, 'users', safeUid, 'private', 'info'));
      if (privSnap.exists()) privateData = privSnap.data();
    } catch {
      // Authorized parent or non-owner will not read private PII
    }

    return {
      uid: safeUid,
      displayName: String(data.displayName || 'Student'),
      email: typeof privateData.email === 'string' ? privateData.email : undefined,
      role: data.role || 'student',
      board: data.board || 'CBSE',
      classLevel: Number(data.classLevel || 7),
      preferredLanguage: String(data.preferredLanguage || 'English'),
      learningPreference: String(data.learningPreference || 'Visual & Step-by-step'),
      academicGoal: String(data.academicGoal || 'Build strong concept clarity'),
      subjects: Array.isArray(data.subjects) ? data.subjects : ['Mathematics', 'Science', 'English'],
      guardianConsentApproved: Boolean(data.guardianConsentApproved),
      guardianEmail: typeof privateData.guardianEmail === 'string' ? privateData.guardianEmail : undefined,
      onboardingComplete: Boolean(data.onboardingComplete),
      theme: data.theme === 'light' ? 'light' : 'dark',
      studyStreak: Number(data.studyStreak || 1),
      notificationsEnabled: privateData.notificationsEnabled !== false,
      nonEssentialNotifications: privateData.nonEssentialNotifications !== false,
      voiceAutoSpeak: Boolean(data.voiceAutoSpeak),
      speechRate: typeof data.speechRate === 'number' ? data.speechRate : 1.0,
      speechPitch: typeof data.speechPitch === 'number' ? data.speechPitch : 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function saveUserProfileToFirestore(profile: UserProfile, isCreate: boolean): Promise<void> {
  const safeUid = sanitizeId(profile.uid);
  const userPath = `users/${safeUid}`;
  const privPath = `users/${safeUid}/private/info`;

  const userPayload = {
    uid: safeUid,
    displayName: truncateForBlueprint(profile.displayName, 80) || 'Student',
    role: profile.role === 'admin' || profile.role === 'teacher' ? profile.role : profile.role === 'parent' ? 'parent' : 'student',
    board: truncateForBlueprint(profile.board, 80) || 'CBSE',
    classLevel: Math.min(12, Math.max(1, Math.round(profile.classLevel))),
    preferredLanguage: truncateForBlueprint(profile.preferredLanguage, 40) || 'English',
    learningPreference: truncateForBlueprint(profile.learningPreference, 60) || 'Visual & Step-by-step',
    academicGoal: truncateForBlueprint(profile.academicGoal, 240) || 'Build strong concept clarity',
    subjects: profile.subjects.slice(0, 12),
    guardianConsentApproved: Boolean(profile.guardianConsentApproved),
    onboardingComplete: Boolean(profile.onboardingComplete),
    theme: profile.theme,
    studyStreak: Math.max(0, Math.round(profile.studyStreak)),
    voiceAutoSpeak: Boolean(profile.voiceAutoSpeak),
    speechRate: Math.min(2, Math.max(0.5, Number(profile.speechRate ?? 1.0))),
    speechPitch: Math.min(2, Math.max(0.5, Number(profile.speechPitch ?? 1.0))),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isCreate) {
      await setDoc(doc(db, 'users', safeUid), userPayload);
    } else {
      const { uid: _u, role: _r, ...updateFields } = userPayload;
      await updateDoc(doc(db, 'users', safeUid), updateFields);
    }
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, userPath);
  }

  const privPayload = {
    uid: safeUid,
    email: truncateForBlueprint(profile.email || 'student@muse.local', 160),
    ...(profile.guardianEmail ? { guardianEmail: truncateForBlueprint(profile.guardianEmail, 160) } : {}),
    notificationsEnabled: Boolean(profile.notificationsEnabled),
    nonEssentialNotifications: Boolean(profile.nonEssentialNotifications),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', safeUid, 'private', 'info'), privPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privPath);
  }
}

export async function deleteUserAccountFromFirestore(uid: string): Promise<void> {
  const safeUid = sanitizeId(uid);
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'private', 'info'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${safeUid}/private/info`);
  }
  try {
    await deleteDoc(doc(db, 'users', safeUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${safeUid}`);
  }
}

export async function upsertLearningProgress(uid: string, item: LearningProgress): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeLesson = sanitizeId(item.lessonId);
  const docId = `${safeUid}_${safeLesson}`;
  const path = `learningProgress/${docId}`;
  try {
    const existing = await getDoc(doc(db, 'learningProgress', docId));
    if (existing.exists()) {
      await updateDoc(doc(db, 'learningProgress', docId), {
        completed: item.completed,
        bookmarked: item.bookmarked,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'learningProgress', docId), {
        uid: safeUid,
        lessonId: safeLesson,
        subject: truncateForBlueprint(item.subject, 60),
        completed: item.completed,
        bookmarked: item.bookmarked,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserProgress(uid: string): Promise<LearningProgress[]> {
  const safeUid = sanitizeId(uid);
  const path = 'learningProgress';
  try {
    const q = query(collection(db, path), where('uid', '==', safeUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        lessonId: String(data.lessonId),
        subject: String(data.subject),
        completed: Boolean(data.completed),
        bookmarked: Boolean(data.bookmarked),
        lastStudiedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveQuizAttemptToFirestore(attempt: QuizAttempt): Promise<void> {
  const safeId = sanitizeId(attempt.id);
  const path = `quizAttempts/${safeId}`;
  try {
    await setDoc(doc(db, 'quizAttempts', safeId), {
      uid: sanitizeId(attempt.uid),
      assessmentId: sanitizeId(attempt.assessmentId),
      mode: attempt.mode,
      subject: truncateForBlueprint(attempt.subject, 60),
      score: Math.round(attempt.score),
      total: Math.max(1, Math.round(attempt.total)),
      percentage: attempt.percentage,
      status: 'submitted',
      submittedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveStudyPlanToFirestore(task: StudyPlanTask, isCreate: boolean): Promise<void> {
  const safeId = sanitizeId(task.id);
  const path = `studyPlans/${safeId}`;
  try {
    if (isCreate) {
      await setDoc(doc(db, 'studyPlans', safeId), {
        uid: sanitizeId(task.uid),
        title: truncateForBlueprint(task.title, 140),
        subject: truncateForBlueprint(task.subject, 60),
        scheduledDate: truncateForBlueprint(task.scheduledDate, 30),
        scheduledTime: truncateForBlueprint(task.scheduledTime, 20),
        taskType: task.taskType,
        priority: task.priority || 'medium',
        recurrence: task.recurrence || 'none',
        completed: task.completed,
        reminderEnabled: task.reminderEnabled,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'studyPlans', safeId), {
        title: truncateForBlueprint(task.title, 140),
        subject: truncateForBlueprint(task.subject, 60),
        scheduledDate: truncateForBlueprint(task.scheduledDate, 30),
        scheduledTime: truncateForBlueprint(task.scheduledTime, 20),
        taskType: task.taskType,
        priority: task.priority || 'medium',
        recurrence: task.recurrence || 'none',
        completed: task.completed,
        reminderEnabled: task.reminderEnabled,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveConversationMessageToFirestore(
  thread: ConversationThread,
  messageId: string,
  sender: 'student' | 'ai',
  text: string
): Promise<void> {
  const safeThreadId = sanitizeId(thread.id);
  const safeMsgId = sanitizeId(messageId);
  const convPath = `conversations/${safeThreadId}`;
  try {
    const convSnap = await getDoc(doc(db, 'conversations', safeThreadId));
    if (!convSnap.exists()) {
      await setDoc(doc(db, 'conversations', safeThreadId), {
        uid: sanitizeId(thread.uid),
        title: truncateForBlueprint(thread.title, 140),
        mode: truncateForBlueprint(thread.mode, 40),
        subject: truncateForBlueprint(thread.subject, 60),
        messageCount: thread.messages.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'conversations', safeThreadId), {
        title: truncateForBlueprint(thread.title, 140),
        mode: truncateForBlueprint(thread.mode, 40),
        messageCount: thread.messages.length,
        updatedAt: serverTimestamp(),
      });
    }
    await setDoc(doc(db, 'conversations', safeThreadId, 'messages', safeMsgId), {
      uid: sanitizeId(thread.uid),
      sender,
      text: truncateForBlueprint(text, 6000),
      feedback: 'none',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, convPath);
  }
}

export async function writeAuditLogToFirestore(actorUid: string, action: string, targetPath: string): Promise<void> {
  const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      actorUid: sanitizeId(actorUid),
      action: truncateForBlueprint(action, 80),
      targetPath: truncateForBlueprint(targetPath, 200),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export type { AssignmentItem, AssignmentSubmission, NotificationItem };
