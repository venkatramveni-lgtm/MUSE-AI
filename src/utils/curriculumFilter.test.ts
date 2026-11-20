import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterByStudentClass,
  getClassDashboardBlueprint,
  getClassPromptChips,
  getClassSpecificStudyPlanSeeds,
  prioritizeByClassAndProfile,
} from './curriculumFilter';

test('prioritizeByClassAndProfile ranks Class 9 Physics/Biology/Maths first for Class 9 students', () => {
  const items = [
    { id: 'c7_sci', classLevel: 7, board: 'CBSE', subject: 'Science' },
    { id: 'c10_phy', classLevel: 10, board: 'CBSE', subject: 'Physics' },
    { id: 'c9_hist', classLevel: 9, board: 'CBSE', subject: 'Social Studies' },
    { id: 'c9_phy', classLevel: 9, board: 'CBSE', subject: 'Physics' },
    { id: 'c9_bio', classLevel: 9, board: 'ICSE', subject: 'Biology' },
  ];

  const ranked = prioritizeByClassAndProfile(items, {
    classLevel: 9,
    board: 'CBSE',
    subjects: ['Physics', 'Biology', 'Mathematics'],
  });

  assert.equal(ranked[0].id, 'c9_phy');
  assert.equal(ranked[1].id, 'c9_bio');
  assert.equal(ranked[2].id, 'c9_hist');
  assert.equal(ranked[3].id, 'c10_phy');
  assert.equal(ranked[4].id, 'c7_sci');
});

test('filterByStudentClass filters strictly when myClassOnly is true and falls back cleanly if empty', () => {
  const items = [
    { id: 'a', classLevel: 7 },
    { id: 'b', classLevel: 9 },
    { id: 'c', classLevel: 9 },
  ];

  assert.deepEqual(
    filterByStudentClass(items, 9, true).map((x) => x.id),
    ['b', 'c']
  );
  assert.deepEqual(
    filterByStudentClass(items, 9, false).map((x) => x.id),
    ['a', 'b', 'c']
  );
  // Fallback to all items if selected grade has 0 exact matches
  assert.deepEqual(
    filterByStudentClass(items, 12, true).map((x) => x.id),
    ['a', 'b', 'c']
  );
});

test('getClassDashboardBlueprint adapts subjects, prompts, and 3D model per class stage', () => {
  const c3 = getClassDashboardBlueprint(3);
  assert.equal(c3.featuredXrModelId, 'water_cycle');
  assert.ok(c3.recommendedSubjects.includes('EVS / Environmental Studies'));

  const c7 = getClassDashboardBlueprint(7);
  assert.equal(c7.featuredXrModelId, 'plant_cell');
  assert.ok(c7.recommendedSubjects.includes('Science'));

  const c9 = getClassDashboardBlueprint(9);
  assert.equal(c9.featuredXrModelId, 'motion_physics');
  assert.ok(c9.recommendedSubjects.includes('Physics'));
  assert.ok(c9.recommendedSubjects.includes('Biology'));
  assert.ok(c9.recommendedSubjects.includes('Mathematics'));

  const c10 = getClassDashboardBlueprint(10);
  assert.equal(c10.featuredXrModelId, 'atomic_bohr');

  const c12 = getClassDashboardBlueprint(12);
  assert.equal(c12.featuredXrModelId, 'motion_physics');
  assert.match(c12.stageLabel, /Class 12/);
});

test('getClassPromptChips and getClassSpecificStudyPlanSeeds return Class 9 STEM content', () => {
  const chips9 = getClassPromptChips(9);
  assert.ok(chips9.some((c) => c.subject === 'Physics'));
  assert.ok(chips9.some((c) => c.subject === 'Biology'));
  assert.ok(chips9.some((c) => c.subject === 'Mathematics'));

  const seeds9 = getClassSpecificStudyPlanSeeds('u1', 9, '2026-11-18', '2026-11-18T10:00:00Z');
  assert.equal(seeds9.length, 2);
  assert.ok(seeds9.every((s) => s.id.startsWith('plan_seed_')));
  assert.match(seeds9[0].title, /Class 9 Physics/);
});
