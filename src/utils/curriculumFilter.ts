import type { StudyPlanTask, UserProfile, XRModelId } from '../types/muse';

export interface ClassScopedItem {
  classLevel?: number;
  board?: string;
  subject?: string;
}

/**
 * Ranks curriculum items so the student's enrolled classLevel appears first,
 * followed by nearest grade levels and matching subjects/board.
 */
export function prioritizeByClassAndProfile<T extends ClassScopedItem>(
  items: readonly T[],
  profile: Pick<UserProfile, 'classLevel' | 'board' | 'subjects'>
): T[] {
  const targetClass = Math.min(12, Math.max(1, Number(profile.classLevel) || 7));
  const preferredSubjects = new Set(profile.subjects.map((s) => s.toLowerCase()));

  return [...items].sort((a, b) => {
    const classA = typeof a.classLevel === 'number' ? a.classLevel : targetClass;
    const classB = typeof b.classLevel === 'number' ? b.classLevel : targetClass;

    const exactClassA = classA === targetClass ? 0 : 1;
    const exactClassB = classB === targetClass ? 0 : 1;
    if (exactClassA !== exactClassB) return exactClassA - exactClassB;

    const subA = a.subject && preferredSubjects.has(a.subject.toLowerCase()) ? 0 : 1;
    const subB = b.subject && preferredSubjects.has(b.subject.toLowerCase()) ? 0 : 1;
    if (subA !== subB) return subA - subB;

    const distA = Math.abs(classA - targetClass);
    const distB = Math.abs(classB - targetClass);
    if (distA !== distB) return distA - distB;

    const boardA = a.board === profile.board ? 0 : 1;
    const boardB = b.board === profile.board ? 0 : 1;
    return boardA - boardB;
  });
}

/**
 * Filters items strictly to the student's class when `myClassOnly` is active,
 * falling back to closest items only if none exist for that grade.
 */
export function filterByStudentClass<T extends ClassScopedItem>(
  items: readonly T[],
  classLevel: number,
  myClassOnly: boolean
): T[] {
  if (!myClassOnly) return [...items];
  const exact = items.filter((item) => item.classLevel === classLevel);
  return exact.length > 0 ? exact : [...items];
}

export interface ClassDashboardBlueprint {
  headlineTag: string;
  recommendedSubjects: string[];
  featuredPrompts: string[];
  featuredXrModelId: XRModelId;
  stageLabel: string;
}

export function getClassDashboardBlueprint(classLevel: number): ClassDashboardBlueprint {
  const safeClass = Math.min(12, Math.max(1, Math.round(classLevel || 7)));

  if (safeClass <= 5) {
    return {
      headlineTag: `Class ${safeClass} Primary Explorer`,
      recommendedSubjects: ['Mathematics', 'EVS / Environmental Studies', 'English', 'Hindi'],
      featuredPrompts: [
        `Explain the water cycle with a fun story for Class ${safeClass}`,
        `Give 5 fractions & division practice problems for Class ${safeClass}`,
        `Help me write 5 sentences on saving trees in simple English`,
      ],
      featuredXrModelId: 'water_cycle',
      stageLabel: 'Primary Foundation (Classes 1–5)',
    };
  }

  if (safeClass <= 8) {
    return {
      headlineTag: `Class ${safeClass} STEM & Humanities Hub`,
      recommendedSubjects: ['Mathematics', 'Science', 'English', 'Social Studies'],
      featuredPrompts: [
        `Explain Pythagoras theorem visually for Class ${safeClass}`,
        `Break down photosynthesis step by step with balanced equations`,
        `Quiz me on key features of the Indian Constitution`,
      ],
      featuredXrModelId: safeClass === 6 ? 'solar_system' : safeClass === 8 ? 'pythagoras_3d' : 'plant_cell',
      stageLabel: 'Middle Stage (Classes 6–8)',
    };
  }

  if (safeClass === 9) {
    return {
      headlineTag: 'Class 9 Physics, Biology, Chemistry & Maths Hub',
      recommendedSubjects: ['Physics', 'Biology', 'Mathematics', 'Chemistry', 'Science', 'English'],
      featuredPrompts: [
        'Derive the 3 equations of motion and Newton’s 2nd Law (F = ma) for Class 9 Physics',
        'Explain Mitochondria, Nucleus, and Cell Organelles for Class 9 Biology',
        'Solve Number Systems & Heron’s Formula area problems step by step for Class 9 Maths',
      ],
      featuredXrModelId: 'motion_physics',
      stageLabel: 'Class 9 Secondary Board Foundation',
    };
  }

  if (safeClass === 10) {
    return {
      headlineTag: 'Class 10 Board Exam Command',
      recommendedSubjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Social Studies'],
      featuredPrompts: [
        'Explain Trigonometry ratios and heights-and-distances shortcuts for Class 10',
        'Compare Ohm’s Law and series vs parallel resistor circuits',
        'Summarize Life Processes: nutrition, respiration, and circulation',
      ],
      featuredXrModelId: 'atomic_bohr',
      stageLabel: 'Class 10 Board Exam Track',
    };
  }

  return {
    headlineTag: `Class ${safeClass} Senior Secondary & Competitive Track`,
    recommendedSubjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
    featuredPrompts: [
      `Walk through calculus derivatives and projectile kinematics for Class ${safeClass}`,
      `Explain chemical equilibrium and thermodynamics laws for Class ${safeClass}`,
      `Build a 5-question practice quiz on Class ${safeClass} molecular genetics`,
    ],
    featuredXrModelId: 'motion_physics',
    stageLabel: `Senior Secondary (Class ${safeClass})`,
  };
}

export function getClassPromptChips(classLevel: number): { label: string; topic: string; subject: string }[] {
  const safeClass = Math.min(12, Math.max(1, Math.round(classLevel || 7)));
  if (safeClass === 9) {
    return [
      { label: 'Class 9 Physics: Force Vectors & Motion', topic: 'Newton’s Laws of Motion & Force Vectors', subject: 'Physics' },
      { label: 'Class 9 Biology: Cell Organelles', topic: 'Plant & Animal Cell Organelles (Mitochondria, Nucleus, Plastids)', subject: 'Biology' },
      { label: 'Class 9 Chemistry: Bohr Atomic Shells', topic: 'Bohr Atomic Model K, L, M Electron Shells', subject: 'Chemistry' },
      { label: 'Class 9 Maths: Heron’s Formula Triangle', topic: 'Triangle Semi-Perimeter & Heron’s Formula Geometry', subject: 'Mathematics' },
    ];
  }
  if (safeClass <= 5) {
    return [
      { label: `Class ${safeClass} Water Cycle`, topic: 'Evaporation, Condensation & Precipitation Cycle', subject: 'Science' },
      { label: `Class ${safeClass} Solar System`, topic: 'Sun & Eight Planets Orbit Map', subject: 'Science' },
      { label: `Class ${safeClass} Fractions`, topic: 'Visual Fraction Pizza & Number Line Bars', subject: 'Mathematics' },
    ];
  }
  if (safeClass === 10 || safeClass >= 11) {
    return [
      { label: `Class ${safeClass} Optics & Ray Diagram`, topic: 'Convex Lens Focal Length & Ray Tracing', subject: 'Physics' },
      { label: `Class ${safeClass} Human Heart Flow`, topic: 'Double Circulation in Human Heart', subject: 'Biology' },
      { label: `Class ${safeClass} Trigonometry Unit Circle`, topic: 'Right Triangle Sine, Cosine & Tangent Circle', subject: 'Mathematics' },
      { label: `Class ${safeClass} Bohr Electron Shells`, topic: 'Quantum Energy Shells & Valency', subject: 'Chemistry' },
    ];
  }
  return [
    { label: `Class ${safeClass} Photosynthesis`, topic: 'Photosynthesis & Chloroplast Energy Conversion', subject: 'Science' },
    { label: `Class ${safeClass} Pythagoras Proof`, topic: 'Pythagoras Right Triangle Squares Proof', subject: 'Mathematics' },
    { label: `Class ${safeClass} Solar System`, topic: 'Inner vs Outer Planets & Asteroid Belt', subject: 'Science' },
    { label: `Class ${safeClass} Bohr Atom`, topic: 'Atomic Nucleus & K, L, M Shells', subject: 'Science' },
  ];
}

export function getClassSpecificStudyPlanSeeds(
  uid: string,
  classLevel: number,
  todayStr: string,
  nowIso: string
): StudyPlanTask[] {
  const safeClass = Math.min(12, Math.max(1, Math.round(classLevel || 7)));

  if (safeClass === 9) {
    return [
      {
        id: 'plan_seed_c9_phy',
        uid,
        title: 'Class 9 Physics: Revise Equations of Motion & Newton’s 2nd Law',
        subject: 'Physics',
        scheduledDate: todayStr,
        scheduledTime: '17:00',
        taskType: 'lesson',
        priority: 'high',
        recurrence: 'none',
        completed: false,
        reminderEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'plan_seed_c9_bio_math',
        uid,
        title: 'Class 9 Biology & Maths: Cell Organelles + Polynomials Daily Quiz',
        subject: 'Biology',
        scheduledDate: todayStr,
        scheduledTime: '18:30',
        taskType: 'quiz',
        priority: 'high',
        recurrence: 'daily',
        completed: false,
        reminderEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  if (safeClass <= 5) {
    return [
      {
        id: `plan_seed_c${safeClass}_1`,
        uid,
        title: `Class ${safeClass} Science: Trace the Water Cycle stages`,
        subject: 'Science',
        scheduledDate: todayStr,
        scheduledTime: '17:00',
        taskType: 'lesson',
        priority: 'high',
        recurrence: 'none',
        completed: false,
        reminderEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: `plan_seed_c${safeClass}_2`,
        uid,
        title: `Class ${safeClass} Maths: Practice Fractions & Number Puzzles`,
        subject: 'Mathematics',
        scheduledDate: todayStr,
        scheduledTime: '18:15',
        taskType: 'quiz',
        priority: 'medium',
        recurrence: 'daily',
        completed: false,
        reminderEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  return [
    {
      id: `plan_seed_c${safeClass}_1`,
      uid,
      title:
        safeClass >= 10
          ? `Class ${safeClass} STEM: Master Atomic Shells, Optics & Quadratic Concepts`
          : `Class ${safeClass} Science: Revise Photosynthesis & Cell Structure`,
      subject: safeClass >= 10 ? 'Physics' : 'Science',
      scheduledDate: todayStr,
      scheduledTime: '17:00',
      taskType: 'lesson',
      priority: 'high',
      recurrence: 'none',
      completed: false,
      reminderEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `plan_seed_c${safeClass}_2`,
      uid,
      title: `Class ${safeClass} Maths: Complete Daily Concept Quiz`,
      subject: 'Mathematics',
      scheduledDate: todayStr,
      scheduledTime: '18:30',
      taskType: 'quiz',
      priority: 'medium',
      recurrence: 'daily',
      completed: false,
      reminderEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}
