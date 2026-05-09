import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlanningText } from "@/lib/planning-progress";

export type ServiceMetadataInput = {
  serviceKey?: string | null;
  oldDisplayName?: string | null;
  displayName: string;
  canonicalName?: string | null;
  operationCode?: string | number | null;
  operationName?: string | null;
  unidade?: string | null;
  escalaRendimento?: string | null;
  valorUnitario?: number | null;
  aliases?: string[];
  sourceSpreadsheet?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
  metadata?: Record<string, unknown>;
};

type ServiceRow = {
  id: string;
  service_key: string;
  slug: string;
  display_name: string;
  canonical_name: string | null;
  operation_code: string | null;
  operation_name: string | null;
  unidade: string;
  escala_rendimento: string | null;
  valor_unitario: number | string | null;
  atividade_id: string | null;
  aliases: string[] | null;
  ativo: boolean;
};

type ActivityRow = {
  id: string;
  nome: string;
  unidade: string;
  valor_unitario: number | string | null;
  ativo: boolean;
  service_key?: string | null;
  service_metadata_id?: string | null;
};

type AnySupabase = Pick<SupabaseClient, "from">;

export function cleanServiceText(value: unknown) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function serviceSlug(value: unknown) {
  return normalizePlanningText(cleanServiceText(value))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function stableServiceKey(input: Pick<ServiceMetadataInput, "serviceKey" | "oldDisplayName" | "displayName" | "operationCode" | "escalaRendimento">) {
  const explicit = cleanServiceText(input.serviceKey);
  if (explicit) return explicit;

  const operationCode = cleanServiceText(input.operationCode);
  const escala = cleanServiceText(input.escalaRendimento);
  const displaySlug = serviceSlug(input.displayName);
  if (operationCode && displaySlug && escala) {
    return `op-${operationCode}-${displaySlug}-${serviceSlug(escala)}`;
  }
  if (operationCode && displaySlug) return `op-${operationCode}-${displaySlug}`;
  if (displaySlug && escala) return `srv-${displaySlug}-${serviceSlug(escala)}`;

  return `srv-${serviceSlug(input.oldDisplayName || input.displayName)}`;
}

export function inferServiceUnit(nome: string, unidade?: string | null) {
  const cleanUnit = cleanServiceText(unidade);
  if (cleanUnit) {
    const normalized = normalizePlanningText(cleanUnit);
    if (normalized.includes("quilometro")) return "km";
    if (normalized.includes("hora")) return "h";
    if (normalized.includes("diaria")) return "diaria";
    if (normalized.includes("hectare")) return "ha";
    return cleanUnit;
  }

  const normalized = normalizePlanningText(nome);
  if (normalized.includes(" km") || normalized.includes("tracado km")) return "km";
  if (normalized.includes("hora")) return "h";
  if (normalized.includes("diaria") || normalized.includes("caminhao pipa")) return "diaria";
  return "ha";
}

function uniqueAliases(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const aliases: string[] = [];

  for (const value of values) {
    const clean = cleanServiceText(value);
    if (!clean) continue;
    const normalized = normalizePlanningText(clean);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    aliases.push(clean);
  }

  return aliases;
}

async function findServiceByName(supabase: AnySupabase, name: string) {
  const normalized = normalizePlanningText(name);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("services_metadata")
    .select("*")
    .limit(1000);

  if (error) throw new Error(error.message);

  return ((data ?? []) as ServiceRow[]).find((row) => {
    const candidates = [
      row.display_name,
      row.canonical_name,
      row.service_key,
      ...(row.aliases ?? []),
    ];
    return candidates.some((candidate) => normalizePlanningText(candidate) === normalized);
  }) ?? null;
}

async function findServiceByKey(supabase: AnySupabase, serviceKey: string) {
  const key = cleanServiceText(serviceKey);
  if (!key) return null;

  const { data, error } = await supabase
    .from("services_metadata")
    .select("*")
    .eq("service_key", key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ServiceRow | null) ?? null;
}

async function findActivityForService(
  supabase: AnySupabase,
  serviceKey: string,
  displayName: string
) {
  const key = cleanServiceText(serviceKey);
  if (key) {
    const { data, error } = await supabase
      .from("atividades")
      .select("id, nome, unidade, valor_unitario, ativo, service_key, service_metadata_id")
      .eq("service_key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as ActivityRow;
  }

  const name = cleanServiceText(displayName);
  if (!name) return null;

  const { data, error } = await supabase
    .from("atividades")
    .select("id, nome, unidade, valor_unitario, ativo, service_key, service_metadata_id")
    .eq("nome", name)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ActivityRow | null) ?? null;
}

async function upsertActivityForService(
  supabase: AnySupabase,
  service: ServiceRow,
  input: ServiceMetadataInput
) {
  const unidade = inferServiceUnit(input.displayName, input.unidade ?? service.unidade);
  const valorUnitario = input.valorUnitario ?? Number(service.valor_unitario ?? 0);
  let activity: ActivityRow | null = null;

  if (service.atividade_id) {
    const { data, error } = await supabase
      .from("atividades")
      .update({
        nome: input.displayName,
        unidade,
        valor_unitario: valorUnitario,
        ativo: service.ativo,
        service_key: service.service_key,
        service_metadata_id: service.id,
      })
      .eq("id", service.atividade_id)
      .select("id, nome, unidade, valor_unitario, ativo, service_key, service_metadata_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    activity = (data as ActivityRow | null) ?? null;
  }

  if (!activity) {
    const existing = await findActivityForService(
      supabase,
      service.service_key,
      input.displayName
    );

    if (existing) {
      const { data, error } = await supabase
        .from("atividades")
        .update({
          nome: input.displayName,
          unidade,
          valor_unitario: valorUnitario,
          ativo: service.ativo,
          service_key: service.service_key,
          service_metadata_id: service.id,
        })
        .eq("id", (existing as ActivityRow).id)
        .select("id, nome, unidade, valor_unitario, ativo, service_key, service_metadata_id")
        .single();
      if (error) throw new Error(error.message);
      activity = data as ActivityRow;
    }
  }

  if (!activity) {
    const { data, error } = await supabase
      .from("atividades")
      .insert({
        nome: input.displayName,
        unidade,
        valor_unitario: valorUnitario,
        ativo: service.ativo,
        service_key: service.service_key,
        service_metadata_id: service.id,
      })
      .select("id, nome, unidade, valor_unitario, ativo, service_key, service_metadata_id")
      .single();
    if (error) throw new Error(error.message);
    activity = data as ActivityRow;
  }

  if (activity.id !== service.atividade_id) {
    const { error } = await supabase
      .from("services_metadata")
      .update({ atividade_id: activity.id })
      .eq("id", service.id);
    if (error) throw new Error(error.message);
  }

  return activity;
}

export async function upsertServiceMetadata(
  supabase: AnySupabase,
  input: ServiceMetadataInput
) {
  const displayName = cleanServiceText(input.displayName);
  if (!displayName) throw new Error("Nome do servico vazio.");

  const explicitServiceKey = cleanServiceText(input.serviceKey);
  const existingByKey = explicitServiceKey
    ? await findServiceByKey(supabase, explicitServiceKey)
    : null;
  const existingByOldName = input.oldDisplayName
    ? await findServiceByName(supabase, input.oldDisplayName)
    : null;
  const existingByDisplayName = await findServiceByName(supabase, displayName);
  const existingService = existingByKey ?? existingByOldName ?? existingByDisplayName;
  const serviceKey = existingService?.service_key ?? stableServiceKey({ ...input, displayName });
  const slug = serviceSlug(serviceKey);
  const canonicalName = cleanServiceText(input.canonicalName) || displayName;
  const unidade = inferServiceUnit(displayName, input.unidade);
  const aliases = uniqueAliases([
    ...(existingService?.aliases ?? []),
    input.oldDisplayName,
    displayName,
    canonicalName,
    ...(input.aliases ?? []),
  ]);

  const payload = {
    service_key: serviceKey,
    slug,
    display_name: displayName,
    canonical_name: canonicalName,
    operation_code: cleanServiceText(input.operationCode) || null,
    operation_name: cleanServiceText(input.operationName) || null,
    unidade,
    escala_rendimento: cleanServiceText(input.escalaRendimento) || null,
    valor_unitario: input.valorUnitario ?? existingService?.valor_unitario ?? 0,
    aliases,
    source_spreadsheet: cleanServiceText(input.sourceSpreadsheet) || null,
    source_sheet: cleanServiceText(input.sourceSheet) || null,
    source_row: input.sourceRow ?? null,
    metadata: input.metadata ?? {},
    ativo: true,
    last_synced_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("services_metadata")
    .upsert(payload, { onConflict: "service_key" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const service = data as ServiceRow;
  const atividade = await upsertActivityForService(supabase, service, input);

  return { service: { ...service, atividade_id: atividade.id }, atividade };
}
