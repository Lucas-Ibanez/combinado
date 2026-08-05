import { getSupabaseClient } from "./supabase.ts";
import { HttpError } from "./auth-guard.ts";

export async function assertGuardianLink(
  authHeader: string,
  guardianId: string,
  protectedPersonId: string,
): Promise<void> {
  const supabase = getSupabaseClient(authHeader);

  const { data, error } = await supabase
    .from("guardian_links")
    .select("id")
    .eq("guardian_id", guardianId)
    .eq("protected_person_id", protectedPersonId)
    .single();

  if (error || !data) {
    throw new HttpError(
      403,
      "Guardian does not have a link to this protected person",
    );
  }
}
