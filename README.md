# Share your dance

A daily clay-dancer game for Reddit, built on Devvit Web with Phaser for
Reddit's Game of the Day Hackathon.

You bend a clay dancer one body part at a time. Every move becomes a numbered
step. Press Play and the dancer performs the steps in order. Each dance is
meant to be shared as a post, and others answer with their own.

## How to play

1. Touch a body part and drag it to a new position.
2. Each move is added as the next numbered step (up to 8).
3. Press **Play** to watch the dance. **Undo** removes the last step and
   **Clear** starts over.

## Status

Week 1 (done): the dance editor.

- Clay dancer drawn in code, no image assets
- Touch-to-number step editor with per-part turning limits
- Playback with a springy snap and a body bounce on each step

Next:

- Week 2: save and share a dance as a post (Redis), T-shirt print from the
  player's Reddit avatar, and the daily challenge
- Week 3: streaks, Devvit Journeys events, polish, and the demo post

## Run it

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run login   # sign in to Reddit, once
npm run dev     # playtest in your test subreddit
```

Other commands:

```bash
npm run test:unit    # dance model tests
npm run test:types   # type check
npm run lint
npm run build
```

## Layout

- `src/shared/dance.ts`: the dance model (skeleton, poses, steps, playback
  timing, validation). Pure code, shared by client and server.
- `src/client/dancer.ts`: draws the clay dancer and finds the part under a
  touch.
- `src/client/scenes/Editor.ts`: the Phaser scene for editing and playback.
- `src/client/game.ts`, `game.html`, `game.css`: the page around the canvas
  (step chips and buttons).
- `src/client/splash.*`: the small card shown in the Reddit feed.
- `src/server`: the Devvit server (post creation; saving comes in week 2).

Based on Reddit's Devvit Phaser template (BSD-3-Clause, see `LICENSE`).
