import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, HttpError } from "../_shared/index.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const body = await req.json();
    const token = body.token;
    const guardianLinkId = body.guardian_link_id;

    if (!token || typeof token !== "string") {
      throw new HttpError(400, "Missing 'token' field");
    }

    if (!guardianLinkId || typeof guardianLinkId !== "string") {
      throw new HttpError(400, "Missing 'guardian_link_id' field");
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token) || !uuidRegex.test(guardianLinkId)) {
      throw new HttpError(400, "Invalid UUID format");
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient.rpc("revoke_guardian_tx", {
      p_panel_token: token,
      p_guardian_link_id: guardianLinkId,
    });

    if (error) {
      if (error.message?.includes("Token inválido")) {
        throw new HttpError(404, "Token inválido ou expirado");
      }
      if (error.message?.includes("não encontrado")) {
        throw new HttpError(404, "Vínculo não encontrado");
      }
      if (error.message?.includes("não pertence")) {
        throw new HttpError(403, "Vínculo não pertence a este protegido");
      }
      throw new HttpError(500, `Erro ao revogar: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true }),
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
