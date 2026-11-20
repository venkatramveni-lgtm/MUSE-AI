import { INDIAN_LANGUAGES } from '../data/educationRegistry';
import type { LiveVoiceCommandResult, UserProfile } from '../types/muse';

export const DEFAULT_MUSE_VOICE_PRESET = 'Sulafat' as const;

export const GEMINI_VOICE_PRESETS = [
  {
    id: 'Sulafat',
    label: 'Nano / Muse Default (Sulafat)',
    description: 'Warm, friendly female-sounding voice · Indian English style',
  },
  {
    id: 'Kore',
    label: 'Kore',
    description: 'Crisp, calm balanced female-sounding tone',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    description: 'Bright, expressive conversational voice',
  },
  {
    id: 'Aoede',
    label: 'Aoede',
    description: 'Gentle, clear storytelling tone',
  },
  {
    id: 'Puck',
    label: 'Puck',
    description: 'Energetic, upbeat study partner',
  },
  {
    id: 'Charon',
    label: 'Charon',
    description: 'Steady, deeper explanatory tone',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    description: 'Bold, resonant voice',
  },
] as const;

export type GeminiVoicePresetId = (typeof GEMINI_VOICE_PRESETS)[number]['id'];

export const ALLOWED_GEMINI_VOICE_NAMES: ReadonlyArray<string> = GEMINI_VOICE_PRESETS.map((v) => v.id);

export const MUSE_TEST_PROMPT = 'Hello Nano, introduce yourself and explain what you can do.';
export const MUSE_TEST_EXPECTED_INTRO =
  "Hello! I'm Muse, your friendly AI assistant inside Nano AI. I'm here to help you learn, explore new ideas, answer questions and make your everyday tasks easier. You can talk to me naturally, and I'll do my best to help you. So, what shall we explore today?";

export function extractCompleteSpeechSentences(buffer: string): {
  sentences: string[];
  remainder: string;
} {
  const cleaned = buffer.replace(/[*`#]/g, '');
  const sentences: string[] = [];
  let cursor = 0;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1] ?? '';
    const isTerminator =
      ch === '!' ||
      ch === '?' ||
      ch === '।' ||
      (ch === '.' && (next === ' ' || next === '\n' || next === '\r' || next === ''));

    // Avoid splitting decimal numbers like 9.8 or abbreviations like "1."
    if (ch === '.' && i > 0 && /\d/.test(cleaned[i - 1]) && /\d/.test(next)) {
      continue;
    }

    if (isTerminator && (next === ' ' || next === '\n' || next === '\r' || ch === '।' || ch === '?' || ch === '!')) {
      const candidate = cleaned.slice(cursor, i + 1).trim();
      if (candidate.length >= 4) {
        sentences.push(candidate);
        cursor = i + 1;
      }
    }
  }

  return {
    sentences,
    remainder: cleaned.slice(cursor),
  };
}

export function resolveMuseVoicePreset(candidate?: string): GeminiVoicePresetId {
  if (!candidate) return DEFAULT_MUSE_VOICE_PRESET;
  const trimmed = candidate.trim();
  const match = GEMINI_VOICE_PRESETS.find((v) => v.id.toLowerCase() === trimmed.toLowerCase());
  return match ? match.id : DEFAULT_MUSE_VOICE_PRESET;
}

export interface SpeechVoiceLike {
  name: string;
  lang: string;
}

export function pickPreferredSpeechVoice<T extends SpeechVoiceLike>(
  voices: readonly T[],
  language: string
): T | undefined {
  if (!voices || voices.length === 0) return undefined;
  const lowerLang = language.trim().toLowerCase();

  if (lowerLang === 'english' || lowerLang === 'en-in' || lowerLang === 'indian english') {
    const enInFemale = voices.find((v) => {
      const vl = v.lang.toLowerCase();
      const vn = v.name.toLowerCase();
      return (
        vl.startsWith('en-in') &&
        /(female|heera|neerja|aditi|raveena|priya|kavya|google|natural)/i.test(vn)
      );
    });
    if (enInFemale) return enInFemale;

    const enInAny = voices.find((v) => v.lang.toLowerCase().startsWith('en-in'));
    if (enInAny) return enInAny;

    const femaleEnglish = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith('en') &&
        /(female|samantha|victoria|karen|zira|aria|jenny|natural|google)/i.test(v.name.toLowerCase())
    );
    if (femaleEnglish) return femaleEnglish;
  }

  const matchedLanguage = INDIAN_LANGUAGES.find((l) => l.name.toLowerCase() === lowerLang);
  const bcp = (matchedLanguage?.bcp47 || 'en-IN').toLowerCase();
  const prefix = bcp.split('-')[0];

  const exactVoice = voices.find((v) => v.lang.toLowerCase() === bcp);
  if (exactVoice) return exactVoice;

  const prefixVoice = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (prefixVoice) return prefixVoice;

  return voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) || voices[0];
}

export function formatDurationTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function detectLanguageMention(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const lang of INDIAN_LANGUAGES) {
    const nameLower = lang.name.toLowerCase();
    if (
      lower.includes(`in ${nameLower}`) ||
      lower.includes(`to ${nameLower}`) ||
      lower === nameLower ||
      lower.includes(`language ${nameLower}`)
    ) {
      return lang.name;
    }
  }
  return undefined;
}

export function parseLiveVoiceCommand(rawInput: string): LiveVoiceCommandResult {
  const rawText = rawInput.trim();
  const normalized = rawText.toLowerCase().replace(/[!?.]+$/g, '').trim();

  if (!normalized) {
    return { type: 'question', rawText };
  }

  // Wake word
  if (/^(hey|hi|hello|ok)\s+(muse(e?\s*ai)?|nano(\s*ai)?)$/i.test(normalized)) {
    return { type: 'wake', rawText };
  }

  // Immediate speech control
  if (/^(wait|hold on|pause|pause speaking)$/i.test(normalized)) {
    return { type: 'pause', rawText };
  }
  if (/^(stop|stop talking|be quiet|cancel speech|quiet)$/i.test(normalized)) {
    return { type: 'stop_speaking', rawText };
  }

  // Conversational follow-up commands
  if (/^(repeat|repeat that|say that again|pardon)$/i.test(normalized)) {
    return { type: 'repeat', rawText };
  }
  if (/^(explain more|tell me more|elaborate|go deeper)$/i.test(normalized)) {
    return { type: 'explain_more', rawText };
  }
  if (/^(make it simple|make it simpler|explain simply|simpler please|easy language)$/i.test(normalized)) {
    return { type: 'simplify', rawText };
  }
  if (/^(give me an example|give an example|example please|show an example)$/i.test(normalized)) {
    return { type: 'example', rawText };
  }
  if (/^(thank you|thanks|thanks a lot|thank you muse|thank you musee?ai|thank you nano)$/i.test(normalized)) {
    return { type: 'thank_you', rawText };
  }
  if (/^(summarize this|summarize|give a summary|short summary)$/i.test(normalized)) {
    return { type: 'summarize', rawText };
  }
  if (/^(start a new conversation|new conversation|reset conversation|start over)$/i.test(normalized)) {
    return { type: 'new_conversation', rawText };
  }
  if (/^(remember this conversation|save this conversation|remember this)$/i.test(normalized)) {
    return { type: 'remember_prompt', rawText };
  }

  // Language switch commands: "Change your language to Telugu" / "Speak in Hindi"
  if (
    /change\s+(your\s+)?language/i.test(normalized) ||
    /^(speak|talk|answer|switch)\s+(to|in)\s+/i.test(normalized)
  ) {
    const targetLanguage = detectLanguageMention(normalized);
    return {
      type: 'change_language',
      rawText,
      targetLanguage,
    };
  }

  // Translation commands: "Translate this to Hindi"
  if (/^translate(\s+this)?/i.test(normalized)) {
    const targetLanguage = detectLanguageMention(normalized);
    const stripped = rawText.replace(/^translate(\s+this)?(\s+(to|into)\s+[a-z]+)?[:\s-]*/i, '').trim();
    return {
      type: 'translate',
      rawText,
      targetLanguage,
      argument: stripped || undefined,
    };
  }

  // Search commands: "Search for photosynthesis"
  if (/^search(\s+for)?\s+/i.test(normalized)) {
    const argument = rawText.replace(/^search(\s+for)?\s+/i, '').trim();
    return {
      type: 'search',
      rawText,
      argument,
    };
  }

  // Read aloud: "Read this aloud: ..."
  if (/^read(\s+this)?\s+aloud[:\s]*/i.test(normalized)) {
    const argument = rawText.replace(/^read(\s+this)?\s+aloud[:\s-]*/i, '').trim();
    return {
      type: 'read_aloud',
      rawText,
      argument,
    };
  }

  // Direct explain this
  if (/^(explain this|explain it)$/i.test(normalized)) {
    return { type: 'explain_more', rawText };
  }

  return { type: 'question', rawText };
}

export function pcmFloat32ToInt16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    bytes[i * 2] = int16 & 0xff;
    bytes[i * 2 + 1] = (int16 >> 8) & 0xff;
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64Int16ToFloat32(base64: string): Float32Array {
  let bytes: Uint8Array;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const sampleCount = Math.floor(bytes.length / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const low = bytes[i * 2];
    const high = bytes[i * 2 + 1];
    let val = (high << 8) | low;
    if (val >= 0x8000) val -= 0x10000;
    float32[i] = val / 32768;
  }
  return float32;
}

export function buildLiveVoiceSystemInstruction(
  profile: Pick<UserProfile, 'displayName' | 'board' | 'classLevel' | 'preferredLanguage' | 'academicGoal'>,
  activeLanguage: string
): string {
  return [
    'You are Muse, the fast live voice AI assistant inside Nano AI (Learn Beyond Limits).',
    'VOICE: Female-sounding, warm and natural.',
    'ACCENT: Speak English with a natural Indian English accent (en-IN).',
    'PERSONALITY: Friendly, intelligent, fast, patient and expressive.',
    'SPEAKING STYLE: Answer immediately in 2-3 clear, natural conversational sentences with zero filler preambles unless asked to explain more or step-by-step.',
    `LEARNER PROFILE: ${profile.displayName}, Class ${profile.classLevel} (${profile.board}), Goal: ${profile.academicGoal}. Tailor depth and examples specifically to Class ${profile.classLevel}.`,
    `LANGUAGES: Understand and respond smoothly in English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, and all supported Indian languages. Active preference: ${activeLanguage}. Always respond in the language the user speaks or prefers while maintaining the same warm friendly personality.`,
    'SELF-INTRODUCTION: When greeted or asked to introduce yourself and explain what you can do, reply warmly like: "Hello! I\'m Muse, your friendly AI assistant inside Nano AI. I\'m here to help you learn, explore new ideas, answer questions and make your everyday tasks easier. What shall we explore today?"',
    'CONVERSATION COMMANDS: If the user says "Explain more", expand the previous answer; if "Make it simple", simplify in everyday beginner-friendly language; if "Give me an example", share one crisp real-life example; if "Summarize this", give a concise summary.',
    'HONESTY: Never invent facts when uncertain — acknowledge uncertainty politely and offer to explore together.',
  ].join('\n');
}
