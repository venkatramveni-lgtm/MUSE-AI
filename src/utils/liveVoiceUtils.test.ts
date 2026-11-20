import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64Int16ToFloat32,
  buildLiveVoiceSystemInstruction,
  DEFAULT_MUSE_VOICE_PRESET,
  extractCompleteSpeechSentences,
  formatDurationTimer,
  parseLiveVoiceCommand,
  pcmFloat32ToInt16Base64,
  pickPreferredSpeechVoice,
  resolveMuseVoicePreset,
} from './liveVoiceUtils';

test('formatDurationTimer renders MM:SS cleanly', () => {
  assert.equal(formatDurationTimer(0), '00:00');
  assert.equal(formatDurationTimer(65), '01:05');
  assert.equal(formatDurationTimer(754), '12:34');
});

test('parseLiveVoiceCommand recognizes all smart conversation commands', () => {
  assert.equal(parseLiveVoiceCommand('Hey Muse').type, 'wake');
  assert.equal(parseLiveVoiceCommand('Hey MUSEEAI!').type, 'wake');
  assert.equal(parseLiveVoiceCommand('Hey Nano').type, 'wake');
  assert.equal(parseLiveVoiceCommand('Hey Nano AI!').type, 'wake');
  assert.equal(parseLiveVoiceCommand('Wait').type, 'pause');
  assert.equal(parseLiveVoiceCommand('Stop talking').type, 'stop_speaking');
  assert.equal(parseLiveVoiceCommand('Repeat that').type, 'repeat');
  assert.equal(parseLiveVoiceCommand('Explain more').type, 'explain_more');
  assert.equal(parseLiveVoiceCommand('Make it simple').type, 'simplify');
  assert.equal(parseLiveVoiceCommand('Give me an example').type, 'example');
  assert.equal(parseLiveVoiceCommand('Thank you!').type, 'thank_you');
  assert.equal(parseLiveVoiceCommand('Summarize this').type, 'summarize');
  assert.equal(parseLiveVoiceCommand('Start a new conversation').type, 'new_conversation');
  assert.equal(parseLiveVoiceCommand('Remember this conversation').type, 'remember_prompt');

  const langCmd = parseLiveVoiceCommand('Change your language to Telugu');
  assert.equal(langCmd.type, 'change_language');
  assert.equal(langCmd.targetLanguage, 'Telugu');

  const searchCmd = parseLiveVoiceCommand('Search for Newton third law');
  assert.equal(searchCmd.type, 'search');
  assert.equal(searchCmd.argument, 'Newton third law');

  const readCmd = parseLiveVoiceCommand('Read this aloud: Energy is conserved');
  assert.equal(readCmd.type, 'read_aloud');
  assert.equal(readCmd.argument, 'Energy is conserved');

  assert.equal(parseLiveVoiceCommand('How do clouds form?').type, 'question');
});

test('PCM Float32 <-> Base64 Int16 round-trips accurately', () => {
  const input = new Float32Array([-1, -0.5, 0, 0.5, 0.99]);
  const b64 = pcmFloat32ToInt16Base64(input);
  const output = base64Int16ToFloat32(b64);
  assert.equal(output.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.ok(Math.abs(output[i] - input[i]) < 0.002, `Sample ${i} mismatch`);
  }
});

test('buildLiveVoiceSystemInstruction embeds Muse female Indian English identity, student profile, and language', () => {
  const instr = buildLiveVoiceSystemInstruction(
    {
      displayName: 'Ananya',
      board: 'Telangana State Board',
      classLevel: 11,
      preferredLanguage: 'Telugu',
      academicGoal: 'Master Calculus & Physics',
    },
    'Telugu'
  );
  assert.match(instr, /Muse/);
  assert.match(instr, /Indian English/);
  assert.match(instr, /Female-sounding/);
  assert.match(instr, /Ananya/);
  assert.match(instr, /Class 11/);
  assert.match(instr, /Telangana State Board/);
  assert.match(instr, /Telugu/);
});

test('resolveMuseVoicePreset defaults to Sulafat and validates allowed presets', () => {
  assert.equal(DEFAULT_MUSE_VOICE_PRESET, 'Sulafat');
  assert.equal(resolveMuseVoicePreset(undefined), 'Sulafat');
  assert.equal(resolveMuseVoicePreset('sulafat'), 'Sulafat');
  assert.equal(resolveMuseVoicePreset('Kore'), 'Kore');
  assert.equal(resolveMuseVoicePreset('UnknownVoice'), 'Sulafat');
});

test('pickPreferredSpeechVoice prioritizes en-IN female voice for English and BCP-47 for Indian languages', () => {
  const voices = [
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Microsoft Ravi - English (India)', lang: 'en-IN' },
    { name: 'Microsoft Heera - English (India) Female', lang: 'en-IN' },
    { name: 'Google हिन्दी', lang: 'hi-IN' },
    { name: 'Google తెలుగు', lang: 'te-IN' },
  ];
  assert.equal(pickPreferredSpeechVoice(voices, 'English')?.name, 'Microsoft Heera - English (India) Female');
  assert.equal(pickPreferredSpeechVoice(voices, 'Telugu')?.lang, 'te-IN');
  assert.equal(pickPreferredSpeechVoice(voices, 'Hindi')?.lang, 'hi-IN');
});

test('extractCompleteSpeechSentences splits sentences while preserving decimals and streaming remainder', () => {
  const res = extractCompleteSpeechSentences(
    '**Gravity** accelerates objects at 9.8 m/s². Force equals mass times acceleration! What next? Incomplete tail'
  );
  assert.deepEqual(res.sentences, [
    'Gravity accelerates objects at 9.8 m/s².',
    'Force equals mass times acceleration!',
    'What next?',
  ]);
  assert.equal(res.remainder.trim(), 'Incomplete tail');

  const singleIncomplete = extractCompleteSpeechSentences('Wait for the period');
  assert.deepEqual(singleIncomplete.sentences, []);
  assert.equal(singleIncomplete.remainder, 'Wait for the period');
});
