'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AgentDTO, FarmBedDTO, PlotDTO, LocationDTO } from '@/lib/clientTypes';
import { TICK_MS, WALK_SPEED } from '@/lib/simConstants';

// Agents only get a fresh authoritative x/y from the server once per tick, in
// WALK_SPEED-per-tick jumps — driving the mesh straight off that would look
// like a snap-then-freeze every poll. Instead we dead-reckon: walk the mesh
// continuously toward the server's own stated destination (targetX/targetY)
// at this same real-world speed every frame, and only gently nudge it toward
// the latest authoritative position to correct for drift.
const WALK_SPEED_MPS = WALK_SPEED / (TICK_MS / 1000);

/** Procedural grass texture: a mottled green tile, repeated across the ground disk. */
function createGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6fae52';
  ctx.fillRect(0, 0, size, size);
  const blobColors = ['#7cb85f', '#63a047', '#82c26a', '#5c9640'];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = blobColors[i % blobColors.length];
    ctx.globalAlpha = 0.22 + Math.random() * 0.25;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 5 + Math.random() * 14;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine speckle pass for extra texture detail at close zoom
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = blobColors[(i + 2) % blobColors.length];
    ctx.globalAlpha = 0.12 + Math.random() * 0.15;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft round cloud sprite, drawn once and reused on a handful of billboards. */
function createCloudTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blobs: [number, number, number][] = [
    [180, 300, 110],
    [280, 260, 130],
    [360, 310, 96],
    [230, 340, 100],
    [330, 350, 92]
  ];
  for (const [x, y, r] of blobs) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const ROLE_COLORS: Record<string, number> = {
  farmer: 0x8fbf7a,
  gatherer: 0xf2b95a,
  builder: 0xe08e6d,
  cook: 0xb79ae8,
  wanderer: 0x7fb8d9
};

function toWorld(x: number, y: number, h = 0) {
  return new THREE.Vector3(x, h, -y);
}

/**
 * Triangular-prism gable roof in local (unrotated) building space: X = width
 * axis, Z = depth axis, Y = up. The ridge runs along whichever of w/d is
 * longer, so it always reads as a real pitched roof regardless of aspect ratio.
 */
function buildGableRoofGeometry(w: number, d: number, height: number, overhang = 0.5): THREE.BufferGeometry {
  const ridgeAlongX = w >= d;
  const L = (ridgeAlongX ? w : d) / 2 + overhang;
  const S = (ridgeAlongX ? d : w) / 2 + overhang;

  let A: number[], B: number[], C: number[], D: number[], E: number[], F: number[];
  if (ridgeAlongX) {
    A = [-L, 0, -S];
    B = [-L, 0, S];
    C = [-L, height, 0];
    D = [L, 0, -S];
    E = [L, 0, S];
    F = [L, height, 0];
  } else {
    A = [-S, 0, -L];
    B = [S, 0, -L];
    C = [0, height, -L];
    D = [-S, 0, L];
    E = [S, 0, L];
    F = [0, height, L];
  }

  const positions = [...A, ...B, ...C, ...D, ...E, ...F];
  // two slanted quads (as triangle pairs) + two gable-end triangles
  const index = [0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 2, 1, 3, 4, 5];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Simple 4-sided pyramid hip roof: base rectangle w x d, apex centered above. */
function buildHipRoofGeometry(w: number, d: number, height: number, overhang = 0.5): THREE.BufferGeometry {
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const positions = [-hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd, 0, height, 0];
  const index = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Flat roof: a thin slab sitting on top of the walls, base at local y=0. */
function buildFlatRoofGeometry(w: number, d: number, thickness = 0.4, overhang = 0.5): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w + overhang * 2, thickness, d + overhang * 2);
  geometry.translate(0, thickness / 2, 0);
  return geometry;
}

const WINDOW_GLASS = 0xbfe3e6;
const WINDOW_FRAME = 0x5a4632;
const DOOR_PANEL = 0x6b4a34;
const DOOR_FRAME = 0x453224;

/**
 * Door + window details for one building, in the same local (X=width, Z=depth,
 * Y=up) space as the gable roof. The whole group gets rotated by the
 * building's angle and dropped at its centroid, same as the roof.
 */
function buildFacade(w: number, d: number, wallHeight: number): THREE.Group {
  const group = new THREE.Group();

  const addPanel = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    frameColor: number,
    faceColor: number,
    faceInset: number
  ) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color: frameColor, flatShading: true }));
    frame.position.set(x, y, z);
    group.add(frame);
    const isSideWall = sx < sz;
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(isSideWall ? sx * 0.5 : sx * 0.72, sy * 0.72, isSideWall ? sz * 0.72 : sz * 0.5),
      new THREE.MeshStandardMaterial({ color: faceColor, flatShading: true })
    );
    face.position.set(x + (isSideWall ? faceInset : 0), y, z + (isSideWall ? 0 : faceInset));
    group.add(face);
  };

  const doorH = Math.min(2.1, wallHeight * 0.6);
  const doorW = Math.min(1.3, w * 0.18);
  addPanel(0, doorH / 2, -d / 2, doorW, doorH, 0.18, DOOR_FRAME, DOOR_PANEL, -0.05);

  const winH = 1.05;
  const winW = 1.05;
  const winY = wallHeight * 0.58;

  // side-wall windows (left/right), always present
  addPanel(-w / 2, winY, 0, 0.18, winH, winW, WINDOW_FRAME, WINDOW_GLASS, -0.05);
  addPanel(w / 2, winY, 0, 0.18, winH, winW, WINDOW_FRAME, WINDOW_GLASS, 0.05);

  // front-wall windows flanking the door, only if there's room
  const flankX = doorW / 2 + winW / 2 + 0.6;
  if (flankX + winW / 2 < w / 2 - 0.4) {
    addPanel(-flankX, winY, -d / 2, winW, winH, 0.18, WINDOW_FRAME, WINDOW_GLASS, -0.05);
    addPanel(flankX, winY, -d / 2, winW, winH, 0.18, WINDOW_FRAME, WINDOW_GLASS, -0.05);
  }

  return group;
}

/** Built pieces (floor/wall/lamp), returned as a group anchored at ground level. */
function buildPieceMesh(type: string, cellSize: number): THREE.Group {
  const group = new THREE.Group();
  const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

  if (type === 'wall') {
    const w = cellSize * 0.85;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 3, 0.4), mat(0xd9c5a0));
    panel.position.set(0, 1.5, 0);
    group.add(panel);

    for (const sign of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.5), mat(0x8a6a48));
      post.position.set(sign * (w / 2 - 0.1), 1.5, 0);
      group.add(post);
    }

    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.14), mat(WINDOW_GLASS));
    pane.position.set(0, 1.9, 0.27);
    group.add(pane);

    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.44), mat(0x8a6a48));
    base.position.set(0, 0.11, 0);
    group.add(base);
  } else if (type === 'lamp') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 6), mat(0x3a2e22));
    post.position.set(0, 0.65, 0);
    group.add(post);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(0xffe08a, { emissive: 0xcfa030 }));
    bulb.position.set(0, 1.42, 0);
    group.add(bulb);

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 8), mat(0xf2c14e, { emissive: 0x553300 }));
    shade.position.set(0, 1.85, 0);
    group.add(shade);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.1, 8), mat(0x3a2e22));
    plate.position.set(0, 0.05, 0);
    group.add(plate);
  } else {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 0.95, 0.25, cellSize * 0.95), mat(0xb9a67d));
    tile.position.set(0, 0.125, 0);
    group.add(tile);

    for (const offset of [-cellSize * 0.2, cellSize * 0.2]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 0.95, 0.05, 0.08), mat(0x8f7a58));
      plank.position.set(0, 0.28, offset);
      group.add(plank);
    }

    const trim = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 1.02, 0.08, cellSize * 1.02), mat(0x7a6647));
    trim.position.set(0, 0.04, 0);
    group.add(trim);
  }
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}

const BED_COLORS: Record<string, number> = {
  empty: 0xa98f6b,
  planted: 0x6f9a52,
  growing: 0x7fb35c,
  ready: 0xd7e06a
};

interface Props {
  agents: AgentDTO[];
  farm: FarmBedDTO[];
  plots: PlotDTO[];
  location: LocationDTO | null;
  dayNight: 'day' | 'night';
  zoomLevel: 'village' | 'island';
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onSelectPlot: (id: string | null) => void;
}

interface Label {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: 'agent' | 'place';
  icon: string;
  color: string;
  external?: boolean;
}

function shadowMesh(x: number, y: number, radiusX: number, radiusZ = radiusX * 0.65) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(radiusX, radiusZ, 1);
  mesh.position.copy(toWorld(x, y, 0.03));
  return mesh;
}

/**
 * Wooden fence + gate around a plot's boundary, built directly in world
 * space (plots aren't rotated). cx/cy/half are in footprint (x,y) space —
 * the same space plot piece coordinates use — so the fence lines up exactly
 * with the piece grid it encloses. One side is left open as the gate.
 */
function buildFence(cx: number, cy: number, half: number, claimed: boolean): THREE.Group {
  const group = new THREE.Group();
  const fenceColor = claimed ? 0xcbb98a : 0x9a9186;
  const gateColor = 0x8a6a48;
  const fenceMat = new THREE.MeshStandardMaterial({ color: fenceColor, flatShading: true });
  const gateMat = new THREE.MeshStandardMaterial({ color: gateColor, flatShading: true });

  const points: [number, number][] = [
    [cx - half, cy - half],
    [cx, cy - half],
    [cx + half, cy - half],
    [cx + half, cy],
    [cx + half, cy + half],
    [cx, cy + half],
    [cx - half, cy + half],
    [cx - half, cy]
  ];
  const gateSegment = 0; // gap between points[0] and points[1]

  points.forEach(([fx, fy], i) => {
    const isGatePost = i === gateSegment || i === gateSegment + 1;
    const h = isGatePost ? 1.5 : 1.0;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(isGatePost ? 0.12 : 0.07, isGatePost ? 0.14 : 0.09, h, 6), isGatePost ? gateMat : fenceMat);
    post.position.copy(toWorld(fx, fy, h / 2));
    post.castShadow = true;
    group.add(post);
  });

  for (let i = 0; i < points.length; i++) {
    if (i === gateSegment) continue;
    const [fx1, fy1] = points[i];
    const [fx2, fy2] = points[(i + 1) % points.length];
    const len = Math.hypot(fx2 - fx1, fy2 - fy1);
    const angle = Math.atan2(fy2 - fy1, fx2 - fx1);
    for (const railY of [0.35, 0.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), fenceMat);
      rail.position.copy(toWorld((fx1 + fx2) / 2, (fy1 + fy2) / 2, railY));
      rail.rotation.y = angle;
      rail.castShadow = true;
      group.add(rail);
    }
  }

  // gate lintel over the opening
  const [gx1, gy1] = points[gateSegment];
  const [gx2, gy2] = points[gateSegment + 1];
  const gateLen = Math.hypot(gx2 - gx1, gy2 - gy1);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(gateLen + 0.3, 0.12, 0.1), gateMat);
  lintel.position.copy(toWorld((gx1 + gx2) / 2, (gy1 + gy2) / 2, 1.55));
  lintel.rotation.y = Math.atan2(gy2 - gy1, gx2 - gx1);
  lintel.castShadow = true;
  group.add(lintel);

  return group;
}

function placeIcon(plot: PlotDTO): string {
  if (plot.pieces.length <= 1) return '✦';
  if ((plot.name ?? '').toLowerCase().includes('farm') || (plot.name ?? '').toLowerCase().includes('garden')) return '🌿';
  return '●';
}

export default function WorldCanvas({
  agents,
  farm,
  plots,
  location,
  dayNight,
  zoomLevel,
  selectedAgentId,
  onSelectAgent,
  onSelectPlot
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const sunRef = useRef<THREE.DirectionalLight>();
  const hemiRef = useRef<THREE.HemisphereLight>();
  const lampLightsRef = useRef<THREE.PointLight[]>([]);
  const lampHeadsRef = useRef<THREE.Mesh[]>([]);
  const lightTargetRef = useRef({
    sunIntensity: 1.5,
    hemiIntensity: 0.75,
    sunColor: new THREE.Color(0xfff0d0),
    bg: new THREE.Color(0xbfe3ea),
    lampIntensity: 0
  });
  const agentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const plotAnchorsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const plotInfoRef = useRef<Map<string, { name: string; icon: string }>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const panRef = useRef({ x: 0, z: 0 });
  const zoomRef = useRef(1.6);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    zoomRef.current = zoomLevel === 'village' ? 1.6 : 0.6;
    const camera = cameraRef.current;
    if (camera) {
      camera.zoom = zoomRef.current;
      camera.updateProjectionMatrix();
    }
  }, [zoomLevel]);

  // --- one-time scene setup ---
  useEffect(() => {
    const container = containerRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe3ea);
    sceneRef.current = scene;

    const aspect = container.clientWidth / (container.clientHeight || container.clientWidth || 1);
    const frustum = 220;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      2000
    );
    camera.position.set(260, 320, 260);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoomRef.current;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Capped conservatively: a high pixel-ratio cap combined with a large
    // shadow map can exceed GPU memory/texture limits on weaker hardware and
    // kill the WebGL context outright (canvas goes blank), which is a much
    // worse failure mode than a slightly softer image. Mobile/touch devices
    // get an extra-conservative cap since they tend to have less GPU memory.
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    // Ask the GPU what it can actually handle rather than assuming — a
    // hard-coded 2048 can still be too much for very old/integrated GPUs.
    const shadowMapSize = Math.min(2048, renderer.capabilities.maxTextureSize || 2048);

    const hemi = new THREE.HemisphereLight(0xfff3d9, 0x9fc7b8, 0.75);
    scene.add(hemi);
    hemiRef.current = hemi;

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(140, 170, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    sun.shadow.camera.left = -230;
    sun.shadow.camera.right = 230;
    sun.shadow.camera.top = 230;
    sun.shadow.camera.bottom = -230;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0015;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;

    // water (everything beyond the island)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x4fa3d1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.2;
    scene.add(water);

    // grass ground disk
    const grassTexture = createGrassTexture();
    grassTexture.anisotropy = maxAniso;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(215, 96), new THREE.MeshStandardMaterial({ map: grassTexture }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // a handful of drifting cloud billboards
    const cloudTexture = createCloudTexture();
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const scale = 40 + Math.random() * 50;
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
      cloud.scale.set(scale, scale, 1);
      cloud.rotation.x = -Math.PI / 2;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 260;
      cloud.position.set(Math.cos(angle) * r, 140 + Math.random() * 40, Math.sin(angle) * r);
      cloud.userData.driftSpeed = 1.5 + Math.random() * 2;
      cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);

    let raf = 0;
    const resize = () => {
      if (!container) return;
      const a = container.clientWidth / (container.clientHeight || container.clientWidth || 1);
      camera.left = (-frustum * a) / 2;
      camera.right = (frustum * a) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let lastLabelUpdate = 0;
    let lastFrameT = 0;
    const animate = (t: number) => {
      raf = requestAnimationFrame(animate);
      const dt = lastFrameT ? Math.min(0.1, (t - lastFrameT) / 1000) : 0;
      lastFrameT = t;

      for (const group of agentMeshesRef.current.values()) {
        const u = group.userData;
        if (u.walking && dt > 0) {
          const dx = (u.destX ?? u.simX) - u.simX;
          const dy = (u.destY ?? u.simY) - u.simY;
          const dist = Math.hypot(dx, dy);
          const step = WALK_SPEED_MPS * dt;
          // local +Z is the character's "front" (that's where the eyes sit),
          // so facing needs atan2(dx, -dy) here, not atan2(dy, dx) — that
          // formula is for aligning an object's local +X (e.g. a fence rail).
          if (dist > 0.05) u.facing = Math.atan2(dx, -dy);
          if (dist > step) {
            u.simX += (dx / dist) * step;
            u.simY += (dy / dist) * step;
          } else {
            u.simX = u.destX ?? u.simX;
            u.simY = u.destY ?? u.simY;
          }
        }
        group.position.set(u.simX ?? 0, 0, -(u.simY ?? 0));

        // ease the walk blend in/out so starting or stopping never pops, and
        // keep the bob small — it's a subtle step wobble, not a hop
        const walkTarget = u.walking ? 1 : 0;
        u.walkBlend = (u.walkBlend ?? 0) + (walkTarget - (u.walkBlend ?? 0)) * Math.min(1, dt * 8);
        const characterRoot = u.characterRoot as THREE.Object3D | undefined;
        if (characterRoot) {
          const phase = t / 130 + (u.seed ?? 0);
          characterRoot.position.y = Math.sin(phase) * 0.1 * u.walkBlend;
          if (u.facing !== undefined) characterRoot.rotation.y = u.facing;

          const swing = Math.sin(phase) * 0.55 * u.walkBlend;
          const armSwing = Math.sin(phase) * 0.4 * u.walkBlend;
          if (u.legL) u.legL.rotation.x = swing;
          if (u.legR) u.legR.rotation.x = -swing;
          if (u.armL) u.armL.rotation.x = -armSwing;
          if (u.armR) u.armR.rotation.x = armSwing;
        }
      }

      for (const cloud of cloudGroup.children) {
        cloud.position.x += (cloud.userData.driftSpeed ?? 1) * dt;
        if (cloud.position.x > 320) cloud.position.x = -320;
      }

      // gently fade lighting/background toward the current day-night target
      // instead of snapping, so sunrise/sunset reads as a transition
      if (dt > 0) {
        const target = lightTargetRef.current;
        const fade = Math.min(1, dt * 0.6);
        sun.intensity += (target.sunIntensity - sun.intensity) * fade;
        sun.color.lerp(target.sunColor, fade);
        hemi.intensity += (target.hemiIntensity - hemi.intensity) * fade;
        (scene.background as THREE.Color).lerp(target.bg, fade);
        for (const light of lampLightsRef.current) {
          light.intensity += (target.lampIntensity - light.intensity) * fade;
        }
        for (const head of lampHeadsRef.current) {
          const mat = head.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity += (target.lampIntensity - mat.emissiveIntensity) * fade;
        }
      }

      renderer.render(scene, camera);

      if (t - lastLabelUpdate > 120) {
        lastLabelUpdate = t;
        const next: Label[] = [];
        const rect = container.getBoundingClientRect();
        const project = (pos: THREE.Vector3) => {
          const v = pos.clone().project(camera);
          if (v.z > 1 || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
          const sx = ((v.x + 1) / 2) * rect.width;
          const sy = ((1 - v.y) / 2) * rect.height;
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
          return { sx, sy };
        };
        for (const [id, group] of agentMeshesRef.current.entries()) {
          const headPos = group.position.clone();
          headPos.y += 3.9;
          const p = project(headPos);
          if (!p) continue;
          next.push({ id, x: p.sx, y: p.sy, text: group.userData.name, kind: 'agent', icon: '', color: group.userData.color, external: group.userData.external });
        }
        for (const [id, anchor] of plotAnchorsRef.current.entries()) {
          const p = project(anchor);
          if (!p) continue;
          const info = plotInfoRef.current.get(id);
          if (!info) continue;
          next.push({ id: `place-${id}`, x: p.sx, y: p.sy, text: info.name, kind: 'place', icon: info.icon, color: '#6b8e78' });
        }
        setLabels(next);
      }
    };
    raf = requestAnimationFrame(animate);

    // --- drag to pan, scroll to zoom, click (no-drag) to select ---
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let dragged = false;
    const panState = panRef.current;

    const applyPan = () => {
      camera.position.set(260 + panState.x, 320, 260 + panState.z);
      camera.lookAt(panState.x, 0, panState.z);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragged = false;
      dragStart = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      dragStart = { x: e.clientX, y: e.clientY };
      const scale = 0.9 / camera.zoom;
      panState.x -= dx * scale;
      panState.z -= dy * scale;
      panState.x = Math.max(-260, Math.min(260, panState.x));
      panState.z = Math.max(-260, Math.min(260, panState.z));
      applyPan();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (dragged) return;
      const rect = container.getBoundingClientRect();
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const groups = Array.from(agentMeshesRef.current.values());
      const hits = raycasterRef.current.intersectObjects(groups, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.id) obj = obj.parent;
        if (obj) onSelectAgent(obj.userData.id);
        onSelectPlot(null);
      } else {
        onSelectAgent(null);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = camera.zoom * (1 - e.deltaY * 0.001);
      camera.zoom = Math.max(0.4, Math.min(5.5, next));
      camera.updateProjectionMatrix();
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // If the GPU/driver kills the context (out of memory, driver reset, too
    // many contexts open, etc.) the canvas would otherwise go blank forever.
    // preventDefault() tells the browser we want it back; the render loop
    // above keeps calling renderer.render() every frame regardless, so it
    // just resumes drawing once the context comes back.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[world] WebGL context lost — will resume automatically if the browser restores it.');
    };
    const onContextRestored = () => {
      console.info('[world] WebGL context restored.');
    };
    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- day / night lighting: set targets here, lerp them gradually in the
  // animate loop below so the transition fades instead of snapping ---
  useEffect(() => {
    const target = lightTargetRef.current;
    if (dayNight === 'day') {
      target.bg.set(0xbfe3ea);
      target.sunIntensity = 1.5;
      target.sunColor.set(0xfff0d0);
      target.hemiIntensity = 0.75;
      target.lampIntensity = 0;
    } else {
      target.bg.set(0x18213f);
      target.sunIntensity = 0.35;
      target.sunColor.set(0x8fa0ff);
      target.hemiIntensity = 0.35;
      target.lampIntensity = 1.4;
    }
  }, [dayNight]);

  // --- static world: buildings, paths, trees (built once location loads) ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !location) return;
    const group = new THREE.Group();
    group.name = 'world-static';

    // paths
    for (const seg of location.paths ?? []) {
      const [x1, y1] = seg.from;
      const [x2, y2] = seg.to;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.2), new THREE.MeshStandardMaterial({ color: 0xcbb98a }));
      strip.rotation.x = -Math.PI / 2;
      const angle = Math.atan2(-(y2 - y1), x2 - x1);
      strip.rotation.z = -angle;
      strip.position.copy(toWorld((x1 + x2) / 2, (y1 + y2) / 2, 0.02));
      group.add(strip);
    }

    // buildings: base walls + a pitched gable roof on top
    for (const b of location.buildings) {
      if (b.footprint.length < 3) continue;
      const shape = new THREE.Shape();
      b.footprint.forEach(([x, y], i) => {
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
      const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: b.wallHeight, bevelEnabled: false });
      wallGeo.rotateX(-Math.PI / 2);
      const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: b.wallColor, flatShading: true }));
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);

      const cx = b.centerX ?? b.footprint.reduce((s, p) => s + p[0], 0) / b.footprint.length;
      const cy = b.centerY ?? b.footprint.reduce((s, p) => s + p[1], 0) / b.footprint.length;
      const w = b.width ?? Math.max(...b.footprint.map((p) => p[0])) - Math.min(...b.footprint.map((p) => p[0]));
      const d = b.depth ?? Math.max(...b.footprint.map((p) => p[1])) - Math.min(...b.footprint.map((p) => p[1]));

      const roofGeo =
        b.roofStyle === 'hip'
          ? buildHipRoofGeometry(w, d, b.roofHeight)
          : b.roofStyle === 'flat'
            ? buildFlatRoofGeometry(w, d)
            : buildGableRoofGeometry(w, d, b.roofHeight);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: b.roofColor, flatShading: true, side: THREE.DoubleSide }));
      roof.position.copy(toWorld(cx, cy, b.wallHeight));
      roof.rotation.y = b.angle ?? 0;
      roof.castShadow = true;
      roof.receiveShadow = true;
      group.add(roof);

      const facade = buildFacade(w, d, b.wallHeight);
      facade.position.copy(toWorld(cx, cy, 0));
      facade.rotation.y = b.angle ?? 0;
      group.add(facade);

      group.add(shadowMesh(cx, cy, Math.max(w, d) * 0.65));
    }

    // trees
    for (const t of location.trees ?? []) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * t.scale, 0.32 * t.scale, 2.2 * t.scale, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a6a48 })
      );
      trunk.position.copy(toWorld(t.x, t.y, 1.1 * t.scale));
      trunk.castShadow = true;
      group.add(trunk);
      if (t.kind === 'palm') {
        for (let i = 0; i < 5; i++) {
          const frond = new THREE.Mesh(
            new THREE.ConeGeometry(0.35 * t.scale, 2.6 * t.scale, 4),
            new THREE.MeshStandardMaterial({ color: 0x6fae5a })
          );
          frond.position.copy(toWorld(t.x, t.y, 2.3 * t.scale));
          frond.rotation.z = (Math.PI / 3.2) * Math.cos((i / 5) * Math.PI * 2);
          frond.rotation.x = (Math.PI / 3.2) * Math.sin((i / 5) * Math.PI * 2);
          frond.rotation.y = (i / 5) * Math.PI * 2;
          frond.castShadow = true;
          group.add(frond);
        }
      } else {
        const foliage = new THREE.Mesh(
          new THREE.SphereGeometry(1.6 * t.scale, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x6fae5a })
        );
        foliage.position.copy(toWorld(t.x, t.y, 2.6 * t.scale));
        foliage.castShadow = true;
        group.add(foliage);
      }
      group.add(shadowMesh(t.x, t.y, 1.4 * t.scale));
    }

    for (const r of location.rocks ?? []) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 * r.scale, 0),
        new THREE.MeshStandardMaterial({ color: 0x9a978d, flatShading: true })
      );
      rock.position.copy(toWorld(r.x, r.y, 0.4 * r.scale));
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
      group.add(shadowMesh(r.x, r.y, 0.9 * r.scale));
    }

    for (const f of location.flowers ?? []) {
      for (let i = 0; i < 4; i++) {
        const ox = (Math.random() - 0.5) * 1.2;
        const oy = (Math.random() - 0.5) * 1.2;
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshStandardMaterial({ color: f.color }));
        bloom.position.copy(toWorld(f.x + ox, f.y + oy, 0.2));
        group.add(bloom);
      }
    }

    // lampposts: post + glowing head + a point light toggled by day/night
    const lampLights: THREE.PointLight[] = [];
    const lampHeads: THREE.Mesh[] = [];
    for (const l of location.lampposts ?? []) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3226, flatShading: true })
      );
      post.position.copy(toWorld(l.x, l.y, 1.6));
      post.castShadow = true;
      group.add(post);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdd88, emissiveIntensity: 0 })
      );
      head.position.copy(toWorld(l.x, l.y, 3.3));
      group.add(head);
      lampHeads.push(head);

      const light = new THREE.PointLight(0xffdd88, 0, 13, 2);
      light.position.copy(toWorld(l.x, l.y, 3.25));
      group.add(light);
      lampLights.push(light);

      group.add(shadowMesh(l.x, l.y, 0.45));
    }
    lampLightsRef.current = lampLights;
    lampHeadsRef.current = lampHeads;

    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      lampLightsRef.current = [];
      lampHeadsRef.current = [];
    };
  }, [location]);

  // --- farm beds ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const group = new THREE.Group();
    for (const bed of farm) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.6, 4.5),
        new THREE.MeshStandardMaterial({ color: BED_COLORS[bed.stage] ?? 0x5b4632 })
      );
      mesh.position.copy(toWorld(bed.x, bed.y, 0.3));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    };
  }, [farm]);

  // --- plots + built pieces + anchors for name pills ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const group = new THREE.Group();
    plotAnchorsRef.current.clear();
    plotInfoRef.current.clear();
    for (const plot of plots) {
      const [cx, cy] = plot.centroid;
      const size = plot.gridCols * plot.cellSize;
      if (plot.name) {
        plotAnchorsRef.current.set(plot.id, toWorld(cx, cy, plot.gridCols * 0.4 + 5));
        plotInfoRef.current.set(plot.id, { name: plot.name, icon: placeIcon(plot) });
      }

      group.add(buildFence(cx, cy, size / 2 + 0.6, !!plot.claimedBy));

      for (const piece of plot.pieces) {
        const px = cx - size / 2 + (piece.col + 0.5) * plot.cellSize;
        const py = cy - size / 2 + (piece.row + 0.5) * plot.cellSize;
        const pieceGroup = buildPieceMesh(piece.type, plot.cellSize);
        pieceGroup.position.copy(toWorld(px, py, 0));
        group.add(pieceGroup);
      }
    }
    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    };
  }, [plots]);

  // --- agents: create/update/remove character groups ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const existing = agentMeshesRef.current;
    const seen = new Set<string>();

    agents.forEach((a, idx) => {
      seen.add(a.id);
      let group = existing.get(a.id);
      const color = ROLE_COLORS[a.role] ?? 0xffffff;

      if (!group) {
        group = new THREE.Group();
        group.position.copy(toWorld(a.x, a.y, 0));

        const shadow = shadowMesh(0, 0, 1.15);
        shadow.position.set(0, 0.05, 0);
        group.add(shadow);

        const characterRoot = new THREE.Group();
        group.add(characterRoot);

        const limbMat = new THREE.MeshStandardMaterial({ color });
        const makeLimbPivot = (x: number, y: number, len: number, radius: number) => {
          const pivot = new THREE.Group();
          pivot.position.set(x, y, 0);
          const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len * 0.55, 4, 8), limbMat);
          limb.position.y = -len / 2;
          limb.castShadow = true;
          pivot.add(limb);
          characterRoot.add(pivot);
          return pivot;
        };

        // torso only spans hip-to-shoulder now — legs/arms are separate
        // swinging pivots so a real walk cycle is possible
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.7, 6, 12), limbMat);
        torso.position.y = 1.65;
        torso.castShadow = true;
        characterRoot.add(torso);

        const legL = makeLimbPivot(-0.22, 0.8, 0.85, 0.17);
        const legR = makeLimbPivot(0.22, 0.8, 0.85, 0.17);
        const armL = makeLimbPivot(-0.58, 1.95, 0.78, 0.14);
        const armR = makeLimbPivot(0.58, 1.95, 0.78, 0.14);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), new THREE.MeshStandardMaterial({ color: 0xf3d9bd }));
        head.position.y = 2.85;
        head.castShadow = true;
        characterRoot.add(head);

        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat);
          eye.position.set(side * 0.18, 2.9, 0.44);
          characterRoot.add(eye);
        }

        group.userData.characterRoot = characterRoot;
        group.userData.bodyMesh = torso;
        group.userData.limbMat = limbMat;
        group.userData.legL = legL;
        group.userData.legR = legR;
        group.userData.armL = armL;
        group.userData.armR = armR;
        group.userData.simX = a.x;
        group.userData.simY = a.y;
        group.userData.facing = 0;
        scene.add(group);
        existing.set(a.id, group);
      }

      group.userData.id = a.id;
      group.userData.name = a.name;
      group.userData.color = `#${color.toString(16).padStart(6, '0')}`;
      group.userData.walking = a.status === 'walking';
      group.userData.seed = idx;
      group.userData.external = a.source === 'external';
      // gently correct client-predicted position toward the authoritative
      // server position instead of snapping, so drift never compounds
      group.userData.simX += (a.x - group.userData.simX) * 0.25;
      group.userData.simY += (a.y - group.userData.simY) * 0.25;
      group.userData.destX = a.status === 'walking' ? a.targetX ?? a.x : a.x;
      group.userData.destY = a.status === 'walking' ? a.targetY ?? a.y : a.y;

      (group.userData.bodyMesh.material as THREE.MeshStandardMaterial).color.set(color);
      const scale = a.id === selectedAgentId ? 1.3 : 1;
      (group.userData.characterRoot as THREE.Group).scale.set(scale, scale, scale);
    });

    for (const [id, group] of existing.entries()) {
      if (!seen.has(id)) {
        scene.remove(group);
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        existing.delete(id);
      }
    }
  }, [agents, selectedAgentId]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {labels.map((l) =>
        l.kind === 'agent' ? (
          <div
            key={l.id}
            onClick={() => onSelectAgent(l.id)}
            style={{ position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -150%)', cursor: 'pointer', userSelect: 'none' }}
          >
            <div
              style={{
                background: '#ffffff',
                border: l.external ? '1.5px solid #6b8e78' : '1.5px solid rgba(0,0,0,0.06)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: '#2c2c2c',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              {l.external ? '✦ ' : ''}
              {l.text}
            </div>
          </div>
        ) : (
          <div
            key={l.id}
            onClick={() => onSelectPlot(l.id.replace('place-', ''))}
            style={{ position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -50%)', cursor: 'pointer', userSelect: 'none' }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#2c2c2c',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>{l.icon}</span>
              {l.text}
              <span style={{ opacity: 0.5 }}>↗</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
