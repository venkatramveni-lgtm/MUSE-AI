import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  Compass,
  Copy,
  FileText,
  FileUp,
  MessageSquarePlus,
  Mic,
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { CORE_SUBJECTS, LANGUAGES } from '../data/curriculumSeed';
import { ChatMessage, ConversationThread, TeachingMode, UploadedDocItem, UserProfile } from '../types/muse';
import { validateDocumentUpload } from '../utils/plannerUtils';
import { authFetch } from '../services/firebaseClient';
import { pickPreferredSpeechVoice } from '../utils/liveVoiceUtils';

interface AITeacherViewProps {
  profile: UserProfile;
  conversations: ConversationThread[];
  uploadedDocs?: UploadedDocItem[];
  activeDocId?: string | null;
  onSelectActiveDoc?: (id: string | null) => void;
  initialSubject?: string;
  initialPrompt?: string | null;
  onConsumeInitialPrompt?: () => void;
  onSaveThread: (thread: ConversationThread) => void;
  onDeleteThread: (threadId: string) => void;
  onSaveUploadedDoc?: (doc: UploadedDocItem) => void;
  onOpenGlobalGuide?: () => void;
}

const TEACHING_MODES: { id: TeachingMode; label: string; desc: string }[] = [
  { id: 'general_qa', label: 'Answer Anything', desc: 'ChatGPT-style open Q&A on any question' },
  { id: 'explain_simply', label: 'Explain simply', desc: 'Clear everyday explanation' },
  { id: 'step_by_step', label: 'Step-by-step', desc: 'Numbered guided breakdown' },
  { id: 'give_examples', label: 'Give examples', desc: 'Real-world analogies' },
  { id: 'test_knowledge', label: 'Test my knowledge', desc: 'Explanation + quick quiz' },
  { id: 'summarize_topic', label: 'Summarize topic', desc: 'Crisp revision takeaways' },
  { id: 'help_revise', label: 'Help me revise', desc: 'Memory hooks & key terms' },
];

const SUBJECT_OPTIONS = ['Any Topic / General', ...CORE_SUBJECTS];

const STARTER_CARDS = [
  {
    category: 'General Tech',
    prompt: 'How does Wi-Fi work and why is 5 GHz faster than 2.4 GHz?',
  },
  {
    category: 'Science',
    prompt: 'Explain photosynthesis step by step with a simple analogy',
  },
  {
    category: 'Coding',
    prompt: 'Teach me Python for-loops with a short working code example',
  },
  {
    category: 'Mathematics',
    prompt: 'Why does a² + b² = c² work in right triangles?',
  },
];

function renderCodeAndPlain(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${i}`}
          className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-blue-400"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`b-${i}`} className="font-semibold text-[var(--text-primary)]">
          {renderCodeAndPlain(part.slice(2, -2), `b-${i}`)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`i-${i}`} className="italic text-[var(--text-secondary)]">
          {renderCodeAndPlain(part.slice(1, -1), `i-${i}`)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`c-${i}`}
          className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-blue-400"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`p-${i}`}>{part}</React.Fragment>;
  });
}

const FormattedAIMessage: React.FC<{ text: string }> = ({ text }) => {
  const segments = useMemo(() => {
    const blocks: { type: 'code' | 'text'; content: string; lang?: string }[] = [];
    const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      blocks.push({ type: 'code', lang: match[1] || 'code', content: match[2].trimEnd() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      blocks.push({ type: 'text', content: text.slice(lastIndex) });
    }
    return blocks;
  }, [text]);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-[var(--text-primary)]">
      {segments.map((seg, sIdx) => {
        if (seg.type === 'code') {
          return (
            <div
              key={sIdx}
              className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[#0b1221] text-slate-100"
            >
              <div className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-white/5 border-b border-white/10">
                {seg.lang}
              </div>
              <pre className="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{seg.content}</code>
              </pre>
            </div>
          );
        }

        const lines = seg.content.split('\n');
        return (
          <div key={sIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              if (/^#{1,3}\s+/.test(trimmed)) {
                const heading = trimmed.replace(/^#{1,3}\s+/, '');
                return (
                  <h4 key={lIdx} className="font-display font-bold text-sm pt-1 text-[var(--text-primary)]">
                    {renderInlineFormatting(heading)}
                  </h4>
                );
              }

              if (/^[-*•]\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="text-blue-400 font-bold mt-0.5">•</span>
                    <span className="flex-1">{renderInlineFormatting(trimmed.replace(/^[-*•]\s+/, ''))}</span>
                  </div>
                );
              }

              const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="text-blue-400 font-semibold min-w-[1.25rem]">{numMatch[1]}.</span>
                    <span className="flex-1">{renderInlineFormatting(numMatch[2])}</span>
                  </div>
                );
              }

              return <p key={lIdx}>{renderInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

export const AITeacherView: React.FC<AITeacherViewProps> = ({
  profile,
  conversations,
  uploadedDocs = [],
  activeDocId,
  onSelectActiveDoc,
  initialSubject,
  initialPrompt,
  onConsumeInitialPrompt,
  onSaveThread,
  onDeleteThread,
  onSaveUploadedDoc,
  onOpenGlobalGuide,
}) => {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    conversations[0]?.id ?? null
  );
  const [localDocId, setLocalDocId] = useState<string | null>(activeDocId ?? null);
  const [mode, setMode] = useState<TeachingMode>('general_qa');
  const [subject, setSubject] = useState<string>(initialSubject || 'Any Topic / General');
  const [language, setLanguage] = useState<string>(profile.preferredLanguage || 'English');
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [showArrows, setShowArrows] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handledPromptRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeDocId !== undefined) {
      setLocalDocId(activeDocId);
    }
  }, [activeDocId]);

  const effectiveDocId = activeDocId !== undefined ? activeDocId : localDocId;
  const setEffectiveDocId = (id: string | null) => {
    setLocalDocId(id);
    onSelectActiveDoc?.(id);
  };
  const attachedDoc = useMemo(
    () => uploadedDocs.find((d) => d.id === effectiveDocId) ?? null,
    [uploadedDocs, effectiveDocId]
  );

  useEffect(() => {
    if (initialSubject) {
      setSubject(initialSubject);
    }
  }, [initialSubject]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setAiConfigured(Boolean(d.aiConfigured)))
      .catch(() => setAiConfigured(null));
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeThread = useMemo(
    () => conversations.find((c) => c.id === activeThreadId) ?? null,
    [conversations, activeThreadId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, loading]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const startNewConversation = () => {
    const now = new Date().toISOString();
    const id = `conv_${Date.now()}`;
    const thread: ConversationThread = {
      id,
      uid: profile.uid,
      title: 'New Chat',
      mode,
      subject,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    onSaveThread(thread);
    setActiveThreadId(id);
    setErrorMsg(null);
  };

  const streamAIResponse = async (
    baseThread: ConversationThread,
    prompt: string,
    replaceAiMsgId?: string
  ) => {
    const aiMsgId = `msg_${Date.now()}_a`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      mode,
      suggestedFollowUps: [],
      sources: [],
      feedback: 'none',
      createdAt: new Date().toISOString(),
    };

    const documentContext = attachedDoc
      ? {
          name: attachedDoc.name,
          summary: attachedDoc.summary,
          keyPoints: attachedDoc.keyPoints,
        }
      : null;

    const payloadBody = JSON.stringify({
      question: prompt,
      mode,
      board: profile.board,
      classLevel: profile.classLevel,
      subject,
      language,
      history: baseThread.messages.slice(-8),
      documentContext,
    });

    const saveAiState = (msg: ChatMessage) => {
      const nextMessages = replaceAiMsgId
        ? baseThread.messages.map((m) => (m.id === replaceAiMsgId ? msg : m))
        : [...baseThread.messages, msg];
      onSaveThread({
        ...baseThread,
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      });
    };

    const streamResp = await authFetch('/api/ai/teach/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody,
    });

    const contentType = streamResp.headers.get('content-type') || '';
    if (!streamResp.ok || !contentType.includes('text/event-stream') || !streamResp.body) {
      if (streamResp.status === 401) {
        const errData = await streamResp.json().catch(() => ({}));
        setErrorMsg(errData.error || 'Please sign in with a verified account to ask Muse AI Teacher.');
        return;
      }
      // Fallback to standard JSON endpoint
      const resp = await authFetch('/api/ai/teach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadBody,
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.errorCode === 'AI_NOT_CONFIGURED') setAiConfigured(false);
        setErrorMsg(data.error || 'Muse AI could not respond right now.');
        return;
      }
      setAiConfigured(true);
      const aiMsg: ChatMessage = {
        ...initialAiMsg,
        text: data.answer,
        suggestedFollowUps: data.suggestedFollowUps || [],
        sources: Array.isArray(data.sources) ? data.sources : [],
      };
      saveAiState(aiMsg);
      if (profile.voiceAutoSpeak) speakText(aiMsg.id, aiMsg.text);
      return;
    }

    setAiConfigured(true);
    setStreamingMsgId(aiMsgId);
    setStreamingText('');
    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let finalFollowUps: string[] = [];
    let finalSources: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const evt of events) {
          const line = evt
            .split(/\r?\n/)
            .find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as {
              delta?: string;
              done?: boolean;
              answer?: string;
              suggestedFollowUps?: string[];
              sources?: string[];
              error?: string;
            };
            if (parsed.error) {
              setErrorMsg(parsed.error);
              return;
            }
            if (parsed.delta) {
              accumulated += parsed.delta;
              setStreamingText(accumulated);
            }
            if (parsed.done) {
              if (parsed.answer) {
                accumulated = parsed.answer;
                setStreamingText(accumulated);
              }
              finalFollowUps = parsed.suggestedFollowUps || [];
              finalSources = Array.isArray(parsed.sources) ? parsed.sources : [];
            }
          } catch {
            // Ignore malformed SSE partial frame
          }
        }
      }
    } finally {
      setStreamingMsgId(null);
      setStreamingText('');
    }

    if (accumulated.trim()) {
      const completedMsg: ChatMessage = {
        ...initialAiMsg,
        text: accumulated,
        suggestedFollowUps: finalFollowUps,
        sources: finalSources,
      };
      saveAiState(completedMsg);
      if (profile.voiceAutoSpeak) {
        speakText(completedMsg.id, completedMsg.text);
      }
    }
  };

  const sendMessage = async (questionText?: string) => {
    const prompt = (questionText ?? input).trim();
    if (!prompt || loading) return;

    setErrorMsg(null);
    setLoading(true);
    if (!questionText) setInput('');

    const now = new Date().toISOString();
    const targetThread: ConversationThread = activeThread ?? {
      id: `conv_${Date.now()}`,
      uid: profile.uid,
      title: prompt.slice(0, 48),
      mode,
      subject,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const studentMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'student',
      text: prompt,
      mode,
      feedback: 'none',
      createdAt: now,
    };

    const updatedWithStudent: ConversationThread = {
      ...targetThread,
      title: targetThread.messages.length === 0 ? prompt.slice(0, 56) : targetThread.title,
      mode,
      subject,
      messages: [...targetThread.messages, studentMsg],
      updatedAt: now,
    };

    onSaveThread(updatedWithStudent);
    setActiveThreadId(updatedWithStudent.id);

    try {
      await streamAIResponse(updatedWithStudent, prompt);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error reaching Muse AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (aiMsgId: string) => {
    if (!activeThread || loading) return;
    const idx = activeThread.messages.findIndex((m) => m.id === aiMsgId);
    if (idx <= 0) return;
    let promptMsg: ChatMessage | null = null;
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (activeThread.messages[i].sender === 'student') {
        promptMsg = activeThread.messages[i];
        break;
      }
    }
    if (!promptMsg) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await streamAIResponse(activeThread, promptMsg.text, aiMsgId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not regenerate response.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && handledPromptRef.current !== initialPrompt) {
      handledPromptRef.current = initialPrompt;
      onConsumeInitialPrompt?.();
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, onConsumeInitialPrompt]);

  const speakText = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setErrorMsg('Read-aloud is not supported in this browser.');
      return;
    }
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*`#]/g, ''));
    const chosenVoice = pickPreferredSpeechVoice(window.speechSynthesis.getVoices(), language);
    if (chosenVoice) utterance.voice = chosenVoice;
    utterance.lang = chosenVoice?.lang || 'en-IN';
    utterance.rate = Math.min(2, Math.max(0.5, Number(profile.speechRate ?? 1.0)));
    utterance.pitch = Math.min(2, Math.max(0.5, Number(profile.speechPitch ?? 1.0)));
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleDictate = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };
    const RecCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!RecCtor) {
      setErrorMsg('Voice dictation requires Chrome/Edge speech recognition. You can type directly or open Voice AI.');
      return;
    }
    const rec = new RecCtor();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const spoken = ev.results[0]?.[0]?.transcript || '';
      if (spoken) setInput((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => setDictating(false);
    setDictating(true);
    rec.start();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || loading) return;

    const check = validateDocumentUpload(file.type || 'text/plain', file.size);
    if (!check.valid) {
      setErrorMsg(check.reason || 'Unsupported file.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    const now = new Date().toISOString();
    const targetThread: ConversationThread = activeThread ?? {
      id: `conv_${Date.now()}`,
      uid: profile.uid,
      title: `File: ${file.name}`.slice(0, 48),
      mode,
      subject,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const rawInput = input.trim();
    const userPrompt = rawInput || `Summarize and extract key study notes from ${file.name}`;
    setInput('');
    const studentMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'student',
      text: `${userPrompt} [Attached: ${file.name}]`,
      attachmentName: file.name,
      mode,
      feedback: 'none',
      createdAt: now,
    };

    const updatedWithStudent: ConversationThread = {
      ...targetThread,
      title: targetThread.messages.length === 0 ? `File: ${file.name}`.slice(0, 56) : targetThread.title,
      messages: [...targetThread.messages, studentMsg],
      updatedAt: now,
    };
    onSaveThread(updatedWithStudent);
    setActiveThreadId(updatedWithStudent.id);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('Could not read selected file.'));
        reader.readAsDataURL(file);
      });

      const resp = await authFetch('/api/ai/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          base64Data,
          action: rawInput ? 'qa' : 'notes',
          question: userPrompt,
          language,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not analyze uploaded document.');
        return;
      }

      const savedDoc: UploadedDocItem = {
        id: `doc_${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        summary: data.summary,
        keyPoints: data.keyPoints || [],
        createdAt: new Date().toISOString(),
      };
      onSaveUploadedDoc?.(savedDoc);
      setEffectiveDocId(savedDoc.id);

      const bullets = Array.isArray(data.keyPoints) && data.keyPoints.length > 0
        ? `\n\n### Key Takeaways\n${data.keyPoints.map((k: string) => `- ${k}`).join('\n')}`
        : '';

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        sender: 'ai',
        text: `${data.summary}${bullets}`,
        mode,
        suggestedFollowUps: [
          `Create 3 practice questions from ${file.name}`,
          'Simplify these notes further',
        ],
        feedback: 'none',
        createdAt: new Date().toISOString(),
      };

      onSaveThread({
        ...updatedWithStudent,
        messages: [...updatedWithStudent.messages, aiMsg],
        updatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Document analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (msgId: string, fb: 'helpful' | 'needs_clarity') => {
    if (!activeThread) return;
    onSaveThread({
      ...activeThread,
      messages: activeThread.messages.map((m) =>
        m.id === msgId ? { ...m, feedback: fb } : m
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeModeLabel = TEACHING_MODES.find((m) => m.id === mode)?.label ?? 'Answer Anything';

  return (
    <div className="muse-card overflow-hidden flex flex-col lg:flex-row min-h-[620px] lg:h-[calc(100vh-124px)]">
      {/* Left ChatGPT-Style Conversation Sidebar */}
      {sidebarOpen && (
        <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col shrink-0 max-h-64 lg:max-h-none">
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startNewConversation}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center justify-center gap-2"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>New chat</span>
              </button>
              <button
                type="button"
                aria-label="Collapse chat history sidebar"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-blue-500/40"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                aria-label="Search conversation history"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-6 px-3 text-center">
                No chats yet. Click <strong>New chat</strong> or type any question below!
              </p>
            ) : (
              filteredConversations.map((c) => (
                <div key={c.id} className="flex items-center gap-1 group">
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(c.id)}
                    className={`flex-1 min-w-0 text-left px-3 py-2 rounded-xl text-xs ${
                      c.id === activeThread?.id
                        ? 'bg-[var(--bg-subtle)] text-blue-400 font-semibold border border-blue-500/30'
                        : 'hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="truncate">{c.title}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {c.subject} • {c.messages.length} msgs
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete conversation ${c.title}`}
                    onClick={() => {
                      onDeleteThread(c.id);
                      if (activeThreadId === c.id) setActiveThreadId(null);
                    }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Main ChatGPT Canvas */}
      <section className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">
        {/* Minimal ChatGPT Top Bar */}
        <header className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen && (
              <button
                type="button"
                aria-label="Open chat history sidebar"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg muse-btn-primary flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-sm">Muse AI Chat</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Gemini • Answers Any Question
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArrows((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                showArrows
                  ? 'bg-blue-600/15 text-blue-400 border-blue-500/40'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{showArrows ? 'Hide Arrows' : 'Show Arrows'}</span>
            </button>

            {onOpenGlobalGuide && (
              <button
                type="button"
                onClick={onOpenGlobalGuide}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">App Guide</span>
              </button>
            )}

            {activeThread && activeThread.messages.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onSaveThread({
                    ...activeThread,
                    messages: [],
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="px-2.5 py-1.5 rounded-xl text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-rose-500/40 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Centered Conversation Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {aiConfigured === false && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Gemini Server Configuration Notice:</strong> <code>GEMINI_API_KEY</code> is not configured on the server. Add it in <strong>Settings &gt; Secrets</strong> to enable live AI responses.
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-center justify-between gap-3"
              >
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {!activeThread || activeThread.messages.length === 0 ? (
              <div className="py-6 sm:py-10 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl muse-btn-primary mx-auto flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">
                    What would you like to ask today?
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)] max-w-xl mx-auto">
                    Ask <strong>any question</strong> — school subjects, coding, science, math, general knowledge, or everyday curiosity.
                  </p>
                </div>

                {/* Inline Arrow Instructions Banner */}
                {showArrows && (
                  <div
                    aria-label="Step-by-step arrow instructions"
                    className="muse-panel p-4 border border-blue-500/35 space-y-3"
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <ArrowRight className="w-4 h-4" />
                      <span>Quick Arrow Guide — What to Select &amp; Do</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                      <div className="flex-1 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-primary)]">Pick Subject &amp; Mode</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Keep <strong>Any Topic</strong> + <strong>Answer Anything</strong>
                          </div>
                        </div>
                        <ArrowDown className="w-4 h-4 text-blue-400 shrink-0" />
                      </div>

                      <ArrowRight className="w-4 h-4 text-blue-400 hidden sm:block shrink-0" />

                      <div className="flex-1 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-primary)]">Pick Card or Type Below</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Tap any starter prompt or type your own
                          </div>
                        </div>
                        <ArrowDown className="w-4 h-4 text-purple-400 shrink-0" />
                      </div>

                      <ArrowRight className="w-4 h-4 text-blue-400 hidden sm:block shrink-0" />

                      <div className="flex-1 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                          3
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-primary)]">Press Enter / Click ↑</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Get instant formatted answer + follow-ups
                          </div>
                        </div>
                        <ArrowUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2x2 ChatGPT-Style Starter Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STARTER_CARDS.map((card) => (
                    <button
                      key={card.prompt}
                      type="button"
                      onClick={() => sendMessage(card.prompt)}
                      className="text-left p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/50 hover:bg-[var(--bg-elevated)] flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                          {card.category}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                          {card.prompt}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-blue-400 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeThread.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full muse-btn-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`min-w-0 ${msg.sender === 'student' ? 'max-w-[80%]' : 'flex-1'}`}>
                    {msg.sender === 'student' ? (
                      <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-600 text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="muse-panel rounded-2xl rounded-tl-sm px-4 py-3.5 space-y-2.5">
                          <FormattedAIMessage text={msg.text} />
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                              <span className="font-semibold text-[var(--text-secondary)]">References: </span>
                              {msg.sources.join(' · ')}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => speakText(msg.id, msg.text)}
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              speakingId === msg.id
                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-blue-500/40'
                            }`}
                          >
                            {speakingId === msg.id ? (
                              <Square className="w-3 h-3" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                            <span>{speakingId === msg.id ? 'Stop Audio' : 'Read Aloud'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-1 hover:border-blue-500/40"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRegenerate(msg.id)}
                            disabled={loading}
                            aria-label="Regenerate response"
                            className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-1 hover:border-blue-500/40 disabled:opacity-40"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Regenerate</span>
                          </button>

                          <button
                            type="button"
                            aria-label="Mark answer helpful"
                            onClick={() => handleFeedback(msg.id, 'helpful')}
                            className={`text-xs p-1.5 rounded-lg border ${
                              msg.feedback === 'helpful'
                                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            aria-label="Mark answer needs clarity"
                            onClick={() => handleFeedback(msg.id, 'needs_clarity')}
                            className={`text-xs p-1.5 rounded-lg border ${
                              msg.feedback === 'needs_clarity'
                                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>

                          {msg.suggestedFollowUps?.map((fu) => (
                            <button
                              key={fu}
                              type="button"
                              onClick={() => sendMessage(fu)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-blue-400 border border-blue-500/25 hover:border-blue-500/60 flex items-center gap-1"
                            >
                              <ArrowRight className="w-3 h-3 shrink-0" />
                              <span>{fu}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && streamingMsgId && streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full muse-btn-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1 muse-panel rounded-2xl rounded-tl-sm px-4 py-3.5">
                  <FormattedAIMessage text={streamingText} />
                </div>
              </div>
            )}

            {loading && (!streamingMsgId || !streamingText) && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full muse-btn-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="muse-panel px-4 py-3 rounded-2xl text-sm text-[var(--text-muted)]">
                  Nano AI is thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating ChatGPT-Style Bottom Composer */}
        <div className="p-3 sm:p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="max-w-3xl mx-auto space-y-2">
            {showArrows && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-medium text-blue-400">
                <span className="inline-flex items-center gap-1">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Select Subject ({subject}) &amp; Mode ({activeModeLabel}) below</span>
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Type ANY question &amp; press Enter or ↑</span>
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus-within:border-blue-500 p-2.5 sm:p-3 space-y-2 shadow-sm"
            >
              {/* Inline Selector Pills Row */}
              <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-[var(--border-subtle)]">
                <select
                  aria-label="AI Teacher Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)]"
                >
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="AI Teaching Mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as TeachingMode)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)]"
                >
                  {TEACHING_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="AI Teacher Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>

                {uploadedDocs.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <select
                      aria-label="Attached document context"
                      value={effectiveDocId || ''}
                      onChange={(e) => setEffectiveDocId(e.target.value || null)}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs max-w-[190px]"
                    >
                      <option value="">No Document Attached</option>
                      {uploadedDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          Doc: {d.name}
                        </option>
                      ))}
                    </select>
                    {attachedDoc && (
                      <button
                        type="button"
                        aria-label="Detach document context"
                        onClick={() => setEffectiveDocId(null)}
                        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {attachedDoc && (
                <div className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 flex items-center justify-between gap-2">
                  <span className="truncate">
                    Follow-ups grounded in <strong>{attachedDoc.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEffectiveDocId(null)}
                    className="text-purple-300 hover:underline shrink-0"
                  >
                    Detach
                  </button>
                </div>
              )}

              {/* Multi-line ChatGPT Prompt Box + Upload + Voice + Upward Arrow Send */}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
                  aria-label="Upload PDF, image, or text document"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  aria-label="Upload PDF or Image"
                  title="Upload PDF, Image, or Text file"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/50 flex items-center justify-center shrink-0 text-[var(--text-secondary)]"
                >
                  <FileUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={dictating ? 'Stop voice dictation' : 'Voice dictation'}
                  title="Dictate question with microphone"
                  onClick={handleDictate}
                  disabled={loading}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${
                    dictating
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-blue-500/50 text-[var(--text-secondary)]'
                  }`}
                >
                  {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Message Nano AI or upload a PDF/Image (${subject}, ${language})...`}
                  aria-label="Ask AI Teacher"
                  maxLength={4000}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none max-h-36"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-full muse-btn-primary disabled:opacity-40 flex items-center justify-center shrink-0"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
