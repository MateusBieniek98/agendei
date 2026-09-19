import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createManifest,
  verifyManifest,
} from "../scripts/backup-manifest.mjs";

const temporaryDirectories: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, "..");

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function temporaryBackup() {
  const root = await mkdtemp(path.join(tmpdir(), "talhivo-backup-test-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "database"), { recursive: true });
  await mkdir(path.join(root, "storage", "objects"), { recursive: true });
  await writeFile(path.join(root, "database", "schema.sql"), "select 1;\n");
  await writeFile(path.join(root, "storage", "objects", "arquivo.bin"), Buffer.from([1, 2, 3]));
  return root;
}

describe("backup manifest", () => {
  it("creates and verifies every archived file", async () => {
    const root = await temporaryBackup();
    const manifestPath = path.join(root, "manifest.json");

    const manifest = await createManifest(root, manifestPath);
    await expect(verifyManifest(root, manifestPath)).resolves.toEqual(manifest);
    expect(manifest.entries.map((entry) => entry.path)).toEqual([
      "database/schema.sql",
      "storage/objects/arquivo.bin",
    ]);
  });

  it("rejects a modified backup", async () => {
    const root = await temporaryBackup();
    const manifestPath = path.join(root, "manifest.json");
    await createManifest(root, manifestPath);
    await writeFile(path.join(root, "database", "schema.sql"), "select 2;\n");

    await expect(verifyManifest(root, manifestPath)).rejects.toThrow(
      "Checksum divergente"
    );
  });
});

describe("backup shell contracts", () => {
  for (const script of ["backup-supabase.sh", "restore-supabase.sh"]) {
    it(`${script} has valid bash syntax`, () => {
      const result = spawnSync("bash", ["-n", path.join(repositoryRoot, "scripts", script)]);
      expect(result.status, result.stderr.toString()).toBe(0);
    });
  }

  it("encrypts off-site backups and blocks direct production restores", async () => {
    const backup = await readFile(
      path.join(repositoryRoot, "scripts", "backup-supabase.sh"),
      "utf8"
    );
    const restore = await readFile(
      path.join(repositoryRoot, "scripts", "restore-supabase.sh"),
      "utf8"
    );

    expect(backup).toMatch(/age\s+\\\s*\n\s*--encrypt/);
    expect(backup).toContain("rclone copyto");
    expect(backup).toContain("supabase-storage-backup.mjs\" export");
    expect(restore).toContain(
      'RESTORE_TARGET_PROJECT_REF" == "$PRODUCTION_PROJECT_REF'
    );
    expect(restore).toContain('RESTORE_CONFIRM_TARGET" != "RESTORE:');
  });
});
