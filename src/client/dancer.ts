import type * as Phaser from 'phaser';
import {
  solveBones,
  type Bone,
  type Part,
  type Point,
  type Pose,
} from '../shared/dance';

// Clay palette. The dancer is drawn with code only (no image assets), so the
// look stays consistent at any size and the post loads fast.
const CLAY = 0xd8734a;
const CLAY_SHADE = 0xb2562f;
const CLAY_LIGHT = 0xf0a37c;
const SHIRT = 0x2e8b84;
const SHIRT_SHADE = 0x1f6b66;
const SHORTS = 0x4a3327;
const PRINT = 0xfbf3e4;
const STAR = 0xf2b632;
const INK = 0x2b1d16;
const FLOOR = 0xe2cfae;

const LIMB_WIDTH: Record<Part, number> = {
  torso: 0.5,
  head: 0.2,
  armL: 0.17,
  foreL: 0.15,
  armR: 0.17,
  foreR: 0.15,
  legL: 0.21,
  shinL: 0.18,
  legR: 0.21,
  shinR: 0.18,
};

const HEAD_RADIUS = 0.27;
const GRAB_RADIUS = 0.17;

export type DancerView = {
  /** Screen position of the hips. */
  origin: Point;
  /** Pixels per body unit. */
  scale: number;
};

export const toScreen = (view: DancerView, p: Point): Point => ({
  x: view.origin.x + p.x * view.scale,
  y: view.origin.y + p.y * view.scale,
});

export const toBody = (view: DancerView, p: Point): Point => ({
  x: (p.x - view.origin.x) / view.scale,
  y: (p.y - view.origin.y) / view.scale,
});

const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq)
        );
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
};

/** Which body part is under `point` (body units), if any. */
export const partAt = (pose: Pose, point: Point): Part | null => {
  const bones = solveBones(pose);
  let best: Part | null = null;
  let bestDistance = Infinity;

  for (const bone of Object.values(bones)) {
    let distance =
      bone.part === 'head'
        ? Math.hypot(point.x - bone.end.x, point.y - bone.end.y) - HEAD_RADIUS
        : distanceToSegment(point, bone.start, bone.end) -
          LIMB_WIDTH[bone.part] / 2;
    // Limbs win over the torso where they overlap it.
    if (bone.part === 'torso') distance += 0.06;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = bone.part;
    }
  }

  return bestDistance <= GRAB_RADIUS ? best : null;
};

/** Where a part's step-number badge sits (body units). */
export const badgeAnchor = (pose: Pose, part: Part): Point => {
  const bone = solveBones(pose)[part];
  if (part === 'head') {
    // On top of the head, so the number never covers the face.
    return {
      x: bone.end.x + Math.cos(bone.dir) * HEAD_RADIUS,
      y: bone.end.y + Math.sin(bone.dir) * HEAD_RADIUS,
    };
  }
  return {
    x: (bone.start.x + bone.end.x) / 2,
    y: (bone.start.y + bone.end.y) / 2,
  };
};

type Draw = {
  g: Phaser.GameObjects.Graphics;
  view: DancerView;
};

const capsule = (
  d: Draw,
  a: Point,
  b: Point,
  width: number,
  color: number,
  alpha = 1
) => {
  const { g, view } = d;
  const p = toScreen(view, a);
  const q = toScreen(view, b);
  const w = width * view.scale;
  g.lineStyle(w, color, alpha);
  g.lineBetween(p.x, p.y, q.x, q.y);
  g.fillStyle(color, alpha);
  g.fillCircle(p.x, p.y, w / 2);
  g.fillCircle(q.x, q.y, w / 2);
};

const disc = (d: Draw, c: Point, radius: number, color: number, alpha = 1) => {
  const p = toScreen(d.view, c);
  d.g.fillStyle(color, alpha);
  d.g.fillCircle(p.x, p.y, radius * d.view.scale);
};

const shift = (p: Point, dx: number, dy: number): Point => ({
  x: p.x + dx,
  y: p.y + dy,
});

const along = (bone: Bone, t: number): Point => ({
  x: bone.start.x + (bone.end.x - bone.start.x) * t,
  y: bone.start.y + (bone.end.y - bone.start.y) * t,
});

/** A limb as a lump of clay: shadow side, body, and a soft highlight. */
const clayLimb = (d: Draw, bone: Bone, selected: boolean) => {
  const width = LIMB_WIDTH[bone.part];
  if (selected) capsule(d, bone.start, bone.end, width + 0.07, INK);
  capsule(
    d,
    shift(bone.start, 0.02, 0.03),
    shift(bone.end, 0.02, 0.03),
    width,
    CLAY_SHADE
  );
  capsule(d, bone.start, bone.end, width, CLAY);
  capsule(
    d,
    shift(along(bone, 0.2), -width * 0.2, -width * 0.2),
    shift(along(bone, 0.65), -width * 0.2, -width * 0.2),
    width * 0.2,
    CLAY_LIGHT,
    0.7
  );
};

const star = (d: Draw, center: Point, radius: number, rotation: number) => {
  const { g, view } = d;
  g.fillStyle(STAR, 1);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = rotation + (i * Math.PI) / 5;
    const p = toScreen(view, {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    });
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fillPath();
};

const drawHead = (d: Draw, bone: Bone, selected: boolean) => {
  const { g, view } = d;
  const c = bone.end;
  const up = { x: Math.cos(bone.dir), y: Math.sin(bone.dir) };
  const side = { x: -up.y, y: up.x };
  const at = (sideAmount: number, upAmount: number): Point => ({
    x: c.x + side.x * sideAmount + up.x * upAmount,
    y: c.y + side.y * sideAmount + up.y * upAmount,
  });

  // Neck
  capsule(d, bone.start, along(bone, 0.5), 0.14, CLAY_SHADE);

  if (selected) disc(d, c, HEAD_RADIUS + 0.035, INK);
  disc(d, shift(c, 0.02, 0.03), HEAD_RADIUS, CLAY_SHADE);
  disc(d, c, HEAD_RADIUS, CLAY);
  disc(d, at(-0.1, 0.12), 0.07, CLAY_LIGHT, 0.7);

  // Face
  disc(d, at(-0.095, 0.03), 0.032, INK);
  disc(d, at(0.095, 0.03), 0.032, INK);
  const mouth = toScreen(view, at(0, -0.03));
  const down = bone.dir + Math.PI;
  g.lineStyle(Math.max(2, 0.03 * view.scale), INK, 1);
  g.beginPath();
  g.arc(mouth.x, mouth.y, 0.1 * view.scale, down - 1, down + 1, false);
  g.strokePath();
};

export type DrawOptions = {
  selected: Part | null;
  /** 0..1, how much the body dips (used for the dance bounce). */
  bounce: number;
};

/** Draws the floor shadow and the dancer for `pose`. */
export const drawDancer = (
  g: Phaser.GameObjects.Graphics,
  view: DancerView,
  pose: Pose,
  options: DrawOptions
) => {
  const floorY = 1.1;
  const floor = toScreen(view, { x: 0, y: floorY });
  const spread = 1 + options.bounce * 0.12;
  g.fillStyle(FLOOR, 1);
  g.fillEllipse(
    floor.x,
    floor.y,
    1.5 * view.scale * spread,
    0.26 * view.scale * spread
  );

  // The whole body dips a little on each step.
  const dipped: DancerView = {
    scale: view.scale,
    origin: {
      x: view.origin.x,
      y: view.origin.y + options.bounce * 0.05 * view.scale,
    },
  };
  const d: Draw = { g, view: dipped };
  const bones = solveBones(pose);
  const is = (part: Part) => options.selected === part;

  // Legs and feet
  for (const side of ['L', 'R'] as const) {
    const thigh = bones[`leg${side}`];
    const shin = bones[`shin${side}`];
    const toe = side === 'L' ? -0.13 : 0.13;
    capsule(d, shin.end, shift(shin.end, toe, 0.01), 0.13, SHORTS);
    clayLimb(d, shin, is(shin.part));
    clayLimb(d, thigh, is(thigh.part));
  }

  // Shorts
  capsule(d, bones.legL.start, bones.legR.start, 0.3, SHORTS);

  // T-shirt: the torso plus a shoulder bar. Its print is where the player's
  // image will go in week 2; for now it carries a star.
  const torso = bones.torso;
  if (is('torso'))
    capsule(d, along(torso, 0.12), torso.end, LIMB_WIDTH.torso + 0.07, INK);
  capsule(
    d,
    shift(along(torso, 0.12), 0.02, 0.03),
    shift(torso.end, 0.02, 0.03),
    LIMB_WIDTH.torso,
    SHIRT_SHADE
  );
  capsule(d, along(torso, 0.12), torso.end, LIMB_WIDTH.torso, SHIRT);
  capsule(d, bones.armL.start, bones.armR.start, 0.24, SHIRT);
  const chest = along(torso, 0.6);
  disc(d, chest, 0.17, PRINT);
  star(d, chest, 0.12, torso.dir);

  drawHead(d, bones.head, is('head'));

  // Arms and hands, over the shirt
  for (const side of ['L', 'R'] as const) {
    const upper = bones[`arm${side}`];
    const fore = bones[`fore${side}`];
    clayLimb(d, upper, is(upper.part));
    clayLimb(d, fore, is(fore.part));
    disc(d, fore.end, 0.1, CLAY);
    // Short sleeve
    capsule(d, upper.start, along(upper, 0.35), 0.21, SHIRT);
  }
};

export const BADGE_COLORS = { fill: INK, text: '#fbf3e4' };
