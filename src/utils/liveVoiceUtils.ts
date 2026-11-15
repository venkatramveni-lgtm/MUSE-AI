import { INDIAN_LANGUAGES } from '../data/educationRegistry';
import type { LiveVoiceCommandResult, UserProfile } from '../types/muse';

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
  if (/^(hey|hi|hello|ok)\s+muse(e?\s*ai)?$/i.test(normalized)) {
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
  if (/^(thank you|thanks|thanks a lot|thank you muse|thank you musee?ai)$/i.test(normalized)) {
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
    'You are Muse AI (also known as MUSEEAI), a friendly, intelligent, real-time AI voice conversation partner and personal tutor.',
    `Learner profile: ${profile.displayName}, Class ${profile.classLevel} (${profile.board}), Goal: ${profile.academicGoal}.`,
    `Active spoken language: ${activeLanguage}. Respond naturally in ${activeLanguage}.`,
    'Keep spoken answers clear, warm, concise (2-5 natural sentences unless asked to explain more or step-by-step), and conversational.',
    'Support natural accents, English, and Indian languages cleanly.',
    'If the user says "Explain more", expand the previous answer.',
    'If the user says "Make it simple", re-explain in everyday beginner-friendly words.',
    'If the user says "Give me an example", give one crisp real-life example.',
    'If the user says "Summarize this", give a brief 3-point summary.',
    'Never invent facts when uncertain — state uncertainty honestly and offer to explore together.',
  ].join(' ');
}
