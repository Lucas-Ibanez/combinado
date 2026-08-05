import { HttpError } from "./auth-guard.ts";

export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("X-Idempotency-Key");
}

export function requireIdempotencyKey(req: Request): string {
  const key = getIdempotencyKey(req);
  if (!key) {
    throw new HttpError(400, "Missing X-Idempotency-Key header");
  }
  return key;
}
