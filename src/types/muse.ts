export type UserRole = 'student' | 'parent' | 'admin';
export type EducationBoard = string;
export type ThemeMode = 'dark' | 'light';
export type TeachingMode =
  | 'general_qa'
  | 'explain_simply'
  | 'step_by_step'
  | 'give_examples'
  | 'test_knowledge'
  | 'summarize_topic'
  | 'help_revise';

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'match' | 'short_answer';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type AssessmentMode = 'daily_quiz' | 'weekly_test' | 'practice';
export type XRModelId =
  | 'solar_system'
  | 'plant_cell'
  | 'atomic_bohr'
  | 'pythagoras_3d'
  | 'water_cycle'
  | 'motion_physics';

export const BLUEPRINT_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 80,
  ACADEMIC_GOAL_MAX: 240,
  TITLE_MAX: 140,
  SUMMARY_MAX: 2000,
  MESSAGE_MAX: 6000,
  SUBMISSION_MAX: 4000,
  FEEDBACK_MAX: 1000,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  role: UserRole;
  board: EducationBoard;
  classLevel: number;
  preferredLanguage: string;
  learningPreference: string;
  academicGoal: string;
  subjects: string[];
  guardianConsentApproved: boolean;
  guardianEmail?: string;
  onboardingComplete: boolean;
  theme: ThemeMode;
  studyStreak: number;
  notificationsEnabled: boolean;
  nonEssentialNotifications: boolean;
  voiceAutoSpeak?: boolean;
  speechRate?: number;
  speechPitch?: number;
  voicePreset?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonDefinition {
  term: string;
  meaning: string;
}

export interface LessonItem {
  id: string;
  board: EducationBoard;
  classLevel: number;
  subject: string;
  chapter: string;
  topic: string;
  title: string;
  language: string;
  introduction: string;
  objectives: string[];
  explanation: string[];
  definitions: LessonDefinition[];
  examples: string[];
  diagramType: 'photosynthesis' | 'pythagoras' | 'solar' | 'atom' | 'water_cycle' | 'grammar' | 'motion';
  keyPoints: string[];
  summary: string;
  practiceExercises: string[];
  relatedTopics: string[];
  xrModelId?: XRModelId;
  isSampleContent: boolean;
  durationMinutes: number;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface QuestionItem {
  id: string;
  board: EducationBoard;
  classLevel: number;
  subject: string;
  chapter: string;
  topic: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  prompt: string;
  options?: string[];
  pairs?: MatchPair[];
  correctAnswer: string | string[];
  keywords?: string[];
  explanation: string;
  createdBy?: string;
}

export interface AssessmentConfig {
  id: string;
  title: string;
  mode: AssessmentMode;
  board: EducationBoard;
  classLevel: number;
  subject: string;
  chapter?: string;
  durationMinutes: number;
  questionIds: string[];
  createdBy?: string;
}

export interface GradedQuestionResult {
  questionId: string;
  prompt: string;
  topic: string;
  userAnswer: string;
  correctAnswerDisplay: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  uid: string;
  assessmentId: string;
  assessmentTitle: string;
  mode: AssessmentMode;
  subject: string;
  score: number;
  total: number;
  percentage: number;
  results: GradedQuestionResult[];
  status: 'submitted';
  submittedAt: string;
}

export interface LearningProgress {
  lessonId: string;
  subject: string;
  completed: boolean;
  bookmarked: boolean;
  lastStudiedAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRecurrence = 'none' | 'daily' | 'weekly';

export interface StudyPlanTask {
  id: string;
  uid: string;
  title: string;
  subject: string;
  scheduledDate: string;
  scheduledTime: string;
  taskType: 'lesson' | 'quiz' | 'revision' | 'assignment' | 'exam';
  priority?: TaskPriority;
  recurrence?: TaskRecurrence;
  notes?: string;
  completed: boolean;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentItem {
  id: string;
  teacherUid: string;
  teacherName: string;
  title: string;
  description: string;
  subject: string;
  board: EducationBoard;
  classLevel: number;
  dueDate: string;
  attachmentLabel?: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentUid: string;
  studentName: string;
  content: string;
  attachmentName?: string;
  status: 'submitted' | 'reviewed';
  teacherFeedback?: string;
  grade?: string;
  submittedAt: string;
  updatedAt: string;
}

export type VideoCategory =
  | 'Concept Explained'
  | 'Step-by-Step Tutorial'
  | 'Visual Lab & 3D'
  | 'Exam & Revision Guide';

export interface VideoLesson {
  id: string;
  board: EducationBoard;
  classLevel: number;
  subject: string;
  chapter: string;
  category?: VideoCategory;
  difficulty?: DifficultyLevel;
  title: string;
  description: string;
  durationLabel: string;
  sourceLabel: string;
  captionsAvailable: boolean;
  captions: string[];
  keyTakeaways: string[];
  xrModelId?: XRModelId;
  externalUrl?: string;
}

export interface FlashcardItem {
  id: string;
  classLevel?: number;
  subject: string;
  chapter: string;
  front: string;
  back: string;
}

export interface SavedGuideLink {
  id: string;
  title: string;
  url: string;
  classLevel: number;
  subject: string;
  channelName: string;
  createdAt: string;
}

export interface SavedNote {
  id: string;
  subject: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  uid: string;
  title: string;
  message: string;
  category: 'test' | 'assignment' | 'study' | 'milestone' | 'account';
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'student' | 'ai';
  text: string;
  mode?: TeachingMode;
  suggestedFollowUps?: string[];
  sources?: string[];
  attachmentName?: string;
  feedback: 'none' | 'helpful' | 'needs_clarity';
  createdAt: string;
}

export interface UploadedDocItem {
  id: string;
  name: string;
  mimeType: string;
  summary: string;
  keyPoints: string[];
  createdAt: string;
}

export interface ConversationThread {
  id: string;
  uid: string;
  title: string;
  mode: TeachingMode;
  subject: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ParentLink {
  id: string;
  parentUid: string;
  studentUid: string;
  studentDisplayName: string;
  consentGranted: boolean;
  status: 'pending' | 'active' | 'revoked';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorName: string;
  action: string;
  targetPath: string;
  createdAt: string;
}

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  category: 'lessons' | 'quizzes' | 'streak' | 'mastery';
  unlocked: boolean;
  progressLabel: string;
}

export type ImageMediaKey = 'photosynthesis' | 'solar' | 'pythagoras' | 'atom' | 'water_cycle';

export interface ImageHotspot {
  id: string;
  label: string;
  detail: string;
  xPercent: number;
  yPercent: number;
}

export interface ImageLessonItem {
  id: string;
  board: EducationBoard;
  classLevel: number;
  subject: string;
  chapter: string;
  title: string;
  summary: string;
  mediaKey: ImageMediaKey;
  linkedLessonId?: string;
  xrModelId?: XRModelId;
  keyTakeaways: string[];
  hotspots: ImageHotspot[];
}

export interface GeneratedVisualDiagram {
  id: string;
  title: string;
  topic: string;
  subject: string;
  classLevel?: number;
  summary: string;
  keyTakeaways: string[];
  hotspots: { label: string; detail: string }[];
  svgMarkup: string;
  createdAt: string;
}

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'muted' | 'ended';

export type LiveCommandType =
  | 'wake'
  | 'pause'
  | 'stop_speaking'
  | 'repeat'
  | 'explain_more'
  | 'simplify'
  | 'example'
  | 'thank_you'
  | 'summarize'
  | 'translate'
  | 'remember_prompt'
  | 'read_aloud'
  | 'change_language'
  | 'new_conversation'
  | 'search'
  | 'question';

export interface LiveVoiceCommandResult {
  type: LiveCommandType;
  rawText: string;
  argument?: string;
  targetLanguage?: string;
}

export interface LiveConversationTurn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  language: string;
  commandType?: LiveCommandType;
  createdAt: string;
}

export type EducationRelevanceLabel =
  | 'Highly Relevant'
  | 'Curriculum Matched'
  | 'Related Lessons'
  | 'Additional Learning';

export interface EducationVideoItem {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  durationLabel: string;
  durationSeconds?: number;
  board: string;
  classLevel: number;
  subject: string;
  chapter?: string;
  language: string;
  sourceType: 'youtube_api' | 'admin_curated' | 'official_channel';
  isApprovedChannel?: boolean;
  isFeatured?: boolean;
  embeddable: boolean;
  captionsHint?: boolean;
  relevanceScore: number;
  relevanceLabel: EducationRelevanceLabel;
  youtubeUrl: string;
}

export interface EducationPlaylistItem {
  playlistId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  itemCount?: number;
  board: string;
  classLevel: number;
  subject: string;
  language: string;
  youtubeUrl: string;
}

export interface OfficialResourceLink {
  id: string;
  title: string;
  provider: string;
  description: string;
  url: string;
  boards: string[];
  classRange: string;
  languages: string[];
  badge: string;
}

export interface ApprovedChannelEntry {
  id: string;
  channelTitle: string;
  channelId?: string;
  handle?: string;
  boards: string[];
  languages: string[];
  subjects: string[];
  officialGovernment: boolean;
}

export interface EducationContentReport {
  id: string;
  videoId: string;
  videoTitle: string;
  reason: string;
  reportedByUid: string;
  status: 'open' | 'removed' | 'dismissed';
  createdAt: string;
}

export type AppModuleId =
  | 'dashboard'
  | 'ai_teacher'
  | 'voice_ai'
  | 'guides'
  | 'viewer_3d'
  | 'education_hub'
  | 'learning_studio'
  | 'lesson_academy'
  | 'video_academy'
  | 'image_academy'
  | 'daily_quiz'
  | 'weekly_tests'
  | 'practice_centre'
  | 'assignment_centre'
  | 'study_planner'
  | 'performance_centre'
  | 'revision_centre'
  | 'achievements'
  | 'profile'
  | 'parent_portal'
  | 'admin_panel';
