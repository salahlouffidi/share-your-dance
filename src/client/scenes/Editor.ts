import { Scene } from 'phaser';
import type * as Phaser from 'phaser';
import {
  MAX_STEPS,
  PARTS,
  aimPart,
  frameAt,
  poseAfter,
  type Part,
  type Pose,
  type Step,
} from '../../shared/dance';
import {
  BADGE_COLORS,
  badgeAnchor,
  drawDancer,
  partAt,
  toBody,
  toScreen,
  type DancerView,
} from '../dancer';

/** Moves smaller than this are treated as a tap, not a step. */
const MIN_MOVE = (4 * Math.PI) / 180;

/** Events the scene sends to the page UI. */
export const EditorEvent = {
  steps: 'editor:steps',
  playing: 'editor:playing',
  active: 'editor:active',
  notice: 'editor:notice',
} as const;

/** Commands the page UI sends to the scene. */
export const EditorCommand = {
  play: 'ui:play',
  stop: 'ui:stop',
  undo: 'ui:undo',
  clear: 'ui:clear',
} as const;

export class Editor extends Scene {
  private steps: Step[] = [];
  private pose: Pose = poseAfter([]);
  private graphics: Phaser.GameObjects.Graphics;
  private badges = new Map<Part, Phaser.GameObjects.Text>();

  private dragging: Part | null = null;
  private dragFrom = 0;
  private hover: Part | null = null;
  private grabPoint: { x: number; y: number } | null = null;

  private playing = false;
  private playTime = 0;
  private activeStep = -1;
  private bounce = 0;

  constructor() {
    super('Editor');
  }

  create() {
    this.steps = [];
    this.pose = poseAfter([]);
    this.graphics = this.add.graphics();

    for (const part of PARTS) {
      const badge = this.add
        .text(0, 0, '', {
          fontFamily: 'ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: BADGE_COLORS.text,
        })
        .setOrigin(0.5)
        .setDepth(2)
        .setVisible(false);
      this.badges.set(part, badge);
    }

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    const events = this.game.events;
    events.on(EditorCommand.play, this.play, this);
    events.on(EditorCommand.stop, this.stop, this);
    events.on(EditorCommand.undo, this.undo, this);
    events.on(EditorCommand.clear, this.clear, this);

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.resize(size.width, size.height);
    });

    this.emitSteps();
  }

  /** Where the dancer stands for the current canvas size. */
  private view(): DancerView {
    const { width, height } = this.scale;
    const scale = Math.min(height / 3.3, width / 2.5);
    return { scale, origin: { x: width / 2, y: height / 2 + scale * 0.3 } };
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.playing) return;
    const part = partAt(this.pose, toBody(this.view(), pointer));
    if (!part) return;

    if (this.steps.length >= MAX_STEPS) {
      this.game.events.emit(EditorEvent.notice, `${MAX_STEPS} steps is the max. Undo one to change it.`);
      return;
    }

    this.dragging = part;
    this.dragFrom = this.pose[part];
    this.grabPoint = { x: pointer.x, y: pointer.y };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (this.playing) return;
    const body = toBody(this.view(), pointer);

    if (!this.dragging) {
      this.hover = partAt(this.pose, body);
      return;
    }

    this.pose[this.dragging] = aimPart(this.pose, this.dragging, body);
    this.grabPoint = { x: pointer.x, y: pointer.y };
  }

  private onUp() {
    const part = this.dragging;
    if (!part) return;
    this.dragging = null;
    this.grabPoint = null;
    // On touch screens there is no hover, so do not leave an outline behind.
    this.hover = null;

    const angle = this.pose[part];
    if (Math.abs(angle - this.dragFrom) < MIN_MOVE) {
      this.pose[part] = this.dragFrom;
      return;
    }

    this.steps.push({ part, angle });
    this.emitSteps();
  }

  private play() {
    if (this.playing || this.steps.length === 0) return;
    this.dragging = null;
    this.grabPoint = null;
    this.hover = null;
    this.playing = true;
    this.playTime = 0;
    this.setActive(-1);
    this.game.events.emit(EditorEvent.playing, true);
  }

  private stop() {
    if (!this.playing) return;
    this.playing = false;
    this.bounce = 0;
    this.pose = poseAfter(this.steps);
    this.setActive(-1);
    this.game.events.emit(EditorEvent.playing, false);
  }

  private undo() {
    if (this.playing || this.steps.length === 0) return;
    this.steps.pop();
    this.pose = poseAfter(this.steps);
    this.emitSteps();
  }

  private clear() {
    if (this.playing || this.steps.length === 0) return;
    this.steps = [];
    this.pose = poseAfter(this.steps);
    this.emitSteps();
  }

  private emitSteps() {
    this.game.events.emit(EditorEvent.steps, [...this.steps]);
  }

  private setActive(index: number) {
    if (index === this.activeStep) return;
    this.activeStep = index;
    this.game.events.emit(EditorEvent.active, index);
  }

  override update(time: number, delta: number) {
    if (this.playing) {
      this.playTime += delta;
      const frame = frameAt(this.steps, this.playTime);
      this.pose = frame.pose;
      this.bounce = frame.bounce;
      this.setActive(frame.active);
      if (frame.done) this.stop();
    } else if (!this.dragging) {
      // A slow breath, so the dancer never looks frozen.
      this.bounce = 0.12 * (0.5 + 0.5 * Math.sin(time / 520));
    }

    this.draw();
  }

  private draw() {
    const view = this.view();
    const g = this.graphics;
    g.clear();

    drawDancer(g, view, this.pose, {
      selected: this.dragging ?? (this.playing ? null : this.hover),
      bounce: this.bounce,
    });

    // The "hand": a ring where the player is holding the clay.
    if (this.dragging && this.grabPoint) {
      g.lineStyle(3, 0x2b1d16, 0.9);
      g.strokeCircle(this.grabPoint.x, this.grabPoint.y, 16);
      g.fillStyle(0xfbf3e4, 0.9);
      g.fillCircle(this.grabPoint.x, this.grabPoint.y, 6);
    }

    this.drawBadges(view);
  }

  /** Numbers on the body: which steps move each part. */
  private drawBadges(view: DancerView) {
    const numbers = new Map<Part, number[]>();
    this.steps.forEach((step, index) => {
      numbers.set(step.part, [...(numbers.get(step.part) ?? []), index + 1]);
    });

    const dip = this.bounce * 0.05 * view.scale;
    for (const [part, badge] of this.badges) {
      const list = numbers.get(part);
      if (!list) {
        badge.setVisible(false);
        continue;
      }

      const label = list.join('·');
      const at = toScreen(view, badgeAnchor(this.pose, part));
      const isActive = this.activeStep >= 0 && list.includes(this.activeStep + 1);
      const radius = (isActive ? 15 : 12) + (label.length - 1) * 3.5;

      this.graphics.fillStyle(isActive ? 0xf2b632 : BADGE_COLORS.fill, 1);
      this.graphics.fillCircle(at.x, at.y + dip, radius);
      badge
        .setText(label)
        .setColor(isActive ? '#2b1d16' : BADGE_COLORS.text)
        .setPosition(at.x, at.y + dip)
        .setVisible(true);
    }
  }
}
