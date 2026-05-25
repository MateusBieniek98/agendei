import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_LOGIN_SETTINGS,
  LOGIN_SETTINGS_KEY,
  normalizeLoginSettings,
} from "@/lib/app-settings-shared";
import {
  DEFAULT_OPERATIONAL_AUTOMATIONS,
  OPERATIONAL_AUTOMATIONS_KEY,
  normalizeOperationalAutomationSettings,
} from "@/lib/operational-automations";

export {
  DEFAULT_LOGIN_SETTINGS,
  LOGIN_SETTINGS_KEY,
  normalizeLoginSettings,
  DEFAULT_OPERATIONAL_AUTOMATIONS,
  OPERATIONAL_AUTOMATIONS_KEY,
  normalizeOperationalAutomationSettings,
};
export type { LoginSettings } from "@/lib/app-settings-shared";
export type { OperationalAutomationSettings } from "@/lib/operational-automations";

type AppSettingRow = {
  value: Record<string, unknown> | null;
};

export function createAppSettingsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getLoginSettings() {
  const client = createAppSettingsClient();
  if (!client) return DEFAULT_LOGIN_SETTINGS;

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", LOGIN_SETTINGS_KEY)
    .maybeSingle();

  const row = data as AppSettingRow | null;
  if (error || !row?.value) return DEFAULT_LOGIN_SETTINGS;
  return normalizeLoginSettings(row.value);
}

export async function getOperationalAutomationSettings() {
  const client = createAppSettingsClient();
  if (!client) return DEFAULT_OPERATIONAL_AUTOMATIONS;

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", OPERATIONAL_AUTOMATIONS_KEY)
    .maybeSingle();

  const row = data as AppSettingRow | null;
  if (error || !row?.value) return DEFAULT_OPERATIONAL_AUTOMATIONS;
  return normalizeOperationalAutomationSettings(row.value);
}
