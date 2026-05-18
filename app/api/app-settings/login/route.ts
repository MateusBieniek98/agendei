import { NextResponse, type NextRequest } from "next/server";
import {
  createAppSettingsClient,
  getLoginSettings,
  LOGIN_SETTINGS_KEY,
  normalizeLoginSettings,
} from "@/lib/app-settings";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await getLoginSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const settings = normalizeLoginSettings(body?.settings ?? body);
  const client = createAppSettingsClient();

  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor para salvar ajustes.",
      },
      { status: 500 }
    );
  }

  const { error } = await client.from("app_settings").upsert(
    {
      key: LOGIN_SETTINGS_KEY,
      value: settings,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings });
}
