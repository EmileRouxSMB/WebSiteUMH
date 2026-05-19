import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets", "js", "umh-config.js");
const targetPath = path.join(repoRoot, "data", "prestataires.json");
const partnerImagesDir = path.join(repoRoot, "images", "partenaires");
const apiUrlOverride = (process.env.SYNC_PRESTATAIRES_API_URL || "").trim();
const partnerImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

function extractApiUrl(configSource) {
  const match = configSource.match(/apiUrl:\s*"([^"]*)"/);
  return match ? match[1].trim() : "";
}

function validatePayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Le JSON distant doit etre un objet.");
  }

  if (!Array.isArray(data.prestataires)) {
    throw new Error("Le JSON distant doit contenir un tableau prestataires.");
  }

  if (!Array.isArray(data.typeDePrestationOptions)) {
    throw new Error("Le JSON distant doit contenir un tableau typeDePrestationOptions.");
  }
}

async function fetchRemoteJson(apiUrl, includeImages) {
  const url = new URL(apiUrl);
  if (includeImages) {
    url.searchParams.set("includeImages", "1");
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const bodyExcerpt = (await response.text()).slice(0, 400).replace(/\s+/g, " ").trim();
    throw new Error(
      [
        `Echec de recuperation du JSON (${response.status} ${response.statusText}).`,
        `URL demandee: ${url.toString()}`,
        `URL finale: ${response.url}`,
        bodyExcerpt ? `Extrait de la reponse: ${bodyExcerpt}` : ""
      ].filter(Boolean).join("\n")
    );
  }

  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const excerpt = rawBody.slice(0, 400).replace(/\s+/g, " ").trim();
    throw new Error(`La reponse Google Apps Script n'est pas un JSON valide. Extrait: ${excerpt}`);
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function findExistingPartnerImagePath(handle) {
  for (const extension of partnerImageExtensions) {
    const existingPath = path.join(partnerImagesDir, `${handle}${extension}`);
    if (await fileExists(existingPath)) {
      return existingPath;
    }
  }
  return "";
}

function normalizePhotoSync(prestataire) {
  const photoSync = prestataire && prestataire.photoSync;
  if (!photoSync || typeof photoSync !== "object") {
    return null;
  }

  const handle = String(photoSync.handle || "").trim().toLowerCase();
  const extension = String(photoSync.extension || "").trim().toLowerCase();
  const mimeType = String(photoSync.mimeType || "").trim();
  const data = String(photoSync.data || "").trim();

  if (!handle || !partnerImageExtensions.includes(extension) || !mimeType || !data) {
    return null;
  }

  return { handle, extension, mimeType, data };
}

async function syncPartnerImages(data) {
  let downloadedCount = 0;
  const prestataires = Array.isArray(data && data.prestataires) ? data.prestataires : [];
  await mkdir(partnerImagesDir, { recursive: true });

  for (const prestataire of prestataires) {
    const photoSync = normalizePhotoSync(prestataire);
    delete prestataire.photoSync;

    if (!photoSync) {
      continue;
    }

    const existingPath = await findExistingPartnerImagePath(photoSync.handle);
    if (!String(prestataire.photo || "").trim()) {
      prestataire.photo = photoSync.handle;
    }

    if (existingPath) {
      continue;
    }

    const nextPath = path.join(partnerImagesDir, `${photoSync.handle}${photoSync.extension}`);
    const buffer = Buffer.from(photoSync.data, "base64");
    await writeFile(nextPath, buffer);
    downloadedCount += 1;
  }

  return downloadedCount;
}

async function main() {
  const configSource = await readFile(configPath, "utf8");
  const apiUrl = apiUrlOverride || extractApiUrl(configSource);
  if (!apiUrl) {
    throw new Error("apiUrl est vide dans assets/js/umh-config.js et SYNC_PRESTATAIRES_API_URL n'est pas defini.");
  }

  const data = await fetchRemoteJson(apiUrl, true);
  validatePayload(data);
  const downloadedImages = await syncPartnerImages(data);

  let current = "";
  try {
    current = await readFile(targetPath, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  const formatted = JSON.stringify(data, null, 2) + "\n";

  if (current === formatted) {
    if (downloadedImages > 0) {
      console.log(`${downloadedImages} image(s) prestataire ajoutee(s).`);
      console.log("prestataires.json est deja a jour.");
      return;
    }
    console.log("prestataires.json est deja a jour.");
    return;
  }

  await writeFile(targetPath, formatted, "utf8");
  if (downloadedImages > 0) {
    console.log(`${downloadedImages} image(s) prestataire ajoutee(s).`);
  }
  console.log("prestataires.json a ete mis a jour.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
