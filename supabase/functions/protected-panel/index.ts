import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, HttpError } from "../_shared/index.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const body = await req.json();
    const token = body.token;

    if (!token || typeof token !== "string") {
      throw new HttpError(400, "Missing 'token' field");
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new HttpError(400, "Invalid token format");
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("get_protected_panel", {
      p_panel_token: token,
    });

    if (error) {
      if (error.message?.includes("Token inválido")) {
        throw new HttpError(404, "Token inválido ou expirado");
      }
      throw new HttpError(500, `Erro ao buscar painel: ${error.message}`);
    }

    return new Response(JSON.stringify({ ok: true, ...data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
