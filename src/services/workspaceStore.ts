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
  SavedGuideLink,
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
import { getClassSpecificStudyPlanSeeds } from '../utils/curriculumFilter';

export interface MuseWorkspaceState {
  authMode: 'unauthenticated' | 'demo' | 'firebase';
  profile: UserProfile | null;
  lessons: LessonItem[];
  questions: QuestionItem[];
  assessments: AssessmentConfig[];
  videos: VideoLesson[];
  images: ImageLessonItem[];
  savedGuideLinks: SavedGuideLink[];
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

const DEFAULT_GUIDE_LINKS: SavedGuideLink[] = [
  {
    id: 'guide_workbookguruji_main',
    title: 'WORKBOOKGURUJI Full Channel Guides & Chapter Solutions',
    url: 'http://www.youtube.com/@WORKBOOKGURUJI',
    classLevel: 9,
    subject: 'Science',
    channelName: '@WORKBOOKGURUJI',
    createdAt: '2026-11-12T08:00:00Z',
  },
];

function mergeSeedById<T extends { id: string }>(seed: readonly T[], existing?: T[]): T[] {
  if (!Array.isArray(existing) || existing.length === 0) return [...seed];
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && typeof item.id === 'string') {
      map.set(item.id, item);
    }
  }
  for (const item of seed) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function createDefaultProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: overrides.uid || 'demo_student_1',
    displayName: overrides.displayName || 'Aarav Sharma',
    email: overrides.email || 'aarav.demo@nanoai.local',
    emailVerified: overrides.emailVerified ?? true,
    role: overrides.role || 'student',
    board: overrides.board || 'CBSE',
    classLevel: overrides.classLevel || 7,
    preferredLanguage: overrides.preferredLanguage || 'English',
    learningPreference: overrides.learningPreference || 'Visual & Step-by-step',
    academicGoal: overrides.academicGoal || 'Master core concepts and score higher in term exams',
    subjects: overrides.subjects || ['Mathematics', 'Science', 'English', 'Social Studies'],
    guardianConsentApproved: overrides.guardianConsentApproved ?? true,
    guardianEmail: overrides.guardianEmail || 'parent.demo@nanoai.local',
    onboardingComplete: overrides.onboardingComplete ?? false,
    theme: overrides.theme || 'dark',
    studyStreak: overrides.studyStreak ?? 1,
    notificationsEnabled: overrides.notificationsEnabled ?? true,
    nonEssentialNotifications: overrides.nonEssentialNotifications ?? true,
    voiceAutoSpeak: overrides.voiceAutoSpeak ?? true,
    speechRate: overrides.speechRate ?? 1.0,
    speechPitch: overrides.speechPitch ?? 1.0,
    voicePreset: overrides.voicePreset || 'Sulafat',
    createdAt: overrides.createdAt || now,
    updatedAt: now,
  };
}

export function createInitialWorkspaceState(authMode: 'unauthenticated' | 'demo' | 'firebase' = 'unauthenticated'): MuseWorkspaceState {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const profile = authMode === 'demo' ? createDefaultProfile({ onboardingComplete: false }) : null;
  const classLevel = profile?.classLevel || 7;
  return {
    authMode,
    profile,
    lessons: [...SAMPLE_LESSONS],
    questions: [...SAMPLE_QUESTIONS],
    assessments: [...SAMPLE_ASSESSMENTS],
    videos: [...SAMPLE_VIDEOS],
    images: [...SAMPLE_IMAGES],
    savedGuideLinks: [...DEFAULT_GUIDE_LINKS],
    progress: [],
    attempts: [],
    studyPlans: getClassSpecificStudyPlanSeeds(profile?.uid || 'demo_student_1', classLevel, today, now),
    assignments: [...INITIAL_ASSIGNMENTS],
    submissions: [],
    conversations: [],
    notifications: [
      {
        id: 'notif_welcome',
        uid: 'demo_student_1',
        title: 'Weekly Exam Scheduled',
        message: 'Class-aligned Weekly Examination & Daily Quiz are ready in Assessments.',
        category: 'test',
        read: false,
        createdAt: now,
      },
      {
        id: 'notif_asgn',
        uid: 'demo_student_1',
        title: 'Class Assignments Ready',
        message: 'Check your class assignments and workbook guides in Assignment Centre.',
        category: 'assignment',
        read: false,
        createdAt: now,
      },
    ],
    savedNotes: [
      {
        id: 'note_seed_1',
        subject: 'Physics',
        title: 'Newton’s Laws & Equations of Motion',
        content: 'v = u + at | s = ut + 1/2 a t^2 | v^2 - u^2 = 2as | Force F = ma (Newton).',
        updatedAt: now,
      },
      {
        id: 'note_seed_2',
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
    offlineLessonIds: SAMPLE_LESSONS.slice(0, 4).map((l) => l.id),
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
        actorName: 'Nano AI Platform',
        action: 'Workspace initialized with class-adaptive curriculum',
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

    parsed.lessons = mergeSeedById(SAMPLE_LESSONS, parsed.lessons);
    parsed.questions = mergeSeedById(SAMPLE_QUESTIONS, parsed.questions);
    parsed.assessments = mergeSeedById(SAMPLE_ASSESSMENTS, parsed.assessments);
    parsed.videos = mergeSeedById(SAMPLE_VIDEOS, parsed.videos);
    parsed.images = mergeSeedById(SAMPLE_IMAGES, parsed.images);
    parsed.assignments = mergeSeedById(INITIAL_ASSIGNMENTS, parsed.assignments);
    parsed.savedGuideLinks = mergeSeedById(DEFAULT_GUIDE_LINKS, parsed.savedGuideLinks);

    if (!Array.isArray(parsed.offlineLessonIds)) {
      parsed.offlineLessonIds = SAMPLE_LESSONS.slice(0, 4).map((l) => l.id);
    }
    if (!Array.isArray(parsed.uploadedDocs)) {
      parsed.uploadedDocs = [];
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
