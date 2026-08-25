import { randomBytes } from 'node:crypto';
import type { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function extractBearerToken(req: Request): string | undefined {
  const header = req.header('Authorization');
  return header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
}
