import { getSupabaseClient } from "./supabase.ts";

export interface AuthResult {
  guardianId: string;
  familyId: string;
}

export interface StepUpAuthResult extends AuthResult {
  aal: string;
}

export interface AuthUserResult {
  userId: string;
}

export async function authGuard(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new HttpError(401, "Missing Authorization header");
  }

  const supabase = getSupabaseClient(authHeader);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, "Invalid or expired token");
  }

  const { data: guardian, error: gErr } = await supabase
    .from("guardians")
    .select("id, family_id")
    .eq("id", user.id)
    .single();

  if (gErr || !guardian) {
    throw new HttpError(403, "User is not a registered guardian");
  }

  return { guardianId: guardian.id, familyId: guardian.family_id };
}

export async function authUser(req: Request): Promise<AuthUserResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new HttpError(401, "Missing Authorization header");
  }

  const supabase = getSupabaseClient(authHeader);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, "Invalid or expired token");
  }

  return { userId: user.id };
}

export async function stepUpAuthGuard(req: Request): Promise<StepUpAuthResult> {
  const result = await authGuard(req);

  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const aal = extractAal(token);

  if (aal !== "aal2") {
    throw new HttpError(
      403,
      "Step-up auth required: verify MFA to perform this action",
    );
  }

  return { ...result, aal };
}

function extractAal(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return "aal1";
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    return decoded.aal ?? "aal1";
  } catch {
    return "aal1";
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
