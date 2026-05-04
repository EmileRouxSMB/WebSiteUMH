import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets", "js", "umh-config.js");
const apiUrl = (process.env.SYNC_PRESTATAIRES_API_URL || "").trim();

function replaceApiUrl(source, nextApiUrl) {
  if (!nextApiUrl) {
    throw new Error("SYNC_PRESTATAIRES_API_URL n'est pas defini.");
  }

  const pattern = /apiUrl:\s*"[^"]*"/;
  if (!pattern.test(source)) {
    throw new Error("Impossible de trouver la propriete apiUrl dans assets/js/umh-config.js.");
  }

  return source.replace(pattern, `apiUrl: ${JSON.stringify(nextApiUrl)}`);
}

async function main() {
  const current = await readFile(configPath, "utf8");
  const next = replaceApiUrl(current, apiUrl);

  if (next === current) {
    console.log("umh-config.js est deja a jour.");
    return;
  }

  await writeFile(configPath, next, "utf8");
  console.log("umh-config.js a ete mis a jour.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
