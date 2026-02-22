import { createClient } from "@supabase/supabase-js";

/**
 * One-time super admin promotion script.
 * Run from backend/CI only (never from frontend).
 * Idempotent by app_settings key.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!SUPER_ADMIN_EMAIL) {
  throw new Error("Missing SUPER_ADMIN_EMAIL");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FLAG_KEY = `rbac.super_admin_promoted.${SUPER_ADMIN_EMAIL.toLowerCase()}`;

async function main() {
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersErr) throw usersErr;

  const target = usersData.users.find((u) => (u.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  if (!target) {
    throw new Error(`No auth user found for ${SUPER_ADMIN_EMAIL}`);
  }

  const { data: existingProfile, error: existingErr } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", target.id)
    .maybeSingle();
  if (existingErr) throw existingErr;

  if (existingProfile?.role === "admin") {
    console.log(`User ${SUPER_ADMIN_EMAIL} is already admin.`);
    return;
  }

  const { error: upsertErr } = await supabase.from("profiles").upsert({
    id: target.id,
    email: target.email || SUPER_ADMIN_EMAIL,
    full_name: target.user_metadata?.full_name || "",
    role: "admin",
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) throw upsertErr;

  const { error: roleErr } = await supabase
    .from("profiles")
    .update({ role: "admin", updated_at: new Date().toISOString() })
    .eq("id", target.id);
  if (roleErr) throw roleErr;

  // Best-effort idempotency marker if app_settings exists.
  await supabase.from("app_settings").upsert({ key: FLAG_KEY, value: "true" }).throwOnError().catch(() => {});

  console.log(`Promoted ${SUPER_ADMIN_EMAIL} to admin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
