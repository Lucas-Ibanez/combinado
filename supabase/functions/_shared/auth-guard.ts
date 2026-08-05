import { getSupabaseClient } from "./supabase.ts";

export interface AuthResult {
  guardianId: string;
  familyId: string;
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

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
