import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function consumeOrganizationRateLimit(options: {
  organizationId: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { allowed: false, error: "Configuração do servidor indisponível." };
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_organization_id: options.organizationId,
    p_bucket: options.bucket,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });
  if (error) return { allowed: false, error: error.message };
  return { allowed: data === true, error: null };
}
