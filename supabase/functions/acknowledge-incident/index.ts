import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authGuard,
  getServiceClient,
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

    // 1. Autenticar
    const { guardianId, familyId } = await authGuard(req);

    // 2. Ler body
    const body = await req.json();
    const incidentId = body.incident_id;
    const ackAction = body.ack_action ?? "safe_confirmed";
    if (!incidentId) {
      throw new HttpError(400, "Missing incident_id");
    }

    // 3. Transação atômica: update incident + audit_log
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc(
      "acknowledge_incident_tx",
      {
        p_incident_id: incidentId,
        p_guardian_id: guardianId,
        p_family_id: familyId,
        p_ack_channel: "app",
      },
    );

    if (error) {
      if (error.code === "P0002") {
        throw new HttpError(404, "Incident not found");
      }
      if (error.code === "P0003") {
        throw new HttpError(409, error.message);
      }
      throw new HttpError(500, `Transaction failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        incident_id: incidentId,
        status: data,
        ack_action: ackAction,
        ack_channel: "app",
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
