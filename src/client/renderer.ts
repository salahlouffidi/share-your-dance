import { solveBones, type Part, type Point, type Pose } from "../shared/dance";
import type { Character } from "../shared/studio";
export const LOOKS = {
  lilac: {
    name: "Mochi",
    vibe: "the daydreamer",
    skin: "#b59ad3",
    light: "#dfcbed",
    dark: "#8662a9",
    shirt: "#f4e8d3",
    pants: "#8d71b5",
    hair: "#a187c2",
    accent: "#916bb4",
  },
  peach: {
    name: "Peach",
    vibe: "the sunshine",
    skin: "#efad86",
    light: "#ffd5b4",
    dark: "#c87d5b",
    shirt: "#dbe8b2",
    pants: "#d98c71",
    hair: "#e39a73",
    accent: "#d47d55",
  },
  mint: {
    name: "Pip",
    vibe: "the free spirit",
    skin: "#9ac4ae",
    light: "#d0e6ce",
    dark: "#678f7b",
    shirt: "#f2dfb3",
    pants: "#638c80",
    hair: "#80a68a",
    accent: "#628d76",
  },
  sky: {
    name: "Bowie",
    vibe: "the cool one",
    skin: "#91b6d4",
    light: "#c6deee",
    dark: "#5d83a6",
    shirt: "#e6d6ed",
    pants: "#5d7eaa",
    hair: "#7b9abc",
    accent: "#6386ae",
  },
};
export type View = { x: number; y: number; scale: number };
export function stageView(w: number, h: number): View {
  return { x: w / 2, y: h * 0.57, scale: Math.min(h / 3.5, w / 2.9) };
}
export function toBody(v: View, x: number, y: number): Point {
  return { x: (x - v.x) / v.scale, y: (y - v.y) / v.scale };
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
        );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function hitPart(pose: Pose, p: Point): Part | null {
  const bones = solveBones(pose);
  let best: Part | null = null;
  let distance = 0.18;
  for (const b of Object.values(bones)) {
    let d =
      b.part === "head"
        ? Math.hypot(p.x - b.end.x, p.y - b.end.y) - 0.31
        : segmentDistance(p, b.start, b.end) -
          (b.part === "torso" ? 0.25 : 0.09);
    if (b.part === "torso") d += 0.07;
    if (d < distance) {
      distance = d;
      best = b.part;
    }
  }
  return best;
}
export function renderDancer(
  ctx: CanvasRenderingContext2D,
  view: View,
  pose: Pose,
  character: Character,
  selected: Part | null,
  bounce = 0,
  badges: Map<Part, number[]> = new Map(),
  active = -1,
) {
  const c = LOOKS[character],
    b = solveBones(pose);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  // a soft ground shadow and plinth
  ctx.save();
  ctx.translate(0, 1.17);
  ctx.scale(1, 0.18);
  const shadow = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 0.9);
  shadow.addColorStop(0, "#8f6a9b40");
  shadow.addColorStop(1, "#9d7ca500");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.translate(0, bounce * 0.06);
  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const capsule = (
    a: Point,
    z: Point,
    width: number,
    color: string,
    highlight: string,
    dark: string,
    part?: Part,
  ) => {
    ctx.lineCap = "round";
    if (selected === part) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = width + 0.08;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(z.x, z.y);
      ctx.stroke();
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x + 0.014, a.y + 0.022);
    ctx.lineTo(z.x + 0.014, z.y + 0.022);
    ctx.stroke();
    const grad = ctx.createLinearGradient(
      a.x - width / 2,
      a.y,
      z.x + width / 2,
      z.y + 0.05,
    );
    grad.addColorStop(0, highlight);
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, dark);
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(z.x, z.y);
    ctx.stroke();
    ctx.strokeStyle = highlight + "80";
    ctx.lineWidth = width * 0.12;
    ctx.beginPath();
    ctx.moveTo(a.x - width * 0.16, a.y);
    ctx.lineTo(
      a.x + (z.x - a.x) * 0.55 - width * 0.16,
      a.y + (z.y - a.y) * 0.55,
    );
    ctx.stroke();
  };
  const along = (p: Part, t: number) => ({
    x: b[p].start.x + (b[p].end.x - b[p].start.x) * t,
    y: b[p].start.y + (b[p].end.y - b[p].start.y) * t,
  });
  // chunky trousers and sneakers
  for (const side of ["L", "R"] as const) {
    const thigh = b[`leg${side}`],
      shin = b[`shin${side}`];
    capsule(thigh.start, thigh.end, 0.265, c.pants, c.skin, c.dark, thigh.part);
    capsule(shin.start, shin.end, 0.22, c.pants, c.skin, c.dark, shin.part);
    ctx.save();
    ctx.translate(shin.end.x, shin.end.y + 0.015);
    ctx.rotate(shin.dir - Math.PI / 2);
    ctx.fillStyle = "#c5b3c3";
    ctx.beginPath();
    ctx.roundRect(-0.13, -0.055, 0.34, 0.145, 0.065);
    ctx.fill();
    ctx.fillStyle = "#fff7e8";
    ctx.beginPath();
    ctx.roundRect(-0.145, -0.105, 0.36, 0.14, 0.065);
    ctx.fill();
    ctx.fillStyle = c.shirt;
    ctx.beginPath();
    ctx.roundRect(-0.09, -0.12, 0.18, 0.08, 0.035);
    ctx.fill();
    ctx.restore();
  }
  // arms behind body, with sleeves and round hands
  for (const side of ["L", "R"] as const) {
    const upper = b[`arm${side}`],
      fore = b[`fore${side}`];
    capsule(upper.start, upper.end, 0.185, c.skin, c.light, c.dark, upper.part);
    capsule(fore.start, fore.end, 0.16, c.skin, c.light, c.dark, fore.part);
    capsule(
      upper.start,
      along(upper.part, 0.43),
      0.24,
      c.shirt,
      "#fff6e9",
      "#d7c5bb",
    );
    circle(fore.end.x + 0.01, fore.end.y + 0.02, 0.115, c.dark);
    circle(fore.end.x, fore.end.y, 0.115, c.skin);
    circle(fore.end.x - 0.027, fore.end.y - 0.028, 0.04, c.light);
  }
  // hoodie body with a little heart print
  capsule(
    along("torso", 0.09),
    along("torso", 0.86),
    0.57,
    c.shirt,
    "#fff9ed",
    "#d5c0bc",
    "torso",
  );
  capsule(b.armL.start, b.armR.start, 0.245, c.shirt, "#fff6e9", "#d8c7bd");
  const chest = along("torso", 0.57);
  ctx.save();
  ctx.translate(chest.x, chest.y);
  ctx.rotate(b.torso.dir + Math.PI / 2);
  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.moveTo(0, 0.072);
  ctx.bezierCurveTo(-0.19, -0.035, -0.05, -0.14, 0, -0.055);
  ctx.bezierCurveTo(0.065, -0.15, 0.19, -0.03, 0, 0.072);
  ctx.fill();
  ctx.fillStyle = "#bba9a2";
  ctx.beginPath();
  ctx.roundRect(-0.14, 0.17, 0.28, 0.07, 0.025);
  ctx.fill();
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-0.085, -0.14);
  ctx.lineTo(-0.07, 0.04);
  ctx.moveTo(0.085, -0.14);
  ctx.lineTo(0.07, 0.02);
  ctx.stroke();
  ctx.restore();
  // clay head, little ears and sculpted curls
  const head = b.head.end;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(b.head.dir + Math.PI / 2);
  capsule({ x: 0, y: 0.28 }, { x: 0, y: 0.38 }, 0.14, c.skin, c.light, c.dark);
  if (selected === "head") circle(0, 0, 0.342, "#fff");
  circle(-0.3, 0.02, 0.08, c.skin);
  circle(0.3, 0.02, 0.08, c.skin);
  const hg = ctx.createRadialGradient(-0.11, -0.13, 0.02, 0, 0, 0.38);
  hg.addColorStop(0, c.light);
  hg.addColorStop(0.5, c.skin);
  hg.addColorStop(1, c.dark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.305, 0.325, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const x = Math.cos(a) * 0.245,
      y = Math.sin(a) * 0.255 - 0.02;
    circle(x + 0.013, y + 0.014, 0.101, c.dark);
    circle(x, y, 0.1, c.hair);
    circle(x - 0.02, y - 0.025, 0.035, c.skin);
  }
  circle(-0.105, -0.005, 0.032, "#46324e");
  circle(0.105, -0.005, 0.032, "#46324e");
  circle(-0.114, -0.015, 0.009, "#fff");
  circle(0.096, -0.015, 0.009, "#fff");
  circle(-0.17, 0.08, 0.035, c.light);
  circle(0.17, 0.08, 0.035, c.light);
  ctx.strokeStyle = "#67415d";
  ctx.lineWidth = 0.02;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0.055, 0.095, 0.18, Math.PI - 0.18);
  ctx.stroke();
  ctx.restore();
  // the numbered choreography markers
  for (const [part, numbers] of badges) {
    const bone = b[part];
    const at =
      part === "head"
        ? { x: bone.end.x + 0.34, y: bone.end.y - 0.2 }
        : along(part, 0.52);
    const label = numbers.join("·");
    const r = 0.085 + Math.max(0, label.length - 1) * 0.02;
    circle(at.x, at.y, r + 0.015, "#fff9");
    circle(at.x, at.y, r, numbers.includes(active + 1) ? "#e8bf5e" : c.accent);
    ctx.fillStyle = "#fff";
    ctx.font = "bold .092px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, at.x, at.y + 0.004);
  }
  ctx.restore();
}
