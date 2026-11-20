import React, { Component, ErrorInfo, lazy, ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Box,
  Calendar,
  ClipboardCheck,
  Compass,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Layers,
  LogOut,
  Mail,
  Menu,
  Mic,
  Moon,
  RefreshCw,
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
  AssignmentSubmission,
  ConversationThread,
  GeneratedVisualDiagram,
  LessonItem,
  NotificationItem,
  QuizAttempt,
  SavedGuideLink,
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
  type User as FirebaseUser,
} from './services/firebaseClient';
import {
  deleteConversationFromFirestore,
  deleteSavedNoteFromFirestore,
  deleteStudyPlanFromFirestore,
  deleteUserAccountFromFirestore,
  fetchConversationsFromFirestore,
  fetchNotificationsFromFirestore,
  fetchQuizAttemptsFromFirestore,
  fetchSavedNotesFromFirestore,
  fetchStudyPlansFromFirestore,
  fetchSubmissionsFromFirestore,
  fetchUserProfile,
  fetchUserProgress,
  markNotificationsReadInFirestore,
  saveConversationMessageToFirestore,
  saveNotificationToFirestore,
  saveQuizAttemptToFirestore,
  saveSavedNoteToFirestore,
  saveStudyPlanToFirestore,
  saveSubmissionToFirestore,
  saveUserProfileToFirestore,
  upsertLearningProgress,
  writeAuditLogToFirestore,
} from './services/firestoreRepo';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from './data/curriculumSeed';
import {
  clearAllOfflineUserSnapshots,
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
import { buildNextRecurringTask, buildUserDataExportPayload, getDueReminderTasks } from './utils/plannerUtils';
import { getClassSpecificStudyPlanSeeds } from './utils/curriculumFilter';
import { ConnectivityPill, OfflineIndicator, PWAInstallButton } from './components/PWAStatusBar';
import { GuidedArrowsOverlay } from './components/GuidedArrowsOverlay';
import { LandingAuthView } from './components/LandingAuthView';
import { OnboardingModal } from './components/OnboardingModal';
import type { StudioTabId } from './components/LearningStudioView';

const StudentDashboard = lazy(() =>
  import('./components/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);
const AITeacherView = lazy(() =>
  import('./components/AITeacherView').then((m) => ({ default: m.AITeacherView }))
);
const VoiceAIView = lazy(() =>
  import('./components/VoiceAIView').then((m) => ({ default: m.VoiceAIView }))
);
const EducationHubView = lazy(() =>
  import('./components/EducationHubView').then((m) => ({ default: m.EducationHubView }))
);
const SmartPlannerView = lazy(() =>
  import('./components/SmartPlannerView').then((m) => ({ default: m.SmartPlannerView }))
);
const LearningStudioView = lazy(() =>
  import('./components/LearningStudioView').then((m) => ({ default: m.LearningStudioView }))
);
const LessonAcademyView = lazy(() =>
  import('./components/LessonAcademyView').then((m) => ({ default: m.LessonAcademyView }))
);
const VideoAcademyView = lazy(() =>
  import('./components/VideoAcademyView').then((m) => ({ default: m.VideoAcademyView }))
);
const ImageAcademyView = lazy(() =>
  import('./components/ImageAcademyView').then((m) => ({ default: m.ImageAcademyView }))
);
const AssessmentCenterView = lazy(() =>
  import('./components/AssessmentCenterView').then((m) => ({ default: m.AssessmentCenterView }))
);
const PerformanceCenterView = lazy(() =>
  import('./components/PerformanceCenterView').then((m) => ({ default: m.PerformanceCenterView }))
);
const AchievementsView = lazy(() =>
  import('./components/LearningToolsViews').then((m) => ({ default: m.AchievementsView }))
);
const AssignmentCenterView = lazy(() =>
  import('./components/LearningToolsViews').then((m) => ({ default: m.AssignmentCenterView }))
);
const ProfileSettingsView = lazy(() =>
  import('./components/LearningToolsViews').then((m) => ({ default: m.ProfileSettingsView }))
);
const RevisionCenterView = lazy(() =>
  import('./components/LearningToolsViews').then((m) => ({ default: m.RevisionCenterView }))
);
const AdminPanelView = lazy(() =>
  import('./components/RolePortalsView').then((m) => ({ default: m.AdminPanelView }))
);
const ParentPortalView = lazy(() =>
  import('./components/RolePortalsView').then((m) => ({ default: m.ParentPortalView }))
);
const GuidesView = lazy(() =>
  import('./components/GuidesView').then((m) => ({ default: m.GuidesView }))
);
const Viewer3DView = lazy(() =>
  import('./components/Viewer3DView').then((m) => ({ default: m.Viewer3DView }))
);

class ModuleErrorBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { resetKey: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unable to load this module.' };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Module render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="muse-card p-6 space-y-3 border border-rose-500/40">
          <div className="flex items-center gap-2 text-rose-400 font-display font-bold text-base">
            <AlertTriangle className="w-5 h-5" />
            <span>Something went wrong loading this section</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ModuleLoadingFallback: React.FC = () => (
  <div className="muse-card p-8 flex items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
    <span>Loading workspace module...</span>
  </div>
);

function mergeItemsById<T extends { id: string }>(cached: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of cached) map.set(item.id, item);
  for (const item of remote) map.set(item.id, item);
  return Array.from(map.values());
}

interface NavItem {
  id: AppModuleId;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'primary' | 'guides' | 'academies' | 'portals';
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
  { id: 'guides', label: 'All Guides & DIKSHA', shortLabel: 'Guides', icon: Globe, group: 'guides' },
  { id: 'lesson_academy', label: 'Learning Academy', icon: BookOpen, group: 'academies' },
  { id: 'video_academy', label: 'Video Academy', icon: Video, group: 'academies' },
  { id: 'image_academy', label: 'Image Academy', icon: ImageIcon, group: 'academies' },
  { id: 'viewer_3d', label: '3D Viewer', icon: Box, group: 'academies' },
  { id: 'daily_quiz', label: 'Daily Quiz', icon: ClipboardCheck, group: 'academies' },
  { id: 'weekly_tests', label: 'Weekly Tests', icon: Award, group: 'academies' },
  { id: 'practice_centre', label: 'Practice Centre', icon: Target, group: 'academies' },
  { id: 'assignment_centre', label: 'Assignment Centre', icon: FileText, group: 'academies' },
  { id: 'revision_centre', label: 'Revision Centre', icon: Layers, group: 'academies' },
  { id: 'achievements', label: 'Achievements', icon: Trophy, group: 'academies' },
  { id: 'parent_portal', label: 'Parent Portal', icon: Users, group: 'portals' },
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
  const [aiActiveDocId, setAiActiveDocId] = useState<string | null>(null);
  const [plannerTaskDraft, setPlannerTaskDraft] = useState<{ title: string; subject: string } | null>(null);
  const [videoInitialSubject, setVideoInitialSubject] = useState<string>('ALL');
  const [videoInitialSearch, setVideoInitialSearch] = useState<string>('');
  const [reminderToast, setReminderToast] = useState<{ id: string; title: string; message: string } | null>(null);
  const triggeredReminderIdsRef = React.useRef<Set<string>>(new Set());
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
  const [verificationNoticeMsg, setVerificationNoticeMsg] = useState<string | null>(null);
  const [refreshingVerification, setRefreshingVerification] = useState(false);
  const wasOfflineRef = React.useRef(!isOnline);

  const isFirebaseVerified =
    workspace.authMode === 'firebase' && Boolean(workspace.profile?.emailVerified || auth.currentUser?.emailVerified);

  // Global search filters
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchBoard, setSearchBoard] = useState('ALL');
  const [searchClass, setSearchClass] = useState('ALL');
  const [searchSubject, setSearchSubject] = useState('ALL');
  const [searchLanguage, setSearchLanguage] = useState('ALL');

  const hydrateFirebaseWorkspace = React.useCallback(async (fbUser: FirebaseUser) => {
    const cachedSnap = await readOfflineSnapshotFromCache(fbUser.uid);
    const isBootAdmin =
      fbUser.email?.toLowerCase() === 'venkatramveni@gmail.com' && fbUser.emailVerified;

    if (!fbUser.emailVerified) {
      const unverifiedProfile =
        cachedSnap?.profile ??
        createDefaultProfile({
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Student',
          email: fbUser.email || undefined,
          emailVerified: false,
          role: 'student',
          onboardingComplete: true,
        });
      const base = createInitialWorkspaceState('firebase');
      setWorkspace({
        ...base,
        authMode: 'firebase',
        profile: { ...unverifiedProfile, emailVerified: false },
        progress: cachedSnap?.progress ?? [],
        savedNotes: cachedSnap?.savedNotes?.length ? cachedSnap.savedNotes : base.savedNotes,
        offlineLessonIds: cachedSnap?.offlineLessonIds?.length ? cachedSnap.offlineLessonIds : base.offlineLessonIds,
        studyPlans: cachedSnap?.studyPlans?.length ? cachedSnap.studyPlans : base.studyPlans,
        attempts: cachedSnap?.attempts?.length ? cachedSnap.attempts : base.attempts,
      });
      setTheme(unverifiedProfile.theme);
      return;
    }

    let profile = navigator.onLine
      ? await fetchUserProfile(fbUser.uid).catch(() => null)
      : cachedSnap?.profile ?? null;

    if (!profile && cachedSnap?.profile) {
      profile = cachedSnap.profile;
    }

    if (!profile) {
      profile = createDefaultProfile({
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Student',
        email: fbUser.email || undefined,
        emailVerified: true,
        role: isBootAdmin ? 'admin' : 'student',
        onboardingComplete: false,
      });
      if (navigator.onLine) {
        await saveUserProfileToFirestore(profile, true).catch(() => {});
      }
    } else {
      profile = { ...profile, emailVerified: true };
    }

    const [
      remoteProgress,
      remoteAttempts,
      remotePlans,
      remoteConversations,
      remoteNotes,
      remoteNotifications,
      remoteSubmissions,
    ] = navigator.onLine
      ? await Promise.all([
          fetchUserProgress(fbUser.uid).catch(() => []),
          fetchQuizAttemptsFromFirestore(fbUser.uid).catch(() => []),
          fetchStudyPlansFromFirestore(fbUser.uid).catch(() => []),
          fetchConversationsFromFirestore(fbUser.uid).catch(() => []),
          fetchSavedNotesFromFirestore(fbUser.uid).catch(() => []),
          fetchNotificationsFromFirestore(fbUser.uid).catch(() => []),
          fetchSubmissionsFromFirestore(fbUser.uid, profile.role).catch(() => []),
        ])
      : [[], [], [], [], [], [], []];

    const mergedProgressAndNotes = mergeOfflineProgressAndNotes({
      baseProgress: remoteProgress,
      cachedProgress: cachedSnap?.progress ?? [],
      baseNotes: remoteNotes,
      cachedNotes: cachedSnap?.savedNotes ?? [],
    });

    const mergedPlans = mergeItemsById(cachedSnap?.studyPlans ?? [], remotePlans);
    const mergedAttempts = mergeItemsById(cachedSnap?.attempts ?? [], remoteAttempts).sort(
      (a, b) => (Date.parse(a.submittedAt) || 0) - (Date.parse(b.submittedAt) || 0)
    );

    const base = createInitialWorkspaceState('firebase');
    setWorkspace({
      ...base,
      authMode: 'firebase',
      profile,
      progress: mergedProgressAndNotes.progress,
      savedNotes:
        mergedProgressAndNotes.savedNotes.length > 0
          ? mergedProgressAndNotes.savedNotes
          : base.savedNotes,
      offlineLessonIds:
        cachedSnap?.offlineLessonIds && cachedSnap.offlineLessonIds.length > 0
          ? cachedSnap.offlineLessonIds
          : base.offlineLessonIds,
      studyPlans: mergedPlans.length > 0 ? mergedPlans : base.studyPlans,
      attempts: mergedAttempts.length > 0 ? mergedAttempts : base.attempts,
      conversations: remoteConversations.length > 0 ? remoteConversations : base.conversations,
      notifications: remoteNotifications.length > 0 ? remoteNotifications : base.notifications,
      submissions: remoteSubmissions,
    });
    setTheme(profile.theme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Real study-task reminder scheduler (checks every 30s)
  useEffect(() => {
    if (!workspace.profile) return;
    const runCheck = () => {
      const due = getDueReminderTasks(
        workspace.studyPlans,
        new Date(),
        triggeredReminderIdsRef.current
      );
      if (due.length === 0) return;
      const nowIso = new Date().toISOString();
      due.forEach((t) => {
        triggeredReminderIdsRef.current.add(t.id);
        const title = `Study Reminder: ${t.title}`;
        const message = `${t.subject} scheduled for ${t.scheduledTime || 'today'}.`;
        const newNotif: NotificationItem = {
          id: `notif_rem_${t.id}_${Date.now()}`,
          uid: workspace.profile?.uid || 'student',
          title,
          message,
          category: 'study',
          read: false,
          createdAt: nowIso,
        };
        setReminderToast({ id: t.id, title, message });
        setWorkspace((w) => ({
          ...w,
          notifications: [newNotif, ...w.notifications].slice(0, 30),
        }));
        if (isFirebaseVerified) {
          saveNotificationToFirestore(newNotif).catch(console.error);
        }
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, { body: message });
          } catch {
            // Ignore browser Notification constructor restrictions
          }
        }
      });
    };
    runCheck();
    const timer = window.setInterval(runCheck, 30_000);
    return () => clearInterval(timer);
  }, [workspace.profile, workspace.studyPlans, isFirebaseVerified]);

  // Register Service Worker (never auto-hydrate anonymous visitors into cached user snapshots)
  useEffect(() => {
    initServiceWorkerRegistration((registered) => {
      setSwReady(registered);
    });
  }, []);

  // Mandatory Firebase boot connection check
  useEffect(() => {
    if (navigator.onLine) {
      testFirestoreConnection().then((res) => {
        if (!res.ok && res.message) {
          console.warn('Firestore startup check:', res.message);
        }
      });
    }
  }, []);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        await hydrateFirebaseWorkspace(fbUser);
      } catch (err) {
        console.error('Firebase hydration warning:', err);
      }
    });
    return () => unsub();
  }, [hydrateFirebaseWorkspace]);

  // Persist demo workspace locally AND mirror essential My Lessons, Saved Notes & progress to SW Cache Storage for signed-in users
  useEffect(() => {
    if (workspace.authMode === 'demo') {
      saveWorkspaceToStorage(workspace);
    }
    if (
      workspace.profile &&
      workspace.profile.uid &&
      workspace.profile.uid !== 'demo_guest' &&
      (workspace.authMode !== 'firebase' || isFirebaseVerified)
    ) {
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
  }, [workspace, isFirebaseVerified]);

  // Reconnect sync: flush cached progress, study plans & notes when coming back online
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      prefetchEssentialCurriculum().catch(() => {});
      if (isFirebaseVerified && workspace.profile) {
        const uid = workspace.profile.uid;
        Promise.all([
          ...workspace.progress.map((p) => upsertLearningProgress(uid, p).catch(() => {})),
          ...workspace.studyPlans.map((t) => saveStudyPlanToFirestore(t, false).catch(() => {})),
          ...workspace.savedNotes.map((n) => saveSavedNoteToFirestore(uid, n).catch(() => {})),
        ]).catch(() => {});
      }
      setJustReconnected(true);
      const timer = window.setTimeout(() => setJustReconnected(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isFirebaseVerified, workspace.profile, workspace.progress, workspace.studyPlans, workspace.savedNotes]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (workspace.profile) {
      const updated = { ...workspace.profile, theme: next, updatedAt: new Date().toISOString() };
      setWorkspace((w) => ({ ...w, profile: updated }));
      if (isFirebaseVerified) {
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
      const signUpRes = await signUpWithEmail(email, password, displayName);
      if (signUpRes.verificationSent) {
        setAuthSuccess('Account created! A verification email was sent to your inbox. Open the link inside to enable cloud sync.');
      } else {
        setAuthError(
          signUpRes.verificationError ||
            'Account created, but verification email could not be sent. Use Resend Verification after signing in.'
        );
      }
    } catch (err: unknown) {
      setAuthError(formatAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (!auth.currentUser) return;
    setRefreshingVerification(true);
    setVerificationNoticeMsg(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      if (auth.currentUser.emailVerified) {
        await hydrateFirebaseWorkspace(auth.currentUser);
        setVerificationNoticeMsg(null);
      } else {
        setVerificationNoticeMsg('Your email is still unverified. Click the link in your inbox, then press Refresh again.');
      }
    } catch (err: unknown) {
      setVerificationNoticeMsg(err instanceof Error ? err.message : 'Unable to refresh verification status right now.');
    } finally {
      setRefreshingVerification(false);
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
    const uid = workspace.profile?.uid;
    if (workspace.authMode === 'firebase') {
      await signOutFirebase().catch(() => {});
    }
    if (uid) {
      await clearOfflineCacheForUser(uid);
    }
    await clearAllOfflineUserSnapshots();
    clearWorkspaceStorage();
    setWorkspace(createInitialWorkspaceState('unauthenticated'));
    setActiveModule('dashboard');
  };

  const handleCompleteOnboarding = async (updatedProfile: UserProfile) => {
    setWorkspace((w) => {
      const classChanged = Boolean(w.profile && updatedProfile.classLevel !== w.profile.classLevel);
      let nextStudyPlans = w.studyPlans;
      if (classChanged) {
        const nowIso = new Date().toISOString();
        const todayStr = nowIso.slice(0, 10);
        const customOrDone = w.studyPlans.filter(
          (t) => !(t.id.startsWith('plan_seed_') && !t.completed)
        );
        const newSeeds = getClassSpecificStudyPlanSeeds(
          updatedProfile.uid,
          updatedProfile.classLevel,
          todayStr,
          nowIso
        );
        nextStudyPlans = [...newSeeds, ...customOrDone];
      }
      return {
        ...w,
        profile: updatedProfile,
        studyPlans: nextStudyPlans,
      };
    });
    if (isFirebaseVerified) {
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

    const completedNotif: NotificationItem | null = nextItem.completed
      ? {
          id: `notif_${Date.now()}`,
          uid: workspace.profile.uid,
          title: 'Lesson Completed',
          message: `Great work finishing "${lesson.title}"!`,
          category: 'milestone',
          read: false,
          createdAt: now,
        }
      : null;

    setWorkspace((w) => {
      const rest = w.progress.filter((p) => p.lessonId !== lesson.id);
      const nextNotifs = completedNotif ? [completedNotif, ...w.notifications] : w.notifications;
      return { ...w, progress: [...rest, nextItem], notifications: nextNotifs };
    });

    if (isFirebaseVerified) {
      upsertLearningProgress(workspace.profile.uid, nextItem).catch(console.error);
      if (completedNotif) {
        saveNotificationToFirestore(completedNotif).catch(console.error);
      }
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
    if (isFirebaseVerified) {
      upsertLearningProgress(workspace.profile.uid, nextItem).catch(console.error);
    }
  };

  const handleRecordAttempt = (attempt: QuizAttempt) => {
    setWorkspace((w) => ({
      ...w,
      attempts: [...w.attempts, attempt],
    }));
    if (isFirebaseVerified) {
      saveQuizAttemptToFirestore(attempt).catch(console.error);
    }
  };

  const handleAddStudyTask = (task: StudyPlanTask) => {
    setWorkspace((w) => ({ ...w, studyPlans: [task, ...w.studyPlans] }));
    if (isFirebaseVerified) {
      saveStudyPlanToFirestore(task, true).catch(console.error);
    }
  };

  const handleUpdateStudyTask = (updated: StudyPlanTask) => {
    setWorkspace((w) => ({
      ...w,
      studyPlans: w.studyPlans.map((t) => (t.id === updated.id ? updated : t)),
    }));
    if (isFirebaseVerified) {
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
    if (isFirebaseVerified && target) {
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
    if (isFirebaseVerified) {
      deleteStudyPlanFromFirestore(id).catch(console.error);
    }
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

  const handleAddGuideLink = (link: SavedGuideLink) => {
    setWorkspace((w) => ({
      ...w,
      savedGuideLinks: [link, ...w.savedGuideLinks.filter((item) => item.url !== link.url)],
    }));
  };

  const handleDeleteGuideLink = (id: string) => {
    setWorkspace((w) => ({
      ...w,
      savedGuideLinks: w.savedGuideLinks.filter((item) => item.id !== id),
    }));
  };

  const handleExportUserData = () => {
    const payload = buildUserDataExportPayload(workspace);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nano_ai_data_${workspace.profile?.uid || 'export'}.json`;
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

    if (isFirebaseVerified && thread.messages.length > 0) {
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
    if (isFirebaseVerified) {
      deleteConversationFromFirestore(threadId).catch(console.error);
    }
  };

  const handleSaveNote = (note: SavedNote) => {
    setWorkspace((w) => ({ ...w, savedNotes: [note, ...w.savedNotes] }));
    if (isFirebaseVerified && workspace.profile) {
      saveSavedNoteToFirestore(workspace.profile.uid, note).catch(console.error);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setWorkspace((w) => ({
      ...w,
      savedNotes: w.savedNotes.filter((n) => n.id !== noteId),
    }));
    if (isFirebaseVerified) {
      deleteSavedNoteFromFirestore(noteId).catch(console.error);
    }
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
    if (isFirebaseVerified) {
      saveSubmissionToFirestore(sub).catch(console.error);
    }
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
      if (auth.currentUser?.emailVerified) {
        await deleteUserAccountFromFirestore(workspace.profile.uid);
      }
      await deleteCurrentFirebaseUser();
    }
    if (uid) {
      await clearOfflineCacheForUser(uid);
    }
    await clearAllOfflineUserSnapshots();
    clearWorkspaceStorage();
    setWorkspace(createInitialWorkspaceState('unauthenticated'));
    setActiveModule('dashboard');
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
    if (item.group === 'primary' || item.group === 'guides' || item.group === 'academies') return true;
    // In Demo mode, all portals are inspectable for testing; in Firebase mode, enforce role strictly!
    if (workspace.authMode === 'demo') return true;
    if (item.id === 'parent_portal') return profile.role === 'parent' || profile.role === 'admin';
    if (item.id === 'admin_panel') return profile.role === 'admin';
    return false;
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row nano-app-canvas text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:h-screen lg:sticky lg:top-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md shrink-0 no-print">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl muse-btn-primary flex items-center justify-center font-display font-bold shrink-0">
            N
          </div>
          <div>
            <div className="font-display font-bold text-base leading-tight">Nano AI</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Class {profile.classLevel} • {workspace.authMode === 'firebase' ? 'Cloud Synced' : 'Demo Workspace'}
            </div>
          </div>
        </div>

        <nav aria-label="Primary Sidebar Navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Nano AI Workspace
          </div>
          {allowedNavItems
            .filter((i) => i.group === 'primary')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                  activeModule === item.id
                    ? 'bg-[var(--bg-subtle)] text-blue-400 font-semibold border border-blue-500/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

          <div className="px-2.5 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            Guides
          </div>
          {allowedNavItems
            .filter((i) => i.group === 'guides')
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                  activeModule === item.id
                    ? 'bg-[var(--bg-subtle)] text-cyan-300 font-semibold border border-cyan-500/40'
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
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
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
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition whitespace-nowrap shrink-0 ${
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-rose-500/40 whitespace-nowrap"
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
              <span className="font-display font-bold text-base">Nano AI Navigation</span>
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                    activeModule === item.id
                      ? 'bg-[var(--bg-subtle)] text-blue-400 font-semibold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
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
        <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/92 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-3 no-print">
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
                      onClick={() => {
                        const unreadIds = workspace.notifications.filter((n) => !n.read).map((n) => n.id);
                        setWorkspace((w) => ({
                          ...w,
                          notifications: w.notifications.map((n) => ({ ...n, read: true })),
                        }));
                        if (isFirebaseVerified && unreadIds.length > 0) {
                          markNotificationsReadInFirestore(unreadIds).catch(console.error);
                        }
                      }}
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
          {workspace.authMode === 'firebase' && !isFirebaseVerified && (
            <div
              role="status"
              className="mb-4 muse-card p-4 border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3 text-xs no-print"
            >
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">
                    Verify your email to enable cloud sync ({profile.email || 'Account'})
                  </div>
                  <div className="text-[var(--text-muted)] mt-0.5">
                    {verificationNoticeMsg ||
                      'Check your inbox for the verification link, then click Refresh Status to unlock persistent cloud saving.'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail().catch(() => {});
                    setVerificationNoticeMsg('Verification email sent. Please check your inbox and spam folder.');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-semibold"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={refreshingVerification}
                  onClick={handleRefreshVerificationStatus}
                  className="px-3 py-1.5 rounded-xl muse-btn-primary font-semibold disabled:opacity-50"
                >
                  {refreshingVerification ? 'Checking...' : "I've Verified — Refresh"}
                </button>
              </div>
            </div>
          )}

          <ModuleErrorBoundary resetKey={activeModule}>
            <Suspense fallback={<ModuleLoadingFallback />}>
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
              uploadedDocs={workspace.uploadedDocs}
              activeDocId={aiActiveDocId}
              onSelectActiveDoc={setAiActiveDocId}
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
              onSaveVoicePreference={(voiceAutoSpeak, speechRate, voicePreset, speechPitch) =>
                handleCompleteOnboarding({
                  ...profile,
                  voiceAutoSpeak,
                  speechRate,
                  ...(voicePreset ? { voicePreset } : {}),
                  ...(typeof speechPitch === 'number' ? { speechPitch } : {}),
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
              lessons={workspace.lessons}
              progress={workspace.progress}
              attempts={workspace.attempts}
              questions={workspace.questions}
              initialTaskDraft={plannerTaskDraft}
              onConsumeTaskDraft={() => setPlannerTaskDraft(null)}
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
              onAskDocFollowUp={(docItem, subject) => {
                setAiActiveDocId(docItem.id);
                if (subject) setAiContextSubject(subject);
                handleNavigate('ai_teacher');
              }}
              onScheduleLesson={(lesson) => {
                setPlannerTaskDraft({
                  title: `Study lesson: ${lesson.title}`,
                  subject: lesson.subject,
                });
                handleNavigate('study_planner');
              }}
              onFindVideos={(lesson) => {
                setVideoInitialSubject(lesson.subject);
                setVideoInitialSearch(lesson.chapter);
                handleNavigate('video_academy');
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
              onScheduleLesson={(lesson) => {
                setPlannerTaskDraft({
                  title: `Study lesson: ${lesson.title}`,
                  subject: lesson.subject,
                });
                handleNavigate('study_planner');
              }}
              onFindVideos={(lesson) => {
                setVideoInitialSubject(lesson.subject);
                setVideoInitialSearch(lesson.chapter);
                handleNavigate('video_academy');
              }}
            />
          )}

          {activeModule === 'video_academy' && (
            <VideoAcademyView
              profile={profile}
              videos={workspace.videos}
              watchedIds={workspace.watchedVideoIds}
              bookmarkedIds={workspace.bookmarkedVideoIds}
              initialSubject={videoInitialSubject}
              initialSearch={videoInitialSearch}
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
              onAskDocFollowUp={(docItem, subject) => {
                setAiActiveDocId(docItem.id);
                if (subject) setAiContextSubject(subject);
                handleNavigate('ai_teacher');
              }}
            />
          )}

          {activeModule === 'guides' && (
            <GuidesView
              profile={profile}
              savedGuideLinks={workspace.savedGuideLinks}
              onAddGuideLink={handleAddGuideLink}
              onDeleteGuideLink={handleDeleteGuideLink}
              onSaveNote={handleSaveNote}
              onAskAITeacher={(subject?: string, prompt?: string) => {
                if (subject) setAiContextSubject(subject);
                if (prompt) setAiInitialPrompt(prompt);
                handleNavigate('ai_teacher');
              }}
            />
          )}

          {activeModule === 'viewer_3d' && (
            <Viewer3DView
              profile={profile}
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
            </Suspense>
          </ModuleErrorBoundary>
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

      {reminderToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 lg:bottom-5 right-4 z-50 max-w-sm muse-card p-4 border-blue-500/50 shadow-xl flex items-start gap-3 no-print"
        >
          <Bell className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold text-[var(--text-primary)]">{reminderToast.title}</div>
            <div className="text-[var(--text-muted)] mt-0.5">{reminderToast.message}</div>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder alert"
            onClick={() => setReminderToast(null)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
