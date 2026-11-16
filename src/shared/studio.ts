import { PARTS, parseSteps, type Part, type Step } from "./dance";
export const CHARACTERS = ["lilac", "peach", "mint", "sky"] as const;
export type Character = (typeof CHARACTERS)[number];
export type Dance = {
  version: 1;
  character: Character;
  bpm: number;
  steps: Step[];
};
export const emptyDance = (): Dance => ({
  version: 1,
  character: "lilac",
  bpm: 110,
  steps: [],
});
export function parseDance(value: unknown): Dance | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("steps" in value) ||
    !("character" in value) ||
    !("bpm" in value)
  )
    return null;
  const character = CHARACTERS.find((x) => x === value.character);
  const steps = parseSteps(value.steps);
  if (
    !character ||
    !steps ||
    typeof value.bpm !== "number" ||
    !Number.isFinite(value.bpm) ||
    value.bpm < 60 ||
    value.bpm > 160
  )
    return null;
  return { version: 1, character, bpm: Math.round(value.bpm), steps };
}
export type Challenge = {
  date: string;
  title: string;
  required: Part;
  steps: number;
};
const CHALLENGE_PARTS: Part[] = [
  "armL",
  "head",
  "legR",
  "foreR",
  "torso",
  "shinL",
  "armR",
];
const CHALLENGE_TITLES = [
  "Reach for the stars",
  "A little head over heels",
  "Kick off the good vibes",
  "Wave hello to the world",
  "Put your heart into it",
  "Happy feet, happy planet",
  "Throw your hands up",
];
const CHALLENGE_LENGTHS = [4, 6, 5, 8, 7];

/** UTC day number, so everyone on Reddit shares the same daily challenge. */
export const dayNumber = (date: Date) => Math.floor(date.getTime() / 86400000);

/**
 * Title and required part cycle every 7 days, the move count every 5, so the
 * exact recipe only repeats after 35 days.
 */
export function challengeFor(date = new Date()): Challenge {
  const day = dayNumber(date);
  const i = ((day % 7) + 7) % 7;
  const j = ((day % 5) + 5) % 5;
  return {
    date: date.toISOString().slice(0, 10),
    title: CHALLENGE_TITLES[i] ?? "Make it move",
    required: CHALLENGE_PARTS[i] ?? "armL",
    steps: CHALLENGE_LENGTHS[j] ?? 6,
  };
}

export type Streak = { last: string; count: number };

/**
 * The streak after completing the challenge of `date` (YYYY-MM-DD). Same day
 * again: unchanged. The day after the last one: +1. Any gap: back to 1.
 */
export function nextStreak(previous: Streak | null, date: string): Streak {
  if (!previous) return { last: date, count: 1 };
  if (previous.last === date) return previous;
  const gap =
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${previous.last}T00:00:00Z`)) /
    86400000;
  return { last: date, count: gap === 1 ? previous.count + 1 : 1 };
}

/** A streak only counts while its last day is today or yesterday. */
export function liveStreak(streak: Streak | null, today: string): number {
  if (!streak) return 0;
  const gap =
    (Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${streak.last}T00:00:00Z`)) /
    86400000;
  return gap === 0 || gap === 1 ? streak.count : 0;
}

export function parseStreak(raw: string | null | undefined): Streak | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "last" in value &&
      "count" in value &&
      typeof value.last === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.last) &&
      typeof value.count === "number" &&
      Number.isInteger(value.count) &&
      value.count > 0
    )
      return { last: value.last, count: value.count };
  } catch {
    /* Corrupt value: treat as no streak. */
  }
  return null;
}
export function challengeProgress(dance: Dance, challenge: Challenge) {
  return {
    length: dance.steps.length === challenge.steps,
    part: dance.steps.some((x) => x.part === challenge.required),
    variety: new Set(dance.steps.map((x) => x.part)).size >= 3,
  };
}
export function challengeComplete(dance: Dance, challenge: Challenge) {
  return Object.values(challengeProgress(dance, challenge)).every(Boolean);
}
export function encodeDance(dance: Dance) {
  return JSON.stringify(dance);
}
export function decodeDance(code: string): Dance | null {
  if (code.length > 4000) return null;
  try {
    return parseDance(JSON.parse(code));
  } catch {
    return null;
  }
}
export const isPart = (s: string): s is Part => PARTS.some((x) => x === s);
