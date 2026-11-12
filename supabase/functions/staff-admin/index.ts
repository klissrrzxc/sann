import { createClient } from "@supabase/supabase-js";

const allowedOrigins = new Set([
  "https://klissrrzxc.github.io",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
const roles = new Set([
  "administrator",
  "editor_in_chief",
  "senior_journalist",
  "junior_journalist",
  "photographer",
]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization,apikey,content-type,x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
  }
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin))
    return reply(403, { error: "Origin denied" });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "POST required" });
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return reply(401, { error: "Staff sign-in required" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } =
    await userClient.auth.getUser(authorization.slice(7));
  if (identityError || !identity.user)
    return reply(401, { error: "Invalid or expired session" });
  const { data: assignment, error: assignmentError } = await userClient
    .from("staff_roles")
    .select("role,active")
    .eq("user_id", identity.user.id)
    .maybeSingle();
  if (
    assignmentError ||
    assignment?.role !== "administrator" ||
    !assignment.active
  )
    return reply(403, { error: "Administrator required" });
  let body: { email?: unknown; rp_name?: unknown; role?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 4096) return reply(413, { error: "Request too large" });
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "Invalid request" });
  }
  if (
    typeof body.email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(body.email) ||
    body.email.length > 254 ||
    typeof body.rp_name !== "string" ||
    !body.rp_name.trim() ||
    body.rp_name.length > 100 ||
    typeof body.role !== "string" ||
    !roles.has(body.role)
  )
    return reply(400, {
      error: "A valid email, RP name and staff role are required",
    });
  // This key exists only in the trusted Edge runtime. It is never returned to callers.
  const service = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: invitation, error: inviteError } =
    await service.auth.admin.inviteUserByEmail(body.email.trim(), {
      redirectTo: "https://klissrrzxc.github.io/sann/",
    });
  if (inviteError || !invitation.user)
    return reply(400, { error: inviteError?.message ?? "Invitation failed" });
  // Use the administrator's JWT for assignment, so admin_staff rechecks live authority.
  const { error: roleError } = await userClient.rpc("admin_staff", {
    p_user_id: invitation.user.id,
    p_name: body.rp_name.trim(),
    p_role: body.role,
    p_active: true,
  });
  if (roleError)
    return reply(409, {
      error:
        "Invitation sent, but role assignment failed. Assign the invited UUID in Staff access.",
      user_id: invitation.user.id,
    });
  return reply(200, { success: true, user_id: invitation.user.id });
});
