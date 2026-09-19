import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const projectRoot = process.cwd();
const staticRoot = path.join(projectRoot, ".next", "static");
const budgetPath = path.join(projectRoot, "performance-budget.json");

async function collectAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await collectAssets(fullPath)));
      continue;
    }
    if (!/\.(?:js|css)$/.test(entry.name)) continue;

    const content = await readFile(fullPath);
    assets.push({
      path: path.relative(projectRoot, fullPath),
      type: path.extname(entry.name),
      bytes: (await stat(fullPath)).size,
      gzipBytes: gzipSync(content).length,
    });
  }

  return assets;
}

const budget = JSON.parse(await readFile(budgetPath, "utf8"));
const assets = await collectAssets(staticRoot);
const totalClientGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
const largestJavaScript = assets
  .filter((asset) => asset.type === ".js")
  .sort((a, b) => b.gzipBytes - a.gzipBytes)[0];
const largestStylesheet = assets
  .filter((asset) => asset.type === ".css")
  .sort((a, b) => b.gzipBytes - a.gzipBytes)[0];

const violations = [];

if (totalClientGzipBytes > budget.totalClientGzipBytes) {
  violations.push(
    `Total gzip do cliente: ${totalClientGzipBytes} > ${budget.totalClientGzipBytes} bytes`,
  );
}
if (largestJavaScript?.gzipBytes > budget.maxJavaScriptChunkGzipBytes) {
  violations.push(
    `Maior chunk JS (${largestJavaScript.path}): ${largestJavaScript.gzipBytes} > ${budget.maxJavaScriptChunkGzipBytes} bytes`,
  );
}
if (largestStylesheet?.gzipBytes > budget.maxStylesheetGzipBytes) {
  violations.push(
    `Maior CSS (${largestStylesheet.path}): ${largestStylesheet.gzipBytes} > ${budget.maxStylesheetGzipBytes} bytes`,
  );
}

console.log(
  JSON.stringify(
    {
      assets: assets.length,
      totalClientGzipBytes,
      largestJavaScript,
      largestStylesheet,
      budget,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  console.error(`Orçamento de performance excedido:\n- ${violations.join("\n- ")}`);
  process.exitCode = 1;
}
