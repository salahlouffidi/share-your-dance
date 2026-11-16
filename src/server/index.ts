import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  context,
  createServer,
  getServerPort,
  redis,
  reddit,
} from "@devvit/web/server";
import {
  parseDance,
  decodeDance,
  encodeDance,
  challengeFor,
  challengeComplete,
} from "../shared/studio";
import type { UiResponse } from "@devvit/web/shared";

export const app = new Hono();
app.onError((error, c) => {
  console.error("Dance Lab request failed:", error.message);
  return c.json(
    {
      message:
        "Could not complete this request. Your dance is still in the editor.",
    },
    500,
  );
});
app.get("/api/state", async (c) => {
  const post = context.postData;
  const dance =
    post && typeof post.dance === "string" ? decodeDance(post.dance) : null;
  return c.json({ dance, challenge: challengeFor() });
});
app.get("/api/draft", async (c) => {
  if (!context.userId)
    return c.json(
      { message: "Sign in to Reddit to load your saved dance." },
      401,
    );
  const data = await redis.get(`draft:${context.userId}`);
  return c.json({ dance: data ? decodeDance(data) : null });
});
app.post("/api/draft", async (c) => {
  if (!context.userId)
    return c.json({ message: "Sign in to Reddit to save your dance." }, 401);
  const raw: unknown = await c.req.json();
  const dance =
    raw && typeof raw === "object" && "dance" in raw
      ? parseDance(raw.dance)
      : null;
  if (!dance || !dance.steps.length)
    return c.json({ message: "A dance needs 1 to 8 valid moves." }, 400);
  await redis.set(`draft:${context.userId}`, encodeDance(dance));
  return c.json({
    saved: true,
    dailyComplete: challengeComplete(dance, challengeFor()),
  });
});
app.post("/api/share", async (c) => {
  if (!context.userId || !context.subredditName)
    return c.json({ message: "Sign in to Reddit to share your dance." }, 401);
  const raw: unknown = await c.req.json();
  const dance =
    raw && typeof raw === "object" && "dance" in raw
      ? parseDance(raw.dance)
      : null;
  if (!dance || !dance.steps.length)
    return c.json({ message: "A dance needs 1 to 8 valid moves." }, 400);
  // Same-user concurrency and accidental double-submit protection. It expires;
  // never blindly retry a post creation after a timeout.
  const lock = await redis.set(`share-lock:${context.userId}`, "1", {
    nx: true,
    expiration: new Date(Date.now() + 60000),
  });
  if (!lock)
    return c.json(
      { message: "Please wait a minute before sharing another dance." },
      429,
    );
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Share Your Dance · ${challengeFor().date} · ${dance.steps.length} little moves`,
    runAs: "USER",
    userGeneratedContent: {
      text: "A player-created dance made from built-in characters and body-part poses.",
    },
    postData: { dance: encodeDance(dance) },
    textFallback: {
      text: "Open this post in the Reddit app or on reddit.com to play this Dance Lab choreography.",
    },
  });
  return c.json({
    url: `https://www.reddit.com/r/${context.subredditName}/comments/${post.id.replace(/^t3_/, "")}/`,
  });
});
app.post("/internal/create-post", async (c) => {
  const post = await reddit.submitCustomPost({
    title: "Share Your Dance · Your daily creative escape",
  });
  return c.json<UiResponse>({
    navigateTo: `https://www.reddit.com/r/${context.subredditName}/comments/${post.id.replace(/^t3_/, "")}/`,
  });
});
serve({ fetch: app.fetch, createServer, port: getServerPort() });
