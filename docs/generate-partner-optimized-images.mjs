import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const partnerImagesDir = path.join(repoRoot, "images", "partenaires");
const optimizedDir = path.join(partnerImagesDir, "optimized");
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

function isPartnerSourceImage(entryName) {
  const extension = path.extname(entryName).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    return false;
  }
  return path.basename(entryName).toLowerCase() !== "logo.png";
}

async function main() {
  const entries = await readdir(partnerImagesDir, { withFileTypes: true });
  const sourceFiles = entries
    .filter((entry) => entry.isFile() && isPartnerSourceImage(entry.name))
    .map((entry) => entry.name);

  await mkdir(optimizedDir, { recursive: true });

  let generatedCount = 0;
  for (const fileName of sourceFiles) {
    const inputPath = path.join(partnerImagesDir, fileName);
    const baseName = path.basename(fileName, path.extname(fileName));
    const outputPath = path.join(optimizedDir, `${baseName}.webp`);

    await sharp(inputPath)
      .rotate()
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true
      })
      .webp({
        quality: WEBP_QUALITY,
        effort: 5
      })
      .toFile(outputPath);

    generatedCount += 1;
  }

  console.log(`${generatedCount} image(s) partenaire optimisee(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
