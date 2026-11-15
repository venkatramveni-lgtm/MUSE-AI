import {
  AssessmentConfig,
  AssignmentItem,
  AssignmentSubmission,
  AuditLogEntry,
  ConversationThread,
  GeneratedVisualDiagram,
  ImageLessonItem,
  LearningProgress,
  LessonItem,
  NotificationItem,
  ParentLink,
  QuestionItem,
  QuizAttempt,
  SavedNote,
  StudyPlanTask,
  UploadedDocItem,
  UserProfile,
  VideoLesson,
} from '../types/muse';
import {
  INITIAL_ASSIGNMENTS,
  SAMPLE_ASSESSMENTS,
  SAMPLE_IMAGES,
  SAMPLE_LESSONS,
  SAMPLE_QUESTIONS,
  SAMPLE_VIDEOS,
} from '../data/curriculumSeed';

export interface MuseWorkspaceState {
  authMode: 'unauthenticated' | 'demo' | 'firebase';
  profile: UserProfile | null;
  lessons: LessonItem[];
  questions: QuestionItem[];
  assessments: AssessmentConfig[];
  videos: VideoLesson[];
  images: ImageLessonItem[];
  progress: LearningProgress[];
  attempts: QuizAttempt[];
  studyPlans: StudyPlanTask[];
  assignments: AssignmentItem[];
  submissions: AssignmentSubmission[];
  conversations: ConversationThread[];
  notifications: NotificationItem[];
  savedNotes: SavedNote[];
  watchedVideoIds: string[];
  bookmarkedVideoIds: string[];
  studiedImageIds: string[];
  bookmarkedImageIds: string[];
  generatedVisuals: GeneratedVisualDiagram[];
  offlineLessonIds: string[];
  uploadedDocs: UploadedDocItem[];
  parentLinks: ParentLink[];
  auditLogs: AuditLogEntry[];
}

const STORAGE_KEY = 'muse_ai_workspace_v1';

export function createDefaultProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: overrides.uid || 'demo_student_1',
    displayName: overrides.displayName || 'Aarav Sharma',
    email: overrides.email || 'aarav.demo@muse.local',
    emailVerified: overrides.emailVerified ?? true,
    role: overrides.role || 'student',
    board: overrides.board || 'CBSE',
    classLevel: overrides.classLevel || 7,
    preferredLanguage: overrides.preferredLanguage || 'English',
    learningPreference: overrides.learningPreference || 'Visual & Step-by-step',
    academicGoal: overrides.academicGoal || 'Master Science & Mathematics concepts for term exams',
    subjects: overrides.subjects || ['Mathematics', 'Science', 'English', 'Social Studies'],
    guardianConsentApproved: overrides.guardianConsentApproved ?? true,
    guardianEmail: overrides.guardianEmail || 'parent.demo@muse.local',
    onboardingComplete: overrides.onboardingComplete ?? false,
    theme: overrides.theme || 'dark',
    studyStreak: overrides.studyStreak ?? 1,
    notificationsEnabled: overrides.notificationsEnabled ?? true,
    nonEssentialNotifications: overrides.nonEssentialNotifications ?? true,
    voiceAutoSpeak: overrides.voiceAutoSpeak ?? false,
    speechRate: overrides.speechRate ?? 1.0,
    speechPitch: overrides.speechPitch ?? 1.0,
    createdAt: overrides.createdAt || now,
    updatedAt: now,
  };
}

export function createInitialWorkspaceState(authMode: 'unauthenticated' | 'demo' | 'firebase' = 'unauthenticated'): MuseWorkspaceState {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    authMode,
    profile: authMode === 'demo' ? createDefaultProfile({ onboardingComplete: false }) : null,
    lessons: [...SAMPLE_LESSONS],
    questions: [...SAMPLE_QUESTIONS],
    assessments: [...SAMPLE_ASSESSMENTS],
    videos: [...SAMPLE_VIDEOS],
    images: [...SAMPLE_IMAGES],
    progress: [],
    attempts: [],
    studyPlans: [
      {
        id: 'plan_seed_1',
        uid: 'demo_student_1',
        title: 'Revise Photosynthesis & Chlorophyll diagram',
        subject: 'Science',
        scheduledDate: today,
        scheduledTime: '17:00',
        taskType: 'lesson',
        priority: 'high',
        recurrence: 'none',
        completed: false,
        reminderEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'plan_seed_2',
        uid: 'demo_student_1',
        title: 'Complete Daily STEM & Grammar Quiz',
        subject: 'Mathematics',
        scheduledDate: today,
        scheduledTime: '18:30',
        taskType: 'quiz',
        priority: 'medium',
        recurrence: 'daily',
        completed: false,
        reminderEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    assignments: [...INITIAL_ASSIGNMENTS],
    submissions: [],
    conversations: [],
    notifications: [
      {
        id: 'notif_welcome',
        uid: 'demo_student_1',
        title: 'Weekly Exam Scheduled',
        message: 'Foundation Science, Math & Civics Weekly Examination is ready in Weekly Tests.',
        category: 'test',
        read: false,
        createdAt: now,
      },
      {
        id: 'notif_asgn',
        uid: 'demo_student_1',
        title: 'New Science Assignment',
        message: 'Chlorophyll & Sunlight Observation Report due on 2026-11-20.',
        category: 'assignment',
        read: false,
        createdAt: now,
      },
    ],
    savedNotes: [
      {
        id: 'note_seed_1',
        subject: 'Science',
        title: 'Photosynthesis Equation Note',
        content: 'Remember: CO2 + H2O --(Sunlight + Chlorophyll)--> Glucose + O2. Guard cells control stomata opening.',
        updatedAt: now,
      },
    ],
    watchedVideoIds: [],
    bookmarkedVideoIds: [],
    studiedImageIds: [],
    bookmarkedImageIds: [],
    generatedVisuals: [],
    offlineLessonIds: SAMPLE_LESSONS.slice(0, 3).map((l) => l.id),
    uploadedDocs: [],
    parentLinks: [
      {
        id: 'parent_demo_demo_student_1',
        parentUid: 'parent_demo',
        studentUid: 'demo_student_1',
        studentDisplayName: 'Aarav Sharma',
        consentGranted: true,
        status: 'active',
        createdAt: now,
      },
    ],
    auditLogs: [
      {
        id: 'audit_init',
        actorUid: 'system',
        actorName: 'Muse Platform',
        action: 'Workspace initialized with verified sample curriculum',
        targetPath: '/curriculum/seed',
        createdAt: now,
      },
    ],
  };
}

export function loadWorkspaceFromStorage(): MuseWorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MuseWorkspaceState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.offlineLessonIds)) {
      parsed.offlineLessonIds = SAMPLE_LESSONS.slice(0, 3).map((l) => l.id);
    }
    if (!Array.isArray(parsed.uploadedDocs)) {
      parsed.uploadedDocs = [];
    }
    if (!Array.isArray(parsed.images) || parsed.images.length === 0) {
      parsed.images = [...SAMPLE_IMAGES];
    }
    if (!Array.isArray(parsed.videos) || parsed.videos.length < SAMPLE_VIDEOS.length) {
      parsed.videos = [...SAMPLE_VIDEOS];
    }
    if (!Array.isArray(parsed.studiedImageIds)) {
      parsed.studiedImageIds = [];
    }
    if (!Array.isArray(parsed.bookmarkedImageIds)) {
      parsed.bookmarkedImageIds = [];
    }
    if (!Array.isArray(parsed.generatedVisuals)) {
      parsed.generatedVisuals = [];
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspaceToStorage(state: MuseWorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearWorkspaceStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
