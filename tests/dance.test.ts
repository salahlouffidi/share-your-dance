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
  liveStreak,
  nextStreak,
  parseDance,
  parseStreak,
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
  const others = [
    "head",
    "armL",
    "legR",
    "torso",
    "foreR",
    "shinR",
    "armR",
    "legL",
    "shinL",
  ] as const;
  const steps = [
    { part: day.required, angle: 0.2 },
    ...others
      .filter((part) => part !== day.required)
      .slice(0, day.steps - 1)
      .map((part) => ({ part, angle: 0.3 })),
  ];
  assert.equal(steps.length, day.steps);
  assert.equal(challengeComplete({ ...emptyDance(), steps }, day), true);
  assert.equal(
    challengeComplete({ ...emptyDance(), steps: steps.slice(1) }, day),
    false,
  );
  assert.equal(challengeComplete(emptyDance(), day), false);
});
test("daily challenges vary and only repeat after 35 days", () => {
  const start = new Date("2026-11-16T12:00:00Z").getTime();
  const at = (n: number) => challengeFor(new Date(start + n * 86400000));
  const recipes = new Set(
    Array.from({ length: 35 }, (_, n) => {
      const c = at(n);
      return `${c.title}|${c.required}|${c.steps}`;
    }),
  );
  assert.equal(recipes.size, 35);
  const first = at(0);
  assert.deepEqual({ ...at(35), date: first.date }, first);
  for (let n = 0; n < 35; n++) {
    const c = at(n);
    assert.ok(c.steps >= 4 && c.steps <= 8);
  }
});
test("streaks grow on consecutive days and reset after a gap", () => {
  let s = nextStreak(null, "2026-11-16");
  assert.deepEqual(s, { last: "2026-11-16", count: 1 });
  s = nextStreak(s, "2026-11-16");
  assert.equal(s.count, 1);
  s = nextStreak(s, "2026-11-17");
  assert.equal(s.count, 2);
  s = nextStreak(s, "2026-11-19");
  assert.equal(s.count, 1);
  assert.equal(liveStreak({ last: "2026-11-17", count: 4 }, "2026-11-18"), 4);
  assert.equal(liveStreak({ last: "2026-11-17", count: 4 }, "2026-11-19"), 0);
  assert.equal(liveStreak(null, "2026-11-19"), 0);
});
test("stored streaks are validated", () => {
  assert.deepEqual(parseStreak('{"last":"2026-11-16","count":3}'), {
    last: "2026-11-16",
    count: 3,
  });
  assert.equal(parseStreak('{"last":"tomorrow","count":3}'), null);
  assert.equal(parseStreak('{"last":"2026-11-16","count":-1}'), null);
  assert.equal(parseStreak("not json"), null);
  assert.equal(parseStreak(null), null);
});
