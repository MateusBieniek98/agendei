import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const STORAGE_MANIFEST = "storage-manifest.json";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
}

function projectRef(url) {
  const hostname = new URL(url).hostname;
  const suffix = ".supabase.co";
  if (!hostname.endsWith(suffix)) throw new Error("URL Supabase invalida.");
  return hostname.slice(0, -suffix.length);
}

function localObjectPath(root, bucket, objectPath) {
  if (
    typeof bucket !== "string" ||
    bucket.length === 0 ||
    bucket.includes("\0") ||
    typeof objectPath !== "string" ||
    objectPath.length === 0 ||
    objectPath.includes("\0")
  ) {
    throw new Error("Identificador de objeto invalido.");
  }
  const bucketKey = createHash("sha256").update(bucket).digest("hex");
  const objectKey = createHash("sha256").update(objectPath).digest("hex");
  return path.resolve(root, "objects", bucketKey, objectKey);
}

async function listObjects(client, bucket, prefix = "") {
  const objects = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Falha ao listar Storage: ${error.message}`);
    const page = data ?? [];

    for (const item of page) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id || item.metadata) {
        objects.push({ path: itemPath, metadata: item.metadata ?? {} });
      } else {
        objects.push(...(await listObjects(client, bucket, itemPath)));
      }
    }

    if (page.length < 1000) break;
    offset += page.length;
  }

  return objects;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function exportStorage(root) {
  const url = required("BACKUP_SUPABASE_URL");
  const serviceKey = required("BACKUP_SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error(`Falha ao listar buckets: ${error.message}`);

  const manifest = {
    formatVersion: 1,
    sourceProjectRef: projectRef(url),
    buckets: [],
  };
  let objectCount = 0;

  for (const bucket of buckets ?? []) {
    const objects = await listObjects(client, bucket.id);
    const bucketEntry = {
      id: bucket.id,
      name: bucket.name,
      public: bucket.public === true,
      fileSizeLimit: bucket.file_size_limit ?? null,
      allowedMimeTypes: bucket.allowed_mime_types ?? null,
      objects: [],
    };

    for (const object of objects) {
      const { data, error: downloadError } = await client.storage
        .from(bucket.id)
        .download(object.path);
      if (downloadError || !data) {
        throw new Error(`Falha ao baixar objeto do Storage: ${downloadError?.message ?? "sem dados"}`);
      }
      const content = Buffer.from(await data.arrayBuffer());
      const destination = localObjectPath(root, bucket.id, object.path);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, content, { mode: 0o600 });
      bucketEntry.objects.push({
        path: object.path,
        bytes: content.length,
        sha256: sha256(content),
        contentType: object.metadata?.mimetype ?? null,
        cacheControl: object.metadata?.cacheControl ?? null,
      });
      objectCount += 1;
    }

    manifest.buckets.push(bucketEntry);
  }

  await writeFile(
    path.join(root, STORAGE_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 }
  );
  process.stdout.write(`${manifest.buckets.length} buckets e ${objectCount} objetos exportados.\n`);
}

async function restoreStorage(root) {
  const url = required("RESTORE_SUPABASE_URL");
  const serviceKey = required("RESTORE_SUPABASE_SERVICE_ROLE_KEY");
  const targetRef = projectRef(url);
  const productionRef = required("PRODUCTION_PROJECT_REF");
  const confirmation = required("RESTORE_CONFIRM_TARGET");
  if (targetRef === productionRef) throw new Error("Restauracao direta em producao bloqueada.");
  if (confirmation !== `RESTORE:${targetRef}`) throw new Error("Confirmacao do destino invalida.");

  const manifest = JSON.parse(await readFile(path.join(root, STORAGE_MANIFEST), "utf8"));
  if (manifest?.formatVersion !== 1 || !Array.isArray(manifest?.buckets)) {
    throw new Error("Manifesto de Storage invalido.");
  }
  if (manifest.sourceProjectRef === targetRef) {
    throw new Error("Origem e destino do Storage nao podem ser iguais.");
  }

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: existingBuckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`Falha ao listar buckets de destino: ${listError.message}`);
  const existing = new Set((existingBuckets ?? []).map((bucket) => bucket.id));
  let restored = 0;

  for (const bucket of manifest.buckets) {
    if (typeof bucket.id !== "string" || bucket.id.length === 0 || !Array.isArray(bucket.objects)) {
      throw new Error("Bucket invalido no manifesto.");
    }
    const options = {
      public: bucket.public === true,
      ...(bucket.fileSizeLimit == null ? {} : { fileSizeLimit: bucket.fileSizeLimit }),
      ...(bucket.allowedMimeTypes == null ? {} : { allowedMimeTypes: bucket.allowedMimeTypes }),
    };
    const bucketResult = existing.has(bucket.id)
      ? await client.storage.updateBucket(bucket.id, options)
      : await client.storage.createBucket(bucket.id, options);
    if (bucketResult.error) {
      throw new Error(`Falha ao preparar bucket: ${bucketResult.error.message}`);
    }

    for (const object of bucket.objects) {
      const source = localObjectPath(root, bucket.id, object.path);
      const content = await readFile(source);
      if (content.length !== object.bytes || sha256(content) !== object.sha256) {
        throw new Error("Objeto de Storage diverge do manifesto.");
      }
      const { error: uploadError } = await client.storage.from(bucket.id).upload(
        object.path,
        content,
        {
          upsert: true,
          ...(object.contentType ? { contentType: object.contentType } : {}),
          ...(object.cacheControl ? { cacheControl: object.cacheControl } : {}),
        }
      );
      if (uploadError) throw new Error(`Falha ao restaurar objeto: ${uploadError.message}`);
      restored += 1;
    }
  }

  process.stdout.write(`${manifest.buckets.length} buckets e ${restored} objetos restaurados.\n`);
}

async function main() {
  const [command, directory] = process.argv.slice(2);
  if (!directory || !["export", "restore"].includes(command)) {
    throw new Error("Uso: supabase-storage-backup.mjs export|restore <diretorio>");
  }
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (command === "export") await exportStorage(root);
  else await restoreStorage(root);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha no Storage."}\n`);
    process.exitCode = 1;
  });
}
