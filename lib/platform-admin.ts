import "server-only";

import { NextResponse } from "next/server";
import {
  getPlatformMfaStatus,
  isCurrentUserPlatformAdmin,
} from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function getPlatformApiContext() {
  if (!(await isCurrentUserPlatformAdmin())) {
    return {
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    } as const;
  }

  const assurance = await getPlatformMfaStatus();
  if (assurance.currentLevel !== "aal2") {
    return {
      response: NextResponse.json(
        { error: "mfa_required", next: "/seguranca/mfa" },
        { status: 403 }
      ),
    } as const;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json(
        { error: "Configuração administrativa indisponível no servidor." },
        { status: 500 }
      ),
    } as const;
  }

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    } as const;
  }

  return { admin, user: auth.user } as const;
}
