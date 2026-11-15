import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Layers,
  LogOut,
  Menu,
  Mic,
  Moon,
  Search,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trophy,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AppModuleId,
  AssessmentMode,
  AssignmentItem,
  AssignmentSubmission,
  ConversationThread,
  GeneratedVisualDiagram,
  LessonItem,
  QuestionItem,
  QuizAttempt,
  SavedNote,
  StudyPlanTask,
  ThemeMode,
  UploadedDocItem,
  UserProfile,
  UserRole,
  VideoLesson,
} from './types/muse';
import {
  clearWorkspaceStorage,
  createDefaultProfile,
  createInitialWorkspaceState,
  loadWorkspaceFromStorage,
  MuseWorkspaceState,
  saveWorkspaceToStorage,
} from './services/workspaceStore';
import {
  auth,
  deleteCurrentFirebaseUser,
  onAuthStateChanged,
  resendVerificationEmail,
  sendResetPassword,
  signInWithEmail,
  signInWithGooglePopup,
  signOutFirebase,
  signUpWithEmail,
  testFirestoreConnection,
} from './services/firebaseClient';
import {
  deleteUserAccountFromFirestore,
  fetchUserProfile,
  fetchUserProgress,
  saveConversationMessageToFirestore,
  saveQuizAttemptToFirestore,
  saveStudyPlanToFirestore,
  saveUserProfileToFirestore,
  upsertLearningProgress,
  writeAuditLogToFirestore,
} from './services/firestoreRepo';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from './data/curriculumSeed';
import {
  clearOfflineCacheForUser,
  getOfflineCacheStatus,
  initServiceWorkerRegistration,
  OfflineCacheStatus,
  prefetchEssentialCurriculum,
  readOfflineSnapshotFromCache,
  syncOfflineSnapshotToCache,
} from './services/offlineCacheService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { LessonCollectionFilter, mergeOfflineProgressAndNotes } from './utils/offlineCache';
import { buildNextRecurringTask, buildUserDataExportPayload } from './utils/plannerUtils';
import { ConnectivityPill, OfflineIndicator, PWAInstallButton } from './components/PWAStatusBar';
import { GuidedArrowsOverlay } from './components/GuidedArrowsOverlay';
import { LandingAuthView } from './components/LandingAuthView';
import { OnboardingModal } from './components/OnboardingModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AITeacherView } from './components/AITeacherView';
import { VoiceAIView } from './components/VoiceAIView';
import { EducationHubView } from './components/EducationHubView';
import { SmartPlannerView } from './components/SmartPlannerView';
import { LearningStudioView, StudioTabId } from './components/LearningStudioView';
import { LessonAcademyView } from './components/LessonAcademyView';
import { VideoAcademyView } from './components/VideoAcademyView';
import { ImageAcademyView } from './components/ImageAcademyView';
import { AssessmentCenterView } from './components/AssessmentCenterView';
import { PerformanceCenterView } from './components/PerformanceCenterView';
import {
  AchievementsView,
  AssignmentCenterView,
  ProfileSettingsView,
  RevisionCenterView,
} from './components/LearningToolsViews';
import {
  AdminPanelView,
  ParentPortalView,
  TeacherPortalView,
} from './components/RolePortalsView';

interface NavItem {
  id: AppModuleId;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'primary' | 'academies' | 'portals';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', shortLabel: 'Home', icon: Home, group: 'primary' },
  { id: 'ai_teacher', label: 'AI Assistant', shortLabel: 'AI Chat', icon: Bot, group: 'primary' },
  { id: 'voice_ai', label: 'Voice AI', shortLabel: 'Voice', icon: Mic, group: 'primary' },
  { id: 'education_hub', label: 'Education Hub', shortLabel: 'Ed Hub', icon: GraduationCap, group: 'primary' },
  { id: 'study_planner', label: 'Planner', shortLabel: 'Planner', icon: Calendar, group: 'primary' },
  { id: 'learning_studio', label: 'Learning Studio', shortLabel: 'Studio', icon: Sparkles, group: 'primary' },
  { id: 'performance_centre', label: 'Progress', shortLabel: 'Progress', icon: BarChart3, group: 'primary' },
  { id: 'profile', label: 'Profile', shortLabel: 'Profile', icon: User, group: 'primary' },
  { id: 'lesson_academy', label: 'Learning Academy', icon: BookOpen, group: 'academies' },
  { id: 'video_academy', label: 'Video Academy', icon: Video, group: 'academies' },
  { id: 'image_academy', label: 'Image Academy', icon: ImageIcon, group: 'academies' },
  { id: 'daily_quiz', label: 'Daily Quiz', icon: ClipboardCheck, group: 'academies' },
  { id: 'weekly_tests', label: 'Weekly Tests', icon: Award, group: 'academies' },
  { id: 'practice_centre', label: 'Practice Centre', icon: Target, group: 'academies' },
  { id: 'assignment_centre', label: 'Assignment Centre', icon: FileText, group: 'academies' },
  { id: 'revision_centre', label: 'Revision Centre', icon: Layers, group: 'academies' },
  { id: 'achievements', label: 'Achievements', icon: Trophy, group: 'academies' },
  { id: 'parent_portal', label: 'Parent Portal', icon: Users, group: 'portals' },
  { id: 'teacher_portal', label: 'Teacher Portal', icon: Sparkles, group: 'portals' },
  { id: 'admin_panel', label: 'Admin Panel', icon: Shield, group: 'portals' },
];

export const App: React.FC = () => {
  const [workspace, setWorkspace] = useState<MuseWorkspaceState>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const seed = createInitialWorkspaceState('demo');
      seed.profile = createDefaultProfile({ onboardingComplete: true });
      return seed;
    }
    const stored = loadWorkspaceFromStorage();
    if (stored && stored.authMode === 'demo' && stored.profile) {
      return stored;
    }
    return createInitialWorkspaceState('unauthenticated');
  });

  const [activeModule, setActiveModule] = useState<AppModuleId>('dashboard');
  const [studioTab, setStudioTab] = useState<StudioTabId>('ai_studio');
  const [studioAssessMode, setStudioAssessMode] = useState<AssessmentMode>('daily_quiz');
  const [lessonContextId, setLessonContextId] = useState<string | null>(null);
  const [lessonCollectionFilter, setLessonCollectionFilter] =
    useState<LessonCollectionFilter>('all');
  const [aiContextSubject, setAiContextSubject] = useState<string | undefined>(undefined);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(workspace.profile?.theme || 'dark');
  const isOnline = useOnlineStatus();
  const [swReady, setSwReady] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<OfflineCacheStatus | null>(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = React.useRef(!isOnline);

  // Global search filters
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchBoard, setSearchBoard] = useState('ALL');
  const [searchClass, setSearchClass] = useState('ALL');
  const [searchSubject, setSearchSubject] = useState('ALL');
  const [searchLanguage, setSearchLanguage] = useState('ALL');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Register Service Worker and hydrate from Cache Storage if offline
  useEffect(() => {
    initServiceWorkerRegistration((registered) => {
      setSwReady(registered);
    });

    if (!navigator.onLine) {
      readOfflineSnapshotFromCache().then((snap) => {
        if (!snap) return;
        setWorkspace((prev) => {
          if (prev.profile) {
            const merged = mergeOfflineProgressAndNotes({
              baseProgress: prev.progress,
              cachedProgress: snap.progress,
              baseNotes: prev.savedNotes,
              cachedNotes: snap.savedNotes,
            });
            return {
              ...prev,
              lessons: snap.lessons.length > 0 ? snap.lessons : prev.lessons,
              offlineLessonIds: snap.offlineLessonIds,
              progress: merged.progress,
              savedNotes: merged.savedNotes,
              studyPlans: snap.studyPlans.length > 0 ? snap.studyPlans : prev.studyPlans,
              attempts: snap.attempts.length > 0 ? snap.attempts : prev.attempts,
            };
          }
          const base = createInitialWorkspaceState('demo');
          return {
            ...base,
            profile: snap.profile,
            lessons: snap.lessons.length > 0 ? snap.lessons : base.lessons,
            offlineLessonIds: snap.offlineLessonIds,
            progress: snap.progress,
            savedNotes: snap.savedNotes,
            studyPlans: snap.studyPlans,
            attempts: snap.attempts,
          };
        });
      });
    }
  }, []);

  // Mandatory Firebase boot connection check
  useEffect(() => {
    if (navigator.onLine) {
      testFirestoreConnection();
    }
  }, []);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const cachedSnap = await readOfflineSnapshotFromCache(fbUser.uid);
        let profile = navigator.onLine
          ? await fetchUserProfile(fbUser.uid).catch(() => null)
          : cachedSnap?.profile ?? null;

        if (!profile && cachedSnap?.profile) {
          profile = cachedSnap.profile;
        }

        const isBootAdmin =
          fbUser.email === 'venkatramveni@gmail.com' && fbUser.emailVerified;

        if (!profile) {
          profile = createDefaultProfile({
            uid: fbUser.uid,
            displayName: fbUser.displayName || 'Student',
            email: fbUser.email || undefined,
            emailVerified: fbUser.emailVerified,
            role: isBootAdmin ? 'admin' : 'student',
            onboardingComplete: false,
          });
          if (navigator.onLine) {
            await saveUserProfileToFirestore(profile, true).catch(() => {});
          }
        }

        const remoteProgress = navigator.onLine
          ? await fetchUserProgress(fbUser.uid).catch(() => [])
          : [];
        const merged = mergeOfflineProgressAndNotes({
          baseProgress: remoteProgress,
          cachedProgress: cachedSnap?.progress ?? [],
          baseNotes: [],
          cachedNotes: cachedSnap?.savedNotes ?? [],
        });

        const base = createInitialWorkspaceState('firebase');
        setWorkspace({
          ...base,
          authMode: 'firebase',
          profile,
          progress: merged.progress,
          savedNotes: merged.savedNotes.length > 0 ? merged.savedNotes : base.savedNotes,
          offlineLessonIds:
            cachedSnap?.offlineLessonIds && cachedSnap.offlineLessonIds.length > 0
              ? cachedSnap.offlineLessonIds
              : base.offlineLessonIds,
          studyPlans:
            cachedSnap?.studyPlans && cachedSnap.studyPlans.length > 0
              ? cachedSnap.studyPlans
              : base.studyPlans,
          attempts:
            cachedSnap?.attempts && cachedSnap.attempts.length > 0
              ? cachedSnap.attempts
              : base.attempts,
        });
        setTheme(profile.theme);
      } catch (err) {
        console.error('Firebase hydration warning:', err);
      }
    });
    return () => unsub();
  }, []);

  // Persist demo workspace locally AND mirror essential My Lessons, Saved Notes & progress to SW Cache Storage
  useEffect(() => {
    if (workspace.authMode === 'demo') {
      saveWorkspaceToStorage(workspace);
    }
    if (workspace.profile) {
      syncOfflineSnapshotToCache({
        profile: workspace.profile,
        lessons: workspace.lessons,
        offlineLessonIds: workspace.offlineLessonIds,
        progress: workspace.progress,
        savedNotes: workspace.savedNotes,
        studyPlans: workspace.studyPlans,
        attempts: workspace.attempts,
      })
        .then(() => getOfflineCacheStatus(workspace.profile?.uid))
        .then((status) => setOfflineStatus(status))
        .catch(() => {});
    }
  }, [workspace]);

  // Reconnect sync: flush cached progress & study plans when coming back online
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      prefetchEssentialCurriculum().catch(() => {});
      if (workspace.authMode === 'firebase' && workspace.profile) {
        const uid = workspace.profile.uid;
        Promise.all([
          ...workspace.progress.map((p) => upsertLearningProgress(uid, p).catch(() => {})),
          ...workspace.studyPlans.map((t) => saveStudyPlanToFirestore(t, false).catch(() => {})),
        ]).catch(() => {});
      }
      setJustReconnected(true);
      const timer = window.setTimeout(() => setJustReconnected(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, workspace.authMode, workspace.profile, workspace.progress, workspace.studyPlans]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (workspace.profile) {
      const updated = { ...workspace.profile, theme: next, updatedAt: new Date().toISOString() };
      setWorkspace((w) => ({ ...w, profile: updated }));
      if (workspace.authMode === 'firebase') {
        saveUserProfileToFirestore(updated, false).catch(console.error);
      }
    }
  };

  const formatAuthErrorMessage = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/operation-not-allowed')) {
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). Enable it there or use Continue with Google / Demo Workspace right now.';
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
      return 'Incorrect email or password. Try again or use Reset Password.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Switch to Sign In.';
    }
    return raw;
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await signInWithGooglePopup();
    } catch (err: unknown) {
      setAuthError(`Google Sign-In did not complete: ${formatAuthErrorMessage(err)}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (email: string, password: string, displayName: string) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await signUpWithEmail(email, password, displayName);
      setAuthSuccess('Account created! A verification email was sent to your inbox.');
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await sendResetPassword(email);
      setAuthSuccess(`Password reset link sent to ${email}. Check your inbox.`);
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLaunchDemo = () => {
    setAuthError(null);
    setAuthSuccess(null);
    const demo = createInitialWorkspaceState('demo');
    setWorkspace(demo);
    setActiveModule('dashboard');
  };

  const handleSignOut = async () => {
    if (workspace.authMode === 'firebase') {
      await signOutFirebase().catch(() => {});
    }
    clearWorkspaceStorage();
    setWorkspace(createInitialWorkspaceState('unauthenticated'));
    setActiveModule('dashboard');
  };

  const handleCompleteOnboarding = async (updatedProfile: UserProfile) => {
    setWorkspace((w) => ({ ...w, profile: updatedProfile }));
    if (workspace.authMode === 'firebase') {
      await saveUserProfileToFirestore(updatedProfile, false).catch(console.error);
      await writeAuditLogToFirestore(updatedProfile.uid, 'Completed student onboarding', `users/${updatedProfile.uid}`).catch(() => {});
    }
  };

  const handleNavigate = (
    mod: AppModuleId,
    ctxLessonId?: string,
    collectionMode?: LessonCollectionFilter
  ) => {
    if (ctxLessonId) setLessonContextId(ctxLessonId);
    if (collectionMode) setLessonCollectionFilter(collectionMode);

    if (mod === 'learning_studio') {
      setStudioTab('ai_studio');
      setStudioAssessMode('daily_quiz');
    }
    setActiveModule(mod);
    setMobileMenuOpen(false);
  };

  const handleToggleLessonComplete = (lesson: LessonItem) => {
    if (!workspace.profile) return;
    const now = new Date().toISOString();
    const current = workspace.progress.find((p) => p.lessonId === lesson.id);
    const nextItem = {
      lessonId: lesson.id,
      subject: lesson.subject,
      completed: !(current?.completed ?? false),
      bookmarked: current?.bookmarked ?? false,
      lastStudiedAt: now,
    };

    setWorkspace((w) => {
      const rest = w.progress.filter((p) => p.lessonId !== lesson.id);
      const nextNotifs = nextItem.completed
        ? [
            {
              id: `notif_${Date.now()}`,
              uid: w.profile!.uid,
              title: 'Lesson Completed',
              message: `Great work finishing "${lesson.title}"!`,
              category: 'milestone' as const,
              read: false,
              createdAt: now,
            },
            ...w.notifications,
          ]
        : w.notifications;
      return { ...w, progress: [...rest, nextItem], notifications: nextNotifs };
    });

    if (workspace.authMode === 'firebase') {
      upsertLearningProgress(workspace.profile.uid, nextItem).catch(console.error);
    }
  };

  const handleToggleLessonBookmark = (lesson: LessonItem) => {
    if (!workspace.profile) return;
    const now = new Date().toISOString();
    const current = workspace.progress.find((p) => p.lessonId === lesson.id);
    const nextItem = {
      lessonId: lesson.id,
      subject: lesson.subject,
      completed: current?.completed ?? false,
      bookmarked: !(current?.bookmarked ?? false),
      lastStudiedAt: now,
    };
    setWorkspace((w) => ({
      ...w,
      progress: [...w.progress.filter((p) => p.lessonId !== lesson.id), nextItem],
    }));
    if (workspace.authMode === 'firebase') {
      upsertLearningProgress(workspace.profile.uid, nextItem).catch(console.error);
    }
  };

  const handleRecordAttempt = (attempt: QuizAttempt) => {
    setWorkspace((w) => ({
      ...w,
      attempts: [...w.attempts, attempt],
    }));
    if (workspace.authMode === 'firebase') {
      saveQuizAttemptToFirestore(attempt).catch(console.error);
    }
  };

  const handleAddStudyTask = (task: StudyPlanTask) => {
    setWorkspace((w) => ({ ...w, studyPlans: [task, ...w.studyPlans] }));
    if (workspace.authMode === 'firebase') {
      saveStudyPlanToFirestore(task, true).catch(console.error);
    }
  };

  const handleUpdateStudyTask = (updated: StudyPlanTask) => {
    setWorkspace((w) => ({
      ...w,
      studyPlans: w.studyPlans.map((t) => (t.id === updated.id ? updated : t)),
    }));
    if (workspace.authMode === 'firebase') {
      saveStudyPlanToFirestore(updated, false).catch(console.error);
    }
  };

  const handleToggleStudyTask = (id: string) => {
    let target: StudyPlanTask | undefined;
    let nextRecurring: StudyPlanTask | null = null;
    setWorkspace((w) => {
      const updatedList = w.studyPlans.map((t) => {
        if (t.id === id) {
          const nextDone = !t.completed;
          target = { ...t, completed: nextDone, updatedAt: new Date().toISOString() };
          if (nextDone) {
            nextRecurring = buildNextRecurringTask(target);
          }
          return target;
        }
        return t;
      });
      return {
        ...w,
        studyPlans: nextRecurring ? [nextRecurring, ...updatedList] : updatedList,
      };
    });
    if (workspace.authMode === 'firebase' && target) {
      saveStudyPlanToFirestore(target, false).catch(console.error);
      if (nextRecurring) {
        saveStudyPlanToFirestore(nextRecurring, true).catch(console.error);
      }
    }
  };

  const handleDeleteStudyTask = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      studyPlans: w.studyPlans.filter((t) => t.id !== id),
    }));
  };

  const handleSaveUploadedDoc = (docItem: UploadedDocItem) => {
    setWorkspace((w) => ({
      ...w,
      uploadedDocs: [docItem, ...w.uploadedDocs].slice(0, 20),
    }));
  };

  const handleMarkVideoWatched = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      watchedVideoIds: w.watchedVideoIds.includes(id)
        ? w.watchedVideoIds
        : [...w.watchedVideoIds, id],
    }));
  };

  const handleToggleVideoBookmark = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      bookmarkedVideoIds: w.bookmarkedVideoIds.includes(id)
        ? w.bookmarkedVideoIds.filter((x) => x !== id)
        : [...w.bookmarkedVideoIds, id],
    }));
  };

  const handleAddCustomVideo = (video: VideoLesson) => {
    setWorkspace((w) => ({
      ...w,
      videos: [video, ...w.videos],
    }));
  };

  const handleToggleStudiedImage = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      studiedImageIds: w.studiedImageIds.includes(id)
        ? w.studiedImageIds.filter((x) => x !== id)
        : [...w.studiedImageIds, id],
    }));
  };

  const handleToggleImageBookmark = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      bookmarkedImageIds: w.bookmarkedImageIds.includes(id)
        ? w.bookmarkedImageIds.filter((x) => x !== id)
        : [...w.bookmarkedImageIds, id],
    }));
  };

  const handleSaveGeneratedVisual = (visual: GeneratedVisualDiagram) => {
    setWorkspace((w) => ({
      ...w,
      generatedVisuals: [visual, ...w.generatedVisuals].slice(0, 20),
    }));
  };

  const handleExportUserData = () => {
    const payload = buildUserDataExportPayload(workspace);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muse_ai_data_${workspace.profile?.uid || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveThread = (thread: ConversationThread) => {
    setWorkspace((w) => {
      const exists = w.conversations.some((c) => c.id === thread.id);
      const next = exists
        ? w.conversations.map((c) => (c.id === thread.id ? thread : c))
        : [thread, ...w.conversations];
      return { ...w, conversations: next };
    });

    if (workspace.authMode === 'firebase' && thread.messages.length > 0) {
      const latest = thread.messages[thread.messages.length - 1];
      saveConversationMessageToFirestore(thread, latest.id, latest.sender, latest.text).catch(
        console.error
      );
    }
  };

  const handleDeleteThread = (threadId: string) => {
    setWorkspace((w) => ({
      ...w,
      conversations: w.conversations.filter((c) => c.id !== threadId),
    }));
  };

  const handleSaveNote = (note: SavedNote) => {
    setWorkspace((w) => ({ ...w, savedNotes: [note, ...w.savedNotes] }));
  };

  const handleDeleteNote = (noteId: string) => {
    setWorkspace((w) => ({
      ...w,
      savedNotes: w.savedNotes.filter((n) => n.id !== noteId),
    }));
  };

  const handleToggleOfflineLesson = (lesson: LessonItem) => {
    setWorkspace((w) => {
      const exists = w.offlineLessonIds.includes(lesson.id);
      return {
        ...w,
        offlineLessonIds: exists
          ? w.offlineLessonIds.filter((id) => id !== lesson.id)
          : [lesson.id, ...w.offlineLessonIds],
      };
    });
  };

  const handleSyncOfflineCache = async () => {
    if (!workspace.profile) return;
    await prefetchEssentialCurriculum().catch(() => {});
    await syncOfflineSnapshotToCache({
      profile: workspace.profile,
      lessons: workspace.lessons,
      offlineLessonIds: workspace.offlineLessonIds,
      progress: workspace.progress,
      savedNotes: workspace.savedNotes,
      studyPlans: workspace.studyPlans,
      attempts: workspace.attempts,
    });
    const status = await getOfflineCacheStatus(workspace.profile.uid);
    setOfflineStatus(status);
  };

  const handleSubmitAssignment = (sub: AssignmentSubmission) => {
    setWorkspace((w) => ({ ...w, submissions: [sub, ...w.submissions] }));
  };

  const handleCreateAssignment = (asgn: AssignmentItem) => {
    setWorkspace((w) => ({
      ...w,
      assignments: [asgn, ...w.assignments],
      auditLogs: [
        ...w.auditLogs,
        {
          id: `audit_${Date.now()}`,
          actorUid: w.profile?.uid || 'teacher',
          actorName: w.profile?.displayName || 'Teacher',
          action: `Published assignment "${asgn.title}"`,
          targetPath: `/assignments/${asgn.id}`,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const handleCreateQuestionAndQuiz = (q: QuestionItem, quizTitle: string) => {
    setWorkspace((w) => ({
      ...w,
      questions: [...w.questions, q],
      assessments: [
        {
          id: `quiz_teacher_${Date.now()}`,
          title: quizTitle,
          mode: 'daily_quiz',
          board: q.board,
          classLevel: q.classLevel,
          subject: q.subject,
          durationMinutes: 5,
          questionIds: [q.id],
          createdBy: q.createdBy,
        },
        ...w.assessments,
      ],
    }));
  };

  const handleReviewSubmission = (submissionId: string, feedback: string, grade: string) => {
    setWorkspace((w) => ({
      ...w,
      submissions: w.submissions.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: 'reviewed',
              teacherFeedback: feedback,
              grade,
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    }));
  };

  const handleAddLesson = (lesson: LessonItem) => {
    setWorkspace((w) => ({
      ...w,
      lessons: [lesson, ...w.lessons],
      auditLogs: [
        ...w.auditLogs,
        {
          id: `audit_${Date.now()}`,
          actorUid: w.profile?.uid || 'admin',
          actorName: w.profile?.displayName || 'Admin',
          action: `Published lesson "${lesson.title}"`,
          targetPath: `/lessons/${lesson.id}`,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const handleDeleteAccount = async () => {
    const uid = workspace.profile?.uid;
    if (workspace.authMode === 'firebase' && workspace.profile) {
      await deleteUserAccountFromFirestore(workspace.profile.uid).catch(console.error);
      await deleteCurrentFirebaseUser().catch(console.error);
    }
    if (uid) {
      await clearOfflineCacheForUser(uid);
    }
    clearWorkspaceStorage();
    setWorkspace(createInitialWorkspaceState('unauthenticated'));
  };

  // Global search results
  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    const matchLesson = (l: LessonItem) => {
      if (searchBoard !== 'ALL' && l.board !== searchBoard) return false;
      if (searchClass !== 'ALL' && l.classLevel !== Number(searchClass)) return false;
      if (searchSubject !== 'ALL' && l.subject !== searchSubject) return false;
      if (searchLanguage !== 'ALL' && l.language !== searchLanguage) return false;
      if (!q) return true;
      return `${l.title} ${l.subject} ${l.chapter} ${l.topic} ${l.summary}`.toLowerCase().includes(q);
    };

    const lessonHits = workspace.lessons.filter(matchLesson);
    const videoHits = workspace.videos.filter((v) => {
      if (searchBoard !== 'ALL' && v.board !== searchBoard) return false;
      if (searchClass !== 'ALL' && v.classLevel !== Number(searchClass)) return false;
      if (searchSubject !== 'ALL' && v.subject !== searchSubject) return false;
      if (!q) return true;
      return `${v.title} ${v.chapter} ${v.description}`.toLowerCase().includes(q);
    });
    const imageHits = workspace.images.filter((img) => {
      if (searchBoard !== 'ALL' && img.board !== searchBoard) return false;
      if (searchClass !== 'ALL' && img.classLevel !== Number(searchClass)) return false;
      if (searchSubject !== 'ALL' && img.subject !== searchSubject) return false;
      if (!q) return true;
      return `${img.title} ${img.chapter} ${img.summary}`.toLowerCase().includes(q);
    });
    const questionHits = workspace.questions.filter((item) => {
      if (searchBoard !== 'ALL' && item.board !== searchBoard) return false;
      if (searchClass !== 'ALL' && item.classLevel !== Number(searchClass)) return false;
      if (searchSubject !== 'ALL' && item.subject !== searchSubject) return false;
      if (!q) return true;
      return `${item.prompt} ${item.topic} ${item.chapter}`.toLowerCase().includes(q);
    });
    return { lessonHits, videoHits, imageHits, questionHits };
  }, [workspace, globalQuery, searchBoard, searchClass, searchSubject, searchLanguage]);

  if (workspace.authMode === 'unauthenticated' || !workspace.profile) {
    return (
      <LandingAuthView
        theme={theme}
        onToggleTheme={toggleTheme}
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        onResetPassword={handleResetPassword}
        onLaunchDemo={handleLaunchDemo}
        authLoading={authLoading}
        authError={authError}
        authSuccess={authSuccess}
      />
    );
  }

  if (!workspace.profile.onboardingComplete) {
    return (
      <OnboardingModal
        initialProfile={workspace.profile}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  const profile = workspace.profile;
  const unreadNotifCount = workspace.notifications.filter((n) => !n.read).length;

  const allowedNavItems = NAV_ITEMS.filter((item) => {
    if (item.group === 'primary' || item.group === 'academies') return true;
    // In Demo mode, all portals are inspectable for testing; in Firebase mode, enforce role strictly!
    if (workspace.authMode === 'demo') return true;
    if (item.id === 'parent_portal') return profile.role === 'parent' || profile.role === 'admin';
    if (item.id === 'teacher_portal') return profile.role === 'teacher' || profile.role === 'admin';
    if (item.id === 'admin_panel') return profile.role === 'admin';
    return false;
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:h-screen lg:sticky lg:top-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 no-print">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl muse-btn-primary flex items-center justify-center font-display font-bold">
            M
          </div>
          <div>
            <div className="font-display font-bold text-base leading-tight">Muse AI</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {workspace.authMode === 'firebase' ? 'Cloud Synced' : 'Demo Workspace'}
            </div>
          </div>
        </div>

        <nav aria-label="Primary Sidebar Navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            MUSE AI Workspace
          </div>
          {allowedNavItems
            .filter((i) => i.group === 'primary')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
                  activeModule === item.id
                    ? 'bg-[var(--bg-subtle)] text-blue-400 font-semibold border border-blue-500/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

          <div className="px-2.5 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Academies &amp; Centres
          </div>
          {allowedNavItems
            .filter((i) => i.group === 'academies')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${
                  activeModule === item.id
                    ? 'bg-[var(--bg-subtle)] text-emerald-400 font-semibold border border-emerald-500/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

          <div className="px-2.5 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Role Portals
          </div>
          {allowedNavItems
            .filter((i) => i.group === 'portals')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  activeModule === item.id
                    ? 'bg-[var(--bg-subtle)] text-purple-400 font-semibold border border-purple-500/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
        </nav>

        <div className="p-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-rose-500/40"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <span className="font-display font-bold text-base">Muse AI Navigation</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav aria-label="Mobile Navigation" className="flex-1 overflow-y-auto py-3 space-y-1">
              {allowedNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium ${
                    activeModule === item.id
                      ? 'bg-[var(--bg-subtle)] text-blue-400 font-semibold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              Sign Out
            </button>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center gap-2 hover:border-blue-500/40"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search lessons, topics, videos, questions...</span>
              <span className="sm:hidden">Search</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <ConnectivityPill isOnline={isOnline} swReady={swReady} />
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 text-xs font-semibold flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Guide Arrows</span>
            </button>
            <button
              type="button"
              aria-label="Toggle Light or Dark Theme"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>

            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setNotifOpen((o) => !o)}
                className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] relative"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 muse-card p-4 z-40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm">Notifications</span>
                    <button
                      type="button"
                      onClick={() =>
                        setWorkspace((w) => ({
                          ...w,
                          notifications: w.notifications.map((n) => ({ ...n, read: true })),
                        }))
                      }
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  {workspace.notifications.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No notifications right now.</p>
                  ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                      {workspace.notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`muse-panel p-2.5 text-xs ${n.read ? 'opacity-70' : 'border-blue-500/40'}`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[var(--text-muted)] mt-0.5">{n.message}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('profile')}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold hidden sm:flex items-center gap-2"
            >
              <span>{profile.displayName}</span>
              <span className="text-[11px] text-blue-400 capitalize">({profile.role})</span>
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 pb-20 sm:p-6 lg:pb-6 max-w-7xl w-full mx-auto">
          {activeModule === 'dashboard' && (
            <StudentDashboard
              workspace={workspace}
              onNavigate={handleNavigate}
              onAskPrompt={(prompt) => {
                setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
              onToggleTask={handleToggleStudyTask}
            />
          )}

          {activeModule === 'ai_teacher' && (
            <AITeacherView
              profile={profile}
              conversations={workspace.conversations}
              initialSubject={aiContextSubject}
              initialPrompt={aiInitialPrompt}
              onConsumeInitialPrompt={() => setAiInitialPrompt(null)}
              onSaveThread={handleSaveThread}
              onDeleteThread={handleDeleteThread}
              onSaveUploadedDoc={handleSaveUploadedDoc}
              onOpenGlobalGuide={() => setGuideOpen(true)}
            />
          )}

          {activeModule === 'voice_ai' && (
            <VoiceAIView
              profile={profile}
              onSaveVoicePreference={(voiceAutoSpeak, speechRate) =>
                handleCompleteOnboarding({
                  ...profile,
                  voiceAutoSpeak,
                  speechRate,
                  updatedAt: new Date().toISOString(),
                })
              }
              onSaveRememberedNote={handleSaveNote}
              onOpenSearch={(query) => {
                setGlobalQuery(query);
                setSearchOpen(true);
              }}
            />
          )}

          {activeModule === 'education_hub' && (
            <EducationHubView
              profile={profile}
              onSaveNote={handleSaveNote}
              onAskAITeacher={(subject?: string, prompt?: string) => {
                if (subject) setAiContextSubject(subject);
                if (prompt) setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
              onSyncProfilePrefs={(board, classLevel, preferredLanguage) =>
                handleCompleteOnboarding({
                  ...profile,
                  board,
                  classLevel,
                  preferredLanguage,
                  updatedAt: new Date().toISOString(),
                })
              }
            />
          )}

          {activeModule === 'study_planner' && (
            <SmartPlannerView
              profile={profile}
              tasks={workspace.studyPlans}
              assignments={workspace.assignments}
              onAddTask={handleAddStudyTask}
              onUpdateTask={handleUpdateStudyTask}
              onToggleTask={handleToggleStudyTask}
              onDeleteTask={handleDeleteStudyTask}
            />
          )}

          {activeModule === 'learning_studio' && (
            <LearningStudioView
              workspace={workspace}
              initialTab={studioTab}
              initialAssessmentMode={studioAssessMode}
              lessonContextId={lessonContextId}
              lessonCollectionFilter={lessonCollectionFilter}
              isOnline={isOnline}
              swReady={swReady}
              offlineStatus={offlineStatus}
              onToggleComplete={handleToggleLessonComplete}
              onToggleBookmark={handleToggleLessonBookmark}
              onToggleOfflineLesson={handleToggleOfflineLesson}
              onSyncOfflineCache={handleSyncOfflineCache}
              onAskAITeacher={(subject?: string, prompt?: string) => {
                if (subject) setAiContextSubject(subject);
                if (prompt) setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
              onRecordAttempt={handleRecordAttempt}
              onMarkVideoWatched={handleMarkVideoWatched}
              onToggleVideoBookmark={handleToggleVideoBookmark}
              onAddCustomVideo={handleAddCustomVideo}
              onToggleStudiedImage={handleToggleStudiedImage}
              onToggleImageBookmark={handleToggleImageBookmark}
              onSaveGeneratedVisual={handleSaveGeneratedVisual}
              onOpenLesson={(lessonId) => handleNavigate('lesson_academy', lessonId)}
              onSubmitAssignment={handleSubmitAssignment}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              onSaveUploadedDoc={handleSaveUploadedDoc}
            />
          )}

          {activeModule === 'lesson_academy' && (
            <LessonAcademyView
              profile={profile}
              lessons={workspace.lessons}
              progress={workspace.progress}
              offlineLessonIds={workspace.offlineLessonIds}
              initialLessonId={lessonContextId}
              initialCollectionFilter={lessonCollectionFilter}
              isOnline={isOnline}
              swReady={swReady}
              onToggleComplete={handleToggleLessonComplete}
              onToggleBookmark={handleToggleLessonBookmark}
              onToggleOfflineLesson={handleToggleOfflineLesson}
              onSyncOfflineCache={handleSyncOfflineCache}
              onAskAITeacher={(subject?: string) => {
                if (subject) setAiContextSubject(subject);
                handleNavigate('ai_teacher');
              }}
            />
          )}

          {activeModule === 'video_academy' && (
            <VideoAcademyView
              profile={profile}
              videos={workspace.videos}
              watchedIds={workspace.watchedVideoIds}
              bookmarkedIds={workspace.bookmarkedVideoIds}
              onMarkWatched={handleMarkVideoWatched}
              onToggleBookmark={handleToggleVideoBookmark}
              onAddCustomVideo={handleAddCustomVideo}
              onAskAITeacher={(subject?: string, prompt?: string) => {
                if (subject) setAiContextSubject(subject);
                if (prompt) setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
            />
          )}

          {activeModule === 'image_academy' && (
            <ImageAcademyView
              profile={profile}
              images={workspace.images}
              studiedIds={workspace.studiedImageIds}
              bookmarkedIds={workspace.bookmarkedImageIds}
              generatedVisuals={workspace.generatedVisuals}
              uploadedDocs={workspace.uploadedDocs}
              onToggleStudied={handleToggleStudiedImage}
              onToggleBookmark={handleToggleImageBookmark}
              onSaveGeneratedVisual={handleSaveGeneratedVisual}
              onSaveUploadedDoc={handleSaveUploadedDoc}
              onSaveNote={handleSaveNote}
              onOpenLesson={(lessonId) => handleNavigate('lesson_academy', lessonId)}
              onAskAITeacher={(subject?: string, prompt?: string) => {
                if (subject) setAiContextSubject(subject);
                if (prompt) setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
            />
          )}

          {(activeModule === 'daily_quiz' ||
            activeModule === 'weekly_tests' ||
            activeModule === 'practice_centre') && (
            <AssessmentCenterView
              mode={
                activeModule === 'weekly_tests'
                  ? 'weekly_test'
                  : activeModule === 'practice_centre'
                    ? 'practice'
                    : 'daily_quiz'
              }
              profile={profile}
              assessments={workspace.assessments}
              questions={workspace.questions}
              attempts={workspace.attempts}
              onRecordAttempt={handleRecordAttempt}
            />
          )}

          {activeModule === 'assignment_centre' && (
            <AssignmentCenterView
              profile={profile}
              assignments={workspace.assignments}
              submissions={workspace.submissions}
              onSubmitAssignment={handleSubmitAssignment}
            />
          )}

          {activeModule === 'revision_centre' && (
            <RevisionCenterView
              workspace={workspace}
              offlineStatus={offlineStatus}
              isOnline={isOnline}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
            />
          )}

          {activeModule === 'performance_centre' && (
            <PerformanceCenterView workspace={workspace} />
          )}

          {activeModule === 'achievements' && <AchievementsView workspace={workspace} />}

          {activeModule === 'profile' && (
            <ProfileSettingsView
              profile={profile}
              theme={theme}
              authMode={workspace.authMode}
              offlineStatus={offlineStatus}
              onSyncOfflineCache={handleSyncOfflineCache}
              onToggleTheme={toggleTheme}
              onSaveProfile={handleCompleteOnboarding}
              onExportData={handleExportUserData}
              onResendVerification={resendVerificationEmail}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeModule === 'parent_portal' && (
            <ParentPortalView
              workspace={workspace}
              onToggleConsent={(linkId) =>
                setWorkspace((w) => ({
                  ...w,
                  parentLinks: w.parentLinks.map((pl) =>
                    pl.id === linkId
                      ? {
                          ...pl,
                          consentGranted: !pl.consentGranted,
                          status: !pl.consentGranted ? 'active' : 'revoked',
                        }
                      : pl
                  ),
                }))
              }
            />
          )}

          {activeModule === 'teacher_portal' && (
            <TeacherPortalView
              workspace={workspace}
              onCreateAssignment={handleCreateAssignment}
              onCreateQuestionAndQuiz={handleCreateQuestionAndQuiz}
              onReviewSubmission={handleReviewSubmission}
            />
          )}

          {activeModule === 'admin_panel' && (
            <AdminPanelView
              workspace={workspace}
              onAddLesson={handleAddLesson}
              onSwitchDemoRole={(role: UserRole) =>
                setWorkspace((w) => ({
                  ...w,
                  profile: w.profile ? { ...w.profile, role } : null,
                }))
              }
            />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Global Search"
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-16"
        >
          <div className="muse-card w-full max-w-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base">Global Search</h2>
              <button
                type="button"
                aria-label="Close Global Search"
                onClick={() => setSearchOpen(false)}
                className="p-1.5 rounded-lg bg-[var(--bg-elevated)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Search lessons, subjects, chapters, topics, videos, questions..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                aria-label="Global filter board"
                value={searchBoard}
                onChange={(e) => setSearchBoard(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Boards</option>
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                aria-label="Global filter class"
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Classes</option>
                {CLASS_LEVELS.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select
                aria-label="Global filter subject"
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Subjects</option>
                {CORE_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                aria-label="Global filter language"
                value={searchLanguage}
                onChange={(e) => setSearchLanguage(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                <option value="ALL">All Languages</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 text-xs">
              <div>
                <div className="font-semibold text-[var(--text-muted)] mb-1">
                  Lessons ({searchResults.lessonHits.length})
                </div>
                {searchResults.lessonHits.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      handleNavigate('lesson_academy', l.id);
                      setSearchOpen(false);
                    }}
                    className="w-full text-left muse-panel p-2.5 mb-1.5 hover:border-blue-500/40"
                  >
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-[var(--text-muted)]">
                      {l.board} Class {l.classLevel} • {l.subject} • {l.chapter}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <div className="font-semibold text-[var(--text-muted)] mb-1">
                  Videos ({searchResults.videoHits.length})
                </div>
                {searchResults.videoHits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      handleNavigate('video_academy');
                      setSearchOpen(false);
                    }}
                    className="w-full text-left muse-panel p-2.5 mb-1.5 hover:border-blue-500/40"
                  >
                    <div className="font-semibold">{v.title}</div>
                    <div className="text-[var(--text-muted)]">{v.subject} • {v.durationLabel}</div>
                  </button>
                ))}
              </div>
              <div>
                <div className="font-semibold text-[var(--text-muted)] mb-1">
                  Image Academy Visuals ({searchResults.imageHits.length})
                </div>
                {searchResults.imageHits.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      handleNavigate('image_academy');
                      setSearchOpen(false);
                    }}
                    className="w-full text-left muse-panel p-2.5 mb-1.5 hover:border-amber-500/40"
                  >
                    <div className="font-semibold">{img.title}</div>
                    <div className="text-[var(--text-muted)]">{img.subject} • {img.chapter}</div>
                  </button>
                ))}
              </div>
              <div>
                <div className="font-semibold text-[var(--text-muted)] mb-1">
                  Question Bank ({searchResults.questionHits.length})
                </div>
                {searchResults.questionHits.slice(0, 5).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      handleNavigate('practice_centre');
                      setSearchOpen(false);
                    }}
                    className="w-full text-left muse-panel p-2.5 mb-1.5 hover:border-blue-500/40"
                  >
                    <div className="font-semibold truncate">{q.prompt}</div>
                    <div className="text-[var(--text-muted)]">{q.subject} • {q.topic}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[var(--bg-surface)]/95 backdrop-blur border-t border-[var(--border-subtle)] grid grid-cols-6 no-print"
      >
        {allowedNavItems
          .filter((i) => i.group === 'primary')
          .slice(0, 5)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                activeModule === item.id ? 'text-blue-400 font-semibold' : 'text-[var(--text-muted)]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.shortLabel || item.label}</span>
            </button>
          ))}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--text-muted)]"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      <OfflineIndicator
        isOnline={isOnline}
        cachedLessonCount={offlineStatus?.cachedLessonCount ?? workspace.offlineLessonIds.length}
        cachedNoteCount={offlineStatus?.cachedNoteCount ?? workspace.savedNotes.length}
        justReconnected={justReconnected}
        onOpenMyLessons={() => handleNavigate('lesson_academy', undefined, 'my_lessons')}
        onOpenSavedNotes={() => handleNavigate('revision_centre')}
      />

      <GuidedArrowsOverlay
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};
