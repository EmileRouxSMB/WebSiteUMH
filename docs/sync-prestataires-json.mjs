import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets", "js", "umh-config.js");
const targetPath = path.join(repoRoot, "data", "prestataires.json");

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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getInstagramHandle(value) {
  let raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  raw = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  raw = raw.replace(/^@/, "");
  return raw.split(/[/?#]/)[0].trim().toLowerCase();
}

function buildPrestataireKey(prestataire) {
  const instagramHandle = getInstagramHandle(prestataire && prestataire.instagram);
  if (instagramHandle) {
    return `instagram:${instagramHandle}`;
  }

  const nomCommercial = normalizeText(prestataire && prestataire.nomCommercial);
  if (nomCommercial) {
    return `nom:${nomCommercial}`;
  }

  return "";
}

function mergeExistingPhotoFields(nextData, currentData) {
  const currentPrestataires = Array.isArray(currentData && currentData.prestataires)
    ? currentData.prestataires
    : [];

  const currentByKey = new Map();
  currentPrestataires.forEach((prestataire) => {
    const key = buildPrestataireKey(prestataire);
    if (key) {
      currentByKey.set(key, prestataire);
    }
  });

  nextData.prestataires = nextData.prestataires.map((prestataire) => {
    const key = buildPrestataireKey(prestataire);
    if (!key) {
      return prestataire;
    }

    const currentPrestataire = currentByKey.get(key);
    if (!currentPrestataire) {
      return prestataire;
    }

    if (!String(prestataire.photo || "").trim() && String(currentPrestataire.photo || "").trim()) {
      prestataire.photo = currentPrestataire.photo;
    }

    return prestataire;
  });
}

async function main() {
  const configSource = await readFile(configPath, "utf8");
  const apiUrl = extractApiUrl(configSource);
  if (!apiUrl) {
    throw new Error("apiUrl est vide dans assets/js/umh-config.js.");
  }

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Echec de recuperation du JSON (${response.status}).`);
  }

  const rawBody = await response.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (error) {
    const excerpt = rawBody.slice(0, 400).replace(/\s+/g, " ").trim();
    throw new Error(`La reponse Google Apps Script n'est pas un JSON valide. Extrait: ${excerpt}`);
  }

  validatePayload(data);

  let current = "";
  try {
    current = await readFile(targetPath, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  let currentData = null;
  if (current) {
    currentData = JSON.parse(current);
    mergeExistingPhotoFields(data, currentData);
  }

  const formatted = JSON.stringify(data, null, 2) + "\n";

  if (current === formatted) {
    console.log("prestataires.json est deja a jour.");
    return;
  }

  await writeFile(targetPath, formatted, "utf8");
  console.log("prestataires.json a ete mis a jour.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
