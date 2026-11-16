import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_STEPS,
  STEP_MS,
  HOLD_MS,
  aimPart,
  clampToLimit,
  danceDuration,
  frameAt,
  parseSteps,
  poseAfter,
  restPose,
  solveBones,
  wrapAngle,
  type Step,
} from './dance.ts';

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

test('rest pose stands upright and symmetric', () => {
  const bones = solveBones(restPose());
  close(bones.torso.end.x, 0);
  close(bones.torso.end.y, -0.8);
  assert.ok(bones.head.end.y < bones.torso.end.y, 'head is above shoulders');
  assert.ok(bones.shinL.end.y > 0.9, 'feet are below the hips');
  close(bones.foreL.end.x, -bones.foreR.end.x);
  close(bones.shinL.end.x, -bones.shinR.end.x);
  assert.ok(bones.foreL.end.x < 0, 'left arm hangs on the left');
});

test('wrapAngle keeps angles in (-PI, PI]', () => {
  close(wrapAngle(3 * Math.PI), Math.PI);
  close(wrapAngle(-Math.PI / 2), -Math.PI / 2);
  close(wrapAngle(2 * Math.PI + 0.25), 0.25);
});

test('clampToLimit respects each part limit', () => {
  close(clampToLimit('torso', 2), (35 * Math.PI) / 180);
  close(clampToLimit('head', -2), (-45 * Math.PI) / 180);
  close(clampToLimit('armL', 0.5), 0.5);
});

test('aimPart points a limb at the target', () => {
  const pose = restPose();
  const shoulder = solveBones(pose).armR.start;
  // Aim the right arm straight up from its shoulder.
  pose.armR = aimPart(pose, 'armR', { x: shoulder.x, y: shoulder.y - 1 });
  const arm = solveBones(pose).armR;
  close(arm.end.x, shoulder.x, 1e-6);
  assert.ok(arm.end.y < shoulder.y, 'arm is raised');
});

test('aimPart on a child follows its moved parent', () => {
  const pose = restPose();
  pose.armL = 1;
  const elbow = solveBones(pose).foreL.start;
  pose.foreL = aimPart(pose, 'foreL', { x: elbow.x - 1, y: elbow.y });
  const fore = solveBones(pose).foreL;
  close(fore.end.y, elbow.y, 1e-6);
  assert.ok(fore.end.x < elbow.x);
});

test('poseAfter applies steps in order, last one wins', () => {
  const steps: Step[] = [
    { part: 'armL', angle: 1 },
    { part: 'head', angle: 0.3 },
    { part: 'armL', angle: -0.5 },
  ];
  close(poseAfter(steps, 1).armL, 1);
  close(poseAfter(steps, 1).head, 0);
  close(poseAfter(steps).armL, -0.5);
  close(poseAfter(steps).head, 0.3);
});

test('frameAt plays step by step and ends on the final pose', () => {
  const steps: Step[] = [
    { part: 'armL', angle: 1 },
    { part: 'legR', angle: 0.6 },
  ];
  const slot = STEP_MS + HOLD_MS;

  const start = frameAt(steps, 0);
  assert.equal(start.active, 0);
  close(start.pose.armL, 0);

  const held = frameAt(steps, STEP_MS + 1);
  assert.equal(held.active, 0);
  close(held.pose.armL, 1);
  close(held.pose.legR, 0);

  const second = frameAt(steps, slot + STEP_MS / 2);
  assert.equal(second.active, 1);
  assert.ok(second.bounce > 0.9);
  assert.ok(second.pose.legR > 0 && second.pose.legR < 0.75);

  const end = frameAt(steps, danceDuration(steps));
  assert.equal(end.active, -1);
  assert.equal(end.done, true);
  close(end.pose.legR, 0.6);
});

test('frameAt on an empty dance is done at rest', () => {
  const frame = frameAt([], 0);
  assert.equal(frame.done, true);
  assert.deepEqual(frame.pose, restPose());
});

test('parseSteps accepts clean data and clamps angles', () => {
  const parsed = parseSteps([
    { part: 'torso', angle: 5 },
    { part: 'head', angle: 0.1 },
  ]);
  assert.ok(parsed);
  assert.equal(parsed.length, 2);
  close(parsed[0]?.angle ?? NaN, clampToLimit('torso', 5));
});

test('parseSteps rejects bad data', () => {
  assert.equal(parseSteps('nope'), null);
  assert.equal(parseSteps([{ part: 'tail', angle: 1 }]), null);
  assert.equal(parseSteps([{ part: 'head', angle: 'x' }]), null);
  assert.equal(parseSteps([{ part: 'head', angle: Infinity }]), null);
  assert.equal(parseSteps([null]), null);
  const tooMany = Array.from({ length: MAX_STEPS + 1 }, () => ({
    part: 'head',
    angle: 0,
  }));
  assert.equal(parseSteps(tooMany), null);
});
