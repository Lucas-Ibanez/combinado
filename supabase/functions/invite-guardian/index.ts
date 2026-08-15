import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  stepUpAuthGuard,
  getServiceClient,
  HttpError,
} from "../_shared/index.ts";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) {
    code += chars[b % chars.length];
  }
  return code;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { guardianId, familyId } = await stepUpAuthGuard(req);

    const body = await req.json();
    const { protected_person_id } = body;

    if (!protected_person_id) {
      throw new HttpError(400, "Missing protected_person_id");
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(protected_person_id)) {
      throw new HttpError(400, "Invalid protected_person_id format");
    }

    const serviceClient = getServiceClient();

    const { data: pp, error: ppErr } = await serviceClient
      .from("protected_persons")
      .select("id, family_id")
      .eq("id", protected_person_id)
      .eq("family_id", familyId)
      .single();

    if (ppErr || !pp) {
      throw new HttpError(404, "Protected person not found in your family");
    }

    const { data: pending } = await serviceClient
      .from("guardian_invites")
      .select("id, invite_code, expires_at")
      .eq("family_id", familyId)
      .eq("protected_person_id", protected_person_id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pending) {
      return new Response(
        JSON.stringify({
          ok: true,
          invite_code: pending.invite_code,
          expires_at: pending.expires_at,
          reused: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const invite_code = generateInviteCode();
    const expires_at = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertErr } = await serviceClient
      .from("guardian_invites")
      .insert({
        family_id: familyId,
        invited_by: guardianId,
        protected_person_id,
        invite_code,
        expires_at,
      });

    if (insertErr) {
      throw new HttpError(500, `Failed to create invite: ${insertErr.message}`);
    }

    await serviceClient.from("audit_log").insert({
      family_id: familyId,
      actor_id: guardianId,
      actor_type: "guardian",
      action: "create_invite",
      target_type: "protected_person",
      target_id: protected_person_id,
      metadata: { invite_code },
    });

    return new Response(
      JSON.stringify({ ok: true, invite_code, expires_at, reused: false }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
});
