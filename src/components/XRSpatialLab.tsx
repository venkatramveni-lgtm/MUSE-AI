import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRModelId } from '../types/muse';
import { Box, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';

interface XRSpatialLabProps {
  modelId: XRModelId;
  title?: string;
}

const MODEL_META: Record<
  XRModelId,
  { label: string; subtitle: string; parts: string[] }
> = {
  solar_system: {
    label: 'Solar System Orbital Mechanics',
    subtitle: 'Observe inner rocky planets and outer gas giants orbiting the Sun.',
    parts: ['Sun (Star Core)', 'Mercury & Venus', 'Earth + Moon', 'Mars & Saturn + Rings'],
  },
  plant_cell: {
    label: 'Plant Cell & Chloroplast Cutaway',
    subtitle: 'Inspect the cell wall, central vacuole, nucleus, mitochondria, and chloroplasts.',
    parts: ['Cellulose Cell Wall', 'Central Vacuole', 'Nucleus & Nucleolus', 'Chloroplasts & Mitochondria'],
  },
  motion_physics: {
    label: 'Class 9 Motion, Force & Momentum Lab',
    subtitle: 'Explore inclined ramp acceleration, net force vector (F = ma), and Newton’s cradle momentum.',
    parts: ['Inclined Plane Ramp', 'Sliding Mass Block', 'Net Force Vector Arrow', 'Newton’s Cradle Spheres'],
  },
  atomic_bohr: {
    label: 'Bohr Atomic Model (Sodium Z=11)',
    subtitle: 'Protons & neutrons in the nucleus with K(2), L(8), M(1) electron shells.',
    parts: ['Proton-Neutron Nucleus', 'K-Shell (2e-)', 'L-Shell (8e-)', 'M-Valence Electron (1e-)'],
  },
  pythagoras_3d: {
    label: 'Pythagoras Geometric Area Proof (3-4-5)',
    subtitle: 'Visual proof that Area(a²) + Area(b²) = Area(c²) along a 3-4-5 right triangle.',
    parts: ['Right Triangle Frame', 'Square a² (9 units)', 'Square b² (16 units)', 'Hypotenuse Square c² (25 units)'],
  },
  water_cycle: {
    label: 'Hydrological Water Cycle Diorama',
    subtitle: 'Sun-driven evaporation over ocean, cloud condensation, and mountain rainfall.',
    parts: ['Ocean Basin', 'Mountain Terrain', 'Evaporation Streams', 'Condensation Cloud & Rain'],
  },
};

function detectWebGlProfile(): { isSoftware: boolean; supported: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return { isSoftware: true, supported: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {
      isSoftware: /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu),
      supported: true,
    };
  } catch {
    return { isSoftware: true, supported: false };
  }
}

function buildModelGroup(modelId: XRModelId): { group: THREE.Group; animate: (elapsed: number) => void } {
  const group = new THREE.Group();
  const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
    geometries: [],
    materials: [],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m);
    return m;
  };

  // Ground contact shadow disc for grounding
  const shadowGeo = trackGeo(new THREE.CircleGeometry(2.6, 32));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -1.15;
  group.add(shadowDisc);

  if (modelId === 'solar_system') {
    const sun = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.45, 28, 28)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.7, roughness: 0.35 }))
    );
    group.add(sun);

    const planets: { mesh: THREE.Object3D; radius: number; speed: number }[] = [];
    const specs = [
      { name: 'mercury', r: 0.75, size: 0.08, color: 0x94a3b8, speed: 1.8 },
      { name: 'venus', r: 1.05, size: 0.12, color: 0xfdba74, speed: 1.3 },
      { name: 'earth', r: 1.42, size: 0.14, color: 0x3b82f6, speed: 1.0 },
      { name: 'mars', r: 1.78, size: 0.11, color: 0xef4444, speed: 0.78 },
      { name: 'saturn', r: 2.25, size: 0.22, color: 0xeab308, speed: 0.5, rings: true },
    ];

    for (const spec of specs) {
      const ringOrbit = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(spec.r, 0.008, 8, 64)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 }))
      );
      ringOrbit.rotation.x = Math.PI / 2;
      group.add(ringOrbit);

      const planetPivot = new THREE.Group();
      const sphere = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(spec.size, 20, 20)),
        trackMat(new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.45, metalness: 0.15 }))
      );
      planetPivot.add(sphere);

      if (spec.rings) {
        const satRing = new THREE.Mesh(
          trackGeo(new THREE.RingGeometry(0.28, 0.42, 32)),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xfde047, side: THREE.DoubleSide, roughness: 0.6 }))
        );
        satRing.rotation.x = Math.PI / 2.6;
        planetPivot.add(satRing);
      }

      group.add(planetPivot);
      planets.push({ mesh: planetPivot, radius: spec.r, speed: spec.speed });
    }

    group.userData.disposables = disposables;
    return {
      group,
      animate: (t) => {
        sun.rotation.y = t * 0.3;
        planets.forEach((p, idx) => {
          const angle = t * p.speed + idx * 1.1;
          p.mesh.position.set(Math.cos(angle) * p.radius, 0, Math.sin(angle) * p.radius);
          p.mesh.rotation.y = t * 0.8;
        });
      },
    };
  }

  if (modelId === 'motion_physics') {
    const basePlatform = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.8, 0.12, 1.8)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.15 }))
    );
    basePlatform.position.set(0, -1.02, 0);
    group.add(basePlatform);

    const rampShape = new THREE.Shape();
    rampShape.moveTo(-1.45, 0);
    rampShape.lineTo(0.35, 0);
    rampShape.lineTo(-1.45, 1.05);
    rampShape.closePath();

    const ramp = new THREE.Mesh(
      trackGeo(new THREE.ExtrudeGeometry(rampShape, { depth: 0.85, bevelEnabled: false })),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.2 }))
    );
    ramp.position.set(-0.2, -0.96, -0.42);
    group.add(ramp);

    const slopeAngle = Math.atan2(1.05, 1.8);
    const moverPivot = new THREE.Group();
    moverPivot.position.set(-1.65, 0.09, 0);
    moverPivot.rotation.z = -slopeAngle;
    group.add(moverPivot);

    const massBlock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.42, 0.28, 0.38)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.25 }))
    );
    massBlock.position.set(0.55, 0.16, 0);
    moverPivot.add(massBlock);

    const vectorShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.6 }))
    );
    vectorShaft.rotation.z = Math.PI / 2;
    vectorShaft.position.set(1.05, 0.16, 0);
    moverPivot.add(vectorShaft);

    const vectorHead = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.08, 0.18, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 }))
    );
    vectorHead.rotation.z = -Math.PI / 2;
    vectorHead.position.set(1.36, 0.16, 0);
    moverPivot.add(vectorHead);

    const cradleGroup = new THREE.Group();
    cradleGroup.position.set(1.15, -0.96, 0);
    group.add(cradleGroup);

    const pillarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 }));
    const pillarGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 10));
    [
      [-0.5, 0.67, -0.25],
      [0.5, 0.67, -0.25],
      [-0.5, 0.67, 0.25],
      [0.5, 0.67, 0.25],
    ].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(px, py, pz);
      cradleGroup.add(p);
    });

    const topBarGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 10));
    [-0.25, 0.25].forEach((pz) => {
      const bar = new THREE.Mesh(topBarGeo, pillarMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.34, pz);
      cradleGroup.add(bar);
    });

    const pendulums: THREE.Group[] = [];
    const sphereMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.65, roughness: 0.2 }));
    const sphereGeo = trackGeo(new THREE.SphereGeometry(0.11, 20, 20));
    const cordGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.85, 8));
    const cordMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xcbd5e1 }));

    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(-0.33 + i * 0.22, 1.34, 0);
      const cord = new THREE.Mesh(cordGeo, cordMat);
      cord.position.y = -0.425;
      pivot.add(cord);
      const bob = new THREE.Mesh(sphereGeo, sphereMat);
      bob.position.y = -0.85;
      pivot.add(bob);
      cradleGroup.add(pivot);
      pendulums.push(pivot);
    }

    group.userData.disposables = disposables;
    return {
      group,
      animate: (t) => {
        const slideCycle = (t * 0.45) % 1;
        const accelDist = 0.35 + slideCycle * slideCycle * 1.15;
        massBlock.position.x = accelDist;
        vectorShaft.position.x = accelDist + 0.5;
        vectorHead.position.x = accelDist + 0.81;

        const swing = Math.sin(t * 3.1);
        pendulums[0].rotation.z = swing < 0 ? swing * 0.48 : 0;
        pendulums[3].rotation.z = swing > 0 ? swing * 0.48 : 0;
      },
    };
  }

  if (modelId === 'plant_cell') {
    const wall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.3, 1.4, 1.6)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65, transparent: true, opacity: 0.35 }))
    );
    group.add(wall);

    const membrane = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1, 1.24, 1.44)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.4, transparent: true, opacity: 0.28 }))
    );
    group.add(membrane);

    const vacuole = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.48, 24, 24)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.1 }))
    );
    vacuole.scale.set(1.3, 0.85, 0.9);
    vacuole.position.set(-0.25, 0, 0);
    group.add(vacuole);

    const nucleus = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.28, 24, 24)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.35 }))
    );
    nucleus.position.set(0.62, 0.15, 0.15);
    group.add(nucleus);

    const mitoMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 }));
    const mitoGeo = trackGeo(new THREE.CapsuleGeometry(0.075, 0.18, 8, 12));
    [
      [0.42, -0.35, -0.35],
      [-0.78, -0.2, 0.38],
    ].forEach(([x, y, z]) => {
      const m = new THREE.Mesh(mitoGeo, mitoMat);
      m.position.set(x, y, z);
      m.rotation.set(0.4, 0.3, Math.PI / 4);
      group.add(m);
    });

    const golgiMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
    for (let g = 0; g < 3; g++) {
      const sac = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14 - g * 0.02, 0.025, 8, 18, Math.PI)), golgiMat);
      sac.position.set(0.25, 0.38 - g * 0.055, -0.35);
      group.add(sac);
    }

    const chloroplasts: THREE.Mesh[] = [];
    const chloroGeo = trackGeo(new THREE.CapsuleGeometry(0.09, 0.2, 8, 12));
    const chloroMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3 }));
    const positions: [number, number, number][] = [
      [-0.75, 0.35, 0.42],
      [0.35, -0.36, 0.42],
      [-0.55, -0.32, -0.4],
      [0.65, 0.32, -0.35],
    ];
    for (const [x, y, z] of positions) {
      const ch = new THREE.Mesh(chloroGeo, chloroMat);
      ch.position.set(x, y, z);
      ch.rotation.z = Math.PI / 3;
      group.add(ch);
      chloroplasts.push(ch);
    }

    group.userData.disposables = disposables;
    return {
      group,
      animate: (t) => {
        group.rotation.y = Math.sin(t * 0.3) * 0.25;
        chloroplasts.forEach((c, i) => {
          c.rotation.x = t * 0.6 + i;
        });
      },
    };
  }

  if (modelId === 'atomic_bohr') {
    const nucleusGroup = new THREE.Group();
    const protonMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.2 }));
    const neutronMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.5 }));
    const nucGeo = trackGeo(new THREE.SphereGeometry(0.12, 16, 16));
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const orb = new THREE.Mesh(nucGeo, i % 2 === 0 ? protonMat : neutronMat);
      orb.position.set(Math.cos(angle) * 0.13, ((i % 3) - 1) * 0.08, Math.sin(angle) * 0.13);
      nucleusGroup.add(orb);
    }
    group.add(nucleusGroup);

    const shells = [
      { r: 0.65, count: 2, speed: 1.8, tiltX: 0.2 },
      { r: 1.15, count: 8, speed: 1.0, tiltX: -0.35 },
      { r: 1.65, count: 1, speed: 0.7, tiltX: 0.15 },
    ];
    const electrons: { mesh: THREE.Mesh; r: number; speed: number; phase: number; tiltX: number }[] = [];
    const eGeo = trackGeo(new THREE.SphereGeometry(0.065, 16, 16));
    const eMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.7 }));

    for (const shell of shells) {
      const ring = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(shell.r, 0.012, 8, 64)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 }))
      );
      ring.rotation.x = Math.PI / 2 + shell.tiltX;
      group.add(ring);

      for (let i = 0; i < shell.count; i++) {
        const e = new THREE.Mesh(eGeo, eMat);
        group.add(e);
        electrons.push({
          mesh: e,
          r: shell.r,
          speed: shell.speed,
          phase: (i / shell.count) * Math.PI * 2,
          tiltX: shell.tiltX,
        });
      }
    }

    group.userData.disposables = disposables;
    return {
      group,
      animate: (t) => {
        nucleusGroup.rotation.y = t * 0.8;
        for (const el of electrons) {
          const a = t * el.speed + el.phase;
          const x = Math.cos(a) * el.r;
          const z = Math.sin(a) * el.r;
          const y = Math.sin(el.tiltX) * z;
          el.mesh.position.set(x, y, Math.cos(el.tiltX) * z);
        }
      },
    };
  }

  if (modelId === 'pythagoras_3d') {
    const scale = 0.26;
    const a = 3 * scale;
    const b = 4 * scale;
    const c = 5 * scale;

    const sqA = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(a, a, 0.08)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35 }))
    );
    sqA.position.set(-a / 2 - b / 2, -b / 2 + a / 2, 0);
    group.add(sqA);

    const sqB = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(b, b, 0.08)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.35 }))
    );
    sqB.position.set(0, -b - 0.02, 0);
    group.add(sqB);

    const angle = Math.atan2(a, b);
    const sqC = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(c, c, 0.08)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 }))
    );
    sqC.rotation.z = -angle;
    sqC.position.set(0.38, 0.38, 0);
    group.add(sqC);

    const triShape = new THREE.Shape();
    triShape.moveTo(-b / 2, -b / 2);
    triShape.lineTo(b / 2, -b / 2);
    triShape.lineTo(-b / 2, -b / 2 + a);
    triShape.closePath();
    const triMesh = new THREE.Mesh(
      trackGeo(new THREE.ExtrudeGeometry(triShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 })),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }))
    );
    triMesh.position.z = -0.05;
    group.add(triMesh);

    group.position.y = 0.2;
    group.userData.disposables = disposables;
    return {
      group,
      animate: (t) => {
        group.rotation.y = Math.sin(t * 0.45) * 0.45;
      },
    };
  }

  // Default: water_cycle
  const baseOcean = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.6, 0.25, 1.8)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.1 }))
  );
  baseOcean.position.set(-0.35, -0.8, 0);
  group.add(baseOcean);

  const mountain = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.9, 1.35, 6)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }))
  );
  mountain.position.set(0.75, -0.25, -0.1);
  group.add(mountain);

  const snowCap = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.32, 0.45, 6)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }))
  );
  snowCap.position.set(0.75, 0.22, -0.1);
  group.add(snowCap);

  const sunOrb = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.24, 20, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.65 }))
  );
  sunOrb.position.set(-1.1, 0.95, -0.3);
  group.add(sunOrb);

  const cloudGroup = new THREE.Group();
  const cloudMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 }));
  const cloudGeo = trackGeo(new THREE.SphereGeometry(0.24, 16, 16));
  [
    [-0.2, 0, 0],
    [0.05, 0.08, 0],
    [0.28, -0.02, 0],
  ].forEach(([cx, cy, cz]) => {
    const puff = new THREE.Mesh(cloudGeo, cloudMat);
    puff.position.set(cx, cy, cz);
    cloudGroup.add(puff);
  });
  cloudGroup.position.set(0.25, 0.85, 0);
  group.add(cloudGroup);

  const drops: THREE.Mesh[] = [];
  const dropGeo = trackGeo(new THREE.SphereGeometry(0.04, 10, 10));
  const dropMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 }));
  for (let i = 0; i < 6; i++) {
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.position.set(0.15 + (i % 3) * 0.18, 0.6 - Math.floor(i / 3) * 0.35, 0);
    group.add(drop);
    drops.push(drop);
  }

  group.userData.disposables = disposables;
  return {
    group,
    animate: (t) => {
      cloudGroup.position.x = 0.2 + Math.sin(t * 0.8) * 0.25;
      drops.forEach((d, idx) => {
        const cycle = (t * 0.9 + idx * 0.22) % 1;
        d.position.y = 0.7 - cycle * 1.2;
      });
    },
  };
}

/**
 * Software 3D-projected Canvas2D fallback when WebGL is disabled or lost on constrained devices.
 */
function runProjectedCanvasFallback(
  mount: HTMLDivElement,
  modelId: XRModelId,
  playingRef: React.MutableRefObject<boolean>,
  setCameraPresetRef: React.MutableRefObject<((preset: 'iso' | 'front' | 'top' | 'reset') => void) | null>
): () => void {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  mount.innerHTML = '';
  mount.appendChild(canvas);

  let yaw = 0.55;
  let pitch = 0.35;
  let zoom = 1;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  setCameraPresetRef.current = (preset) => {
    if (preset === 'iso') {
      yaw = 0.68;
      pitch = 0.45;
      zoom = 1;
    } else if (preset === 'front') {
      yaw = 0;
      pitch = 0.1;
      zoom = 1.05;
    } else if (preset === 'top') {
      yaw = 0;
      pitch = 1.35;
      zoom = 1;
    } else {
      yaw = 0.55;
      pitch = 0.35;
      zoom = 1;
    }
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - lastY) * 0.01));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = () => {
    dragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom = Math.max(0.6, Math.min(1.8, zoom - e.deltaY * 0.001));
  };

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const project = (x: number, y: number, z: number, cx: number, cy: number, scale: number) => {
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cpitch = Math.cos(pitch);
    const spitch = Math.sin(pitch);

    const x1 = x * cyaw - z * syaw;
    const z1 = x * syaw + z * cyaw;
    const y2 = y * cpitch - z1 * spitch;
    const z2 = y * spitch + z1 * cpitch;
    const persp = 4.5 / (4.5 - Math.max(-2.5, Math.min(2.5, z2)));
    return {
      sx: cx + x1 * scale * persp * zoom,
      sy: cy - y2 * scale * persp * zoom,
      depth: z2,
      persp,
    };
  };

  let disposed = false;
  let rafId = 0;
  const start = performance.now();

  const drawFrame = () => {
    if (disposed) return;
    const w = mount.clientWidth || 640;
    const h = mount.clientHeight || 360;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const t = playingRef.current ? (performance.now() - start) / 1000 : 0.4;
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.2;

      ctx.fillStyle = '#0b152a';
      ctx.fillRect(0, 0, w, h);

      // Floor perspective grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let g = -2; g <= 2; g += 0.5) {
        const a = project(g, -1.1, -2, cx, cy, scale);
        const b = project(g, -1.1, 2, cx, cy, scale);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();

        const c = project(-2, -1.1, g, cx, cy, scale);
        const d = project(2, -1.1, g, cx, cy, scale);
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(d.sx, d.sy);
        ctx.stroke();
      }

      const nodes: { x: number; y: number; z: number; r: number; color: string; label?: string }[] = [];
      if (modelId === 'solar_system') {
        nodes.push({ x: 0, y: 0, z: 0, r: 22, color: '#fbbf24', label: 'Sun' });
        [
          { rad: 0.75, r: 7, c: '#94a3b8', s: 1.8, n: 'Mercury' },
          { rad: 1.05, r: 9, c: '#fdba74', s: 1.3, n: 'Venus' },
          { rad: 1.42, r: 10, c: '#3b82f6', s: 1.0, n: 'Earth' },
          { rad: 1.78, r: 8, c: '#ef4444', s: 0.78, n: 'Mars' },
          { rad: 2.25, r: 14, c: '#eab308', s: 0.5, n: 'Saturn' },
        ].forEach((p, idx) => {
          const a = t * p.s + idx;
          nodes.push({ x: Math.cos(a) * p.rad, y: 0, z: Math.sin(a) * p.rad, r: p.r, color: p.c, label: p.n });
        });
      } else if (modelId === 'atomic_bohr') {
        nodes.push({ x: 0, y: 0, z: 0, r: 18, color: '#ef4444', label: 'Nucleus' });
        [
          { rad: 0.7, count: 2, s: 1.8 },
          { rad: 1.25, count: 8, s: 1.0 },
          { rad: 1.75, count: 1, s: 0.7 },
        ].forEach((sh) => {
          for (let i = 0; i < sh.count; i++) {
            const a = t * sh.s + (i / sh.count) * Math.PI * 2;
            nodes.push({ x: Math.cos(a) * sh.rad, y: Math.sin(a) * 0.25, z: Math.sin(a) * sh.rad, r: 6, color: '#38bdf8' });
          }
        });
      } else if (modelId === 'motion_physics') {
        const slide = (t * 0.45) % 1;
        const bx = -1.2 + slide * 1.4;
        const by = 0.5 - slide * 0.9;
        nodes.push({ x: -1.2, y: 0.5, z: 0, r: 10, color: '#64748b', label: 'Ramp Top' });
        nodes.push({ x: bx, y: by, z: 0, r: 16, color: '#3b82f6', label: 'Mass (F=ma)' });
        nodes.push({ x: bx + 0.5, y: by - 0.3, z: 0, r: 8, color: '#22d3ee', label: 'Net Force' });
        for (let i = 0; i < 4; i++) {
          const swing = i === 0 ? Math.min(0, Math.sin(t * 3) * 0.35) : i === 3 ? Math.max(0, Math.sin(t * 3) * 0.35) : 0;
          nodes.push({ x: 0.7 + i * 0.24 + swing, y: -0.25 + Math.abs(swing) * 0.3, z: 0, r: 10, color: '#f59e0b', label: i === 0 ? 'Cradle' : undefined });
        }
      } else if (modelId === 'plant_cell') {
        nodes.push({ x: -0.25, y: 0, z: 0, r: 26, color: '#38bdf8', label: 'Vacuole' });
        nodes.push({ x: 0.65, y: 0.15, z: 0.1, r: 18, color: '#8b5cf6', label: 'Nucleus' });
        nodes.push({ x: 0.4, y: -0.4, z: -0.3, r: 11, color: '#f97316', label: 'Mitochondria' });
        nodes.push({ x: -0.75, y: 0.35, z: 0.35, r: 12, color: '#22c55e', label: 'Chloroplast' });
      } else {
        nodes.push({ x: -0.6, y: -0.4, z: 0, r: 22, color: '#3b82f6', label: 'Model A' });
        nodes.push({ x: 0.4, y: 0.3, z: 0.2, r: 20, color: '#10b981', label: 'Model B' });
        nodes.push({ x: 0, y: -0.9, z: -0.2, r: 16, color: '#f59e0b', label: 'Base' });
      }

      const projected = nodes
        .map((n) => ({ ...n, ...project(n.x, n.y, n.z, cx, cy, scale) }))
        .sort((a, b) => a.depth - b.depth);

      for (const p of projected) {
        const radius = Math.max(3, p.r * p.persp * zoom);
        const grad = ctx.createRadialGradient(p.sx - radius * 0.3, p.sy - radius * 0.3, 1, p.sx, p.sy, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, p.color);
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fill();
        if (p.label) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 11px Inter, sans-serif';
          ctx.fillText(p.label, p.sx + radius + 5, p.sy + 4);
        }
      }
    }
    rafId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}

export const XRSpatialLab: React.FC<XRSpatialLabProps> = ({ modelId, title }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [xrSupported, setXrSupported] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const [fallbackActive, setFallbackActive] = useState(false);
  const playingRef = useRef(true);
  const setCameraPresetRef = useRef<((preset: 'iso' | 'front' | 'top' | 'reset') => void) | null>(null);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((supported) => setXrSupported(supported))
        .catch(() => setXrSupported(false));
    }
  }, []);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;
    setFallbackActive(false);

    const glProfile = detectWebGlProfile();
    const width = Math.max(300, mount.clientWidth || 640);
    const height = Math.max(280, mount.clientHeight || 360);

    let renderer: THREE.WebGLRenderer | null = null;
    if (glProfile.supported) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !glProfile.isSoftware,
          powerPreference: 'high-performance',
          alpha: false,
        });
      } catch {
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'default',
            alpha: false,
          });
        } catch {
          renderer = null;
        }
      }
    }

    if (!renderer) {
      setFallbackActive(true);
      return runProjectedCanvasFallback(mount, modelId, playingRef, setCameraPresetRef);
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(glProfile.isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !glProfile.isSoftware;
    renderer.xr.enabled = true;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    let fallbackCleanup: (() => void) | null = null;
    let disposed = false;

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      if (disposed) return;
      setFallbackActive(true);
      if (!fallbackCleanup) {
        fallbackCleanup = runProjectedCanvasFallback(mount, modelId, playingRef, setCameraPresetRef);
      }
    };
    const handleContextRestored = () => {
      if (disposed) return;
      setRetrySeed((s) => s + 1);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b152a);
    scene.fog = new THREE.Fog(0x0b152a, 6, 15);

    let envTexture: THREE.Texture | null = null;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const rt = pmrem.fromScene(roomEnv, 0.04);
      envTexture = rt.texture;
      scene.environment = envTexture;
      roomEnv.dispose();
      pmrem.dispose();
    } catch {
      // Proceed cleanly with directional & hemisphere lighting if PMREM is unavailable
    }

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 40);
    camera.position.set(0, 1.6, 4.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !glProfile.isSoftware;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;

    setCameraPresetRef.current = (preset) => {
      if (preset === 'iso') {
        camera.position.set(3.0, 2.2, 3.6);
      } else if (preset === 'front') {
        camera.position.set(0, 0.35, 4.5);
      } else if (preset === 'top') {
        camera.position.set(0, 4.6, 0.35);
      } else {
        camera.position.set(0, 1.6, 4.4);
      }
      controls.target.set(0, 0, 0);
      controls.update();
    };

    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff7ed, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const built = buildModelGroup(modelId);
    scene.add(built.group);

    let rafId = 0;
    let timerId = 0;
    const startTime = performance.now();
    const activeRenderer = renderer;

    function afterDraw(cb: () => void) {
      try {
        const gl = activeRenderer.getContext() as Partial<WebGL2RenderingContext> | null;
        if (gl && typeof gl.fenceSync === 'function' && typeof gl.getSyncParameter === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE!, 0);
          gl.flush?.();
          const poll = () => {
            if (disposed) return;
            const state = sync && gl.getSyncParameter!(sync, gl.SYNC_STATUS!);
            if (state === gl.UNSIGNALED) {
              timerId = window.setTimeout(poll, 8);
            } else {
              if (sync && typeof gl.deleteSync === 'function') gl.deleteSync(sync);
              timerId = window.setTimeout(cb, 50);
            }
          };
          timerId = window.setTimeout(poll, 8);
          return;
        }
      } catch {
        // Fallback to standard timer when fenceSync is unavailable
      }
      timerId = window.setTimeout(cb, 50);
    }

    function tick() {
      if (disposed || fallbackCleanup) return;
      const elapsed = (performance.now() - startTime) / 1000;
      if (playingRef.current) {
        built.animate(elapsed);
      }
      controls.update();
      activeRenderer.render(scene, camera);
      if (glProfile.isSoftware) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!mount || disposed || fallbackCleanup) return;
      const w = Math.max(300, mount.clientWidth || 640);
      const h = Math.max(280, mount.clientHeight || 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      activeRenderer.setSize(w, h);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    resizeObserver?.observe(mount);
    window.addEventListener('resize', handleResize);
    const initRaf = requestAnimationFrame(handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      activeRenderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      activeRenderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      fallbackCleanup?.();
      controls.dispose();
      const disp = built.group.userData.disposables as
        | { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }
        | undefined;
      disp?.geometries.forEach((g) => g.dispose());
      disp?.materials.forEach((m) => m.dispose());
      envTexture?.dispose();
      activeRenderer.dispose();
    };
  }, [modelId, retrySeed]);

  const meta = MODEL_META[modelId] || MODEL_META.solar_system;

  return (
    <div className="muse-card overflow-hidden" data-testid="xr-spatial-lab">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">{title || meta.label}</h4>
            <p className="text-xs text-[var(--text-muted)]">{meta.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause 3D' : 'Play 3D'}
          </button>
          {(['iso', 'front', 'top'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCameraPresetRef.current?.(preset)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 capitalize whitespace-nowrap shrink-0"
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCameraPresetRef.current?.('reset');
              if (fallbackActive) setRetrySeed((s) => s + 1);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset View
          </button>
          {xrSupported && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600/20 text-purple-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> WebXR Ready
            </span>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[340px] sm:h-[380px] bg-[#0b152a] cursor-grab active:cursor-grabbing relative"
        aria-label={`Interactive 3D spatial model: ${meta.label}`}
      />

      <div className="px-4 py-2.5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">3D Components:</span>
        {meta.parts.map((part) => (
          <span
            key={part}
            className="text-xs px-2.5 py-0.5 rounded-md bg-[var(--bg-subtle)] text-blue-400 border border-blue-500/20"
          >
            {part}
          </span>
        ))}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          Drag to orbit • Scroll to zoom
        </span>
      </div>
    </div>
  );
};
