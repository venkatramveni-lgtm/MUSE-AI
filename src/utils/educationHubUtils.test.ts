import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYouTubeEducationQuery,
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  parseIso8601Duration,
  scoreVideoRelevance,
  SimpleTTLCache,
} from './educationHubUtils';
import { getChaptersForSelection, getSubjectsForBoardAndClass } from '../data/educationRegistry';

test('extractYouTubeVideoId handles standard, short, embed, and raw IDs cleanly', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=123'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://example.com/not-youtube'), null);
});

test('extractYouTubePlaylistId extracts playlist IDs safely', () => {
  assert.equal(
    extractYouTubePlaylistId('https://www.youtube.com/playlist?list=PL1234567890ABCDEF'),
    'PL1234567890ABCDEF'
  );
  assert.equal(extractYouTubePlaylistId('PL1234567890ABCDEF'), 'PL1234567890ABCDEF');
  assert.equal(extractYouTubePlaylistId('invalid'), null);
});

test('parseIso8601Duration formats YouTube durations accurately', () => {
  assert.deepEqual(parseIso8601Duration('PT12M5S'), { label: '12:05', seconds: 725 });
  assert.deepEqual(parseIso8601Duration('PT1H02M09S'), { label: '1:02:09', seconds: 3729 });
});

test('buildYouTubeEducationQuery builds stage, board, subject & language query', () => {
  const q = buildYouTubeEducationQuery({
    board: 'Telangana State Board',
    classLevel: 10,
    subject: 'Physics',
    chapter: 'Light Optics',
    language: 'Telugu',
  });
  assert.match(q, /Telangana State Board/);
  assert.match(q, /Class 10/);
  assert.match(q, /Physics/);
  assert.match(q, /Light Optics/);
  assert.match(q, /in Telugu/);
});

test('scoreVideoRelevance ranks NCERT/board/class matches above generic videos', () => {
  const high = scoreVideoRelevance(
    {
      title: 'CBSE Class 7 Science Nutrition in Plants Full Chapter',
      description: 'NCERT Class 7 photosynthesis explanation',
      channelTitle: 'NCERT OFFICIAL',
      isApprovedChannel: true,
      isFeatured: true,
    },
    { board: 'CBSE', classLevel: 7, subject: 'Science', chapter: 'Nutrition in Plants' }
  );
  const low = scoreVideoRelevance(
    {
      title: 'Random science facts compilation',
      description: 'General trivia',
      channelTitle: 'Trivia World',
    },
    { board: 'CBSE', classLevel: 7, subject: 'Science', chapter: 'Nutrition in Plants' }
  );
  assert.equal(high.relevanceLabel, 'Highly Relevant');
  assert.ok(high.score > low.score);
});

test('getSubjectsForBoardAndClass dynamically differentiates Classes 1-5 vs 6-8 vs 9-10 vs 11-12', () => {
  const primary = getSubjectsForBoardAndClass('CBSE', 3).map((s) => s.name);
  const senior = getSubjectsForBoardAndClass('CBSE', 12).map((s) => s.name);
  const telangana = getSubjectsForBoardAndClass('Telangana State Board', 7).map((s) => s.name);

  assert.ok(primary.includes('EVS / Environmental Studies'));
  assert.ok(!primary.includes('Accountancy'));
  assert.ok(senior.includes('Accountancy'));
  assert.ok(senior.includes('Physics'));
  assert.ok(telangana.includes('Telugu'));
  assert.ok(getChaptersForSelection('CBSE', 12, 'Physics').length >= 3);
});

test('SimpleTTLCache stores and retrieves cached responses', () => {
  const cache = new SimpleTTLCache<string>(5000);
  cache.set('k1', 'cached-payload');
  assert.equal(cache.get('k1'), 'cached-payload');
  assert.equal(cache.size(), 1);
  cache.clear();
  assert.equal(cache.get('k1'), null);
});
