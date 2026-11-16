import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { InitResponse } from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

// Week 1 only needs to know who is playing. Saving and sharing dances
// (Redis) and the daily challenge arrive in week 2.
api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is missing from context' },
      400
    );
  }

  try {
    const username = await reddit.getCurrentUsername();
    return c.json<InitResponse>({
      type: 'init',
      postId,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API init error for post ${postId}:`, error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Initialization failed' },
      400
    );
  }
});
