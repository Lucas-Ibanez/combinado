import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authGuard, HttpError } from "../_shared/index.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { guardianId, familyId } = await authGuard(req);

    return new Response(
      JSON.stringify({
        ok: true,
        guardian_id: guardianId,
        family_id: familyId,
        message: "start-simulation scaffold ready",
      }),
      {
        status: 200,
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
