import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authUser,
  getServiceClient,
  HttpError,
} from "../_shared/index.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { userId } = await authUser(req);

    const body = await req.json();
    const {
      family_name,
      guardian_name,
      guardian_phone,
      protected_name,
      protected_phone,
      code_word,
      code_hint,
    } = body;

    if (!family_name || !guardian_name || !guardian_phone) {
      throw new HttpError(400, "Missing family_name, guardian_name, or guardian_phone");
    }
    if (!protected_name || !protected_phone) {
      throw new HttpError(400, "Missing protected_name or protected_phone");
    }
    if (!code_word) {
      throw new HttpError(400, "Missing code_word");
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("setup_family_tx", {
      p_guardian_id: userId,
      p_family_name: family_name,
      p_guardian_name: guardian_name,
      p_guardian_phone: guardian_phone,
      p_protected_name: protected_name,
      p_protected_phone: protected_phone,
      p_code_word: code_word,
      p_code_hint: code_hint ?? null,
    });

    if (error) {
      if (error.code === "P0003") {
        throw new HttpError(409, "Guardian already has a family");
      }
      throw new HttpError(500, `Transaction failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, ...data }),
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
