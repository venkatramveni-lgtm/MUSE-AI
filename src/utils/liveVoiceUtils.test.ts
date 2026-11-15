import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64Int16ToFloat32,
  buildLiveVoiceSystemInstruction,
  formatDurationTimer,
  parseLiveVoiceCommand,
  pcmFloat32ToInt16Base64,
} from './liveVoiceUtils';

test('formatDurationTimer renders MM:SS cleanly', () => {
  assert.equal(formatDurationTimer(0), '00:00');
  assert.equal(formatDurationTimer(65), '01:05');
  assert.equal(formatDurationTimer(754), '12:34');
});

test('parseLiveVoiceCommand recognizes all smart conversation commands', () => {
  assert.equal(parseLiveVoiceCommand('Hey Muse').type, 'wake');
  assert.equal(parseLiveVoiceCommand('Hey MUSEEAI!').type, 'wake');
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

test('buildLiveVoiceSystemInstruction embeds student board, class and active language', () => {
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
  assert.match(instr, /Ananya/);
  assert.match(instr, /Class 11/);
  assert.match(instr, /Telangana State Board/);
  assert.match(instr, /Telugu/);
});
