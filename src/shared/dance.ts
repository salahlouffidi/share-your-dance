// The dance model: a small skeleton, a pose (one angle per body part) and a
// dance (an ordered list of numbered steps). Everything here is pure, so the
// client can draw it and the server can validate and store it.

export const PARTS = [
  'torso',
  'head',
  'armL',
  'foreL',
  'armR',
  'foreR',
  'legL',
  'shinL',
  'legR',
  'shinR',
] as const;

export type Part = (typeof PARTS)[number];

/** Angle offset from the rest position, in radians, for every part. */
export type Pose = Record<Part, number>;

/** One numbered move: "turn this part to this angle". */
export type Step = { part: Part; angle: number };

export type Point = { x: number; y: number };

export type Bone = {
  part: Part;
  start: Point;
  end: Point;
  /** World direction of the bone, radians (screen space: +y is down). */
  dir: number;
};

type BoneDef = {
  /** Parent bone, or null for bones attached to the hips. */
  parent: Part | null;
  /** Where the bone starts: 'end' of its parent, or an offset from the hips. */
  anchor: 'end' | Point;
  /** Rest direction relative to the parent direction (or to the world). */
  rest: number;
  length: number;
  /** How far the part may turn from rest, each way. */
  limit: number;
  label: string;
};

const DEG = Math.PI / 180;

// Lengths are in "body units"; the torso is 0.8 units tall.
const BONES: Record<Part, BoneDef> = {
  torso: { parent: null, anchor: { x: 0, y: 0 }, rest: -90 * DEG, length: 0.8, limit: 35 * DEG, label: 'Body' },
  head: { parent: 'torso', anchor: 'end', rest: 0, length: 0.36, limit: 45 * DEG, label: 'Head' },
  armL: { parent: 'torso', anchor: 'end', rest: 200 * DEG, length: 0.42, limit: 175 * DEG, label: 'Left arm' },
  foreL: { parent: 'armL', anchor: 'end', rest: 0, length: 0.4, limit: 150 * DEG, label: 'Left hand' },
  armR: { parent: 'torso', anchor: 'end', rest: 160 * DEG, length: 0.42, limit: 175 * DEG, label: 'Right arm' },
  foreR: { parent: 'armR', anchor: 'end', rest: 0, length: 0.4, limit: 150 * DEG, label: 'Right hand' },
  legL: { parent: null, anchor: { x: -0.16, y: 0.04 }, rest: 97 * DEG, length: 0.5, limit: 85 * DEG, label: 'Left leg' },
  shinL: { parent: 'legL', anchor: 'end', rest: 0, length: 0.5, limit: 130 * DEG, label: 'Left foot' },
  legR: { parent: null, anchor: { x: 0.16, y: 0.04 }, rest: 83 * DEG, length: 0.5, limit: 85 * DEG, label: 'Right leg' },
  shinR: { parent: 'legR', anchor: 'end', rest: 0, length: 0.5, limit: 130 * DEG, label: 'Right foot' },
};

/** Shoulders sit a little to each side of the top of the torso. */
const SHOULDER_HALF_WIDTH = 0.24;

export const MAX_STEPS = 8;
export const STEP_MS = 420;
export const HOLD_MS = 110;
export const END_HOLD_MS = 600;

export const partLabel = (part: Part): string => BONES[part].label;

export const restPose = (): Pose => ({
  torso: 0,
  head: 0,
  armL: 0,
  foreL: 0,
  armR: 0,
  foreR: 0,
  legL: 0,
  shinL: 0,
  legR: 0,
  shinR: 0,
});

/** Wrap an angle into (-PI, PI]. */
export const wrapAngle = (angle: number): number => {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

export const clampToLimit = (part: Part, angle: number): number => {
  const { limit } = BONES[part];
  return Math.max(-limit, Math.min(limit, wrapAngle(angle)));
};

const solveBone = (pose: Pose, part: Part, parent: Bone | null): Bone => {
  const def = BONES[part];
  const parentDir = parent ? parent.dir : 0;
  const dir = parentDir + def.rest + pose[part];

  let start: Point;
  if (def.anchor === 'end') {
    start = parent ? { ...parent.end } : { x: 0, y: 0 };
    if (part === 'armL' || part === 'armR') {
      // Slide the arm sideways along the shoulder line.
      const side = part === 'armL' ? -1 : 1;
      const across = parentDir + Math.PI / 2;
      start = {
        x: start.x + Math.cos(across) * SHOULDER_HALF_WIDTH * side,
        y: start.y + Math.sin(across) * SHOULDER_HALF_WIDTH * side,
      };
    }
  } else {
    start = { ...def.anchor };
  }

  return {
    part,
    start,
    end: {
      x: start.x + Math.cos(dir) * def.length,
      y: start.y + Math.sin(dir) * def.length,
    },
    dir,
  };
};

/** Forward kinematics: where every bone is, in body units, hips at 0,0. */
export const solveBones = (pose: Pose): Record<Part, Bone> => {
  const torso = solveBone(pose, 'torso', null);
  const armL = solveBone(pose, 'armL', torso);
  const armR = solveBone(pose, 'armR', torso);
  const legL = solveBone(pose, 'legL', null);
  const legR = solveBone(pose, 'legR', null);

  return {
    torso,
    head: solveBone(pose, 'head', torso),
    armL,
    foreL: solveBone(pose, 'foreL', armL),
    armR,
    foreR: solveBone(pose, 'foreR', armR),
    legL,
    shinL: solveBone(pose, 'shinL', legL),
    legR,
    shinR: solveBone(pose, 'shinR', legR),
  };
};

/**
 * The pose angle that makes `part` point from its joint toward `target`
 * (body units), respecting the part's turning limit.
 */
export const aimPart = (pose: Pose, part: Part, target: Point): number => {
  const bone = solveBones(pose)[part];
  const world = Math.atan2(target.y - bone.start.y, target.x - bone.start.x);
  const restWorld = bone.dir - pose[part];
  return clampToLimit(part, world - restWorld);
};

/** The pose reached after the first `count` steps (all of them by default). */
export const poseAfter = (steps: readonly Step[], count = steps.length): Pose => {
  const pose = restPose();
  for (const step of steps.slice(0, count)) {
    pose[step.part] = step.angle;
  }
  return pose;
};

export const danceDuration = (steps: readonly Step[]): number =>
  steps.length === 0 ? 0 : steps.length * (STEP_MS + HOLD_MS) + END_HOLD_MS;

/** Overshoots a little, then settles: gives the clay a springy snap. */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export type DanceFrame = {
  pose: Pose;
  /** Index of the step being performed, or -1 once the dance has ended. */
  active: number;
  /** 0..1 dip of the whole body, peaking mid-step. */
  bounce: number;
  done: boolean;
};

/** The dancer's state `timeMs` after Play was pressed. */
export const frameAt = (steps: readonly Step[], timeMs: number): DanceFrame => {
  const slot = STEP_MS + HOLD_MS;
  const index = Math.floor(timeMs / slot);

  if (steps.length === 0 || index >= steps.length) {
    return {
      pose: poseAfter(steps),
      active: -1,
      bounce: 0,
      done: timeMs >= danceDuration(steps),
    };
  }

  const step = steps[index];
  const pose = poseAfter(steps, index);
  if (!step) return { pose, active: -1, bounce: 0, done: true };

  const t = Math.min(1, (timeMs - index * slot) / STEP_MS);
  const from = pose[step.part];
  pose[step.part] = from + (step.angle - from) * easeOutBack(t);

  return { pose, active: index, bounce: Math.sin(Math.PI * t), done: false };
};

const isPart = (value: unknown): value is Part =>
  typeof value === 'string' && PARTS.some((part) => part === value);

/** Validates untrusted data (a saved or shared dance) into clean steps. */
export const parseSteps = (data: unknown): Step[] | null => {
  if (!Array.isArray(data) || data.length > MAX_STEPS) return null;

  const steps: Step[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) return null;
    if (!('part' in item) || !('angle' in item)) return null;
    const { part, angle } = item;
    if (!isPart(part) || typeof angle !== 'number' || !Number.isFinite(angle)) {
      return null;
    }
    steps.push({ part, angle: clampToLimit(part, angle) });
  }
  return steps;
};
