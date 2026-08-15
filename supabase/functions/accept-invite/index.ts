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
    const { invite_code, display_name, phone } = body;

    if (!invite_code || typeof invite_code !== "string") {
      throw new HttpError(400, "Missing invite_code");
    }
    if (!display_name || typeof display_name !== "string") {
      throw new HttpError(400, "Missing display_name");
    }

    const cleanCode = invite_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      throw new HttpError(400, "Invalid invite code format");
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("accept_invite_tx", {
      p_user_id: userId,
      p_invite_code: cleanCode,
      p_display_name: display_name,
      p_phone: phone ?? null,
    });

    if (error) {
      const map: Record<string, { status: number; msg: string }> = {
        P0001: { status: 404, msg: "Código de convite não encontrado" },
        P0002: { status: 409, msg: "Convite já utilizado ou revogado" },
        P0003: { status: 409, msg: "Você já pertence a outra família" },
        P0004: { status: 410, msg: "Convite expirado" },
        P0005: { status: 400, msg: "Não é possível aceitar o próprio convite" },
      };
      const mapped = map[error.code];
      if (mapped) {
        throw new HttpError(mapped.status, mapped.msg);
      }
      throw new HttpError(500, `Transaction failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, ...data }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
});
