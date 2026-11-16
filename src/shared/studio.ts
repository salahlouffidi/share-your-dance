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
export function challengeFor(date = new Date()): Challenge {
  const day = Math.floor(date.getTime() / 86400000);
  const choices: Part[] = [
    "armL",
    "head",
    "legR",
    "foreR",
    "torso",
    "shinL",
    "armR",
  ];
  const names = [
    "Reach for the stars",
    "A little head over heels",
    "Kick off the good vibes",
    "Wave hello to the world",
    "Put your heart into it",
    "Happy feet, happy planet",
    "Throw your hands up",
  ];
  const i = ((day % 7) + 7) % 7;
  return {
    date: date.toISOString().slice(0, 10),
    title: names[i],
    required: choices[i],
    steps: 6,
  };
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
