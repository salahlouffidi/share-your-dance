# Dance Lab / share-your-dance

This is a fresh implementation of salahlouffidi/share-your-dance.
Read README.md and package.json before changing the project.

## Decisions

- Keep built-in characters and shirt designs only. No user images, head replacement, background removal, or Reddit-avatar import.
- The dance mechanic is drag a body part -> append a numbered move -> play in order.
- Preserve the lightweight, tactile lilac/peach studio aesthetic and responsive touch support.
- Do not reintroduce Phaser solely to match the old implementation. This renderer uses Canvas 2D to keep the client small and the local preview independent.
- GitHub repo and Devvit app are both named share-your-dance.
- The studio must fit one screen without page scrolling (tests/smoke.mjs checks five viewport sizes).

## Runtime

- npm ci, npm run dev: browser preview without Reddit authentication.
- npm run dev:reddit: Devvit playtest; requires login and a moderated test subreddit.
- npm run login:reddit: browser login flow. Never request credentials in chat.
- npm run build and npm run build:reddit: separate build targets.
- Client TS config has the browser export condition. Server TS config must NOT have it, otherwise Devvit selects its intentional panic imports.
- Keep server imports out of browser modules. Gate client SDK use behind the **REDDIT** compile-time flag.

## Verification

Run npm run check, npm run lint, npm test, npm run build, npm run build:reddit.
For interaction changes: npx playwright install chromium, npm run test:ui.
Do not claim a live Reddit integration was tested without actually completing login, install and playtest.
Do not publish the Devvit app publicly or merge/push unrelated work unless requested.
