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
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LANGUAGES } from '../data/curriculumSeed';
import { getBcp47ForLanguage } from '../data/educationRegistry';
import {
  LiveConversationTurn,
  LiveVoiceStatus,
  SavedNote,
  UserProfile,
} from '../types/muse';
import {
  base64Int16ToFloat32,
  formatDurationTimer,
  parseLiveVoiceCommand,
  pcmFloat32ToInt16Base64,
} from '../utils/liveVoiceUtils';

interface VoiceAIViewProps {
  profile: UserProfile;
  onSaveVoicePreference?: (voiceAutoSpeak: boolean, speechRate: number) => void;
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
  onSaveRememberedNote,
  onOpenSearch,
}) => {
  const [viewMode, setViewMode] = useState<'live_talk' | 'classic'>('live_talk');
  const [language, setLanguage] = useState(profile.preferredLanguage || 'English');
  const [speechRate, setSpeechRate] = useState(profile.speechRate ?? 1.0);
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
  const turnsRef = useRef<LiveConversationTurn[]>([]);

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

  const speakWithBrowserOrGeminiTts = useCallback(
    async (text: string, targetLanguage: string, autoContinueListening = false) => {
      const cleanText = text.replace(/[*`#]/g, '').trim();
      if (!cleanText) return;
      lastAiReplyRef.current = cleanText;
      stopAllPlayback();

      // Primary accessible voice playback via Web Speech API respecting speed & pitch sliders
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setLiveStatus('speaking');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = getBcp47ForLanguage(targetLanguage);
        utterance.rate = Math.min(2, Math.max(0.5, speechRate));
        utterance.pitch = Math.min(2, Math.max(0.5, Number(profile.speechPitch ?? 1.0)));
        utterance.onstart = () => setLiveStatus('speaking');
        utterance.onend = () => {
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
        };
        utterance.onerror = () => {
          setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
        };
        window.speechSynthesis.speak(utterance);
        return;
      }

      // Secondary high-quality Gemini TTS fallback for browsers without speechSynthesis
      try {
        setLiveStatus('speaking');
        const resp = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText.slice(0, 900), language: targetLanguage }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.audioBase64) {
            const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
            htmlAudioRef.current = audio;
            audio.playbackRate = speechRate;
            audio.onended = () => {
              setLiveStatus(sessionActiveRef.current ? (isMutedRef.current ? 'muted' : 'listening') : 'idle');
            };
            await audio.play();
            return;
          }
        }
      } catch {
        // Ignore TTS network fallback notice cleanly
      }
      setLiveStatus(sessionActiveRef.current ? 'listening' : 'idle');
    },
    [profile.speechPitch, speechRate, stopAllPlayback]
  );

  const appendTurn = useCallback((role: 'user' | 'ai', text: string, lang: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTurns((prev) => [
      ...prev,
      {
        id: `vt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role,
        text: clean,
        language: lang,
        createdAt: new Date().toISOString(),
      },
    ]);
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
        setStatusNotice(`Searching Muse AI resources for "${cmd.argument}"...`);
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

      // Otherwise call context-aware /api/ai/voice-converse + spoken TTS
      setLiveStatus('thinking');
      try {
        const resp = await fetch('/api/ai/voice-converse', {
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
            history: turnsRef.current.slice(-8).map((t) => ({ role: t.role, text: t.text })),
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
      language,
      onOpenSearch,
      profile.academicGoal,
      profile.board,
      profile.classLevel,
      profile.displayName,
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
          }, 350);
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

  const startLiveTalk = async () => {
    setErrorMsg(null);
    setStatusNotice(null);
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

    // Attempt Gemini Live WebSocket real-time speech-to-speech bridge first
    try {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProto}//${window.location.host}/api/live-voice`);
      wsRef.current = ws;

      const fallbackTimeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startSpeechFallbackLoop(stream || undefined);
        }
      }, 3000);

      ws.onopen = () => {
        window.clearTimeout(fallbackTimeout);
        ws.send(
          JSON.stringify({
            type: 'start',
            language,
            profile: {
              displayName: profile.displayName,
              board: profile.board,
              classLevel: profile.classLevel,
              preferredLanguage: profile.preferredLanguage,
              academicGoal: profile.academicGoal,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || '{}'));
          if (msg.type === 'ready') {
            setTransportLabel('gemini_live');
            setSessionActive(true);
            setLiveStatus('listening');
            setStatusNotice('Connected to Muse Live Voice (Real-Time Gemini Audio). Speak naturally!');

            if (stream && micAudioCtxRef.current) {
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
        startSpeechFallbackLoop(stream || undefined);
      };
    } catch {
      startSpeechFallbackLoop(stream || undefined);
    }
  };

  const endLiveConversation = () => {
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
      {/* Top Mode & Language Header */}
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-400">
            <Radio className="w-3.5 h-3.5" />
            <span>MUSE AI · LIVE VOICE CONVERSATION SYSTEM</span>
          </div>
          <h1 className="font-display font-bold text-xl">Live Talk &amp; Voice AI Companion</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Speak naturally, interrupt mid-answer, switch languages anytime, and get instant intelligent spoken responses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('live_talk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                viewMode === 'live_talk' ? 'muse-btn-primary' : 'text-[var(--text-secondary)]'
              }`}
            >
              Live Talk
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
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

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            <select
              aria-label="Voice speed"
              value={String(speechRate)}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="bg-transparent focus:outline-none tabular-nums"
            >
              <option value="0.85">0.85x Calm</option>
              <option value="1">1.0x Normal</option>
              <option value="1.2">1.2x Fast</option>
            </select>
          </div>
        </div>
      </div>

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
                · {transportLabel === 'gemini_live' ? 'Gemini Live Real-Time Audio' : 'Speech + Gemini Voice'}
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
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={820}
            height={160}
            data-testid="voice-waveform-canvas"
            aria-label="Live Voice AI real-time audio waveform"
            className="w-full h-40 rounded-2xl border border-[var(--border-subtle)]"
          />
          {viewMode === 'live_talk' && !sessionActive && turns.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
              <div className="text-sm font-display font-bold text-white/90">
                Hello {profile.displayName}! I&apos;m Muse, your live AI partner.
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Press Start Talking below or ask in {language} using voice or text.
              </div>
            </div>
          )}
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
                    {turn.role === 'user' ? 'You' : 'Muse AI'} · {turn.language} ·{' '}
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
