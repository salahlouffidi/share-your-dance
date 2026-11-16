import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aimPart,
  frameAt,
  danceDuration,
  parseSteps,
  poseAfter,
  solveBones,
} from "../src/shared/dance.ts";
import {
  challengeFor,
  challengeComplete,
  decodeDance,
  emptyDance,
  encodeDance,
  parseDance,
} from "../src/shared/studio.ts";

test("a recorded move changes only the selected local joint and its descendants", () => {
  const pose = poseAfter([{ part: "armL", angle: 1 }]);
  const bones = solveBones(pose),
    rest = solveBones(poseAfter([]));
  assert.notDeepEqual(bones.foreL.end, rest.foreL.end);
  assert.deepEqual(bones.armR, rest.armR);
  assert.equal(pose.foreL, 0);
});
test("dragging from a joint toward a target produces a bounded finite angle", () => {
  for (const target of [
    { x: 0, y: 0 },
    { x: 100, y: -100 },
    { x: -100, y: 100 },
  ]) {
    const angle = aimPart(poseAfter([]), "torso", target);
    assert.ok(Number.isFinite(angle));
    assert.ok(Math.abs(angle) <= (35 * Math.PI) / 180);
  }
});
test("playback starts at rest, follows the ordered recipe, and finishes at its final pose", () => {
  const steps = [
    { part: "armL" as const, angle: 0.8 },
    { part: "head" as const, angle: -0.3 },
  ];
  assert.ok(Math.abs(frameAt(steps, 0).pose.armL) < 1e-12);
  assert.equal(frameAt(steps, 530).pose.armL, 0.8);
  assert.equal(frameAt(steps, 530).active, 1);
  assert.deepEqual(frameAt(steps, danceDuration(steps)).pose, poseAfter(steps));
  assert.equal(frameAt(steps, danceDuration(steps)).done, true);
});
test("untrusted dances reject unsupported characters, invalid tempo, excess moves and non-finite angles", () => {
  assert.equal(parseDance({ ...emptyDance(), character: "my-photo" }), null);
  assert.equal(parseDance({ ...emptyDance(), bpm: Infinity }), null);
  assert.equal(parseSteps([{ part: "head", angle: NaN }]), null);
  assert.equal(
    parseSteps(Array.from({ length: 9 }, () => ({ part: "head", angle: 0 }))),
    null,
  );
  assert.equal(parseSteps([{ part: "not-a-part", angle: 0 }]), null);
  assert.equal(decodeDance("<script>alert(1)</script>"), null);
});
test("dance sharing code round trips without identity or image fields", () => {
  const dance = {
    ...emptyDance(),
    steps: [{ part: "head" as const, angle: 0.2 }],
  };
  assert.deepEqual(decodeDance(encodeDance(dance)), dance);
  assert.deepEqual(
    parseDance({ ...dance, avatarUrl: "https://example.com/face.png" }),
    dance,
  );
});
test("the daily challenge is stable within a UTC day and can be completed", () => {
  const day = challengeFor(new Date("2026-11-16T00:00:00Z"));
  assert.deepEqual(day, challengeFor(new Date("2026-11-16T23:59:59Z")));
  const dance = {
    ...emptyDance(),
    steps: [
      { part: day.required, angle: 0.2 },
      { part: "head" as const, angle: 0.3 },
      { part: "armL" as const, angle: 0.4 },
      { part: "legR" as const, angle: 0.2 },
      { part: "torso" as const, angle: 0.1 },
      { part: "foreR" as const, angle: 0.2 },
    ],
  };
  assert.equal(challengeComplete(dance, day), true);
  assert.equal(challengeComplete(emptyDance(), day), false);
});
