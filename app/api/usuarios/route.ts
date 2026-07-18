// Gestão de usuários para admin.
//
// A listagem usa Supabase Auth como fonte principal porque usuários podem
// existir no Auth antes/depois do profile. A service_role fica somente aqui,
// no servidor, e nunca é enviada ao navegador.

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLES: UserRole[] = ["encarregado", "admin", "gestor", "manutencao"];
const PROFILE_WITH_EQUIPE_SELECT = "*, equipes:equipes!profiles_equipe_fk(nome)";

type ListUsersClient = {
  auth: {
    admin: {
      listUsers: (params: {
        page: number;
        perPage: number;
      }) => Promise<{ data: { users: User[] }; error: { message: string } | null }>;
    };
  };
};

type ProfileRow = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  equipe_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  equipes: { nome: string } | null;
};

type SupabaseAdminClient = Exclude<
  ReturnType<typeof createAdminClient>,
  { error: string }
>["client"];

function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !serviceKey) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.",
    } as const;
  }

  return {
    client: createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }),
  } as const;
}

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    } as const;
  }
  if (profile.role !== "admin") {
    return {
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    } as const;
  }
  return { profile } as const;
}

function normalizeRole(value: unknown): UserRole {
  return ROLES.includes(value as UserRole) ? (value as UserRole) : "encarregado";
}

function fallbackName(email: string) {
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return name ? name.replace(/\b\w/g, (char) => char.toUpperCase()) : "Usuário sem nome";
}

function metadataText(user: User, key: string) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function mergeAuthAndProfile(user: User, profile?: ProfileRow) {
  const email = profile?.email || user.email || "";
  const nome = profile?.nome || metadataText(user, "nome") || fallbackName(email);
  const createdAt = profile?.created_at || user.created_at || new Date().toISOString();
  const updatedAt = profile?.updated_at || user.updated_at || createdAt;

  return {
    id: user.id,
    email,
    nome,
    role: profile?.role ?? normalizeRole(metadataText(user, "role")),
    equipe_id: profile?.equipe_id ?? null,
    ativo: profile?.ativo ?? true,
    created_at: createdAt,
    updated_at: updatedAt,
    equipes: profile?.equipes ?? null,
    profile_missing: !profile,
    auth_missing: false,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

async function listAllAuthUsers(admin: ListUsersClient) {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;
    const batch = data.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function listProfilesFallback(warning: string) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_WITH_EQUIPE_SELECT)
    .order("nome");

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        warning,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    items: data ?? [],
    warning,
    source: "profiles_fallback",
  });
}

async function deactivateUserProfile(
  admin: SupabaseAdminClient,
  id: string,
  reason: string
) {
  const updated = await admin
    .from("profiles")
    .update({
      ativo: false,
      equipe_id: null,
    })
    .eq("id", id)
    .select(PROFILE_WITH_EQUIPE_SELECT)
    .maybeSingle();

  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 400 });
  }

  if (!updated.data) {
    return NextResponse.json(
      { error: "Usuário não encontrado no cadastro do app." },
      { status: 404 }
    );
  }

  const authLookup = await admin.auth.admin.getUserById(id).catch(() => null);
  const currentMetadata =
    authLookup && !authLookup.error && authLookup.data.user
      ? ((authLookup.data.user.user_metadata ?? {}) as Record<string, unknown>)
      : {};

  await admin.auth.admin
    .updateUserById(id, {
      user_metadata: {
        ...currentMetadata,
        ativo: false,
        desativado_em: new Date().toISOString(),
      },
    })
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    mode: "deactivated",
    item: updated.data,
    message:
      "Usuário desativado. O histórico foi preservado e este acesso não entra mais no app.",
    detail: reason,
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const adminResult = createAdminClient();
  if ("error" in adminResult) {
    return listProfilesFallback(
      adminResult.error ?? "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor."
    );
  }

  try {
    const admin = adminResult.client;
    const [authUsers, profilesResult] = await Promise.all([
      listAllAuthUsers(admin),
      admin.from("profiles").select(PROFILE_WITH_EQUIPE_SELECT).order("nome"),
    ]);

    if (profilesResult.error) {
      return listProfilesFallback(
        `Falha ao consultar usuarios com service role. Mostrando profiles como fallback. Detalhe: ${profilesResult.error.message}`
      );
    }

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const authIds = new Set(authUsers.map((user) => user.id));

    const merged = authUsers.map((user) => mergeAuthAndProfile(user, byId.get(user.id)));

    // Segurança extra: se sobrou profile órfão, mostre também para o admin limpar.
    for (const profile of profiles) {
      if (!authIds.has(profile.id)) {
        merged.push({
          ...profile,
          profile_missing: false,
          auth_missing: true,
          last_sign_in_at: null,
          email_confirmed_at: null,
        });
      }
    }

    merged.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return NextResponse.json({
      items: merged,
      source: "auth_admin",
    });
  } catch (error) {
    return listProfilesFallback(
      `Falha ao consultar Supabase Auth. Mostrando profiles como fallback. Detalhe: ${
        (error as Error).message
      }`
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const adminResult = createAdminClient();
  if ("error" in adminResult) {
    return NextResponse.json({ error: adminResult.error }, { status: 500 });
  }

  const { id, nome, role, equipe_id, ativo } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }

  const admin = adminResult.client;
  const patch: Record<string, unknown> = {};
  if (nome !== undefined) patch.nome = String(nome).trim();
  if (role !== undefined) patch.role = role;
  if (equipe_id !== undefined) patch.equipe_id = equipe_id || null;
  if (ativo !== undefined) patch.ativo = Boolean(ativo);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nenhum campo para atualizar" }, { status: 400 });
  }

  const existing = await admin
    .from("profiles")
    .select(PROFILE_WITH_EQUIPE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 400 });
  }

  if (!existing.data) {
    const { data: authUser, error: authError } =
      await admin.auth.admin.getUserById(id);
    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message ?? "usuário não encontrado no Auth" },
        { status: 404 }
      );
    }

    const email = authUser.user.email ?? "";
    const upsert = await admin
      .from("profiles")
      .upsert(
        {
          id,
          email,
          nome: String(
            patch.nome || metadataText(authUser.user, "nome") || fallbackName(email)
          ),
          role: normalizeRole(patch.role ?? metadataText(authUser.user, "role")),
          equipe_id: (patch.equipe_id as string | null | undefined) ?? null,
          ativo: (patch.ativo as boolean | undefined) ?? true,
        },
        { onConflict: "id" }
      )
      .select(PROFILE_WITH_EQUIPE_SELECT)
      .single();

    if (upsert.error) {
      return NextResponse.json({ error: upsert.error.message }, { status: 400 });
    }

    return NextResponse.json({ item: upsert.data });
  }

  const updated = await admin
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select(PROFILE_WITH_EQUIPE_SELECT)
    .single();

  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 400 });
  }

  const updatedProfile = updated.data as ProfileRow;
  if (nome !== undefined || role !== undefined) {
    await admin.auth.admin
      .updateUserById(id, {
        user_metadata: {
          nome: updatedProfile.nome,
          role: updatedProfile.role,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ item: updatedProfile });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const adminResult = createAdminClient();
  if ("error" in adminResult) {
    return NextResponse.json({ error: adminResult.error }, { status: 500 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (id === auth.profile.id) {
    return NextResponse.json(
      { error: "Você não pode excluir o próprio usuário logado." },
      { status: 400 }
    );
  }

  const admin = adminResult.client;
  const authDelete = await admin.auth.admin.deleteUser(id);
  if (authDelete.error) {
    const message = authDelete.error.message.toLowerCase();
    if (!message.includes("not found") && !message.includes("user not found")) {
      return deactivateUserProfile(admin, id, authDelete.error.message);
    }
  }

  const profileDelete = await admin.from("profiles").delete().eq("id", id);
  if (profileDelete.error) {
    return deactivateUserProfile(admin, id, profileDelete.error.message);
  }

  return NextResponse.json({
    ok: true,
    mode: "deleted",
    message: "Usuário excluído.",
  });
}
