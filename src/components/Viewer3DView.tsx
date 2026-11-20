import React, { useState } from 'react';
import { Box, Sparkles } from 'lucide-react';
import { UserProfile, XRModelId } from '../types/muse';
import { getClassDashboardBlueprint } from '../utils/curriculumFilter';
import { XRSpatialLab } from './XRSpatialLab';

interface Viewer3DViewProps {
  profile: UserProfile;
  onAskAITeacher?: (subject?: string, prompt?: string) => void;
}

interface ModelCatalogEntry {
  id: XRModelId;
  title: string;
  subject: string;
  recommendedClasses: string;
  keyConcepts: string[];
}

const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'motion_physics',
    title: 'Force Vectors, Ramp & Newton’s Cradle',
    subject: 'Physics',
    recommendedClasses: 'Classes 8–12',
    keyConcepts: [
      'Net force vector accelerates the block down the inclined plane (F = ma).',
      'Equal and opposite impulses conserve linear momentum across colliding spheres.',
      'Free-body components split gravity into normal and parallel components.',
    ],
  },
  {
    id: 'plant_cell',
    title: 'Plant Cell, Chloroplast & Mitochondria',
    subject: 'Biology',
    recommendedClasses: 'Classes 7–12',
    keyConcepts: [
      'Cellulose cell wall gives rigid structural support around the plasma membrane.',
      'Central vacuole maintains turgor pressure and stores cell sap.',
      'Chloroplasts convert light energy into glucose while mitochondria release ATP.',
    ],
  },
  {
    id: 'atomic_bohr',
    title: 'Bohr Atomic Model (Sodium Z=11)',
    subject: 'Chemistry',
    recommendedClasses: 'Classes 9–12',
    keyConcepts: [
      'Protons (+) and neutrons form the dense central nucleus.',
      'Electrons orbit in quantized shells: K = 2, L = 8, M = 1.',
      'Single valence electron gives Sodium (Na) its +1 electrovalency.',
    ],
  },
  {
    id: 'pythagoras_3d',
    title: 'Pythagoras Geometric Area Proof (3-4-5)',
    subject: 'Mathematics',
    recommendedClasses: 'Classes 7–10',
    keyConcepts: [
      'Side a = 3 forms area a² = 9 square units; side b = 4 forms area b² = 16 square units.',
      'Combined area 9 + 16 equals the hypotenuse square c² = 25 square units.',
      'Foundation for coordinate distance formula and right-triangle trigonometry.',
    ],
  },
  {
    id: 'solar_system',
    title: 'Solar System Orbital Mechanics',
    subject: 'Science',
    recommendedClasses: 'Classes 3–9',
    keyConcepts: [
      'Inner rocky planets orbit faster closer to the Sun’s gravitational well.',
      'Kepler’s laws link orbital radius to orbital period.',
      'Outer gas giants feature wide orbits and planetary ring systems.',
    ],
  },
  {
    id: 'water_cycle',
    title: 'Hydrological Water Cycle Diorama',
    subject: 'Science',
    recommendedClasses: 'Classes 1–8',
    keyConcepts: [
      'Solar heating drives evaporation from oceans and transpiration from plants.',
      'Cooling air at altitude condenses water vapour into clouds.',
      'Precipitation returns freshwater over mountain basins and rivers.',
    ],
  },
];

export const Viewer3DView: React.FC<Viewer3DViewProps> = ({ profile, onAskAITeacher }) => {
  const blueprint = getClassDashboardBlueprint(profile.classLevel);
  const [selectedModelId, setSelectedModelId] = useState<XRModelId>(blueprint.featuredXrModelId);

  const activeEntry = MODEL_CATALOG.find((m) => m.id === selectedModelId) || MODEL_CATALOG[0];

  return (
    <div className="space-y-5">
      <div className="muse-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-400">
            <Box className="w-3.5 h-3.5" />
            <span>Nano AI Interactive 3D &amp; WebXR Spatial Viewer</span>
          </div>
          <h1 className="font-display font-bold text-xl mt-0.5">
            3D Concept Lab (Class {profile.classLevel} · {profile.board})
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Orbit, zoom, switch camera angles (Iso / Front / Top), and inspect interactive 3D models aligned to your class syllabus.
          </p>
        </div>

        {onAskAITeacher && (
          <button
            type="button"
            onClick={() =>
              onAskAITeacher(
                activeEntry.subject,
                `Explain "${activeEntry.title}" for ${profile.board} Class ${profile.classLevel} in clear steps and include key exam questions.`
              )
            }
            className="px-4 py-2 rounded-xl text-xs font-semibold muse-btn-primary flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Nano AI about this 3D Model</span>
          </button>
        )}
      </div>

      {/* Model Switcher Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODEL_CATALOG.map((item) => {
          const isSelected = item.id === activeEntry.id;
          const isClassRecommended = item.id === blueprint.featuredXrModelId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedModelId(item.id)}
              className={`muse-card p-4 text-left border transition space-y-1.5 ${
                isSelected ? 'border-purple-500 bg-[var(--bg-subtle)]' : 'hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-blue-400">
                  {item.subject} · {item.recommendedClasses}
                </span>
                {isClassRecommended && (
                  <span className="text-[10px] font-bold uppercase text-emerald-400">
                    Class {profile.classLevel} Pick
                  </span>
                )}
              </div>
              <div className="font-display font-bold text-sm text-[var(--text-primary)]">
                {item.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live 3D Stage */}
      <XRSpatialLab modelId={activeEntry.id} title={activeEntry.title} />

      {/* Key Study Takeaways for Active 3D Model */}
      <div className="muse-card p-5 space-y-3">
        <h2 className="font-display font-bold text-base">
          Key Concepts in {activeEntry.title}
        </h2>
        <ul className="grid sm:grid-cols-3 gap-3 text-xs text-[var(--text-secondary)]">
          {activeEntry.keyConcepts.map((concept) => (
            <li key={concept} className="muse-panel p-3.5 leading-relaxed">
              {concept}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
