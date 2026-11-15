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
    parts: ['Sun (Star Core)', 'Mercury & Venus', 'Earth + Moon', 'Mars & Jupiter + Rings'],
  },
  plant_cell: {
    label: 'Plant Cell & Chloroplast Cutaway',
    subtitle: 'Inspect the cell wall, large central vacuole, nucleus, and green chloroplasts.',
    parts: ['Cellulose Cell Wall', 'Central Vacuole', 'Nucleus & Nucleolus', 'Chloroplasts (Photosynthesis)'],
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

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
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

    // Hypotenuse square rotated along triangle edge
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

export const XRSpatialLab: React.FC<XRSpatialLabProps> = ({ modelId, title }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [xrSupported, setXrSupported] = useState(false);
  const playingRef = useRef(true);
  const resetCameraFnRef = useRef<(() => void) | null>(null);

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

    const isSoftwareGl = detectSoftwareGl();
    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 360;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.xr.enabled = true;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b152a);
    scene.fog = new THREE.Fog(0x0b152a, 6, 15);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 40);
    camera.position.set(0, 1.6, 4.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;

    resetCameraFnRef.current = () => {
      camera.position.set(0, 1.6, 4.4);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    // Warm key + cool hemisphere lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff7ed, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const built = buildModelGroup(modelId);
    scene.add(built.group);

    let frameId = 0;
    let disposed = false;
    const startTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const elapsed = (performance.now() - startTime) / 1000;
      if (playingRef.current) {
        built.animate(elapsed);
      }
      controls.update();
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!mount || disposed) return;
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      const disp = built.group.userData.disposables as
        | { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] }
        | undefined;
      disp?.geometries.forEach((g) => g.dispose());
      disp?.materials.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, [modelId]);

  const meta = MODEL_META[modelId];

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 flex items-center gap-1.5"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause 3D' : 'Play 3D'}
          </button>
          <button
            type="button"
            onClick={() => resetCameraFnRef.current?.()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/50 flex items-center gap-1.5"
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
        className="w-full h-[320px] sm:h-[360px] bg-[#0b152a] cursor-grab active:cursor-grabbing"
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
        <span className="ml-auto text-xs text-[var(--text-muted)]">Drag to orbit • Scroll to zoom</span>
      </div>
    </div>
  );
};
