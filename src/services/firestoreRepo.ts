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
      voicePreset: typeof data.voicePreset === 'string' && data.voicePreset ? data.voicePreset : 'Sulafat',
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
    role: profile.role === 'admin' ? 'admin' : profile.role === 'parent' ? 'parent' : 'student',
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
    voicePreset: profile.voicePreset || 'Sulafat',
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

  // 1. Delete AI conversations + nested messages subcollection owned by the user
  try {
    const convSnap = await getDocs(query(collection(db, 'conversations'), where('uid', '==', safeUid)));
    for (const convDoc of convSnap.docs) {
      const msgSnap = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
      for (const msgDoc of msgSnap.docs) {
        await deleteDoc(doc(db, 'conversations', convDoc.id, 'messages', msgDoc.id));
      }
      await deleteDoc(doc(db, 'conversations', convDoc.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'conversations');
  }

  // 2. Delete user-owned collections (studyPlans, learningProgress, savedNotes, notifications)
  const ownedCollections = ['studyPlans', 'learningProgress', 'savedNotes', 'notifications'] as const;
  for (const colName of ownedCollections) {
    try {
      const snap = await getDocs(query(collection(db, colName), where('uid', '==', safeUid)));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }

  // 3. Delete private PII subcollection doc & public user doc
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

function toIsoString(val: unknown): string {
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) return val;
  return new Date().toISOString();
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
        lastStudiedAt: toIsoString(data.updatedAt),
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
      subject: truncateForBlueprint(attempt.subject, 60) || 'Science',
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

export async function fetchQuizAttemptsFromFirestore(uid: string): Promise<QuizAttempt[]> {
  const safeUid = sanitizeId(uid);
  const path = 'quizAttempts';
  try {
    const q = query(collection(db, path), where('uid', '==', safeUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        const mode = (data.mode === 'weekly_test' || data.mode === 'practice' ? data.mode : 'daily_quiz') as QuizAttempt['mode'];
        const subject = String(data.subject || 'Science');
        return {
          id: d.id,
          uid: String(data.uid || safeUid),
          assessmentId: String(data.assessmentId || d.id),
          assessmentTitle: `${subject} ${mode === 'weekly_test' ? 'Weekly Test' : mode === 'practice' ? 'Practice' : 'Daily Quiz'}`,
          mode,
          subject,
          score: Number(data.score || 0),
          total: Math.max(1, Number(data.total || 1)),
          percentage: Number(data.percentage || 0),
          results: [],
          status: 'submitted' as const,
          submittedAt: toIsoString(data.submittedAt),
        };
      })
      .sort((a, b) => (Date.parse(a.submittedAt) || 0) - (Date.parse(b.submittedAt) || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
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
        subject: truncateForBlueprint(task.subject, 60) || 'Science',
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
        subject: truncateForBlueprint(task.subject, 60) || 'Science',
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

export async function fetchStudyPlansFromFirestore(uid: string): Promise<StudyPlanTask[]> {
  const safeUid = sanitizeId(uid);
  const path = 'studyPlans';
  try {
    const q = query(collection(db, path), where('uid', '==', safeUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: String(data.uid || safeUid),
        title: String(data.title || 'Study Task'),
        subject: String(data.subject || 'Science'),
        scheduledDate: String(data.scheduledDate || new Date().toISOString().slice(0, 10)),
        scheduledTime: String(data.scheduledTime || '17:00'),
        taskType: (data.taskType || 'lesson') as StudyPlanTask['taskType'],
        priority: (data.priority || 'medium') as StudyPlanTask['priority'],
        recurrence: (data.recurrence || 'none') as StudyPlanTask['recurrence'],
        completed: Boolean(data.completed),
        reminderEnabled: Boolean(data.reminderEnabled),
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteStudyPlanFromFirestore(planId: string): Promise<void> {
  const safeId = sanitizeId(planId);
  const path = `studyPlans/${safeId}`;
  try {
    await deleteDoc(doc(db, 'studyPlans', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
        title: truncateForBlueprint(thread.title, 140) || 'Conversation',
        mode: truncateForBlueprint(thread.mode, 40) || 'general_qa',
        subject: truncateForBlueprint(thread.subject, 60) || 'General',
        messageCount: Math.min(500, thread.messages.length),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'conversations', safeThreadId), {
        title: truncateForBlueprint(thread.title, 140) || 'Conversation',
        mode: truncateForBlueprint(thread.mode, 40) || 'general_qa',
        messageCount: Math.min(500, thread.messages.length),
        updatedAt: serverTimestamp(),
      });
    }
    await setDoc(doc(db, 'conversations', safeThreadId, 'messages', safeMsgId), {
      uid: sanitizeId(thread.uid),
      sender,
      text: truncateForBlueprint(text, 6000) || '...',
      feedback: 'none',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, convPath);
  }
}

export async function fetchConversationsFromFirestore(uid: string): Promise<ConversationThread[]> {
  const safeUid = sanitizeId(uid);
  const path = 'conversations';
  try {
    const convSnap = await getDocs(query(collection(db, path), where('uid', '==', safeUid)));
    const threads: ConversationThread[] = [];
    for (const convDoc of convSnap.docs) {
      const data = convDoc.data();
      const msgSnap = await getDocs(
        query(collection(db, 'conversations', convDoc.id, 'messages'), where('uid', '==', safeUid))
      );
      const messages = msgSnap.docs
        .map((m) => {
          const md = m.data();
          return {
            id: m.id,
            sender: (md.sender === 'student' ? 'student' : 'ai') as 'student' | 'ai',
            text: String(md.text || ''),
            feedback: (md.feedback === 'helpful' || md.feedback === 'needs_clarity' ? md.feedback : 'none') as
              | 'none'
              | 'helpful'
              | 'needs_clarity',
            createdAt: toIsoString(md.createdAt),
          };
        })
        .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));

      threads.push({
        id: convDoc.id,
        uid: String(data.uid || safeUid),
        title: String(data.title || 'Conversation'),
        mode: (data.mode || 'general_qa') as ConversationThread['mode'],
        subject: String(data.subject || 'Any Topic / General'),
        messages,
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      });
    }
    return threads.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteConversationFromFirestore(threadId: string): Promise<void> {
  const safeId = sanitizeId(threadId);
  const path = `conversations/${safeId}`;
  try {
    const msgSnap = await getDocs(collection(db, 'conversations', safeId, 'messages'));
    for (const m of msgSnap.docs) {
      await deleteDoc(doc(db, 'conversations', safeId, 'messages', m.id));
    }
    await deleteDoc(doc(db, 'conversations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSavedNoteToFirestore(uid: string, note: {
  id: string;
  subject: string;
  title: string;
  content: string;
}): Promise<void> {
  const safeId = sanitizeId(note.id);
  const path = `savedNotes/${safeId}`;
  try {
    const existing = await getDoc(doc(db, 'savedNotes', safeId));
    if (existing.exists()) {
      await updateDoc(doc(db, 'savedNotes', safeId), {
        subject: truncateForBlueprint(note.subject, 60) || 'General',
        title: truncateForBlueprint(note.title, 140) || 'Study Note',
        content: truncateForBlueprint(note.content, 6000) || 'Note content',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'savedNotes', safeId), {
        uid: sanitizeId(uid),
        subject: truncateForBlueprint(note.subject, 60) || 'General',
        title: truncateForBlueprint(note.title, 140) || 'Study Note',
        content: truncateForBlueprint(note.content, 6000) || 'Note content',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchSavedNotesFromFirestore(uid: string) {
  const safeUid = sanitizeId(uid);
  const path = 'savedNotes';
  try {
    const snap = await getDocs(query(collection(db, path), where('uid', '==', safeUid)));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          subject: String(data.subject || 'General'),
          title: String(data.title || 'Saved Note'),
          content: String(data.content || ''),
          updatedAt: toIsoString(data.updatedAt),
        };
      })
      .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteSavedNoteFromFirestore(noteId: string): Promise<void> {
  const safeId = sanitizeId(noteId);
  const path = `savedNotes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'savedNotes', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNotificationToFirestore(item: NotificationItem): Promise<void> {
  const safeId = sanitizeId(item.id);
  const path = `notifications/${safeId}`;
  try {
    await setDoc(doc(db, 'notifications', safeId), {
      uid: sanitizeId(item.uid),
      title: truncateForBlueprint(item.title, 120) || 'Update',
      message: truncateForBlueprint(item.message, 400) || 'Notification',
      category: item.category,
      read: Boolean(item.read),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchNotificationsFromFirestore(uid: string): Promise<NotificationItem[]> {
  const safeUid = sanitizeId(uid);
  const path = 'notifications';
  try {
    const snap = await getDocs(query(collection(db, path), where('uid', '==', safeUid)));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid || safeUid),
          title: String(data.title || 'Update'),
          message: String(data.message || ''),
          category: (data.category || 'study') as NotificationItem['category'],
          read: Boolean(data.read),
          createdAt: toIsoString(data.createdAt),
        };
      })
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function markNotificationsReadInFirestore(ids: string[]): Promise<void> {
  for (const id of ids) {
    const safeId = sanitizeId(id);
    try {
      await updateDoc(doc(db, 'notifications', safeId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${safeId}`);
    }
  }
}

export async function fetchSubmissionsFromFirestore(uid: string, role: string): Promise<AssignmentSubmission[]> {
  const safeUid = sanitizeId(uid);
  const path = 'submissions';
  try {
    const q =
      role === 'admin'
        ? collection(db, path)
        : query(collection(db, path), where('studentUid', '==', safeUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        assignmentId: String(data.assignmentId || ''),
        studentUid: String(data.studentUid || safeUid),
        studentName: 'Student',
        content: String(data.content || ''),
        status: (data.status === 'reviewed' ? 'reviewed' : 'submitted') as 'submitted' | 'reviewed',
        teacherFeedback: typeof data.teacherFeedback === 'string' ? data.teacherFeedback : undefined,
        grade: typeof data.grade === 'string' ? data.grade : undefined,
        submittedAt: toIsoString(data.submittedAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveSubmissionToFirestore(sub: AssignmentSubmission): Promise<void> {
  const safeId = sanitizeId(sub.id);
  const path = `submissions/${safeId}`;
  try {
    await setDoc(doc(db, 'submissions', safeId), {
      assignmentId: sanitizeId(sub.assignmentId),
      studentUid: sanitizeId(sub.studentUid),
      content: truncateForBlueprint(sub.content, 4000) || 'Submission',
      status: 'submitted',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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

