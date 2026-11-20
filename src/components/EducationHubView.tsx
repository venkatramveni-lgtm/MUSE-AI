import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Flag,
  Globe,
  GraduationCap,
  History,
  Layers,
  ListVideo,
  Play,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Tv,
  Video,
} from 'lucide-react';
import {
  ALL_CLASS_LEVELS,
  INDIAN_BOARDS,
  INDIAN_LANGUAGES,
  OFFICIAL_EDUCATION_PORTALS,
  getChaptersForSelection,
  getSubjectsForBoardAndClass,
  type BoardDefinition,
  type LanguageDefinition,
  type SubjectDescriptor,
} from '../data/educationRegistry';
import { auth, authFetch } from '../services/firebaseClient';
import type {
  ApprovedChannelEntry,
  EducationPlaylistItem,
  EducationRelevanceLabel,
  EducationVideoItem,
  OfficialResourceLink,
  SavedNote,
  UserProfile,
} from '../types/muse';

interface EducationHubViewProps {
  profile: UserProfile;
  onSaveNote?: (note: SavedNote) => void;
  onAskAITeacher?: (subject?: string, prompt?: string) => void;
  onSyncProfilePrefs?: (board: string, classLevel: number, language: string) => void;
}

type HubInnerTab = 'videos' | 'playlists' | 'official' | 'saved';

interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizGradeResult {
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
}

interface WatchHistoryEntry {
  video: EducationVideoItem;
  progressPercent: number;
  watchedAt: string;
}

const AI_TUTOR_ACTIONS: Array<{ id: string; label: string }> = [
  { id: 'explain_chapter', label: 'Explain this chapter' },
  { id: 'simple_english', label: 'Simple English' },
  { id: 'hindi_explain', label: 'Explain in Hindi' },
  { id: 'telugu_explain', label: 'Explain in Telugu' },
  { id: 'important_points', label: 'Important points' },
  { id: 'revision_notes', label: 'Revision notes' },
  { id: 'examples', label: 'Real-life examples' },
  { id: 'difficult_words', label: 'Difficult words' },
  { id: 'mind_map', label: 'Mind map' },
  { id: 'practice_questions', label: 'Practice questions' },
  { id: 'study_plan', label: '3-Day study plan' },
  { id: 'test_understanding', label: 'Test my understanding' },
];

export const EducationHubView: React.FC<EducationHubViewProps> = ({
  profile,
  onSaveNote,
  onAskAITeacher,
  onSyncProfilePrefs,
}) => {
  const [selectedBoard, setSelectedBoard] = useState<string>(profile.board || 'CBSE');
  const [selectedClass, setSelectedClass] = useState<number>(
    Math.min(12, Math.max(1, profile.classLevel || 7))
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    profile.preferredLanguage || 'English'
  );

  const [boards, setBoards] = useState<BoardDefinition[]>(INDIAN_BOARDS);
  const [languages, setLanguages] = useState<LanguageDefinition[]>(INDIAN_LANGUAGES);
  const [subjects, setSubjects] = useState<SubjectDescriptor[]>(() =>
    getSubjectsForBoardAndClass(profile.board || 'CBSE', profile.classLevel || 7)
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(
    () =>
      getSubjectsForBoardAndClass(profile.board || 'CBSE', profile.classLevel || 7)[0]?.name ||
      'Science'
  );
  const [chapters, setChapters] = useState<string[]>(() =>
    getChaptersForSelection(profile.board || 'CBSE', profile.classLevel || 7, 'Science')
  );
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');

  const [innerTab, setInnerTab] = useState<HubInnerTab>('videos');
  const [relevanceFilter, setRelevanceFilter] = useState<
    'ALL' | EducationRelevanceLabel | 'Official'
  >('ALL');

  // Video & Playlist state
  const [videos, setVideos] = useState<EducationVideoItem[]>([]);
  const [playlists, setPlaylists] = useState<EducationPlaylistItem[]>([]);
  const [officialPortals, setOfficialPortals] = useState<OfficialResourceLink[]>(
    OFFICIAL_EDUCATION_PORTALS
  );
  const [approvedChannels, setApprovedChannels] = useState<ApprovedChannelEntry[]>([]);
  const [ytConfigured, setYtConfigured] = useState<boolean>(true);
  const [ytSearchUrl, setYtSearchUrl] = useState<string>('');
  const [ytPlaylistUrl, setYtPlaylistUrl] = useState<string>('');
  const [builtQuery, setBuiltQuery] = useState<string>('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [quotaUsed, setQuotaUsed] = useState<number>(0);
  const [videosLoading, setVideosLoading] = useState<boolean>(false);
  const [playlistsLoading, setPlaylistsLoading] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Player + Bookmarks + History + Report state
  const [selectedVideo, setSelectedVideo] = useState<EducationVideoItem | null>(null);
  const [studyWorkspaceOpen, setStudyWorkspaceOpen] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<EducationVideoItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [reportOpen, setReportOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>(
    'Off-syllabus or low educational quality'
  );
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Ask Muse AI Video Tutor & Quiz state
  const [tutorTab, setTutorTab] = useState<'explain' | 'quiz'>('explain');
  const [tutorLoading, setTutorLoading] = useState<boolean>(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState<string>('');
  const [tutorResponse, setTutorResponse] = useState<{
    explanation: string;
    keyPoints: string[];
    followUpQuestions: string[];
    basedOnTranscript: boolean;
  } | null>(null);
  const [noteSavedToast, setNoteSavedToast] = useState<boolean>(false);

  const [quizLoading, setQuizLoading] = useState<boolean>(false);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizGradeResult | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Hydrate dynamic board & language lists once
  useEffect(() => {
    let active = true;
    const isAuthed = Boolean(auth.currentUser);
    Promise.all([
      fetch('/api/education/boards').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/education/languages').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      isAuthed
        ? authFetch('/api/education/bookmarks')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
      isAuthed
        ? authFetch('/api/education/watch-history')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]).then(([bData, lData, bmData, whData]) => {
      if (!active) return;
      if (bData?.boards && Array.isArray(bData.boards)) setBoards(bData.boards);
      if (lData?.languages && Array.isArray(lData.languages)) setLanguages(lData.languages);
      if (bmData?.bookmarks && Array.isArray(bmData.bookmarks)) setBookmarks(bmData.bookmarks);
      if (whData?.history && Array.isArray(whData.history)) setWatchHistory(whData.history);
    });
    return () => {
      active = false;
    };
  }, [profile.uid]);

  // Reload subjects whenever Board or Class (1-12) changes
  useEffect(() => {
    const localSubjects = getSubjectsForBoardAndClass(selectedBoard, selectedClass);
    setSubjects(localSubjects);
    setSelectedSubject((prev) =>
      localSubjects.some((s) => s.name === prev) ? prev : localSubjects[0]?.name || 'Science'
    );

    let active = true;
    fetch(
      `/api/education/subjects?board=${encodeURIComponent(selectedBoard)}&classLevel=${selectedClass}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.subjects) || data.subjects.length === 0) return;
        setSubjects(data.subjects);
        setSelectedSubject((prev) =>
          data.subjects.some((s: SubjectDescriptor) => s.name === prev)
            ? prev
            : data.subjects[0].name
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedBoard, selectedClass]);

  // Reload suggested chapters whenever Board, Class, or Subject changes
  useEffect(() => {
    const localCh = getChaptersForSelection(selectedBoard, selectedClass, selectedSubject);
    setChapters(localCh);
    setSelectedChapter('');

    let active = true;
    fetch(
      `/api/education/chapters?board=${encodeURIComponent(selectedBoard)}&classLevel=${selectedClass}&subject=${encodeURIComponent(selectedSubject)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.chapters)) return;
        setChapters(data.chapters);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedBoard, selectedClass, selectedSubject]);

  // Reload Official Government Portals & Approved Channels when Board changes
  useEffect(() => {
    let active = true;
    fetch(`/api/education/official-resources?board=${encodeURIComponent(selectedBoard)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.officialPortals)) setOfficialPortals(data.officialPortals);
        if (Array.isArray(data.approvedChannels)) setApprovedChannels(data.approvedChannels);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedBoard]);

  const fetchVideos = useCallback(
    async (pageToken?: string) => {
      setVideosLoading(true);
      setVideoError(null);
      try {
        const params = new URLSearchParams({
          board: selectedBoard,
          classLevel: String(selectedClass),
          subject: selectedSubject,
          language: selectedLanguage,
        });
        if (selectedChapter) params.set('chapter', selectedChapter);
        if (activeQuery) params.set('q', activeQuery);
        if (pageToken) params.set('pageToken', pageToken);

        const resp = await fetch(`/api/education/videos?${params.toString()}`);
        const data = await resp.json();

        setYtConfigured(data.configured !== false);
        setBuiltQuery(data.searchQuery || `${selectedBoard} Class ${selectedClass} ${selectedSubject}`);
        setYtSearchUrl(
          data.youtubeSearchUrl ||
            `https://www.youtube.com/results?search_query=${encodeURIComponent(
              `${selectedBoard} Class ${selectedClass} ${selectedSubject} ${selectedChapter}`
            )}`
        );
        if (typeof data.quotaUsedToday === 'number') setQuotaUsed(data.quotaUsedToday);
        setNextPageToken(data.nextPageToken);

        const incoming: EducationVideoItem[] = Array.isArray(data.videos) ? data.videos : [];
        if (pageToken) {
          setVideos((prev) => {
            const seen = new Set(prev.map((v) => v.videoId));
            return [...prev, ...incoming.filter((v) => !seen.has(v.videoId))];
          });
        } else {
          setVideos(incoming);
        }

        if (!resp.ok && data.error) {
          setVideoError(data.error);
        } else if (data.configured !== false && data.warning) {
          setVideoError(data.warning);
        }
      } catch (err: unknown) {
        setVideoError(err instanceof Error ? err.message : 'Unable to reach Education Hub server.');
      } finally {
        setVideosLoading(false);
      }
    },
    [selectedBoard, selectedClass, selectedSubject, selectedLanguage, selectedChapter, activeQuery]
  );

  const fetchPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    try {
      const params = new URLSearchParams({
        board: selectedBoard,
        classLevel: String(selectedClass),
        subject: selectedSubject,
        language: selectedLanguage,
      });
      const resp = await fetch(`/api/education/playlists?${params.toString()}`);
      const data = await resp.json();
      if (data.youtubePlaylistSearchUrl) setYtPlaylistUrl(data.youtubePlaylistSearchUrl);
      if (Array.isArray(data.playlists)) setPlaylists(data.playlists);
    } catch {
      // keep existing playlists state
    } finally {
      setPlaylistsLoading(false);
    }
  }, [selectedBoard, selectedClass, selectedSubject, selectedLanguage]);

  useEffect(() => {
    fetchVideos();
    fetchPlaylists();
  }, [fetchVideos, fetchPlaylists]);

  const filteredVideos = useMemo(() => {
    if (relevanceFilter === 'ALL') return videos;
    if (relevanceFilter === 'Official') {
      return videos.filter((v) => v.isApprovedChannel || v.sourceType === 'admin_curated');
    }
    return videos.filter((v) => v.relevanceLabel === relevanceFilter);
  }, [videos, relevanceFilter]);

  const activeStage = useMemo(
    () => ALL_CLASS_LEVELS.find((c) => c.classLevel === selectedClass) || ALL_CLASS_LEVELS[6],
    [selectedClass]
  );

  const groupedBoards = useMemo(() => {
    return {
      National: boards.filter((b) => b.category === 'National'),
      Senior: boards.filter((b) => b.category === 'Senior Secondary'),
      Open: boards.filter((b) => b.category === 'Open'),
      State: boards.filter((b) => b.category === 'State'),
    };
  }, [boards]);

  const isBookmarked = useCallback(
    (videoId: string) => bookmarks.some((b) => b.videoId === videoId),
    [bookmarks]
  );

  const handleToggleBookmark = async (video: EducationVideoItem) => {
    if (!auth.currentUser) {
      const exists = bookmarks.some((v) => v.videoId === video.videoId);
      setBookmarks((prev) =>
        exists ? prev.filter((v) => v.videoId !== video.videoId) : [video, ...prev]
      );
      setStatusToast(exists ? 'Removed from Bookmarks' : 'Saved to Bookmarks');
      setTimeout(() => setStatusToast(null), 2200);
      return;
    }
    try {
      const resp = await authFetch('/api/education/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.bookmarks)) setBookmarks(data.bookmarks);
      setStatusToast(data.bookmarked ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
      setTimeout(() => setStatusToast(null), 2200);
    } catch {
      // ignore transient network failure
    }
  };

  const handleSelectVideo = async (video: EducationVideoItem) => {
    setSelectedVideo(video);
    setStudyWorkspaceOpen(true);
    setTutorResponse(null);
    setTutorError(null);
    setQuizSessionId(null);
    setQuizQuestions([]);
    setQuizResult(null);
    setReportOpen(false);
    setReportFeedback(null);

    if (!auth.currentUser) return;
    try {
      const resp = await authFetch('/api/education/watch-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video, progressPercent: 25 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.history)) setWatchHistory(data.history);
      }
    } catch {
      // non-blocking
    }
  };

  const handleMarkWatched = async (video: EducationVideoItem) => {
    if (!auth.currentUser) {
      setStatusToast('Sign in with a verified account to sync Watch History across devices.');
      setTimeout(() => setStatusToast(null), 2400);
      return;
    }
    try {
      const resp = await authFetch('/api/education/watch-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video, progressPercent: 100 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.history)) setWatchHistory(data.history);
        setStatusToast('Marked 100% watched in Study History');
        setTimeout(() => setStatusToast(null), 2200);
      }
    } catch {
      // non-blocking
    }
  };

  const handleNavigateAdjacentVideo = (delta: number) => {
    if (!selectedVideo || filteredVideos.length === 0) return;
    const idx = filteredVideos.findIndex((v) => v.videoId === selectedVideo.videoId);
    if (idx === -1) return;
    const nextIdx = (idx + delta + filteredVideos.length) % filteredVideos.length;
    handleSelectVideo(filteredVideos[nextIdx]);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo) return;
    try {
      const resp = await authFetch('/api/education/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedVideo.videoId,
          videoTitle: selectedVideo.title,
          reason: reportReason.trim() || 'Inappropriate or off-syllabus content',
        }),
      });
      if (resp.ok) {
        setReportFeedback('Report submitted to Admin Moderation Queue. Thank you for keeping Muse safe.');
        setReportOpen(false);
      } else {
        const data = await resp.json().catch(() => ({}));
        setReportFeedback(data.error || 'Please sign in to submit content reports.');
      }
    } catch {
      setReportFeedback('Could not submit report right now.');
    }
  };

  const handleAskTutor = async (action: string, customQ?: string) => {
    setTutorTab('explain');
    setStudyWorkspaceOpen(true);
    setTutorLoading(true);
    setTutorError(null);

    try {
      const resp = await authFetch('/api/education/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle:
            selectedVideo?.title ||
            selectedChapter ||
            activeQuery ||
            `${selectedBoard} Class ${selectedClass} ${selectedSubject}`,
          videoDescription: selectedVideo?.description || '',
          board: selectedBoard,
          classLevel: selectedClass,
          subject: selectedSubject,
          chapter: selectedChapter || selectedVideo?.chapter || '',
          language: selectedLanguage,
          action,
          question: customQ || tutorQuestion,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setTutorError(data.error || 'AI Tutor is unavailable right now.');
        return;
      }
      setTutorResponse({
        explanation: data.explanation || '',
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [],
        basedOnTranscript: Boolean(data.basedOnTranscript),
      });
      if (action === 'custom') setTutorQuestion('');
    } catch (err: unknown) {
      setTutorError(err instanceof Error ? err.message : 'Network error contacting AI Tutor.');
    } finally {
      setTutorLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setTutorTab('quiz');
    setStudyWorkspaceOpen(true);
    setQuizLoading(true);
    setQuizError(null);
    setQuizResult(null);
    setQuizSessionId(null);
    setQuizAnswers({});

    try {
      const topic =
        selectedVideo?.title ||
        selectedChapter ||
        activeQuery ||
        `${selectedSubject} Class ${selectedClass}`;
      const resp = await authFetch('/api/education/quiz-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          board: selectedBoard,
          classLevel: selectedClass,
          subject: selectedSubject,
          language: selectedLanguage,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setQuizError(data.error || 'Could not generate practice quiz.');
        return;
      }
      setQuizSessionId(typeof data.quizSessionId === 'string' ? data.quizSessionId : null);
      setQuizQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (err: unknown) {
      setQuizError(err instanceof Error ? err.message : 'Network error generating quiz.');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (quizQuestions.length === 0 || !quizSessionId) return;
    try {
      const resp = await authFetch('/api/education/quiz-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizSessionId,
          answers: quizAnswers,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setQuizResult(data);
      } else {
        setQuizError(data.error || 'Failed to submit quiz answers.');
      }
    } catch {
      setQuizError('Failed to submit quiz answers.');
    }
  };

  const handleSaveTutorToNotes = () => {
    if (!tutorResponse || !onSaveNote) return;
    const titleBase =
      selectedVideo?.title ||
      selectedChapter ||
      `${selectedBoard} Class ${selectedClass} ${selectedSubject}`;
    onSaveNote({
      id: `note_edhub_${Date.now()}`,
      subject: selectedSubject,
      title: `Education Hub: ${titleBase.slice(0, 80)}`,
      content: [
        tutorResponse.explanation,
        tutorResponse.keyPoints.length > 0
          ? `\nKey Points:\n• ${tutorResponse.keyPoints.join('\n• ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      updatedAt: new Date().toISOString(),
    });
    setNoteSavedToast(true);
    setTimeout(() => setNoteSavedToast(false), 2400);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
    setInnerTab('videos');
  };

  const matchesProfile =
    selectedBoard === profile.board &&
    selectedClass === profile.classLevel &&
    selectedLanguage === profile.preferredLanguage;

  return (
    <div className="space-y-6">
      {/* Header Hero & Profile Curriculum Alignment */}
      <section className="muse-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              <span>MUSE AI · Universal Indian Education Hub</span>
            </div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-primary)]">
              Classes 1–12 · All 28 Boards · 23 Indian Languages
            </h1>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
              Select any Class stage, State or National Board, Subject, and Indian Language to discover curriculum-aligned YouTube video lessons, official NCERT/DIKSHA portals, and an interactive Ask-Muse AI Tutor &amp; Quiz companion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!matchesProfile && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBoard(profile.board || 'CBSE');
                    setSelectedClass(Math.min(12, Math.max(1, profile.classLevel || 7)));
                    setSelectedLanguage(profile.preferredLanguage || 'English');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40"
                >
                  Reset to My Profile ({profile.board} · Cl {profile.classLevel})
                </button>
                {onSyncProfilePrefs && (
                  <button
                    type="button"
                    onClick={() => onSyncProfilePrefs(selectedBoard, selectedClass, selectedLanguage)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
                  >
                    Save Selection to Profile
                  </button>
                )}
              </>
            )}
            {statusToast && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
                {statusToast}
              </span>
            )}
          </div>
        </div>

        {/* 1. Class 1–12 Stage Selector */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              1. Select Class (1–12)
            </span>
            <span className="text-blue-400 font-semibold">
              {activeStage.label} ({activeStage.stage}) · {activeStage.focus}
            </span>
          </div>
          <div
            role="group"
            aria-label="Select Class Level 1 to 12"
            className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5"
          >
            {ALL_CLASS_LEVELS.map((cls) => {
              const active = cls.classLevel === selectedClass;
              return (
                <button
                  key={cls.classLevel}
                  type="button"
                  onClick={() => setSelectedClass(cls.classLevel)}
                  className={`py-2 px-1.5 rounded-xl text-xs font-semibold border transition text-center ${
                    active
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-blue-500/40'
                  }`}
                >
                  <div>Cl {cls.classLevel}</div>
                  <div className={`text-[9px] truncate ${active ? 'text-blue-100' : 'text-[var(--text-muted)]'}`}>
                    {cls.stage === 'Senior Secondary' ? 'Sr Sec' : cls.stage}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Board + Language + Topic Search */}
        <div className="grid grid-cols-1 md:grid-cols-12 md:items-end gap-3 pt-1">
          <div className="md:col-span-4 min-w-0">
            <label
              htmlFor="edhub-board-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 truncate"
            >
              2. Board (28+ Indian Boards)
            </label>
            <select
              id="edhub-board-select"
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium"
            >
              <optgroup label="National Boards">
                {groupedBoards.National.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Senior Secondary & Open Schooling">
                {[...groupedBoards.Senior, ...groupedBoards.Open].map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Indian State Boards">
                {groupedBoards.State.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="md:col-span-3 min-w-0">
            <label
              htmlFor="edhub-lang-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 truncate"
            >
              3. Language (23 Indian)
            </label>
            <select
              id="edhub-lang-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium"
            >
              {languages.map((lang) => (
                <option key={lang.name} value={lang.name}>
                  {lang.name} ({lang.nativeLabel})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="md:col-span-5 min-w-0">
            <label
              htmlFor="edhub-topic-search"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 truncate"
            >
              4. Search Topic or Chapter
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="edhub-topic-search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g., Photosynthesis, Trigonometry, Electrostatics..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary shrink-0"
              >
                Search
              </button>
              {activeQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setActiveQuery('');
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 5. Stage-Appropriate Dynamic Subjects */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              5. Subjects for {selectedBoard} · Class {selectedClass}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {subjects.length} stage-matched subjects
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => {
              const active = selectedSubject === sub.name;
              return (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => setSelectedSubject(sub.name)}
                  title={sub.description}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-purple-500/40'
                  }`}
                >
                  <span>{sub.name}</span>
                  {sub.stream && sub.stream !== 'Core' && (
                    <span
                      className={`text-[10px] ${
                        active ? 'text-purple-100' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      ({sub.stream})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Recommended Chapters */}
        {chapters.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Chapter Focus ({selectedSubject})
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedChapter('')}
                className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                  selectedChapter === ''
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 font-semibold'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                }`}
              >
                All Chapters
              </button>
              {chapters.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChapter(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    selectedChapter === ch
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 font-semibold'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-blue-500/40'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Active Integrated Player + Ask Muse AI Tutor & Quiz Workspace */}
      {studyWorkspaceOpen && (
        <section
          aria-label="Integrated Video Player and Ask Muse AI Tutor"
          className="muse-card p-5 space-y-4 border border-blue-500/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Interactive Lesson &amp; AI Study Companion
              </div>
              <h2 className="font-display font-bold text-lg">
                {selectedVideo
                  ? selectedVideo.title
                  : `${selectedBoard} Class ${selectedClass} · ${selectedSubject}${selectedChapter ? ` · ${selectedChapter}` : ''}`}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedVideo && (
                <>
                  <button
                    type="button"
                    onClick={() => handleNavigateAdjacentVideo(-1)}
                    className="px-2.5 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateAdjacentVideo(1)}
                    className="px-2.5 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-1"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setStudyWorkspaceOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
              >
                Close Study View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Embedded YouTube IFrame Player (if video chosen) or Topic Overview */}
            <div className="lg:col-span-7 min-w-0 space-y-3">
              {selectedVideo ? (
                <>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-[var(--border-subtle)]">
                    <iframe
                      title={selectedVideo.title}
                      src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?rel=0&cc_load_policy=1&enablejsapi=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>

                  <div className="muse-panel p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] truncate">
                        {selectedVideo.channelTitle} · {selectedVideo.durationLabel}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {selectedVideo.relevanceLabel} ·{' '}
                        {selectedVideo.captionsHint
                          ? 'Captions available on player (CC)'
                          : 'Use player CC button if creator uploaded captions'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(selectedVideo)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 ${
                          isBookmarked(selectedVideo.videoId)
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{isBookmarked(selectedVideo.videoId) ? 'Saved' : 'Save Video'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkWatched(selectedVideo)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Watched
                      </button>

                      <a
                        href={selectedVideo.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-1 hover:border-blue-500/40"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => setReportOpen((o) => !o)}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 flex items-center gap-1"
                      >
                        <Flag className="w-3.5 h-3.5" /> Report
                      </button>
                    </div>
                  </div>

                  {reportOpen && (
                    <form onSubmit={handleSubmitReport} className="muse-panel p-3.5 space-y-2 text-xs">
                      <label htmlFor="edhub-report-reason" className="font-semibold block">
                        Report Inappropriate or Off-Syllabus Video
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          id="edhub-report-reason"
                          type="text"
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 rounded-lg font-semibold bg-rose-600 text-white"
                        >
                          Submit Report
                        </button>
                      </div>
                    </form>
                  )}

                  {reportFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                      {reportFeedback}
                    </div>
                  )}

                  {selectedVideo.description && (
                    <div className="muse-panel p-3.5 text-xs text-[var(--text-secondary)] space-y-1">
                      <div className="font-semibold text-[var(--text-primary)]">Lesson Notes &amp; Description</div>
                      <p className="whitespace-pre-line line-clamp-4">{selectedVideo.description}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="muse-panel p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Topic Study Workspace Ready</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Practicing <strong>{selectedBoard}</strong> · <strong>Class {selectedClass}</strong> ·{' '}
                    <strong>{selectedSubject}</strong>
                    {selectedChapter ? ` · Chapter: ${selectedChapter}` : ''}. Use the Ask Muse AI Tutor actions on the right or launch a 5-question quiz anytime.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ytSearchUrl && (
                      <a
                        href={ytSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary inline-flex items-center gap-1.5"
                      >
                        <Tv className="w-3.5 h-3.5" /> Search Video Lessons on YouTube
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {onAskAITeacher && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskAITeacher(
                            selectedSubject,
                            `Teach me ${selectedChapter || selectedSubject} for ${selectedBoard} Class ${selectedClass} in ${selectedLanguage}.`
                          )
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-1.5"
                      >
                        <Bot className="w-3.5 h-3.5 text-blue-400" /> Open Full AI Assistant
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: ASK MUSE ABOUT THIS VIDEO + 5-Question Quiz */}
            <div className="lg:col-span-5 min-w-0 muse-panel p-4 space-y-3 flex flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Bot className="w-4 h-4" />
                  <span>ASK MUSE ABOUT THIS VIDEO</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTutorTab('explain')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      tutorTab === 'explain'
                        ? 'bg-purple-600 text-white'
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    AI Tutor
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      tutorTab === 'quiz'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    <ClipboardCheck className="w-3 h-3" /> 5-Q Quiz
                  </button>
                </div>
              </div>

              {tutorTab === 'explain' ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex flex-wrap gap-1.5">
                    {AI_TUTOR_ACTIONS.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        disabled={tutorLoading}
                        onClick={() => handleAskTutor(act.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-500/40 disabled:opacity-50"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (tutorQuestion.trim()) handleAskTutor('custom');
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={tutorQuestion}
                      onChange={(e) => setTutorQuestion(e.target.value)}
                      placeholder="Ask a doubt about this video or chapter..."
                      aria-label="Ask Muse about this video"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
                    />
                    <button
                      type="submit"
                      disabled={tutorLoading || !tutorQuestion.trim()}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary disabled:opacity-50"
                    >
                      Ask
                    </button>
                  </form>

                  <div className="flex-1 max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
                    {tutorLoading && (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] text-xs text-blue-300 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating grounded curriculum explanation in {selectedLanguage}...</span>
                      </div>
                    )}

                    {tutorError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                        {tutorError}
                      </div>
                    )}

                    {tutorResponse && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                        {!tutorResponse.basedOnTranscript && (
                          <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                            Grounded in lesson title, description &amp; syllabus metadata (full spoken YouTube audio transcript is not fetched).
                          </div>
                        )}
                        <div className="text-[var(--text-primary)] whitespace-pre-line leading-relaxed">
                          {tutorResponse.explanation}
                        </div>

                        {tutorResponse.keyPoints.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                            <div className="font-semibold text-blue-400">Key Points</div>
                            <ul className="list-disc pl-4 space-y-0.5 text-[var(--text-secondary)]">
                              {tutorResponse.keyPoints.map((kp, i) => (
                                <li key={i}>{kp}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {tutorResponse.followUpQuestions.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="font-semibold text-[var(--text-muted)]">Follow-Up Questions</div>
                            <div className="flex flex-wrap gap-1.5">
                              {tutorResponse.followUpQuestions.map((fq) => (
                                <button
                                  key={fq}
                                  type="button"
                                  onClick={() => handleAskTutor('custom', fq)}
                                  className="text-left px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 text-[11px]"
                                >
                                  {fq}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                          {onSaveNote && (
                            <button
                              type="button"
                              onClick={handleSaveTutorToNotes}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{noteSavedToast ? 'Saved to Notes!' : 'Save to Notes'}</span>
                            </button>
                          )}
                          {onAskAITeacher && (
                            <button
                              type="button"
                              onClick={() =>
                                onAskAITeacher(
                                  selectedSubject,
                                  `Continue explaining: ${selectedVideo?.title || selectedChapter || selectedSubject}`
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                            >
                              Continue in AI Chat
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!tutorLoading && !tutorResponse && !tutorError && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)]">
                        Click any smart action above (e.g. <strong>Explain this chapter</strong>,{' '}
                        <strong>Explain in Telugu</strong>, or <strong>Mind map</strong>) or switch to{' '}
                        <strong>5-Q Quiz</strong> to test your understanding.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 flex-1 max-h-[420px] overflow-y-auto pr-1">
                  {quizLoading && (
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] text-xs text-blue-300 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Building 5-question practice quiz in {selectedLanguage}...</span>
                    </div>
                  )}

                  {quizError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                      {quizError}
                    </div>
                  )}

                  {!quizLoading && quizQuestions.length > 0 && (
                    <div className="space-y-3">
                      {quizQuestions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 text-xs"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">
                            {idx + 1}. {q.prompt}
                          </div>
                          <div className="space-y-1">
                            {q.options.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`edquiz_${q.id}`}
                                  checked={quizAnswers[q.id] === opt}
                                  onChange={() =>
                                    setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }))
                                  }
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSubmitQuiz}
                          className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
                        >
                          Grade Quiz
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateQuiz}
                          className="px-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                        >
                          New Questions
                        </button>
                      </div>

                      {quizResult && (
                        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2 text-xs">
                          <div className="font-display font-bold text-sm text-blue-300">
                            Score: {quizResult.score} / {quizResult.total} ({quizResult.percentage}%)
                          </div>
                          <div className="space-y-1.5">
                            {quizResult.results.map((r, i) => (
                              <div
                                key={r.questionId || i}
                                className={`p-2 rounded-lg border ${
                                  r.isCorrect
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-rose-500/30 bg-rose-500/10'
                                }`}
                              >
                                <div className="font-semibold">
                                  Q{i + 1}: {r.isCorrect ? 'Correct' : `Expected "${r.correctAnswer}"`}
                                </div>
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  {r.explanation}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Inner Navigation Tabs + Relevance Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Education Hub Sections" className="flex flex-wrap gap-2">
          {[
            { id: 'videos' as HubInnerTab, label: `Lessons & Videos (${filteredVideos.length})`, icon: Video },
            { id: 'playlists' as HubInnerTab, label: `Playlists (${playlists.length})`, icon: ListVideo },
            { id: 'official' as HubInnerTab, label: `Official Govt Portals (${officialPortals.length})`, icon: Globe },
            { id: 'saved' as HubInnerTab, label: `Saved & History (${bookmarks.length + watchHistory.length})`, icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={innerTab === tab.id}
              onClick={() => setInnerTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                innerTab === tab.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-blue-500/40'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {innerTab === 'videos' && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="edhub-rel-filter" className="text-[var(--text-muted)] font-medium">
              Filter:
            </label>
            <select
              id="edhub-rel-filter"
              value={relevanceFilter}
              onChange={(e) =>
                setRelevanceFilter(
                  e.target.value as 'ALL' | EducationRelevanceLabel | 'Official'
                )
              }
              className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Relevance Tiers</option>
              <option value="Highly Relevant">Highly Relevant</option>
              <option value="Curriculum Matched">Curriculum Matched</option>
              <option value="Official">Official &amp; Admin Curated Only</option>
            </select>
            <button
              type="button"
              onClick={() => fetchVideos()}
              aria-label="Refresh video search"
              className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${videosLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: LESSONS & VIDEOS */}
      {innerTab === 'videos' && (
        <div className="space-y-4">
          {!ytConfigured && (
            <div className="muse-card p-5 border border-amber-500/30 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="font-display font-bold text-sm text-[var(--text-primary)]">
                    Live YouTube Data API v3 Not Configured Yet (Server Secret Missing)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Set <code className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)]">YOUTUBE_API_KEY</code> in AI Studio Secrets on the server to stream real educational YouTube searches automatically. Meanwhile, Teachers/Admins can add verified YouTube videos in the Admin Panel, or you can open the exact YouTube search and study right here with the Ask Muse AI Tutor &amp; 5-Question Quiz!
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {ytSearchUrl && (
                  <a
                    href={ytSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary inline-flex items-center gap-1.5"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Open YouTube Search: &ldquo;{builtQuery}&rdquo;</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVideo(null);
                    setStudyWorkspaceOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-purple-500/40 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Study Topic with AI Tutor &amp; Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInnerTab('official')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-emerald-500/40 flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Browse Official NCERT / DIKSHA Portals</span>
                </button>
              </div>
            </div>
          )}

          {videoError && (
            <div className="muse-card p-4 border border-rose-500/30 text-xs text-rose-300">
              {videoError}
            </div>
          )}

          {videosLoading && videos.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="muse-card p-4 space-y-3 animate-pulse">
                  <div className="aspect-video rounded-xl bg-[var(--bg-elevated)]" />
                  <div className="h-4 w-3/4 rounded bg-[var(--bg-elevated)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--bg-elevated)]" />
                </div>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="muse-card p-6 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto">
                <Video className="w-5 h-5 text-blue-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base">
                  No curated or cached videos found for this exact filter yet
                </h3>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Try clearing your chapter keyword, switching relevance to All Tiers, or launch the Ask Muse AI Tutor &amp; Quiz directly for {selectedBoard} Class {selectedClass} {selectedSubject}.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVideo(null);
                    setStudyWorkspaceOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary"
                >
                  Open AI Tutor &amp; Quiz for {selectedSubject}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVideos.map((vid) => {
                  const saved = isBookmarked(vid.videoId);
                  return (
                    <article
                      key={vid.videoId}
                      className="muse-card overflow-hidden flex flex-col justify-between border border-[var(--border-subtle)] hover:border-blue-500/40 transition"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectVideo(vid)}
                        className="text-left block w-full"
                      >
                        <div className="relative aspect-video bg-slate-900 overflow-hidden">
                          {vid.thumbnailUrl ? (
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                              <Video className="w-8 h-8 text-blue-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent flex items-end justify-between p-3">
                            <span className="text-[11px] font-semibold text-white">
                              {vid.durationLabel} · {vid.language}
                            </span>
                            <span className="w-8 h-8 rounded-full bg-blue-600/95 text-white flex items-center justify-center shadow">
                              <Play className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-blue-400 truncate">
                              {vid.channelTitle}
                              {vid.isApprovedChannel ? ' ✓ Verified' : ''}
                            </span>
                            <span className="text-emerald-400 font-semibold shrink-0">
                              {vid.relevanceLabel}
                            </span>
                          </div>
                          <h3 className="font-display font-bold text-sm text-[var(--text-primary)] line-clamp-2">
                            {vid.title}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                            {vid.description || `${vid.board} Class ${vid.classLevel} · ${vid.subject}`}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                          <button
                            type="button"
                            onClick={() => handleSelectVideo(vid)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold muse-btn-primary flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" /> Watch &amp; Ask AI
                          </button>
                          <button
                            type="button"
                            aria-label={saved ? `Remove bookmark for ${vid.title}` : `Save bookmark for ${vid.title}`}
                            onClick={() => handleToggleBookmark(vid)}
                            className={`p-2 rounded-lg border ${
                              saved
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {nextPageToken && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    disabled={videosLoading}
                    onClick={() => fetchVideos(nextPageToken)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/40"
                  >
                    {videosLoading ? 'Loading More...' : 'Load More Video Lessons'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: PLAYLISTS */}
      {innerTab === 'playlists' && (
        <div className="muse-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Full-Chapter Playlists ({selectedBoard} · Class {selectedClass} · {selectedSubject})</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Structured multi-video chapter series curated by Teachers &amp; YouTube Educators.
              </p>
            </div>
            {ytPlaylistUrl && (
              <a
                href={ytPlaylistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 inline-flex items-center gap-1.5"
              >
                <span>Explore Playlists on YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {playlistsLoading ? (
            <div className="text-xs text-[var(--text-muted)]">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="muse-panel p-5 text-xs text-[var(--text-secondary)]">
              No curated playlists added for this selection yet. Administrators can paste any verified YouTube Playlist URL in the Admin Panel, or click &ldquo;Explore Playlists on YouTube&rdquo; above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playlists.map((pl) => (
                <div key={pl.playlistId} className="muse-panel p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-purple-400">{pl.channelTitle}</div>
                    <h3 className="font-display font-bold text-sm">{pl.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">{pl.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-subtle)]">
                    <span>{pl.board} · Class {pl.classLevel} · {pl.language}</span>
                    <a
                      href={pl.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      Open Playlist <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFICIAL GOVT PORTALS & VERIFIED CHANNELS */}
      {innerTab === 'official' && (
        <div className="space-y-5">
          <div className="muse-card p-5 space-y-4">
            <div>
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Official Government &amp; Board Education Portals</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Direct verified links to NCERT PM e-Vidya TV Channels, DIKSHA State Textbooks, SWAYAM MOOCs, and SCERT Repositories.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {officialPortals.map((portal) => (
                <a
                  key={portal.id}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="muse-panel p-4 space-y-2 hover:border-emerald-500/50 transition flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-emerald-400">{portal.badge}</span>
                      <span className="text-[var(--text-muted)]">{portal.classRange}</span>
                    </div>
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      {portal.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">{portal.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-blue-400 font-semibold pt-2 border-t border-[var(--border-subtle)]">
                    <span>{portal.provider}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {approvedChannels.length > 0 && (
            <div className="muse-card p-5 space-y-3">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>Approved Educational YouTube Channels ({approvedChannels.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {approvedChannels.map((ch) => (
                  <div key={ch.id} className="muse-panel p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{ch.channelTitle}</span>
                      {ch.officialGovernment && (
                        <span className="text-[10px] font-semibold text-emerald-400">Official Govt</span>
                      )}
                    </div>
                    <div className="text-[var(--text-muted)]">
                      {ch.boards.slice(0, 3).join(', ')} · {ch.languages.slice(0, 3).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAVED BOOKMARKS & WATCH HISTORY */}
      {innerTab === 'saved' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="muse-card p-5 space-y-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span>Bookmarked Video Lessons ({bookmarks.length})</span>
            </h2>
            {bookmarks.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No bookmarked videos yet. Tap the bookmark button on any Education Hub lesson to save it here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bookmarks.map((bm) => (
                  <div key={bm.videoId} className="muse-panel p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{bm.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {bm.channelTitle} · {bm.board} Class {bm.classLevel} · {bm.subject}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectVideo(bm)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold muse-btn-primary shrink-0"
                    >
                      Play
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="muse-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <span>Continue Learning History ({watchHistory.length})</span>
              </h2>
              {quotaUsed > 0 && (
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                  API Quota: {quotaUsed} units
                </span>
              )}
            </div>
            {watchHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Start watching any lesson to track your recently studied topics here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {watchHistory.map((entry) => (
                  <div
                    key={entry.video.videoId}
                    className="muse-panel p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{entry.video.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {entry.progressPercent}% watched · {new Date(entry.watchedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectVideo(entry.video)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0"
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
