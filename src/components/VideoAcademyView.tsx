import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Download,
  ExternalLink,
  Filter,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Video as VideoIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BOARDS, CLASS_LEVELS, CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import { VIDEO_THUMBNAIL_BY_ID } from '../data/academyMedia';
import { UserProfile, VideoCategory, VideoLesson } from '../types/muse';
import {
  computeVideoCaptionIndex,
  filterVideoLibrary,
  groupVideosByCategory,
  VIDEO_CATEGORIES,
  VideoCollectionFilter,
} from '../utils/academyUtils';
import { filterByStudentClass, prioritizeByClassAndProfile } from '../utils/curriculumFilter';
import { XRSpatialLab } from './XRSpatialLab';
import { authFetch } from '../services/firebaseClient';
import { pickPreferredSpeechVoice } from '../utils/liveVoiceUtils';

interface VideoAcademyViewProps {
  profile?: UserProfile;
  videos: VideoLesson[];
  watchedIds: string[];
  bookmarkedIds: string[];
  initialCategory?: 'ALL' | VideoCategory;
  initialSubject?: string;
  initialSearch?: string;
  onMarkWatched: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onAddCustomVideo?: (video: VideoLesson) => void;
  onAskAITeacher?: (subject?: string, prompt?: string) => void;
}

function drawSceneCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  video: VideoLesson,
  progressPct: number,
  showCaptions: boolean
) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#091229');
  grad.addColorStop(0.55, '#152552');
  grad.addColorStop(1, '#2b135c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const phase = (progressPct / 100) * Math.PI * 4;

  // Topic-specific animated educational visual on stage
  if (video.xrModelId === 'plant_cell' || video.id.includes('photo')) {
    // Sunbeams -> Leaf Chloroplast -> O2 & Glucose bubbles
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(82, 92, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(116, 102);
    ctx.lineTo(255, 148);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(360, 160, 92, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chloroplast: CO2 + H2O', 360, 164);

    // Rising O2 bubbles
    for (let i = 0; i < 4; i++) {
      const bx = 500 + i * 36;
      const by = 180 - (((progressPct * 1.4 + i * 22) % 90));
      ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#a78bfa';
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  } else if (video.xrModelId === 'pythagoras_3d' || video.id.includes('pythag')) {
    const ox = 290;
    const oy = 205;
    const scale = 18;
    const a = 3 * scale;
    const b = 4 * scale;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.fillRect(ox - a, oy - a, a, a);
    ctx.strokeRect(ox - a, oy - a, a, a);

    ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.strokeStyle = '#a78bfa';
    ctx.fillRect(ox, oy, b, Math.min(54, b));
    ctx.strokeRect(ox, oy, b, Math.min(54, b));

    ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
    ctx.strokeStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + b, oy);
    ctx.lineTo(ox, oy - a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const pulse = 1 + Math.sin(phase) * 0.06;
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`a² (9) + b² (16) = c² (25)  ·  ${Math.round(progressPct)}%`, ox + 110, 155 * pulse);
  } else if (video.xrModelId === 'solar_system' || video.id.includes('solar')) {
    const cx = w * 0.5;
    const cy = h * 0.54;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    const orbits = [
      { r: 58, color: '#94a3b8', speed: 1.8, size: 5 },
      { r: 92, color: '#38bdf8', speed: 1.15, size: 8 },
      { r: 128, color: '#ef4444', speed: 0.85, size: 6 },
      { r: 172, color: '#eab308', speed: 0.5, size: 12 },
    ];
    for (const o of orbits) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.r * 1.45, o.r * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();

      const px = cx + Math.cos(phase * o.speed) * o.r * 1.45;
      const py = cy + Math.sin(phase * o.speed) * o.r * 0.58;
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(px, py, o.size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (video.xrModelId === 'atomic_bohr' || video.id.includes('bohr')) {
    const cx = w * 0.5;
    const cy = h * 0.54;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(cx + 6, cy + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    [52, 92, 134].forEach((r, idx) => {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.4, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();

      const count = idx === 0 ? 2 : idx === 1 ? 4 : 1;
      for (let i = 0; i < count; i++) {
        const angle = phase * (1.5 - idx * 0.35) + (i * Math.PI * 2) / count;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r * 1.4, cy + Math.sin(angle) * r * 0.62, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } else if (video.xrModelId === 'motion_physics' || video.id.includes('motion')) {
    // Inclined ramp, sliding block, force vector F = ma, and velocity trail
    const slideT = (progressPct % 100) / 100;
    const rampX1 = 120;
    const rampY1 = 108;
    const rampX2 = 540;
    const rampY2 = 228;

    ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rampX1, rampY2);
    ctx.lineTo(rampX2, rampY2);
    ctx.lineTo(rampX1, rampY1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const bx = rampX1 + 40 + slideT * 310;
    const slopeRatio = (rampY2 - rampY1) / (rampX2 - rampX1);
    const by = rampY1 + (bx - rampX1) * slopeRatio - 18;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.atan(slopeRatio));
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.fillRect(-20, -16, 40, 26);
    ctx.strokeRect(-20, -16, 40, 26);
    ctx.restore();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + 18, by - 4);
    ctx.lineTo(bx + 78, by + 16);
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('F = m × a   |   v = u + at   |   s = ut + ½at²', 120, 86);
  } else {
    // Default animated wave + concept progress timeline
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 24; x <= w - 24; x += 8) {
      const y = h * 0.55 + Math.sin((x + progressPct * 5) * 0.03) * 26;
      if (x === 24) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Title & Subtitle Header
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(video.title.slice(0, 62), 24, 38);
  ctx.fillStyle = '#93c5fd';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${video.board} Class ${video.classLevel} · ${video.subject} · ${video.durationLabel}`, 24, 60);

  // Captions bar
  const captionIdx = computeVideoCaptionIndex(progressPct, video.captions.length);
  if (showCaptions && captionIdx >= 0 && video.captions[captionIdx]) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.84)';
    ctx.fillRect(18, h - 58, w - 36, 40);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, h - 58, w - 36, 40);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12.5px sans-serif';
    ctx.fillText(video.captions[captionIdx].slice(0, 94), 30, h - 33);
  }
}

export const VideoAcademyView: React.FC<VideoAcademyViewProps> = ({
  profile,
  videos,
  watchedIds,
  bookmarkedIds,
  initialCategory = 'ALL',
  initialSubject = 'ALL',
  initialSearch = '',
  onMarkWatched,
  onToggleBookmark,
  onAddCustomVideo,
  onAskAITeacher,
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [subject, setSubject] = useState(initialSubject);
  const [boardFilter, setBoardFilter] = useState('ALL');
  const [myClassOnly, setMyClassOnly] = useState<boolean>(() => !initialSearch && Boolean(profile?.classLevel));
  const [classFilter, setClassFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | VideoCategory>(initialCategory);
  const [collectionFilter, setCollectionFilter] = useState<VideoCollectionFilter>('all');
  const [organizeByCategory, setOrganizeByCategory] = useState(true);
  const [activeId, setActiveId] = useState(videos[0]?.id || '');
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1 | 1.5>(1);
  const [progressSec, setProgressSec] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [narrateCaptions, setNarrateCaptions] = useState(false);
  const [recordingWebm, setRecordingWebm] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [customExternalUrl, setCustomExternalUrl] = useState('');
  const [customSubject, setCustomSubject] = useState(profile?.subjects[0] || 'Science');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const lastSpokenIdxRef = useRef<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setCategoryFilter(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const filtered = useMemo(() => {
    const base = filterVideoLibrary(videos, {
      subject,
      category: categoryFilter,
      board: boardFilter,
      classLevel: classFilter,
      search,
      collectionFilter,
      watchedIds,
      bookmarkedIds,
    });
    const ranked = profile ? prioritizeByClassAndProfile(base, profile) : base;
    return profile && classFilter === 'ALL'
      ? filterByStudentClass(ranked, profile.classLevel, myClassOnly)
      : ranked;
  }, [videos, subject, categoryFilter, boardFilter, classFilter, search, collectionFilter, watchedIds, bookmarkedIds, profile, myClassOnly]);

  const groupedPlaylists = useMemo(() => groupVideosByCategory(filtered), [filtered]);

  const activeVideo =
    filtered.find((v) => v.id === activeId) ||
    filtered[0] ||
    videos.find((v) => v.id === activeId) ||
    videos[0];
  const activeCaptionIdx = activeVideo
    ? computeVideoCaptionIndex(progressSec, activeVideo.captions.length)
    : -1;

  const canRecordWebm =
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  const handleToggleWebmRecord = () => {
    if (recordingWebm && recorderRef.current) {
      recorderRef.current.stop();
      setRecordingWebm(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !canRecordWebm || !activeVideo) return;
    try {
      const stream = canvas.captureStream(24);
      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeVideo.id}_walkthrough.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecordingWebm(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingWebm(true);
      setProgressSec(0);
      setPlaying(true);
    } catch {
      setRecordingWebm(false);
    }
  };

  useEffect(() => {
    if (!playing || !activeVideo) return;
    const step = 2 * playbackSpeed;
    const timer = window.setInterval(() => {
      setProgressSec((prev) => Math.min(100, prev + step));
    }, 220);
    return () => clearInterval(timer);
  }, [playing, playbackSpeed, activeVideo]);

  useEffect(() => {
    if (!playing || !activeVideo || progressSec < 100) return;
    setPlaying(false);
    if (recordingWebm && recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (!watchedIds.includes(activeVideo.id)) {
      onMarkWatched(activeVideo.id);
    }
  }, [playing, progressSec, activeVideo, watchedIds, onMarkWatched, recordingWebm]);

  useEffect(() => {
    if (!narrateCaptions || !playing || !activeVideo || activeCaptionIdx < 0) return;
    if (lastSpokenIdxRef.current === activeCaptionIdx) return;
    lastSpokenIdxRef.current = activeCaptionIdx;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const raw = activeVideo.captions[activeCaptionIdx] || '';
      const spokenText = raw.replace(/^\d{2}:\d{2}\s*[—-]\s*/, '');
      const utterance = new SpeechSynthesisUtterance(spokenText);
      const chosenVoice = pickPreferredSpeechVoice(
        window.speechSynthesis.getVoices(),
        profile?.preferredLanguage || 'English'
      );
      if (chosenVoice) utterance.voice = chosenVoice;
      utterance.lang = chosenVoice?.lang || 'en-IN';
      utterance.rate = Math.min(2, Math.max(0.5, Number(profile?.speechRate ?? 1.0)));
      utterance.pitch = Math.min(2, Math.max(0.5, Number(profile?.speechPitch ?? 1.0)));
      window.speechSynthesis.speak(utterance);
    }
  }, [narrateCaptions, playing, activeVideo, activeCaptionIdx, profile?.preferredLanguage, profile?.speechRate, profile?.speechPitch]);

  useEffect(() => {
    if (!playing && typeof window !== 'undefined' && 'speechSynthesis' in window && narrateCaptions) {
      window.speechSynthesis.cancel();
    }
  }, [playing, narrateCaptions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeVideo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSceneCanvas(ctx, canvas.width, canvas.height, activeVideo, progressSec, showCaptions);
  }, [activeVideo, progressSec, showCaptions]);

  const handleGenerateCustomVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim() || customLoading || !onAddCustomVideo) return;
    setCustomLoading(true);
    setCustomError(null);
    try {
      const resp = await authFetch('/api/ai/video-walkthrough', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTopic.trim(),
          subject: customSubject,
          board: profile?.board || 'CBSE',
          classLevel: profile?.classLevel || 7,
          language: profile?.preferredLanguage || 'English',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setCustomError(data.error || 'Could not generate video walkthrough.');
        return;
      }
      const newVid: VideoLesson = {
        id: `vid_ai_${Date.now()}`,
        board: profile?.board || 'CBSE',
        classLevel: profile?.classLevel || 7,
        subject: customSubject,
        chapter: data.chapter || customSubject,
        category: 'Step-by-Step Tutorial',
        difficulty: 'medium',
        title: data.title || customTopic.trim(),
        description: data.description || '',
        durationLabel: data.durationLabel || '04:00',
        sourceLabel: `Nano AI Walkthrough (${LANGUAGES.includes((profile?.preferredLanguage || 'English') as typeof LANGUAGES[number]) ? profile?.preferredLanguage || 'English' : 'English'})`,
        captionsAvailable: true,
        captions: Array.isArray(data.captions) && data.captions.length > 0 ? data.captions : [`00:00 — ${customTopic.trim()}`],
        keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
        ...( /^https?:\/\/.+/i.test(customExternalUrl.trim()) ? { externalUrl: customExternalUrl.trim() } : {} ),
      };
      onAddCustomVideo(newVid);
      setCategoryFilter('ALL');
      setActiveId(newVid.id);
      setProgressSec(0);
      setPlaying(false);
      lastSpokenIdxRef.current = -1;
      setCustomTopic('');
      setCustomExternalUrl('');
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : 'Network error generating video walkthrough.');
    } finally {
      setCustomLoading(false);
    }
  };

  const renderVideoCard = (vid: VideoLesson) => {
    const watched = watchedIds.includes(vid.id);
    const bookmarked = bookmarkedIds.includes(vid.id);
    const thumbSrc = VIDEO_THUMBNAIL_BY_ID[vid.id];
    const effectiveCategory = vid.category || 'Concept Explained';
    return (
      <button
        key={vid.id}
        type="button"
        onClick={() => {
          setActiveId(vid.id);
          setProgressSec(0);
          setPlaying(false);
          lastSpokenIdxRef.current = -1;
        }}
        className={`w-full min-w-0 overflow-hidden text-left muse-card p-3 flex items-center gap-3 border transition ${
          vid.id === activeVideo?.id ? 'border-blue-500 bg-[var(--bg-subtle)]' : 'hover:border-blue-500/40'
        }`}
      >
        <div className="w-24 aspect-[4/3] rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center relative">
          {!brokenThumbs[vid.id] && thumbSrc ? (
            <img
              src={thumbSrc}
              alt={vid.title}
              referrerPolicy="no-referrer"
              onError={() => setBrokenThumbs((b) => ({ ...b, [vid.id]: true }))}
              className="w-full h-full object-cover"
            />
          ) : (
            <VideoIcon className="w-6 h-6 text-blue-400" />
          )}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono tabular-nums">
            {vid.durationLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 min-w-0 text-[11px] text-[var(--text-muted)]">
            <span className="truncate min-w-0 flex-1">
              {vid.subject} · Class {vid.classLevel} · {effectiveCategory}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {bookmarked && <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400" />}
              {watched && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
          </div>
          <div className="font-semibold text-sm line-clamp-2 break-words">{vid.title}</div>
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            {vid.chapter}
            {vid.difficulty ? ` · ${vid.difficulty}` : ''}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="muse-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl">Video Academy</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Organized curriculum tutorials, concept walkthroughs, synchronized captions, voice narration, and 3D XR companions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-auto min-w-0 flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos & tutorials..."
                aria-label="Search video library"
                className="w-full sm:w-52 pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              />
            </div>
            <select
              aria-label="Filter videos by board"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Boards</option>
              {BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              aria-label="Filter videos by class"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                if (e.target.value !== 'ALL') setMyClassOnly(false);
              }}
              className="px-2.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Classes (1–12)</option>
              {CLASS_LEVELS.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
            <select
              aria-label="Filter videos by subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              <option value="ALL">All Subjects</option>
              {Array.from(new Set(videos.map((v) => v.subject))).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-sky-400" /> Categories:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
              categoryFilter === 'ALL'
                ? 'bg-sky-600 text-white border-sky-500'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            All Categories ({videos.length})
          </button>
          {VIDEO_CATEGORIES.map((cat) => {
            const count = videos.filter((v) => (v.category || 'Concept Explained') === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                  categoryFilter === cat
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {profile && (
              <button
                type="button"
                onClick={() => {
                  setMyClassOnly((m) => !m);
                  setClassFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                  myClassOnly && classFilter === 'ALL'
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                My Class ({profile.classLevel})
              </button>
            )}
            {(
              [
                { id: 'all', label: `All Videos (${videos.length})` },
                { id: 'bookmarked', label: `Bookmarked (${bookmarkedIds.length})` },
                { id: 'watched', label: `Watched (${watchedIds.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCollectionFilter(tab.id);
                  if (tab.id === 'all') setMyClassOnly(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                  collectionFilter === tab.id && !(tab.id === 'all' && myClassOnly)
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setOrganizeByCategory((o) => !o)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{organizeByCategory ? 'Grouped by Category' : 'Flat Playlist'}</span>
            </button>
          </div>

          {onAddCustomVideo && (
            <form onSubmit={handleGenerateCustomVideo} className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Generate AI walkthrough for any topic..."
                aria-label="Topic for AI video walkthrough"
                className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs w-full sm:w-48 min-w-0"
              />
              <input
                type="url"
                value={customExternalUrl}
                onChange={(e) => setCustomExternalUrl(e.target.value)}
                placeholder="Optional video link..."
                aria-label="Optional external video URL"
                className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs w-full sm:w-44 min-w-0"
              />
              <select
                aria-label="Subject for AI video walkthrough"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
              >
                {CORE_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={customLoading || !customTopic.trim()}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary whitespace-nowrap shrink-0 flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{customLoading ? 'Creating...' : 'Create Tutorial'}</span>
              </button>
            </form>
          )}
        </div>

        {customError && (
          <div role="alert" className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
            {customError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 min-w-0 space-y-4">
          {filtered.length === 0 ? (
            <div className="muse-card p-4 space-y-2 text-xs text-[var(--text-muted)]">
              <div>No videos or tutorials match your active filters.</div>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setSubject('ALL');
                  setBoardFilter('ALL');
                  setClassFilter('ALL');
                  setCollectionFilter('all');
                  setSearch('');
                }}
                className="text-blue-400 font-semibold hover:underline"
              >
                Reset Video Filters
              </button>
            </div>
          ) : organizeByCategory && categoryFilter === 'ALL' ? (
            groupedPlaylists.map((group) => (
              <div key={group.category} className="space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400 truncate">
                    {group.category}
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                    {group.items.length} item{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="space-y-2.5">{group.items.map(renderVideoCard)}</div>
              </div>
            ))
          ) : (
            <div className="space-y-2.5">{filtered.map(renderVideoCard)}</div>
          )}
        </div>

        {activeVideo && (
          <div className="lg:col-span-8 min-w-0 space-y-5">
            <div className="muse-card p-4 sm:p-5 space-y-4 min-w-0">
              <canvas
                ref={canvasRef}
                width={720}
                height={320}
                className="w-full rounded-xl border border-[var(--border-subtle)]"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{playing ? 'Pause Walkthrough' : 'Play Walkthrough'}</span>
                </button>
                <button
                  type="button"
                  aria-label="Restart walkthrough"
                  onClick={() => {
                    setProgressSec(0);
                    lastSpokenIdxRef.current = -1;
                  }}
                  className="p-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  aria-label="Video playback progress"
                  min={0}
                  max={100}
                  value={progressSec}
                  onChange={(e) => {
                    lastSpokenIdxRef.current = -1;
                    setProgressSec(Number(e.target.value));
                  }}
                  className="flex-1 min-w-[120px] accent-blue-500"
                />
                <select
                  aria-label="Video playback speed"
                  value={String(playbackSpeed)}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value) as 0.75 | 1 | 1.5)}
                  className="px-2.5 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] tabular-nums"
                >
                  <option value="0.75">0.75x</option>
                  <option value="1">1.0x</option>
                  <option value="1.5">1.5x</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCaptions((c) => !c)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] whitespace-nowrap shrink-0"
                >
                  {showCaptions ? 'Captions: ON' : 'Captions: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setNarrateCaptions((n) => !n)}
                  className={`px-3 py-1.5 rounded-xl text-xs border whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    narrateCaptions
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                  }`}
                >
                  {narrateCaptions ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{narrateCaptions ? 'Voice Narration: ON' : 'Voice Narration: OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(activeVideo.id)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] whitespace-nowrap shrink-0 flex items-center gap-1"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{bookmarkedIds.includes(activeVideo.id) ? 'Bookmarked' : 'Bookmark'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMarkWatched(activeVideo.id)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0"
                >
                  {watchedIds.includes(activeVideo.id) ? 'Watched' : 'Mark Watched'}
                </button>
                {canRecordWebm && (
                  <button
                    type="button"
                    onClick={handleToggleWebmRecord}
                    className={`px-3 py-1.5 rounded-xl text-xs border whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      recordingWebm
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{recordingWebm ? 'Stop & Save (.webm)' : 'Record Walkthrough (.webm)'}</span>
                  </button>
                )}
                {activeVideo.externalUrl && (
                  <a
                    href={activeVideo.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <span>Watch External Video</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {onAskAITeacher && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskAITeacher(
                        activeVideo.subject,
                        `Summarize and quiz me on "${activeVideo.title}": ${activeVideo.description}`
                      )
                    }
                    className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-subtle)] text-blue-400 border border-blue-500/30 whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask Nano AI</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-[var(--text-secondary)]">{activeVideo.description}</p>

              {/* Clickable Chapter Captions */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">Chapter Walkthrough Timeline</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeVideo.captions.map((cap, idx) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => {
                        const targetPct = Math.round((idx / Math.max(1, activeVideo.captions.length)) * 100);
                        lastSpokenIdxRef.current = -1;
                        setProgressSec(targetPct);
                      }}
                      className={`p-2.5 rounded-xl text-left text-xs border transition ${
                        idx === activeCaptionIdx
                          ? 'bg-[var(--bg-subtle)] border-blue-500/50 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-blue-500/30'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {activeVideo.keyTakeaways.length > 0 && (
                <div className="muse-panel p-3.5 space-y-1.5">
                  <div className="text-xs font-semibold text-emerald-400">Key Takeaways</div>
                  <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                    {activeVideo.keyTakeaways.map((kt) => (
                      <li key={kt} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{kt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-[var(--text-muted)]">
                Category: {activeVideo.category || 'Concept Explained'} · Source: {activeVideo.sourceLabel}
              </div>
            </div>

            {activeVideo.xrModelId && (
              <XRSpatialLab modelId={activeVideo.xrModelId} title={`3D Companion: ${activeVideo.title}`} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
