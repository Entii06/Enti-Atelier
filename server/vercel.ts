import type { Request, Response } from 'express';
import { createApp } from '../server.ts';

const app = createApp({ production: true, serveFrontend: false });

export function handleApi(route: string) {
  return async (req: Request, res: Response) => {
    try {
      // Keep the original query even if the platform normalizes the function path.
      const url = new URL(req.url || '/', 'http://localhost');
      req.url = route + url.search;
      (await app)(req, res);
    } catch (error) {
      console.error('API initialization failed:', error);
      if (!res.headersSent) res.status(500).json({ error: 'API unavailable.' });
    }
  };
}
