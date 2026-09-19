import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("service worker privacy", () => {
  it("does not precache or persist authenticated navigation", async () => {
    const source = await readFile("public/sw.js", "utf8");

    expect(source).not.toContain("PRE_CACHE");
    expect(source).not.toContain('c.put(request, clone)');
    expect(source).not.toContain('"/lancamento"');
    expect(source).not.toContain('"/admin"');
    expect(source).toContain('fetch(request, { cache: "no-store" })');
    expect(source).toContain('event.data?.type !== "CLEAR_USER_DATA"');
  });
});
