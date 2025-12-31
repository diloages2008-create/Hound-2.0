// Supabase Edge Function: checkin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDGE_SUPABASE_URL = Deno.env.get("EDGE_SUPABASE_URL") ?? "";
const EDGE_SERVICE_ROLE_KEY = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const deviceid = String(body.deviceId ?? body.deviceid ?? "").trim();
  if (!token || !deviceid) {
    return Response.json({ ok: false, error: "Missing token or device id.", forceGate: false }, { status: 400 });
  }
  const supabase = createClient(EDGE_SUPABASE_URL, EDGE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("token, deviceid, expiresat, revoked")
    .eq("token", token)
    .maybeSingle();

  if (sessionError || !session || session.deviceid !== deviceid) {
    return Response.json({ ok: false, error: "Session not found.", forceGate: false }, { status: 403 });
  }
  if (session.revoked) {
    return Response.json({ ok: false, error: "Session revoked.", forceGate: true }, { status: 403 });
  }
  if (session.expiresat && new Date(session.expiresat).getTime() < Date.now()) {
    return Response.json({ ok: false, error: "Session expired.", forceGate: true }, { status: 403 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("deviceid, revoked, wipeonnextlaunch")
    .eq("deviceid", deviceid)
    .maybeSingle();

  if (!device) {
    return Response.json({ ok: false, error: "Device not found.", forceGate: false }, { status: 403 });
  }
  if (device.revoked) {
    return Response.json({ ok: false, error: "Device revoked.", forceGate: true }, { status: 403 });
  }

  await supabase.from("devices").update({ lastseen: new Date().toISOString() }).eq("deviceid", deviceid);

  if (device.wipeonnextlaunch) {
    await supabase.from("devices").update({ wipeonnextlaunch: false }).eq("deviceid", deviceid);
  }

  return Response.json({ ok: true, wipeonnextlaunch: !!device.wipeonnextlaunch });
});
