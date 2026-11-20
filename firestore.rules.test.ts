import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('firestore.rules starts with rules_version 2 and default-deny catch-all', () => {
  assert.match(rulesSource, /^rules_version = '2';/);
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified on bootstrapped admin and standard writes', () => {
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /request\.auth\.token\.email == 'venkatramveni@gmail\.com'/);
});

test('firestore.rules isolates PII in private subcollection and blocks blanket reads', () => {
  assert.match(rulesSource, /match \/private\/\{docId\}/);
  assert.doesNotMatch(rulesSource, /allow read:\s*if isSignedIn\(\)/);
  assert.doesNotMatch(rulesSource, /allow list:\s*if isSignedIn\(\);/);
});

test('firestore.rules prevents student role escalation and score tampering', () => {
  assert.match(rulesSource, /incoming\(\)\.role in \['student', 'parent'\] \|\| isBootstrappedAdmin\(\)/);
  assert.match(rulesSource, /match \/quizAttempts\/\{attemptId\}[\s\S]*allow update, delete: if isValidId\(attemptId\) && isAdmin\(\);/);
});

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const blueprint = JSON.parse(fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8'));
  const paths = Object.keys(blueprint.firestore);
  for (const path of paths) {
    const topCollection = path.split('/').filter(Boolean)[0];
    assert.ok(
      rulesSource.includes(`match /${topCollection}/`),
      `Missing match block for blueprint collection: ${topCollection}`
    );
  }
});

test('firestore.rules permits user self-update of voicePreset alongside speech settings', () => {
  assert.match(rulesSource, /'voiceAutoSpeak', 'speechRate', 'speechPitch', 'voicePreset', 'updatedAt'/);
});

test('firestore.rules enforces owner-only rules and validation for savedNotes', () => {
  assert.match(rulesSource, /function isValidSavedNote\(data\)/);
  assert.match(rulesSource, /match \/savedNotes\/\{noteId\}[\s\S]*incoming\(\)\.uid == request\.auth\.uid/);
});


