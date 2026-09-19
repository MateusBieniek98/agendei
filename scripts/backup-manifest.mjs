import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, lstat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT_VERSION = 1;

function safeRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value)
  ) {
    throw new Error("Caminho invalido no manifesto.");
  }

  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Caminho fora do backup.");
  }
  return normalized;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function walkFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Links simbolicos nao sao permitidos no backup.");
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, absolute)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error("Entrada nao regular encontrada no backup.");
    }

    files.push(path.relative(root, absolute).split(path.sep).join("/"));
  }

  return files;
}

export async function createManifest(rootPath, manifestPath) {
  const root = path.resolve(rootPath);
  const manifest = path.resolve(manifestPath);
  const manifestRelative = path.relative(root, manifest).split(path.sep).join("/");
  const files = (await walkFiles(root)).filter((file) => file !== manifestRelative);
  const entries = [];

  for (const file of files) {
    const safePath = safeRelativePath(file);
    const absolute = path.join(root, ...safePath.split("/"));
    const stats = await lstat(absolute);
    entries.push({
      path: safePath,
      bytes: stats.size,
      sha256: await sha256File(absolute),
    });
  }

  const payload = {
    formatVersion: FORMAT_VERSION,
    algorithm: "sha256",
    entries,
  };
  await writeFile(manifest, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return payload;
}

export async function verifyManifest(rootPath, manifestPath) {
  const root = path.resolve(rootPath);
  const manifest = path.resolve(manifestPath);
  const parsed = JSON.parse(await readFile(manifest, "utf8"));
  if (
    parsed?.formatVersion !== FORMAT_VERSION ||
    parsed?.algorithm !== "sha256" ||
    !Array.isArray(parsed?.entries)
  ) {
    throw new Error("Formato de manifesto nao suportado.");
  }

  const expectedPaths = new Set();
  for (const entry of parsed.entries) {
    const safePath = safeRelativePath(entry?.path);
    if (expectedPaths.has(safePath)) throw new Error("Arquivo duplicado no manifesto.");
    expectedPaths.add(safePath);

    const absolute = path.join(root, ...safePath.split("/"));
    const stats = await lstat(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Entrada insegura no backup.");
    }
    if (stats.size !== entry.bytes || (await sha256File(absolute)) !== entry.sha256) {
      throw new Error("Checksum divergente no backup.");
    }
  }

  const manifestRelative = path.relative(root, manifest).split(path.sep).join("/");
  const actualPaths = (await walkFiles(root)).filter((file) => file !== manifestRelative);
  if (
    actualPaths.length !== expectedPaths.size ||
    actualPaths.some((file) => !expectedPaths.has(file))
  ) {
    throw new Error("Conteudo do backup difere do manifesto.");
  }

  return parsed;
}

async function main() {
  const [command, firstPath, secondPath] = process.argv.slice(2);
  if (command === "create" && firstPath && secondPath) {
    const manifest = await createManifest(firstPath, secondPath);
    process.stdout.write(`${manifest.entries.length} arquivos catalogados.\n`);
    return;
  }
  if (command === "verify" && firstPath && secondPath) {
    const manifest = await verifyManifest(firstPath, secondPath);
    process.stdout.write(`${manifest.entries.length} arquivos verificados.\n`);
    return;
  }
  if (command === "digest" && firstPath && !secondPath) {
    process.stdout.write(`${await sha256File(path.resolve(firstPath))}\n`);
    return;
  }
  throw new Error(
    "Uso: backup-manifest.mjs create|verify <diretorio> <manifesto> ou digest <arquivo>"
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha no manifesto."}\n`);
    process.exitCode = 1;
  });
}
