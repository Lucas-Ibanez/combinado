import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authGuard,
  assertGuardianLink,
  checkRateLimit,
  getServiceClient,
  getIdempotencyKey,
  HttpError,
} from "../_shared/index.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    // 1. Autenticar e extrair guardian
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

    // 4. Rate limit: max 5 simulações por hora por guardião
    await checkRateLimit(
      `start_simulation:${guardianId}`,
      3600,
      5,
    );

    // 5. Idempotency key (opcional)
    const idempotencyKey = getIdempotencyKey(req);

    // 6. Transactional outbox via RPC (atomicamente: insert simulation + enqueue job)
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("start_simulation_tx", {
      p_family_id: familyId,
      p_protected_person_id: protectedPersonId,
      p_guardian_id: guardianId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw new HttpError(500, `Transaction failed: ${error.message}`);
    }

    // 7. Registrar no audit_log
    await serviceClient.from("audit_log").insert({
      family_id: familyId,
      actor_id: guardianId,
      actor_type: "guardian",
      action: `start_simulation:${guardianId}`,
      target_type: "simulation",
      target_id: data,
      metadata: { protected_person_id: protectedPersonId },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        simulation_id: data,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
