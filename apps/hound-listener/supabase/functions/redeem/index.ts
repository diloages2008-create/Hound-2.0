// Supabase Edge Function: redeem
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDGE_SUPABASE_URL = Deno.env.get("EDGE_SUPABASE_URL") ?? "";
const EDGE_SERVICE_ROLE_KEY = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const body = await req.json().catch(() => ({}));
  const invitecode = String(body.inviteCode ?? body.invitecode ?? "").trim();
  const deviceid = String(body.deviceId ?? body.deviceid ?? "").trim();
  const label = String(body.label ?? "").trim();
  if (!invitecode || !deviceid) {
    return Response.json({ error: "Missing invite code or device id." }, { status: 400 });
  }
  const supabase = createClient(EDGE_SUPABASE_URL, EDGE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("code, revoked, maxdevices, usedcount, expiresat")
    .eq("code", invitecode)
    .single();

  if (inviteError || !invite || invite.revoked) {
    return Response.json({ error: "Invite invalid or revoked." }, { status: 403 });
  }
  if (invite.expiresat && new Date(invite.expiresat).getTime() < Date.now()) {
    return Response.json({ error: "Invite expired." }, { status: 403 });
  }

  const { data: existingDevice } = await supabase
    .from("devices")
    .select("deviceid, revoked")
    .eq("invitecode", invitecode)
    .eq("deviceid", deviceid)
    .maybeSingle();

  if (existingDevice?.revoked) {
    return Response.json({ error: "Device revoked." }, { status: 403 });
  }

  const { count } = await supabase
    .from("devices")
    .select("deviceid", { count: "exact", head: true })
    .eq("invitecode", invitecode)
    .eq("revoked", false);

  const maxdevices = Number(invite.maxdevices ?? 1);
  if (!existingDevice && Number.isFinite(count) && count >= maxdevices) {
    return Response.json({ error: "Invite device limit reached." }, { status: 403 });
  }

  if (!existingDevice) {
    await supabase.from("devices").insert({
      deviceid,
      invitecode,
      label,
      firstseen: new Date().toISOString(),
      lastseen: new Date().toISOString(),
      revoked: false,
      wipeonnextlaunch: false
    });
    await supabase.from("invites").update({ usedcount: (invite.usedcount ?? 0) + 1 }).eq("code", invitecode);
  } else {
    await supabase.from("devices").update({ lastseen: new Date().toISOString() }).eq("deviceid", deviceid);
  }

  const token = crypto.randomUUID();
  const expiresat = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("sessions").insert({
    token,
    deviceid,
    createdat: new Date().toISOString(),
    expiresat,
    revoked: false
  });

  return Response.json({ token, expiresat });
});
