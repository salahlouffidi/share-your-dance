import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { MAX_STEPS, parseSteps, partLabel, type Step } from '../shared/dance';
import { Editor, EditorCommand, EditorEvent } from './scenes/Editor';

const DEFAULT_HINT = 'Touch a body part and drag it. Every move becomes a numbered step.';
const READY_HINT = 'Press Play to watch the steps in order.';

const element = <T extends HTMLElement>(id: string, type: new () => T): T => {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
};

const start = () => {
  const game = new Game({
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#f4ead9',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [Editor],
  });

  // The stage sits between the title bar and the panel; keep the canvas the
  // same size as that space whenever the layout changes.
  const stage = element('game-container', HTMLElement);
  new ResizeObserver(() => game.scale.refresh()).observe(stage);

  const count = element('count', HTMLSpanElement);
  const hint = element('hint', HTMLParagraphElement);
  const list = element('steps', HTMLOListElement);
  const play = element('play', HTMLButtonElement);
  const undo = element('undo', HTMLButtonElement);
  const clear = element('clear', HTMLButtonElement);

  let steps: Step[] = [];
  let playing = false;
  let noticeTimer: number | undefined;

  const restHint = () => (steps.length === 0 ? DEFAULT_HINT : READY_HINT);

  const render = () => {
    count.textContent = `${steps.length}/${MAX_STEPS}`;
    play.textContent = playing ? 'Stop' : 'Play';
    play.disabled = steps.length === 0;
    undo.disabled = playing || steps.length === 0;
    clear.disabled = playing || steps.length === 0;
    if (noticeTimer === undefined) hint.textContent = restHint();

    list.replaceChildren(
      ...steps.map((step, index) => {
        const item = document.createElement('li');
        const number = document.createElement('b');
        number.textContent = String(index + 1);
        item.append(number, partLabel(step.part));
        return item;
      })
    );
    list.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'end' });
  };

  game.events.on(EditorEvent.steps, (next: unknown) => {
    steps = parseSteps(next) ?? [];
    render();
  });

  game.events.on(EditorEvent.playing, (next: unknown) => {
    playing = next === true;
    render();
  });

  game.events.on(EditorEvent.active, (index: unknown) => {
    [...list.children].forEach((item, i) => item.classList.toggle('active', i === index));
    if (typeof index === 'number' && index >= 0) {
      list.children[index]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  });

  game.events.on(EditorEvent.notice, (message: unknown) => {
    if (typeof message !== 'string') return;
    hint.textContent = message;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      noticeTimer = undefined;
      hint.textContent = restHint();
    }, 2600);
  });

  play.addEventListener('click', () => {
    game.events.emit(playing ? EditorCommand.stop : EditorCommand.play);
  });
  undo.addEventListener('click', () => game.events.emit(EditorCommand.undo));
  clear.addEventListener('click', () => game.events.emit(EditorCommand.clear));

  render();
};

document.addEventListener('DOMContentLoaded', start);
