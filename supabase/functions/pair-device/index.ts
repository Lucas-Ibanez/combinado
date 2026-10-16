import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authGuard,
  assertGuardianLink,
  getServiceClient,
  getIdempotencyKey,
  HttpError,
} from "../_shared/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const authHeader = req.headers.get("Authorization")!;
    const { guardianId, familyId } = await authGuard(req);

    // 2. Ler body
    const body = await req.json();
    const protectedPersonId = body.protected_person_id;
    if (!protectedPersonId) {
      throw new HttpError(400, "Missing protected_person_id");
    }

    // 3. Confirmar vínculo guardião ↔ protegido
    await assertGuardianLink(authHeader, guardianId, protectedPersonId);

    // 4. Idempotency key (opcional)
    const idempotencyKey = getIdempotencyKey(req);

    // 5. Transação atômica: update status + enqueue job + audit_log
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("pair_device_tx", {
      p_protected_person_id: protectedPersonId,
      p_guardian_id: guardianId,
      p_family_id: familyId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      if (error.code === "P0002") {
        throw new HttpError(404, "Protected person not found");
      }
      if (error.code === "P0003") {
        throw new HttpError(409, error.message);
      }
      throw new HttpError(500, `Transaction failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        protected_person_id: protectedPersonId,
        baileys_status: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
