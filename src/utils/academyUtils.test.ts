import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampZoomScale,
  computeVideoCaptionIndex,
  filterImageLibrary,
  filterVideoLibrary,
  groupVideosByCategory,
  sanitizeEducationalSvg,
} from './academyUtils';
import { ImageLessonItem, VideoLesson } from '../types/muse';

const SAMPLE_IMAGES: ImageLessonItem[] = [
  {
    id: 'img_1',
    board: 'CBSE',
    classLevel: 7,
    subject: 'Science',
    chapter: 'Nutrition in Plants',
    title: 'Photosynthesis Chloroplast Cutaway',
    summary: 'Sunlight drives glucose synthesis.',
    mediaKey: 'photosynthesis',
    keyTakeaways: ['Chlorophyll captures sunlight'],
    hotspots: [{ id: 'h1', label: 'Stomata', detail: 'Gas pores', xPercent: 40, yPercent: 75 }],
  },
  {
    id: 'img_2',
    board: 'CBSE',
    classLevel: 8,
    subject: 'Mathematics',
    chapter: 'Triangles and Properties',
    title: 'Pythagoras 3-4-5 Area Proof',
    summary: 'Area squares sum along hypotenuse.',
    mediaKey: 'pythagoras',
    keyTakeaways: ['a^2 + b^2 = c^2'],
    hotspots: [{ id: 'h2', label: 'Hypotenuse', detail: '5x5 square', xPercent: 55, yPercent: 35 }],
  },
];

const SAMPLE_VIDEOS: VideoLesson[] = [
  {
    id: 'vid_1',
    board: 'CBSE',
    classLevel: 7,
    subject: 'Science',
    chapter: 'Nutrition in Plants',
    category: 'Visual Lab & 3D',
    title: 'Photosynthesis Walkthrough',
    description: 'Leaf structure.',
    durationLabel: '04:30',
    sourceLabel: 'Muse Visual Lab',
    captionsAvailable: true,
    captions: ['One', 'Two', 'Three', 'Four'],
    keyTakeaways: ['Oxygen released'],
  },
  {
    id: 'vid_2',
    board: 'CBSE',
    classLevel: 8,
    subject: 'Mathematics',
    chapter: 'Triangles',
    category: 'Step-by-Step Tutorial',
    title: 'Pythagoras Proof',
    description: 'Area tiles.',
    durationLabel: '05:15',
    sourceLabel: 'Muse Visual Lab',
    captionsAvailable: true,
    captions: ['Start', 'End'],
    keyTakeaways: ['Right triangle'],
  },
];

test('filterImageLibrary filters by board, subject, collection, and hotspot search', () => {
  const all = filterImageLibrary(SAMPLE_IMAGES, {
    board: 'ALL',
    classLevel: 'ALL',
    subject: 'ALL',
    search: '',
    collectionFilter: 'all',
    studiedIds: [],
    bookmarkedIds: [],
  });
  assert.equal(all.length, 2);

  const hotspotMatch = filterImageLibrary(SAMPLE_IMAGES, {
    board: 'CBSE',
    classLevel: '7',
    subject: 'Science',
    search: 'stomata',
    collectionFilter: 'studied',
    studiedIds: ['img_1'],
    bookmarkedIds: [],
  });
  assert.equal(hotspotMatch.length, 1);
  assert.equal(hotspotMatch[0].id, 'img_1');

  const bookmarkedOnly = filterImageLibrary(SAMPLE_IMAGES, {
    board: 'ALL',
    classLevel: 'ALL',
    subject: 'ALL',
    search: '',
    collectionFilter: 'bookmarked',
    studiedIds: [],
    bookmarkedIds: ['img_2'],
  });
  assert.equal(bookmarkedOnly.length, 1);
  assert.equal(bookmarkedOnly[0].id, 'img_2');
});

test('filterVideoLibrary filters by collection state, category, and subject', () => {
  const watched = filterVideoLibrary(SAMPLE_VIDEOS, {
    subject: 'ALL',
    search: '',
    collectionFilter: 'watched',
    watchedIds: ['vid_2'],
    bookmarkedIds: [],
  });
  assert.equal(watched.length, 1);
  assert.equal(watched[0].id, 'vid_2');

  const tutorials = filterVideoLibrary(SAMPLE_VIDEOS, {
    subject: 'ALL',
    category: 'Step-by-Step Tutorial',
    search: '',
    collectionFilter: 'all',
    watchedIds: [],
    bookmarkedIds: [],
  });
  assert.equal(tutorials.length, 1);
  assert.equal(tutorials[0].id, 'vid_2');

  const grouped = groupVideosByCategory(SAMPLE_VIDEOS);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].category, 'Step-by-Step Tutorial');
  assert.equal(grouped[1].category, 'Visual Lab & 3D');
});

test('clampZoomScale keeps zoom within 1.0 to 2.5 bounds', () => {
  assert.equal(clampZoomScale(0.2), 1);
  assert.equal(clampZoomScale(1.75), 1.75);
  assert.equal(clampZoomScale(4), 2.5);
  assert.equal(clampZoomScale(Number.NaN), 1);
});

test('computeVideoCaptionIndex maps progress percentages cleanly', () => {
  assert.equal(computeVideoCaptionIndex(0, 4), 0);
  assert.equal(computeVideoCaptionIndex(50, 4), 2);
  assert.equal(computeVideoCaptionIndex(100, 4), 3);
  assert.equal(computeVideoCaptionIndex(50, 0), -1);
});

test('sanitizeEducationalSvg strips script tags and inline event handlers', () => {
  const dirty = '<svg viewBox="0 0 100 100" onload="alert(1)"><script>evil()</script><circle cx="50" cy="50" r="20" onclick="hack()"/></svg>';
  const clean = sanitizeEducationalSvg(dirty, 'Safe Circle');
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('onload='), false);
  assert.equal(clean.includes('onclick='), false);
  assert.equal(clean.includes('<circle'), true);

  const fallback = sanitizeEducationalSvg('not an svg at all', 'Photosynthesis <script>');
  assert.equal(fallback.startsWith('<svg'), true);
  assert.equal(fallback.includes('<script'), false);
});
