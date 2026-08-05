import { getServiceClient } from "./supabase.ts";
import { HttpError } from "./auth-guard.ts";

export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<void> {
  const serviceClient = getServiceClient();

  const windowStart = new Date(
    Date.now() - windowSeconds * 1000,
  ).toISOString();

  const { count, error } = await serviceClient
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", key)
    .gte("created_at", windowStart);

  if (error) {
    throw new HttpError(500, "Rate limit check failed");
  }

  if ((count ?? 0) >= maxRequests) {
    throw new HttpError(429, "Rate limit exceeded. Try again later.");
  }
}
