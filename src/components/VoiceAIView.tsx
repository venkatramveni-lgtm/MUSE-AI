import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  Bot,
  Globe,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LANGUAGES } from '../data/curriculumSeed';
import { getBcp47ForLanguage } from '../data/educationRegistry';
import { authFetch, getFirebaseIdToken } from '../services/firebaseClient';
import {
  LiveConversationTurn,
  LiveVoiceStatus,
  SavedNote,
  UserProfile,
} from '../types/muse';
import {
  base64Int16ToFloat32,
  DEFAULT_MUSE_VOICE_PRESET,
  extractCompleteSpeechSentences,
  formatDurationTimer,
  GEMINI_VOICE_PRESETS,
  MUSE_TEST_EXPECTED_INTRO,
  MUSE_TEST_PROMPT,
  parseLiveVoiceCommand,
  pcmFloat32ToInt16Base64,
  pickPreferredSpeechVoice,
  resolveMuseVoicePreset,
} from '../utils/liveVoiceUtils';

interface VoiceAIViewProps {
  profile: UserProfile;
  onSaveVoicePreference?: (
    voiceAutoSpeak: boolean,
    speechRate: number,
    voicePreset?: string,
    speechPitch?: number
  ) => void;
  onSaveRememberedNote?: (note: SavedNote) => void;
  onOpenSearch?: (query: string) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, targetSampleRate = 16000): Float32Array {
  if (inputSampleRate === targetSampleRate) return buffer;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export const VoiceAIView: React.FC<VoiceAIViewProps> = ({
  profile,
  onSaveVoicePreference,
  onSaveRememberedNote,
  onOpenSearch,
}) => {
  const [viewMode, setViewMode] = useState<'live_talk' | 'classic'>('live_talk');
  const [language, setLanguage] = useState(profile.preferredLanguage || 'English');
  const [speechRate, setSpeechRate] = useState(profile.speechRate ?? 1.0);
  const [speechPitch, setSpeechPitch] = useState(Number(profile.speechPitch ?? 1.0));
  const [voicePreset, setVoicePreset] = useState<string>(() =>
    resolveMuseVoicePreset(profile.voicePreset)
  );
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState<boolean>(profile.voiceAutoSpeak ?? true);
  const [instantSpeechMode, setInstantSpeechMode] = useState<boolean>(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [liveReady, setLiveReady] = useState<boolean | null>(null);
  const [activeModel, setActiveModel] = useState('gemini-4-hydrogen');
  const [activeVoiceName, setActiveVoiceName] = useState<string>(() =>
    resolveMuseVoicePreset(profile.voicePreset)
  );
  const [liveStatus, setLiveStatus] = useState<LiveVoiceStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transportLabel, setTransportLabel] = useState<'gemini_live' | 'speech_fallback'>('speech_fallback');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pendingRememberConfirm, setPendingRememberConfirm] = useState(false);
  const [turns, setTurns] = useState<LiveConversationTurn[]>([]);
  const [micSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(
      navigator.mediaDevices?.getUserMedia || w.SpeechRecognition || w.webkitSpeechRecognition
    );
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const animPhaseRef = useRef(0);
  const lastAiReplyRef = useRef('');
  const liveOutputBufferRef = useRef('');
  const liveInputBufferRef = useRef('');
  const sessionActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const isPausedRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const turnsRef = useRef<LiveConversationTurn[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const activeUtteranceCountRef = useRef(0);

  useEffect(() => {
    setVoicePreset(resolveMuseVoicePreset(profile.voicePreset));
    setActiveVoiceName(resolveMuseVoicePreset(profile.voicePreset));
  }, [profile.voicePreset]);

  useEffect(() => {
    setSpeechRate(profile.speechRate ?? 1.0);
  }, [profile.speechRate]);

  useEffect(() => {
    setSpeechPitch(Number(profile.speechPitch ?? 1.0));
  }, [profile.speechPitch]);

  useEffect(() => {
    setVoiceAutoSpeak(profile.voiceAutoSpeak ?? true);
  }, [profile.voiceAutoSpeak]);

  useEffect(() => {
    let active = true;
    getFirebaseIdToken()
      .then((token) => {
        if (!active) return null;
        if (!token) {
          setLiveReady(false);
          return null;
        }
        return authFetch('/api/live-voice/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voicePreset, language }),
        });
      })
      .then((r) => (r && r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setLiveReady(Boolean(data.liveReady));
        if (data.model) setActiveModel(String(data.model));
        if (data.voiceName) setActiveVoiceName(String(data.voiceName));
      })
      .catch(() => {
        if (active) setLiveReady(false);
      });
    return () => {
      active = false;
    };
  }, [voicePreset, language]);

  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    if (!sessionActive || isPaused) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionActive, isPaused]);

  const stopAllPlayback = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    activeUtteranceCountRef.current = 0;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (htmlAudioRef.current) {
      try {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
      } catch {
        // ignore
      }
      htmlAudioRef.current = null;
    }
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current = [];
    if (playbackCtxRef.current) {
      nextPlayTimeRef.current = playbackCtxRef.current.currentTime;
    }
  }, []);

  const teardownMicAndWs = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;

    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      stopAllPlayback();
      teardownMicAndWs();
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAllPlayback, teardownMicAndWs]);

  // Animated Real-Time Audio Waveform Canvas
  useEffect(() => {
    let rafId = 0;
    const dataArray = new Uint8Array(36);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#070e1e');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#1e103d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const isListeningNow = liveStatus === 'listening' && !isMuted && !isPaused;
      const isSpeakingNow = liveStatus === 'speaking';
      const isThinkingNow = liveStatus === 'thinking' || liveStatus === 'connecting';

      animPhaseRef.current += isListeningNow
        ? 0.16
        : isSpeakingNow
          ? 0.13
          : isThinkingNow
            ? 0.08
            : 0.025;

      let hasLiveMicData = false;
      if (isListeningNow && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        hasLiveMicData = avg > 3;
      }

      const barCount = 40;
      const barWidth = Math.max(4, Math.floor((w - 80) / barCount) - 4);
      const startX = (w - barCount * (barWidth + 4)) / 2;

      for (let i = 0; i < barCount; i += 1) {
        let amp = 0.14;
        if (isPaused || isMuted) {
          amp = 0.08;
        } else if (hasLiveMicData) {
          const val = dataArray[i % dataArray.length] / 255;
          amp = Math.max(0.14, val * 0.9);
        } else if (isListeningNow || isSpeakingNow) {
          amp =
            0.22 +
            0.6 *
              Math.abs(
                Math.sin(animPhaseRef.current + i * 0.34) *
                  Math.cos(animPhaseRef.current * 0.55 + i * 0.16)
              );
        } else if (isThinkingNow) {
          amp = 0.18 + 0.25 * Math.abs(Math.sin(animPhaseRef.current * 1.4 + i * 0.45));
        } else {
          amp = 0.1 + 0.05 * Math.sin(animPhaseRef.current + i * 0.25);
        }

        const barH = Math.max(6, amp * (h * 0.72));
        const x = startX + i * (barWidth + 4);
        const y = (h - barH) / 2;

        const barGrad = ctx.createLinearGradient(x, y, x, y + barH);
        if (isListeningNow) {
          barGrad.addColorStop(0, '#38bdf8');
          barGrad.addColorStop(1, '#2563eb');
        } else if (isSpeakingNow) {
          barGrad.addColorStop(0, '#c084fc');
          barGrad.addColorStop(1, '#7c3aed');
        } else if (isThinkingNow) {
          barGrad.addColorStop(0, '#fbbf24');
          barGrad.addColorStop(1, '#d97706');
        } else {
          barGrad.addColorStop(0, '#475569');
          barGrad.addColorStop(1, '#334155');
        }
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 4);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [liveStatus, isMuted, isPaused]);

  const schedulePcm24kAudio = useCallback((base64Pcm: string) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackCtxRef.current.currentTime;
      }
      const ctx = playbackCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const float32 = base64Int16ToFloat32(base64Pcm);
      if (float32.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime + 0.02, nextPlayTimeRef.current);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;
      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0 && sessionActiveRef.current && !isPausedRef.current) {
          setLiveStatus(isMutedRef.current ? 'muted' : 'listening');
        }
      };
      source.start(startAt);
      setLiveStatus('speaking');
    } catch {
      // Ignore Web Audio scheduling error cleanly
    }
  }, []);

  const speakSentenceChunk = useCallback(
    (sentence: string, targetLanguage: string, autoContinueListening = false) => {
      const clean = sentence.replace(/[*`#]/g, '').trim();
      if (!clean || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(clean);
      const targetBcp = getBcp47ForLanguage(targetLanguage);
      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = pickPreferredSpeechVoice(voices, targetLanguage);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
      utterance.lang = chosenVoice?.lang || targetBcp;
      utterance.rate = Math.min(2, Math.max(0.5, speechRate));
      utterance.pitch = Math.min(2, Math.max(0.5, speechPitch));
      activeUtteranceCountRef.current += 1;
      utterance.onstart = () => setLiveStatus('speaking');
      const finishChunk = () => {
        activeUtteranceCountRef.current = Math.max(0, activeUtteranceCountRef.current - 1);
        if (activeUtteranceCountRef.current === 0) {
          if (sessionActiveRef.current && !isPausedRef.current) {
            setLiveStatus(isMutedRef.current ? 'muted' : 'listening');
            if (autoContinueListening && recognitionRef.current && !isMutedRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                // ignore if already running
              }
            }
          } else {
            setLiveStatus(sessionActiveRef.current ? 'paused' : 'idle');
          }
        }
      };
      utterance.onend = finishChunk;
      utterance.onerror = finishChunk;
      setLiveStatus('speaking');
      window.speechSynthesis.speak(utterance);
    },
    [speechPitch, speechRate]
  );

  const speakWithBrowserOrGeminiTts = useCallback(
    async (text: string, targetLanguage: string, autoContinueListening = false) => {
      const cleanText = text.replace(/[*`#]/g, '').trim();
      if (!cleanText) return;
      lastAiReplyRef.current = cleanText;
      stopAllPlayback();

      // Use Studio Gemini Sulafat WAV TTS only when instant streaming speech mode is switched OFF
      if (liveReady && !instantSpeechMode) {
        try {
          setLiveStatus('speaking');
          const resp = await authFetch('/api/ai/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText.slice(0, 900),
              language: targetLanguage,
              voicePreset,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.audioBase64) {
              const audio = new Audio(
                `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
              );
              htmlAudioRef.current = audio;
              audio.playbackRate = Math.min(2, Math.max(0.5, speechRate));
              audio.onended = () => {
                if (sessionActiveRef.current && !isPausedRef.current) {
                  setLiveStatus(isMutedRef.current ? 'muted' : 'listening');
                  if (autoContinueListening && recognitionRef.current && !isMutedRef.current) {
                    try {
                      recognitionRef.current.start();
                    } catch {
                      // ignore
                    }
                  }
                } else {
                  setLiveStatus(sessionActiveRef.current ? 'paused' : 'idle');
                }
              };
              await audio.play();
              return;
            }
          }
        } catch {
          // Fall through cleanly to instant Web Speech API
        }
      }

      // Fast Browser SpeechSynthesis prioritizing Indian English (en-IN) or active Indian language
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speakSentenceChunk(cleanText, targetLanguage, autoContinueListening);
        return;
      }

      setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
    },
    [instantSpeechMode, liveReady, speakSentenceChunk, speechRate, stopAllPlayback, voicePreset]
  );

  const appendTurn = useCallback((role: 'user' | 'ai', text: string, lang: string) => {
    const clean = text.trim();
    if (!clean) return;
    const turnId = `vt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        role,
        text: clean,
        language: lang,
        createdAt: new Date().toISOString(),
      },
    ]);
    return turnId;
  }, []);

  const processUserUtterance = useCallback(
    async (rawUtterance: string) => {
      const clean = rawUtterance.trim();
      if (!clean) return;
      setErrorMsg(null);
      setStatusNotice(null);

      const cmd = parseLiveVoiceCommand(clean);

      if (cmd.type === 'stop_speaking') {
        stopAllPlayback();
        setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
        setStatusNotice('Stopped AI speech immediately.');
        return;
      }

      if (cmd.type === 'pause') {
        stopAllPlayback();
        setIsPaused(true);
        setLiveStatus('paused');
        setStatusNotice('Conversation paused. Tap Resume or say anything to continue.');
        return;
      }

      if (cmd.type === 'wake') {
        appendTurn('user', clean, language);
        const greeting = `Hi ${profile.displayName}! I'm Muse, ready to help you in ${language}. What would you like to learn or talk about?`;
        appendTurn('ai', greeting, language);
        speakWithBrowserOrGeminiTts(greeting, language, true);
        return;
      }

      if (cmd.type === 'repeat') {
        appendTurn('user', clean, language);
        if (lastAiReplyRef.current) {
          speakWithBrowserOrGeminiTts(lastAiReplyRef.current, language, true);
        } else {
          const msg = 'I haven’t answered a question yet. Go ahead and ask me anything!';
          appendTurn('ai', msg, language);
          speakWithBrowserOrGeminiTts(msg, language, true);
        }
        return;
      }

      if (cmd.type === 'new_conversation') {
        stopAllPlayback();
        setTurns([]);
        lastAiReplyRef.current = '';
        setElapsedSeconds(0);
        setStatusNotice('Started a fresh live conversation.');
        return;
      }

      if (cmd.type === 'remember_prompt') {
        appendTurn('user', clean, language);
        setPendingRememberConfirm(true);
        const confirmLine =
          'Would you like me to save this voice conversation to your Saved Notes? Tap Confirm Save below or cancel.';
        appendTurn('ai', confirmLine, language);
        speakWithBrowserOrGeminiTts(confirmLine, language, false);
        return;
      }

      if (cmd.type === 'change_language') {
        const nextLang = cmd.targetLanguage || language;
        setLanguage(nextLang);
        appendTurn('user', clean, nextLang);
        const ack = cmd.targetLanguage
          ? `Sure! I have switched our conversation language to ${nextLang}. Please ask your next question.`
          : `Which language would you like to switch to? You can choose from ${LANGUAGES.slice(0, 8).join(', ')}, and more.`;
        appendTurn('ai', ack, nextLang);
        speakWithBrowserOrGeminiTts(ack, nextLang, true);
        return;
      }

      if (cmd.type === 'read_aloud' && cmd.argument) {
        appendTurn('user', clean, language);
        appendTurn('ai', cmd.argument, language);
        speakWithBrowserOrGeminiTts(cmd.argument, language, true);
        return;
      }

      if (cmd.type === 'search' && cmd.argument && onOpenSearch) {
        appendTurn('user', clean, language);
        setStatusNotice(`Searching Nano AI resources for "${cmd.argument}"...`);
      } else {
        appendTurn('user', clean, language);
      }

      const activeLang = cmd.type === 'translate' && cmd.targetLanguage ? cmd.targetLanguage : language;
      if (cmd.type === 'translate' && cmd.targetLanguage) {
        setLanguage(cmd.targetLanguage);
      }

      // If live Gemini WebSocket session is open, route text directly into live session
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && transportLabel === 'gemini_live') {
        setLiveStatus('thinking');
        wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
        return;
      }

      // Fast low-latency streaming response: speak complete sentences immediately as they arrive!
      setLiveStatus('thinking');
      stopAllPlayback();

      if (instantSpeechMode) {
        const controller = new AbortController();
        streamAbortRef.current = controller;
        const aiTurnId = `vt_${Date.now()}_stream`;
        let fullAnswer = '';
        let speechBuffer = '';
        let hasSpokenAny = false;

        try {
          const resp = await authFetch('/api/ai/voice-converse/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              question: clean,
              commandType: cmd.type,
              board: profile.board,
              classLevel: profile.classLevel,
              displayName: profile.displayName,
              academicGoal: profile.academicGoal,
              language: activeLang,
              history: turnsRef.current.slice(-6).map((t) => ({ role: t.role, text: t.text })),
            }),
          });

          const contentType = resp.headers.get('content-type') || '';
          if (resp.ok && resp.body && contentType.includes('text/event-stream')) {
            setTurns((prev) => [
              ...prev,
              {
                id: aiTurnId,
                role: 'ai',
                text: '...',
                language: activeLang,
                createdAt: new Date().toISOString(),
              },
            ]);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split('\n');
              sseBuffer = lines.pop() ?? '';

              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const payloadRaw = line.slice(5).trim();
                if (!payloadRaw) continue;
                let evt: { delta?: string; answer?: string; done?: boolean; error?: string };
                try {
                  evt = JSON.parse(payloadRaw);
                } catch {
                  continue;
                }
                if (evt.error) {
                  throw new Error(evt.error);
                }
                if (evt.delta) {
                  fullAnswer += evt.delta;
                  speechBuffer += evt.delta;
                  const { sentences, remainder } = extractCompleteSpeechSentences(speechBuffer);
                  if (sentences.length > 0) {
                    speechBuffer = remainder;
                    for (const s of sentences) {
                      hasSpokenAny = true;
                      speakSentenceChunk(s, activeLang, false);
                    }
                  }
                  const snapshot = fullAnswer.trim();
                  setTurns((prev) =>
                    prev.map((t) => (t.id === aiTurnId ? { ...t, text: snapshot || '...' } : t))
                  );
                }
                if (evt.done) {
                  if (evt.answer && evt.answer.trim()) {
                    fullAnswer = evt.answer.trim();
                  }
                  const leftover = speechBuffer.replace(/[*`#]/g, '').trim();
                  if (leftover) {
                    speechBuffer = '';
                    hasSpokenAny = true;
                    speakSentenceChunk(leftover, activeLang, sessionActiveRef.current);
                  } else if (!hasSpokenAny && fullAnswer) {
                    speakSentenceChunk(fullAnswer, activeLang, sessionActiveRef.current);
                  }
                }
              }
            }

            if (fullAnswer.trim()) {
              lastAiReplyRef.current = fullAnswer.trim();
              setTurns((prev) =>
                prev.map((t) => (t.id === aiTurnId ? { ...t, text: fullAnswer.trim() } : t))
              );
              if (activeUtteranceCountRef.current === 0 && !speechBuffer.trim()) {
                setLiveStatus(sessionActiveRef.current ? (isMutedRef.current ? 'muted' : 'listening') : 'idle');
              }
              return;
            }
          }
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          setTurns((prev) => prev.filter((t) => t.id !== aiTurnId || (t.text && t.text !== '...')));
          if (err instanceof Error && err.message && !err.message.includes('network')) {
            // Fall through cleanly to single-shot JSON endpoint below
          }
        } finally {
          if (streamAbortRef.current === controller) {
            streamAbortRef.current = null;
          }
        }
      }

      // Single-shot JSON endpoint fallback (used for Studio Sulafat Audio or if stream failed)
      try {
        const resp = await authFetch('/api/ai/voice-converse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: clean,
            commandType: cmd.type,
            board: profile.board,
            classLevel: profile.classLevel,
            displayName: profile.displayName,
            academicGoal: profile.academicGoal,
            language: activeLang,
            history: turnsRef.current.slice(-6).map((t) => ({ role: t.role, text: t.text })),
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setErrorMsg(data.error || 'Live Voice AI could not generate an answer right now.');
          setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
          return;
        }
        appendTurn('ai', data.answer, activeLang);
        await speakWithBrowserOrGeminiTts(data.answer, activeLang, sessionActiveRef.current);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Network error reaching Live Voice AI.');
        setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
      }
    },
    [
      appendTurn,
      instantSpeechMode,
      language,
      onOpenSearch,
      profile.academicGoal,
      profile.board,
      profile.classLevel,
      profile.displayName,
      speakSentenceChunk,
      speakWithBrowserOrGeminiTts,
      stopAllPlayback,
      transportLabel,
    ]
  );

  const startSpeechFallbackLoop = useCallback(
    (stream?: MediaStream) => {
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const RecCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!RecCtor) {
        setTransportLabel('speech_fallback');
        setSessionActive(true);
        setLiveStatus('listening');
        setStatusNotice(
          'Live microphone streaming connected (type or tap Quick Commands below if browser speech recognition is unavailable).'
        );
        return;
      }

      const recognition = new RecCtor();
      recognition.lang = getBcp47ForLanguage(language);
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalCaptured = '';
      recognition.onresult = (event) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          combined += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalCaptured = combined;
          }
        }
        setInterimTranscript(combined);
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone permission was blocked. Grant microphone permission or type below.');
          setSessionActive(false);
          setLiveStatus('idle');
        }
      };

      recognition.onend = () => {
        setInterimTranscript('');
        if (finalCaptured.trim()) {
          const captured = finalCaptured;
          finalCaptured = '';
          processUserUtterance(captured);
        } else if (sessionActiveRef.current && !isPausedRef.current && !isMutedRef.current) {
          setTimeout(() => {
            if (sessionActiveRef.current && !isPausedRef.current && !isMutedRef.current) {
              try {
                recognition.start();
              } catch {
                // ignore
              }
            }
          }, 60);
        }
      };

      recognitionRef.current = recognition;
      setTransportLabel('speech_fallback');
      setSessionActive(true);
      setLiveStatus('listening');
      if (stream) {
        mediaStreamRef.current = stream;
      }
      try {
        recognition.start();
      } catch {
        // ignore
      }
    },
    [language, processUserUtterance]
  );

  const connectLiveWebSocket = useCallback(
    async (stream: MediaStream | null) => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) {
          startSpeechFallbackLoop(stream || undefined);
          return;
        }
        intentionalCloseRef.current = false;
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProto}//${window.location.host}/api/live-voice`, [`bearer.${token}`]);
        wsRef.current = ws;

        const fallbackTimeout = window.setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            intentionalCloseRef.current = true;
            ws.close();
            startSpeechFallbackLoop(stream || undefined);
          }
        }, 1000);

        ws.onopen = () => {
          window.clearTimeout(fallbackTimeout);
          ws.send(
            JSON.stringify({
              type: 'start',
              language,
              voicePreset,
              profile: {
                displayName: profile.displayName,
                board: profile.board,
                classLevel: profile.classLevel,
                preferredLanguage: profile.preferredLanguage,
                academicGoal: profile.academicGoal,
                voicePreset,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data || '{}'));
            if (msg.type === 'ready') {
              reconnectAttemptsRef.current = 0;
              if (msg.model) setActiveModel(String(msg.model));
              if (msg.voiceName) setActiveVoiceName(String(msg.voiceName));
              setTransportLabel('gemini_live');
              setSessionActive(true);
              setLiveStatus('listening');
              setStatusNotice(
                `Connected to Muse (${msg.voiceName || voicePreset}) · Indian English & Indian Languages. Speak naturally!`
              );

              if (stream && micAudioCtxRef.current && !processorRef.current) {
                const ctx = micAudioCtxRef.current;
                const src = ctx.createMediaStreamSource(stream);
                const processor = ctx.createScriptProcessor(2048, 1, 1);
                processorRef.current = processor;
                processor.onaudioprocess = (ev) => {
                  if (isMutedRef.current || isPausedRef.current || ws.readyState !== WebSocket.OPEN) return;
                  const inputData = ev.inputBuffer.getChannelData(0);
                  const downsampled = downsampleBuffer(inputData, ctx.sampleRate, 16000);
                  const b64 = pcmFloat32ToInt16Base64(downsampled);
                  ws.send(JSON.stringify({ type: 'audio', data: b64 }));
                };
                src.connect(processor);
                processor.connect(ctx.destination);
              }
            } else if (msg.type === 'input_transcript' && msg.text) {
              liveInputBufferRef.current = `${liveInputBufferRef.current} ${msg.text}`.trim();
              setInterimTranscript(liveInputBufferRef.current);
            } else if (msg.type === 'output_transcript' && msg.text) {
              if (liveInputBufferRef.current) {
                appendTurn('user', liveInputBufferRef.current, language);
                liveInputBufferRef.current = '';
                setInterimTranscript('');
              }
              liveOutputBufferRef.current = `${liveOutputBufferRef.current} ${msg.text}`.trim();
            } else if (msg.type === 'audio' && msg.data) {
              schedulePcm24kAudio(msg.data);
            } else if (msg.type === 'interrupted') {
              stopAllPlayback();
              setLiveStatus('listening');
            } else if (msg.type === 'turn_complete') {
              if (liveInputBufferRef.current) {
                appendTurn('user', liveInputBufferRef.current, language);
                liveInputBufferRef.current = '';
                setInterimTranscript('');
              }
              if (liveOutputBufferRef.current) {
                lastAiReplyRef.current = liveOutputBufferRef.current;
                appendTurn('ai', liveOutputBufferRef.current, language);
                liveOutputBufferRef.current = '';
              }
              if (activeSourcesRef.current.length === 0 && sessionActiveRef.current) {
                setLiveStatus(isMutedRef.current ? 'muted' : 'listening');
              }
            } else if (msg.type === 'error') {
              intentionalCloseRef.current = true;
              ws.close();
              if (msg.code === 'AI_NOT_CONFIGURED') {
                setErrorMsg(msg.message);
              }
              startSpeechFallbackLoop(stream || undefined);
            }
          } catch {
            // ignore malformed WS frames
          }
        };

        ws.onerror = () => {
          window.clearTimeout(fallbackTimeout);
          if (!intentionalCloseRef.current) {
            startSpeechFallbackLoop(stream || undefined);
          }
        };

        ws.onclose = () => {
          window.clearTimeout(fallbackTimeout);
          if (
            !intentionalCloseRef.current &&
            sessionActiveRef.current &&
            transportLabel === 'gemini_live' &&
            reconnectAttemptsRef.current < 2
          ) {
            reconnectAttemptsRef.current += 1;
            setStatusNotice(`Reconnecting Muse Live Voice (${reconnectAttemptsRef.current}/2)...`);
            window.setTimeout(() => {
              if (sessionActiveRef.current && !intentionalCloseRef.current) {
                connectLiveWebSocket(mediaStreamRef.current);
              }
            }, 900);
          }
        };
      } catch {
        startSpeechFallbackLoop(stream || undefined);
      }
    },
    [
      appendTurn,
      language,
      profile.academicGoal,
      profile.board,
      profile.classLevel,
      profile.displayName,
      profile.preferredLanguage,
      schedulePcm24kAudio,
      startSpeechFallbackLoop,
      stopAllPlayback,
      transportLabel,
      voicePreset,
    ]
  );

  const startLiveTalk = async () => {
    setErrorMsg(null);
    setStatusNotice(null);
    reconnectAttemptsRef.current = 0;
    intentionalCloseRef.current = false;
    stopAllPlayback();
    teardownMicAndWs();
    setElapsedSeconds(0);
    setIsMuted(false);
    setIsPaused(false);
    setLiveStatus('connecting');

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        startSpeechFallbackLoop();
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        micAudioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
    } catch {
      setErrorMsg(
        'Microphone access was denied or unavailable. Please allow microphone permission in your browser settings, or type your message below.'
      );
      setLiveStatus('idle');
      return;
    }

    if (liveReady === false) {
      startSpeechFallbackLoop(stream || undefined);
      return;
    }

    connectLiveWebSocket(stream);
  };

  const endLiveConversation = () => {
    intentionalCloseRef.current = true;
    reconnectAttemptsRef.current = 0;
    stopAllPlayback();
    teardownMicAndWs();
    setSessionActive(false);
    setIsMuted(false);
    setIsPaused(false);
    setLiveStatus('ended');
    setInterimTranscript('');
  };

  const handleInterruptAndListen = () => {
    stopAllPlayback();
    setIsPaused(false);
    setLiveStatus(isMuted ? 'muted' : 'listening');
    setStatusNotice('Interrupted AI response — listening to your next question.');
    if (recognitionRef.current && !isMuted) {
      try {
        recognitionRef.current.start();
      } catch {
        // ignore
      }
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    if (nextMuted) {
      setLiveStatus('muted');
    } else if (!isPaused && sessionActive) {
      setLiveStatus('listening');
    }
  };

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      stopAllPlayback();
      setLiveStatus('paused');
    } else {
      setLiveStatus(isMuted ? 'muted' : 'listening');
    }
  };

  const confirmSaveConversation = () => {
    if (!onSaveRememberedNote || turns.length === 0) {
      setPendingRememberConfirm(false);
      return;
    }
    const content = turns
      .map((t) => `${t.role === 'user' ? 'You' : 'Muse AI'}: ${t.text}`)
      .join('\n\n');
    onSaveRememberedNote({
      id: `note_voice_${Date.now()}`,
      subject: 'Voice AI Conversation',
      title: `Live Talk Session (${language}) — ${new Date().toLocaleDateString()}`,
      content,
      updatedAt: new Date().toISOString(),
    });
    setPendingRememberConfirm(false);
    setStatusNotice('Saved this Live Talk conversation to Revision Centre → Saved Notes.');
  };

  const handleTestMuseVoice = () => {
    setErrorMsg(null);
    if (liveReady) {
      processUserUtterance(MUSE_TEST_PROMPT);
      return;
    }
    appendTurn('user', MUSE_TEST_PROMPT, language);
    appendTurn('ai', MUSE_TEST_EXPECTED_INTRO, language);
    setStatusNotice(
      `Playing Muse voice preview (${activeVoiceName} · Indian English style). Add GEMINI_API_KEY in server Secrets for full live conversational Gemini audio.`
    );
    speakWithBrowserOrGeminiTts(MUSE_TEST_EXPECTED_INTRO, language, false);
  };

  const persistVoicePrefs = (
    nextAutoSpeak: boolean,
    nextRate: number,
    nextPreset: string,
    nextPitch: number
  ) => {
    setVoiceAutoSpeak(nextAutoSpeak);
    setSpeechRate(nextRate);
    setVoicePreset(nextPreset);
    setActiveVoiceName(nextPreset);
    setSpeechPitch(nextPitch);
    onSaveVoicePreference?.(nextAutoSpeak, nextRate, nextPreset, nextPitch);
  };

  const activePresetMeta =
    GEMINI_VOICE_PRESETS.find((v) => v.id === voicePreset) || GEMINI_VOICE_PRESETS[0];

  const statusBadgeLabel: Record<LiveVoiceStatus, string> = {
    idle: 'Ready to Talk',
    connecting: 'Connecting Live Voice...',
    listening: 'Listening Naturally...',
    thinking: 'Muse is Thinking...',
    speaking: 'Muse is Speaking',
    paused: 'Conversation Paused',
    muted: 'Microphone Muted',
    ended: 'Session Ended',
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Top Mode, Muse Voice Identity & Language Header */}
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-[#0f172a] via-[#131836] to-[#1e103d] border border-purple-500/25">
        <div className="flex items-center gap-4">
          {/* Animated Muse Voice Avatar */}
          <div
            data-testid="muse-voice-avatar"
            className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              liveStatus === 'speaking'
                ? 'bg-gradient-to-br from-purple-600 to-blue-600 border-purple-300/60 shadow-lg shadow-purple-500/30 animate-pulse'
                : liveStatus === 'listening'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-sky-300/60 shadow-lg shadow-sky-500/25'
                  : liveStatus === 'thinking' || liveStatus === 'connecting'
                    ? 'bg-gradient-to-br from-amber-500/80 to-purple-700 border-amber-300/60 animate-pulse'
                    : 'bg-gradient-to-br from-indigo-950 to-purple-950 border-purple-400/30'
            }`}
          >
            <Bot className="w-7 h-7 text-white" />
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0f172a] ${
                liveStatus === 'speaking'
                  ? 'bg-purple-400'
                  : liveStatus === 'listening'
                    ? 'bg-sky-400'
                    : liveStatus === 'muted' || liveStatus === 'paused'
                      ? 'bg-rose-400'
                      : 'bg-emerald-400'
              }`}
            />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-300">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span>NANO AI LIVE · FRIENDLY ASSISTANT · INDIAN ENGLISH (en-IN)</span>
            </div>
            <h1 className="font-display font-bold text-xl text-white">Live Talk &amp; Nano Voice AI</h1>
            <p className="text-xs text-slate-300">
              Voice: <strong className="text-purple-200">{activePresetMeta.label}</strong> · Mode: <strong className="text-sky-200">{instantSpeechMode ? 'Instant Streaming Voice (<1s)' : 'Studio Gemini Sulafat Audio'}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('live_talk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                viewMode === 'live_talk' ? 'muse-btn-primary' : 'text-[var(--text-secondary)]'
              }`}
            >
              Live Talk
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                viewMode === 'classic' ? 'muse-btn-primary' : 'text-[var(--text-secondary)]'
              }`}
            >
              Classic Voice Q&amp;A
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <select
              aria-label="Voice AI language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowVoiceSettings((v) => !v)}
            aria-expanded={showVoiceSettings}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-purple-400/50 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span>Voice Settings</span>
          </button>
        </div>
      </div>

      {showVoiceSettings && (
        <div
          data-testid="voice-ai-settings-panel"
          className="muse-card p-4 border border-purple-500/30 grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
        >
          <div className="space-y-1">
            <label htmlFor="voice-ai-preset" className="text-[11px] font-semibold text-[var(--text-muted)] block">
              Nano Voice Preset
            </label>
            <select
              id="voice-ai-preset"
              value={voicePreset}
              onChange={(e) => persistVoicePrefs(voiceAutoSpeak, speechRate, e.target.value, speechPitch)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs"
            >
              {GEMINI_VOICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="voice-ai-speed-mode" className="text-[11px] font-semibold text-[var(--text-muted)] block">
              Response Audio Engine
            </label>
            <button
              id="voice-ai-speed-mode"
              type="button"
              onClick={() => setInstantSpeechMode((v) => !v)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border transition text-left ${
                instantSpeechMode
                  ? 'bg-sky-600/20 border-sky-400/50 text-sky-200'
                  : 'bg-purple-600/20 border-purple-400/50 text-purple-200'
              }`}
            >
              {instantSpeechMode ? 'Instant Streaming Voice (Fastest)' : 'Studio Gemini Sulafat Audio'}
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="voice-ai-rate" className="text-[11px] font-semibold text-[var(--text-muted)] block">
              Speaking Speed ({speechRate.toFixed(2)}x)
            </label>
            <input
              id="voice-ai-rate"
              type="range"
              min="0.7"
              max="1.5"
              step="0.05"
              value={speechRate}
              onChange={(e) =>
                persistVoicePrefs(voiceAutoSpeak, Number(e.target.value), voicePreset, speechPitch)
              }
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="voice-ai-pitch" className="text-[11px] font-semibold text-[var(--text-muted)] block">
              Pitch ({speechPitch.toFixed(2)})
            </label>
            <input
              id="voice-ai-pitch"
              type="range"
              min="0.7"
              max="1.4"
              step="0.05"
              value={speechPitch}
              onChange={(e) =>
                persistVoicePrefs(voiceAutoSpeak, speechRate, voicePreset, Number(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTestMuseVoice}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold muse-btn-primary w-full whitespace-nowrap"
            >
              Test Nano Voice
            </button>
            {voicePreset !== DEFAULT_MUSE_VOICE_PRESET && (
              <button
                type="button"
                onClick={() => persistVoicePrefs(voiceAutoSpeak, 1.0, DEFAULT_MUSE_VOICE_PRESET, 1.0)}
                className="px-3 py-2 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="px-2 py-1 rounded bg-amber-500/20 font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/40 text-xs text-sky-200 flex items-center justify-between gap-3">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-sky-300 font-semibold hover:underline shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {pendingRememberConfirm && (
        <div className="muse-card p-4 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <BookmarkCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Save Conversation?</strong> Confirm before saving this Live Talk transcript into your Saved Notes.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmSaveConversation}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold muse-btn-primary"
            >
              Confirm Save
            </button>
            <button
              type="button"
              onClick={() => setPendingRememberConfirm(false)}
              className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Live Voice Stage Card */}
      <div className="muse-card p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                liveStatus === 'listening'
                  ? 'bg-sky-400 animate-pulse'
                  : liveStatus === 'speaking'
                    ? 'bg-purple-400 animate-pulse'
                    : liveStatus === 'thinking' || liveStatus === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : liveStatus === 'muted' || liveStatus === 'paused'
                        ? 'bg-rose-400'
                        : 'bg-slate-500'
              }`}
            />
            <span data-testid="live-voice-status" className="text-xs font-semibold">
              {statusBadgeLabel[liveStatus]}
            </span>
            {sessionActive && (
              <span className="text-[11px] text-[var(--text-muted)]">
                · {transportLabel === 'gemini_live' ? `Gemini Live (${activeModel} · ${activeVoiceName})` : `Muse Fallback (${activeVoiceName} · en-IN)`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              Session Timer: <strong data-testid="live-voice-timer">{formatDurationTimer(elapsedSeconds)}</strong>
            </span>
          </div>
        </div>

        {/* Animated Waveform Visualizer */}
        <div className="space-y-2.5">
          {viewMode === 'live_talk' && !sessionActive && turns.length === 0 && (
            <div className="rounded-xl bg-[#0f172a]/85 border border-purple-500/20 px-4 py-3 text-center">
              <div className="text-sm font-display font-bold text-white">
                Hello {profile.displayName}! I&apos;m Muse ({activeVoiceName}), your friendly AI partner.
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Press Start Talking below, test Muse&apos;s voice, or speak naturally in {language}.
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={820}
            height={128}
            data-testid="voice-waveform-canvas"
            aria-label="Live Voice AI real-time audio waveform"
            className="w-full h-32 rounded-2xl border border-purple-500/25 block"
          />
        </div>

        {/* Large Primary Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {!sessionActive ? (
              <button
                type="button"
                onClick={startLiveTalk}
                className="px-5 py-3 rounded-2xl text-xs font-bold muse-btn-primary flex items-center gap-2 shadow-lg"
              >
                <Mic className="w-4 h-4" />
                <span>{viewMode === 'live_talk' ? 'Start Talking (Live Mode)' : 'Start Microphone'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={endLiveConversation}
                className="px-5 py-3 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Conversation</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTestMuseVoice}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600/20 border border-purple-500/40 text-purple-200 hover:bg-purple-600/30 flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5 text-purple-300" />
              <span>Test Muse Voice</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              disabled={!sessionActive}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] disabled:opacity-40 flex items-center gap-1.5"
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-sky-400" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePause}
              disabled={!sessionActive}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] disabled:opacity-40 flex items-center gap-1.5"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleInterruptAndListen}
              disabled={liveStatus !== 'speaking' && !lastAiReplyRef.current}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600/20 border border-purple-500/40 text-purple-300 disabled:opacity-40 flex items-center gap-1.5"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Interrupt AI &amp; Listen</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAllPlayback();
                if (sessionActive) setLiveStatus(isMuted ? 'muted' : 'listening');
              }}
              disabled={liveStatus !== 'speaking'}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] disabled:opacity-40 flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Audio</span>
            </button>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{micSupported ? 'Mic active only during session' : 'Text-to-Voice Fallback Active'}</span>
          </div>
        </div>

        {interimTranscript && (
          <div className="muse-panel p-3 text-xs">
            <span className="font-semibold text-sky-400">Hearing: </span>
            <span>{interimTranscript}</span>
          </div>
        )}

        {/* Smart Conversation Voice Commands Quick Bar */}
        <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Say or Tap a Smart Voice Command</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Explain more',
              'Make it simple',
              'Give me an example',
              'Repeat that',
              'Summarize this',
              'Remember this conversation',
              'Change your language to Telugu',
              'Stop talking',
            ].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => processUserUtterance(cmd)}
                className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 transition"
              >
                &ldquo;{cmd}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Text Fallback / Live Conversation Prompt */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualInput.trim()) return;
            const text = manualInput;
            setManualInput('');
            processUserUtterance(text);
          }}
          className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1"
        >
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={`Talk or type to Muse AI in ${language} (e.g., "Explain photosynthesis simply")...`}
            aria-label="Live Voice AI text fallback prompt"
            className="flex-1 min-w-0 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={liveStatus === 'thinking' || !manualInput.trim()}
            className="w-full sm:w-auto justify-center shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold muse-btn-primary disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send &amp; Speak</span>
          </button>
        </form>
      </div>

      {/* Live Conversation Transcript */}
      <div className="muse-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-400" />
            <span>Live Conversation Transcript ({turns.length} turns)</span>
          </h2>
          <div className="flex items-center gap-3">
            {turns.length > 0 && onSaveRememberedNote && (
              <button
                type="button"
                onClick={() => setPendingRememberConfirm(true)}
                className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                Save Conversation
              </button>
            )}
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  stopAllPlayback();
                  setTurns([]);
                  lastAiReplyRef.current = '';
                }}
                className="text-xs text-[var(--text-muted)] hover:text-rose-400 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Conversation
              </button>
            )}
          </div>
        </div>

        {turns.length === 0 ? (
          <div className="muse-panel p-5 text-xs text-[var(--text-muted)] space-y-1.5">
            <p>
              No live turns yet. Tap <strong>Start Talking (Live Mode)</strong>, tap any smart voice command chip, or type a question above.
            </p>
            <p>
              Supports interruption (&ldquo;Stop&rdquo; / Interrupt button), &ldquo;Wait&rdquo;, &ldquo;Repeat that&rdquo;, &ldquo;Explain more&rdquo;, &ldquo;Make it simple&rdquo;, &ldquo;Give me an example&rdquo;, &ldquo;Summarize this&rdquo;, and switching languages across 23 Indian languages.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-4 rounded-xl border space-y-1.5 ${
                  turn.role === 'user'
                    ? 'bg-blue-600/10 border-blue-500/30'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="font-semibold">
              {turn.role === 'user' ? 'You' : 'Nano AI'} · {turn.language} ·{' '}
                    {new Date(turn.createdAt).toLocaleTimeString()}
                  </span>
                  {turn.role === 'ai' && (
                    <button
                      type="button"
                      onClick={() => speakWithBrowserOrGeminiTts(turn.text, turn.language, false)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-blue-400 font-semibold flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Replay
                    </button>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
