import "./style.css";
import {
  PARTS,
  MAX_STEPS,
  aimPart,
  clampToLimit,
  danceDuration,
  frameAt,
  partLabel,
  poseAfter,
  type Part,
  type Step,
} from "../shared/dance";
import {
  CHARACTERS,
  challengeFor,
  challengeProgress,
  challengeComplete,
  decodeDance,
  encodeDance,
  emptyDance,
  parseDance,
  isPart,
  type Dance,
} from "../shared/studio";
import { LOOKS, renderDancer, stageView, toBody, hitPart } from "./renderer";

function el<T extends HTMLElement>(id: string): T {
  const item = document.getElementById(id);
  if (!item) throw new Error(`Missing interface element: ${id}`);
  return item as T;
}
const canvas = el<HTMLCanvasElement>("stage");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("This browser does not support Canvas 2D.");
const angle = el<HTMLInputElement>("angle"),
  partSelect = el<HTMLSelectElement>("body-part"),
  tempo = el<HTMLInputElement>("tempo");
let dance: Dance = emptyDance(),
  pose = poseAfter([]),
  selected: Part = "foreL",
  redo: Step[] = [],
  playing = false,
  playTime = 0,
  active = -1,
  drag: Part | null = null,
  dragFrom = 0,
  view = stageView(500, 400),
  width = 500,
  height = 400,
  busy = false;
let noticeTimer: ReturnType<typeof setTimeout>;
let selectedIndex = -1;
let audio: AudioContext | undefined;
let lastBeat = -1;
let storedSignature = "";
const challenge = challengeFor();
const draftKey = "dance-lab:draft:v1";
function notice(text: string) {
  const n = el("notice");
  n.textContent = text;
  n.classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => n.classList.remove("visible"), 3800);
}
function stop() {
  playing = false;
  active = -1;
  pose = poseAfter(dance.steps);
  lastBeat = -1;
  sync();
}
function changed() {
  storedSignature = "";
  selectedIndex = -1;
  redo = [];
  sync();
}
function addMove(part: Part, value: number) {
  if (playing) return;
  if (dance.steps.length >= MAX_STEPS) {
    notice("Eight moves is a full recipe. Undo a move to make room.");
    pose = poseAfter(dance.steps);
    sync();
    return;
  }
  dance.steps.push({ part, angle: clampToLimit(part, value) });
  pose = poseAfter(dance.steps);
  changed();
}
function setDance(next: Dance) {
  stop();
  dance = next;
  pose = poseAfter(dance.steps);
  redo = [];
  selectedIndex = -1;
  storedSignature = "";
  sync();
}
function sync() {
  const look = LOOKS[dance.character];
  el("dancer-name").textContent = look.name;
  el("dancer-vibe").textContent = look.vibe;
  document.querySelectorAll<HTMLButtonElement>(".character").forEach((b) => {
    const on = b.dataset.character === dance.character;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
    const check = b.querySelector<HTMLElement>(".check");
    if (check) check.style.visibility = on ? "visible" : "hidden";
    b.disabled = playing;
  });
  el("step-count").textContent = `${dance.steps.length} / ${MAX_STEPS} moves`;
  el<HTMLButtonElement>("play").disabled = dance.steps.length === 0;
  el("play").innerHTML = playing
    ? "<span>■</span> Stop the dance"
    : "<span>▶</span> Play my dance";
  el<HTMLButtonElement>("undo").disabled = playing || !dance.steps.length;
  el<HTMLButtonElement>("redo").disabled = playing || !redo.length;
  el<HTMLButtonElement>("clear").disabled = playing || !dance.steps.length;
  el<HTMLButtonElement>("add-move").disabled =
    playing || dance.steps.length >= MAX_STEPS;
  el<HTMLButtonElement>("demo").disabled = playing;
  el<HTMLButtonElement>("share").disabled =
    busy || playing || !dance.steps.length;
  el<HTMLButtonElement>("save").disabled =
    busy || playing || !dance.steps.length;
  el<HTMLButtonElement>("load").disabled = busy || playing;
  el<HTMLButtonElement>("import").disabled = playing;
  partSelect.disabled = playing;
  angle.disabled = playing;
  tempo.disabled = playing;
  partSelect.value = selected;
  angle.value = String(Math.round((pose[selected] * 180) / Math.PI));
  el("angle-value").textContent = `${angle.value}°`;
  tempo.value = String(dance.bpm);
  el("tempo-value").textContent = `${dance.bpm} BPM`;
  el("duration").textContent = dance.steps.length
    ? `${((danceDuration(dance.steps) * 110) / dance.bpm / 1000).toFixed(1)} seconds of pure you.`
    : "Your next great dance starts with one move.";
  el("stage-state").textContent = playing
    ? "A LITTLE MAGIC IN MOTION"
    : "READY TO GROOVE";
  document.querySelector(".stage-panel")?.classList.toggle("playing", playing);
  el("stage-caption").textContent = playing
    ? "Your recipe, one little move at a time."
    : dance.steps.length
      ? "Keep going. Every happy accident counts."
      : "↖ Drag any body part. That’s your first move.";
  const line = el("timeline");
  line.replaceChildren();
  for (let i = 0; i < MAX_STEPS; i++) {
    const step = dance.steps[i];
    const b = document.createElement("button");
    b.className = `move${step ? "" : " empty"}${i === selectedIndex ? " selected" : ""}`;
    b.disabled = playing || !step;
    b.dataset.index = String(i);
    if (step) {
      b.setAttribute(
        "aria-label",
        `Step ${i + 1}: ${partLabel(step.part)}, ${Math.round((step.angle * 180) / Math.PI)} degrees`,
      );
      b.innerHTML = `<span class="move-num">${i + 1}</span><span><strong>${partLabel(step.part)}</strong><small>${Math.round((step.angle * 180) / Math.PI)}° bend</small></span>`;
      b.addEventListener("click", () => {
        selectedIndex = i;
        selected = step.part;
        pose = poseAfter(dance.steps, i + 1);
        sync();
      });
    } else {
      b.textContent = "＋";
      b.setAttribute("aria-label", `Empty step ${i + 1}`);
    }
    line.append(b);
  }
  const p = challengeProgress(dance, challenge);
  const checks = [
    ["length", "Exactly 6 moves"],
    ["part", `Use your ${partLabel(challenge.required).toLowerCase()}`],
    ["variety", "Move 3 different body parts"],
  ] as const;
  el("daily-checks").replaceChildren(
    ...checks.map(([key, label]) => {
      const li = document.createElement("li");
      li.textContent = label;
      li.classList.toggle("done", p[key]);
      return li;
    }),
  );
  el("daily-title").textContent = challenge.title;
  el("daily-date").textContent = `${challenge.date} · resets at midnight UTC`;
}
for (const key of CHARACTERS) {
  const look = LOOKS[key],
    b = document.createElement("button");
  b.className = "character";
  b.dataset.character = key;
  b.setAttribute("aria-label", `Choose ${look.name}, ${look.vibe}`);
  const thumb = document.createElement("canvas");
  thumb.width = 100;
  thumb.height = 120;
  thumb.setAttribute("aria-hidden", "true");
  const t = thumb.getContext("2d");
  if (t) renderDancer(t, { x: 50, y: 77, scale: 43 }, poseAfter([]), key, null);
  b.append(thumb);
  const label = document.createElement("span");
  label.innerHTML = `<strong>${look.name}</strong><small>${look.vibe}</small>`;
  b.append(label);
  const check = document.createElement("span");
  check.className = "check";
  check.textContent = "✓";
  b.append(check);
  b.addEventListener("click", () => {
    dance.character = key;
    changed();
  });
  el("characters").append(b);
}
for (const part of PARTS) {
  const option = document.createElement("option");
  option.value = part;
  option.textContent = partLabel(part);
  partSelect.append(option);
}
partSelect.addEventListener("change", () => {
  if (isPart(partSelect.value)) {
    selected = partSelect.value;
    pose = poseAfter(dance.steps);
    selectedIndex = -1;
    sync();
  }
});
angle.addEventListener("input", () => {
  pose[selected] = clampToLimit(
    selected,
    (Number(angle.value) * Math.PI) / 180,
  );
  angle.value = String(Math.round((pose[selected] * 180) / Math.PI));
  el("angle-value").textContent = `${angle.value}°`;
});
el("add-move").addEventListener("click", () =>
  addMove(selected, pose[selected]),
);
tempo.addEventListener("input", () => {
  dance.bpm = Number(tempo.value);
  storedSignature = "";
  el("tempo-value").textContent = `${dance.bpm} BPM`;
  el("duration").textContent =
    `${((danceDuration(dance.steps) * 110) / dance.bpm / 1000).toFixed(1)} seconds of pure you.`;
});
function point(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return toBody(view, e.clientX - r.left, e.clientY - r.top);
}
canvas.addEventListener("pointerdown", (e) => {
  if (playing || busy) return;
  if (dance.steps.length >= MAX_STEPS) {
    notice("Your recipe has 8 moves. Undo one to keep sculpting.");
    return;
  }
  pose = poseAfter(dance.steps);
  const part = hitPart(pose, point(e));
  if (!part) return;
  selected = part;
  selectedIndex = -1;
  drag = part;
  dragFrom = pose[part];
  canvas.setPointerCapture(e.pointerId);
  sync();
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  pose[drag] = aimPart(pose, drag, point(e));
  angle.value = String(Math.round((pose[drag] * 180) / Math.PI));
  el("angle-value").textContent = `${angle.value}°`;
});
canvas.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const part = drag;
  drag = null;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  if (Math.abs(pose[part] - dragFrom) > 0.06) addMove(part, pose[part]);
  else {
    pose = poseAfter(dance.steps);
    sync();
  }
});
canvas.addEventListener("pointercancel", () => {
  drag = null;
  pose = poseAfter(dance.steps);
  sync();
});
canvas.addEventListener("lostpointercapture", () => {
  if (drag) {
    drag = null;
    pose = poseAfter(dance.steps);
    sync();
  }
});
function undoMove() {
  if (playing || !dance.steps.length) return;
  const s = dance.steps.pop();
  if (s) redo.push(s);
  pose = poseAfter(dance.steps);
  storedSignature = "";
  selectedIndex = -1;
  sync();
}
el("undo").addEventListener("click", undoMove);
el("redo").addEventListener("click", () => {
  const s = redo.pop();
  if (s) {
    dance.steps.push(s);
    pose = poseAfter(dance.steps);
    storedSignature = "";
    selectedIndex = -1;
    sync();
  }
});
el("clear").addEventListener("click", () => {
  dance.steps = [];
  redo = [];
  pose = poseAfter([]);
  changed();
});
el("demo").addEventListener("click", () => {
  setDance({
    ...dance,
    steps: [
      { part: "armL", angle: 1.45 },
      { part: "foreR", angle: -1.1 },
      { part: "head", angle: 0.3 },
      { part: "legR", angle: -0.45 },
      { part: "torso", angle: -0.22 },
      { part: "armR", angle: -1.4 },
    ],
  });
  notice("A little inspiration. Drag a limb to make it your own.");
});
function start() {
  if (!dance.steps.length || busy) return;
  if (playing) {
    stop();
    return;
  }
  playing = true;
  playTime = 0;
  lastBeat = -1;
  if (el<HTMLInputElement>("sound").checked) {
    try {
      audio ??= new AudioContext();
      void audio
        .resume()
        .catch(() => notice("Audio is unavailable. Your dance still works."));
    } catch {
      notice("Audio is unavailable. Your dance still works.");
    }
  }
  sync();
}
el("play").addEventListener("click", start);
document.addEventListener("keydown", (e) => {
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    document.querySelector("dialog[open]")
  )
    return;
  if (e.code === "Space" && !(target instanceof HTMLButtonElement)) {
    e.preventDefault();
    start();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undoMove();
  }
});
function beat() {
  if (
    !audio ||
    audio.state !== "running" ||
    !el<HTMLInputElement>("sound").checked
  )
    return;
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.frequency.setValueAtTime(140, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, audio.currentTime + 0.1);
  gain.gain.setValueAtTime(0.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.13);
  osc.start();
  osc.stop(audio.currentTime + 0.14);
}
const resize = new ResizeObserver(() => {
  const r = canvas.getBoundingClientRect();
  width = r.width;
  height = r.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  view = stageView(width, height);
});
resize.observe(canvas);
let previous = performance.now();
function frame(now: number) {
  if (!ctx) return;
  const dt = Math.min(now - previous, 80);
  previous = now;
  let bounce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : 0.08 * (1 + Math.sin(now / 700));
  if (playing) {
    playTime += (dt * dance.bpm) / 110;
    const f = frameAt(dance.steps, playTime);
    pose = f.pose;
    bounce = f.bounce;
    if (active !== f.active) {
      active = f.active;
      document
        .querySelectorAll<HTMLElement>(".move")
        .forEach((m, i) => m.classList.toggle("active", i === active));
    }
    const tick = Math.floor(playTime / 530);
    if (lastBeat !== tick && f.active >= 0) {
      beat();
      lastBeat = tick;
    }
    if (f.done) {
      if (el<HTMLInputElement>("loop").checked) {
        playTime = 0;
        lastBeat = -1;
      } else stop();
    }
  }
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const badges = new Map<Part, number[]>();
  dance.steps.forEach((s, i) =>
    badges.set(s.part, [...(badges.get(s.part) ?? []), i + 1]),
  );
  renderDancer(
    ctx,
    view,
    pose,
    dance.character,
    playing ? null : selected,
    bounce,
    badges,
    active,
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-close]",
))
  button.addEventListener("click", () => button.closest("dialog")?.close());
el("help").addEventListener("click", () =>
  el<HTMLDialogElement>("help-dialog").showModal(),
);
el("import").addEventListener("click", () =>
  el<HTMLDialogElement>("import-dialog").showModal(),
);
el("import-confirm").addEventListener("click", () => {
  const next = decodeDance(el<HTMLTextAreaElement>("import-code").value);
  if (!next) {
    notice("That dance code is not valid. Check the full code and try again.");
    return;
  }
  setDance(next);
  el<HTMLDialogElement>("import-dialog").close();
  notice("Dance imported. Time to add your own personality.");
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Reddit could not complete this request.",
    );
  }
  return response.json();
}
function draftFrom(value: unknown): Dance | null {
  return value && typeof value === "object" && "dance" in value
    ? parseDance(value.dance)
    : null;
}
el("save").addEventListener("click", async () => {
  if (!dance.steps.length) return;
  busy = true;
  sync();
  try {
    if (__REDDIT__) await request("/api/draft", "POST", { dance });
    else localStorage.setItem(draftKey, encodeDance(dance));
    storedSignature = encodeDance(dance);
    notice(
      challengeComplete(dance, challenge)
        ? "Saved! Today’s creative challenge is complete. ✦"
        : "Saved. Your moves are in good hands.",
    );
  } catch (e) {
    notice(e instanceof Error ? e.message : "Could not save.");
  } finally {
    busy = false;
    sync();
  }
});
el("load").addEventListener("click", async () => {
  busy = true;
  sync();
  try {
    const next = __REDDIT__
      ? draftFrom(await request("/api/draft"))
      : decodeDance(localStorage.getItem(draftKey) ?? "");
    if (next) {
      setDance(next);
      storedSignature = encodeDance(next);
      notice("Your saved dance is back on stage.");
    } else notice("No saved dance yet. Make a move and save it first.");
  } catch (e) {
    notice(e instanceof Error ? e.message : "Could not load your dance.");
  } finally {
    busy = false;
    sync();
  }
});
el("share").addEventListener("click", async () => {
  if (!dance.steps.length || busy) return;
  if (!__REDDIT__) {
    el<HTMLTextAreaElement>("dance-code").value = encodeDance(dance);
    el<HTMLDialogElement>("share-dialog").showModal();
    return;
  }
  busy = true;
  sync();
  try {
    const result = await request("/api/share", "POST", { dance });
    if (
      !result ||
      typeof result !== "object" ||
      !("url" in result) ||
      typeof result.url !== "string"
    )
      throw new Error("Reddit returned an invalid post link.");
    const { navigateTo } = await import("@devvit/web/client");
    navigateTo(result.url);
  } catch (e) {
    notice(
      e instanceof Error
        ? e.message
        : "Could not share. Your dance is still here.",
    );
  } finally {
    busy = false;
    sync();
  }
});
el("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      el<HTMLTextAreaElement>("dance-code").value,
    );
    notice("Copied! A friend can import this code into Dance Lab.");
  } catch {
    el<HTMLTextAreaElement>("dance-code").select();
    notice(
      "Select and copy the code manually; clipboard permission was not available.",
    );
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dance.steps.length && storedSignature !== encodeDance(dance)) {
    e.preventDefault();
    e.returnValue = "";
  }
});
sync();
if (__REDDIT__) {
  el("runtime-label").textContent = "MADE TO MOVE, TOGETHER ON REDDIT";
  void request("/api/state")
    .then((result) => {
      const saved = draftFrom(result);
      if (saved) {
        setDance(saved);
        notice("A shared dance is ready. Press Play, or make it your own.");
      }
    })
    .catch(() =>
      notice(
        "Reddit could not load this post. The editor still works; try loading again.",
      ),
    );
} else {
  el("runtime-label").textContent = "LOCAL STUDIO · SAVES ON THIS DEVICE";
}
