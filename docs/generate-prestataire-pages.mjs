import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "prestataires.json");
const payhipProductsPath = path.join(repoRoot, "data", "payhip-products.js");
const outputDir = path.join(repoRoot, "prestataires");
const sitemapPath = path.join(repoRoot, "sitemap.xml");
const siteOrigin = "https://www.unmariageheureux.com";
const siteHomeUrl = `${siteOrigin}/`;
const optimizedImagesDir = path.join(repoRoot, "images", "partenaires", "optimized");
const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const staticIndexableUrls = [
  `${siteOrigin}/conditions-generales-prestataires.html`,
  `${siteOrigin}/conditions-generales-site-et-vente.html`
];

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeExternalUrl(url, label) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;

  const cleanLabel = String(label || "").toLowerCase();
  const handle = raw.startsWith("@") ? raw.slice(1) : raw;
  if (cleanLabel === "instagram") return `https://www.instagram.com/${handle}`;
  if (cleanLabel === "facebook") return `https://www.facebook.com/${handle}`;
  if (cleanLabel === "tiktok") return `https://www.tiktok.com/@${handle}`;
  return `https://${raw}`;
}

function truncateText(value, maxChars) {
  const raw = normalizeWhitespace(value);
  if (!raw || raw.length <= maxChars) return raw;
  const cutoff = raw.slice(0, maxChars + 1);
  const lastSpace = cutoff.lastIndexOf(" ");
  const truncated = (lastSpace > Math.floor(maxChars * 0.6) ? cutoff.slice(0, lastSpace) : raw.slice(0, maxChars)).trim();
  return `${truncated}...`;
}

function clampText(value, maxChars) {
  const raw = normalizeWhitespace(value);
  if (!raw || raw.length <= maxChars) return raw;
  const cutoff = raw.slice(0, maxChars + 1);
  const lastSpace = cutoff.lastIndexOf(" ");
  return (lastSpace > Math.floor(maxChars * 0.6) ? cutoff.slice(0, lastSpace) : raw.slice(0, maxChars)).trim();
}

function buildMetaDescription(primaryText, fallbackText, maxChars = 155) {
  const rawPrimary = normalizeWhitespace(primaryText);
  const candidate = clampText(primaryText, maxChars);
  if (rawPrimary.length > maxChars) {
    const punctuationCandidates = [".", "!", "?", ";", ":", ","];
    let bestBoundary = -1;
    for (const token of punctuationCandidates) {
      const index = rawPrimary.lastIndexOf(token, maxChars);
      if (index > bestBoundary) {
        bestBoundary = index;
      }
    }
    if (bestBoundary >= 100) {
      return rawPrimary.slice(0, bestBoundary + 1).trim();
    }
  }
  if (candidate) return candidate;
  return clampText(fallbackText, maxChars);
}

function buildSlug(prestataire, usedSlugs) {
  const base = slugify(prestataire.nomCommercial) || "prestataire";
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }

  const stableKey = [
    prestataire.nomCommercial,
    prestataire.email,
    prestataire.instagram,
    prestataire.siteWeb
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
  const suffix = crypto.createHash("sha1").update(stableKey).digest("hex").slice(0, 6);
  const withSuffix = `${base}-${suffix}`;
  if (!usedSlugs.has(withSuffix)) {
    usedSlugs.add(withSuffix);
    return withSuffix;
  }

  let i = 2;
  while (usedSlugs.has(`${withSuffix}-${i}`)) {
    i += 1;
  }
  const fallback = `${withSuffix}-${i}`;
  usedSlugs.add(fallback);
  return fallback;
}

function formatPhoneForDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const compact = raw.replace(/[^\d+]/g, "");
  if (!compact) return raw;

  if (compact.startsWith("+33")) {
    return formatPhoneForDisplay(`0${compact.slice(3)}`);
  }

  const digits = compact.replace(/\D/g, "");
  const normalized = digits.length === 9 ? `0${digits}` : digits;
  if (!/^0\d{9}$/.test(normalized)) return raw;
  return normalized.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

async function findPhoto(prestataire) {
  const handle = String(prestataire.photo || "").trim().toLowerCase();
  if (!handle) return "../images/logo.png";
  for (const ext of [".webp"]) {
    const candidate = path.join(optimizedImagesDir, `${handle}${ext}`);
    try {
      await readFile(candidate);
      return `../images/partenaires/optimized/${handle}${ext}`;
    } catch {}
  }
  for (const ext of imageExtensions) {
    const candidate = path.join(repoRoot, "images", "partenaires", `${handle}${ext}`);
    try {
      await readFile(candidate);
      return `../images/partenaires/${handle}${ext}`;
    } catch {}
  }
  for (const ext of imageExtensions) {
    const candidate = path.join(repoRoot, "images", "partenaires", "thumbs", `${handle}${ext}`);
    try {
      await readFile(candidate);
      return `../images/partenaires/thumbs/${handle}${ext}`;
    } catch {}
  }
  return "../images/logo.png";
}

function buildSocialLinks(prestataire) {
  const links = [];
  const instagram = normalizeExternalUrl(prestataire.instagram, "instagram");
  const facebook = normalizeExternalUrl(prestataire.facebook, "facebook");
  if (instagram) {
    links.push(`<a href="${escapeHtml(instagram)}" target="_blank" rel="noopener" class="annuaire-social annuaire-social-icon annuaire-outbound" data-link-label="Instagram" data-source-area="fiche_prestataire_r4" aria-label="Instagram"><img src="../images/instagram.png" alt="Instagram" class="annuaire-social-image"></a>`);
  }
  if (facebook) {
    links.push(`<a href="${escapeHtml(facebook)}" target="_blank" rel="noopener" class="annuaire-social annuaire-social-icon annuaire-outbound" data-link-label="Facebook" data-source-area="fiche_prestataire_r4" aria-label="Facebook"><img src="../images/logo-facebook.png" alt="Facebook" class="annuaire-social-image"></a>`);
  }
  return links.length ? `<div class="fiche-socials">${links.join("")}</div>` : "";
}

function pickPayhipProduct(products, slug) {
  if (!Array.isArray(products) || !products.length) return null;
  const hash = crypto.createHash("sha1").update(String(slug || "")).digest();
  const index = hash[0] % products.length;
  return products[index] || null;
}

function buildPayhipProductEmbed(product) {
  if (!product || !product.key) return "";
  const title = String(product.title || "").trim() || "Produit APIPE";
  const key = String(product.key || "").trim();
  return `<section class="fiche-payhip" aria-label="Produit recommande">
              <p class="fiche-payhip-eyebrow">Pour aller plus loin</p>
              <h4 class="fiche-payhip-title">${escapeHtml(title)}</h4>
              <div class="payhip-embed-page" data-key="${escapeHtml(key)}">...</div>
            </section>`;
}

async function renderPrestatairePage(prestataire, slug, payhipProducts) {
  const types = toArray(prestataire.typeDePrestation).join(" / ");
  const departements = toArray(prestataire.departementsCouverts)
    .map((value) => String(value).trim().toUpperCase() === "ALL" ? "France entiere" : String(value).trim().toUpperCase())
    .filter(Boolean)
    .join(", ");
  const siteWeb = normalizeExternalUrl(prestataire.siteWeb, "site web");
  const phoneDisplay = formatPhoneForDisplay(prestataire.numeroDeTel);
  const photo = await findPhoto(prestataire);
  const titleParts = [prestataire.nomCommercial, types || "Prestataire mariage", "Un Mariage Heureux"].filter(Boolean);
  const title = titleParts.join(" | ");
  const descriptionSource = prestataire.personnalisationUMH || prestataire.descriptionDesPrestationsProposees || "";
  const metaDescription = buildMetaDescription(
    descriptionSource,
    `${prestataire.nomCommercial} est reference sur Un Mariage Heureux pour vous aider a trouver un prestataire mariage adapte a votre projet.`
  );
  const canonical = `${siteOrigin}/prestataires/${slug}.html`;
  const payhipProduct = pickPayhipProduct(payhipProducts, slug);
  const payhipProductEmbed = buildPayhipProductEmbed(payhipProduct);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: prestataire.nomCommercial || "",
    description: clampText(prestataire.descriptionDesPrestationsProposees || descriptionSource, 300),
    areaServed: toArray(prestataire.departementsCouverts).map((value) => String(value).trim().toUpperCase()),
    email: prestataire.email || undefined,
    telephone: prestataire.numeroDeTel || undefined,
    url: siteWeb || canonical,
    sameAs: [
      normalizeExternalUrl(prestataire.instagram, "instagram"),
      normalizeExternalUrl(prestataire.facebook, "facebook"),
      normalizeExternalUrl(prestataire.tiktok, "tiktok")
    ].filter(Boolean)
  };

  return `<!doctype html>
<html lang="fr">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-0GCKXB9161"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("js", new Date());
    gtag("config", "G-0GCKXB9161");
  </script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(siteOrigin + photo.replace("..", ""))}">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="${escapeHtml(siteOrigin + photo.replace("..", ""))}">
  <link rel="stylesheet" href="../assets/css/main.css">
  <link rel="stylesheet" href="../assets/css/annuaire.css">
  <script src="../data/payhip-products.js"></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="single-page-annuaire is-fiche-prestataire-visible">
  <div id="wrapper">
    <header id="header">
      <nav>
        <ul>
          <li class="nav-logo-item"><a href="https://shop.unmariageheureux.com/" class="nav-logo-link" aria-label="Un Mariage Heureux"><img src="../images/logo.png" alt=""></a></li>
          <li><a href="https://shop.unmariageheureux.com/mariage">La boutique Mariage</a></li>
          <li><a href="https://shop.unmariageheureux.com/blog/le-guide-du-mariage-heureux">Blog</a></li>
          <li><a href="../index.html#annuaire">Nos partenaires</a></li>
          <li><a href="https://shop.unmariageheureux.com/faq">FAQ</a></li>
          <li><a href="https://shop.unmariageheureux.com/contact">Contact</a></li>
          <li><a href="../nouveau-prestataire.html">Inscription prestataire</a></li>
        </ul>
      </nav>
      <div class="content">
        <div class="inner">
          <h1>${escapeHtml(prestataire.nomCommercial || "Prestataire mariage")}</h1>
          <p>${escapeHtml(types || "Prestataire mariage")}</p>
          <p><a href="../index.html#annuaire">Retour a l'annuaire</a></p>
        </div>
      </div>
    </header>
    <div id="main">
      <article id="fiche-prestataire">
        <h2 class="major">Notre partenaire</h2>
        <p class="fiche-return">
          <a href="../index.html#annuaire" class="fiche-return-link">Retour a nos partenaires</a>
        </p>
        <div class="fiche-shell">
          <div class="fiche-media">
            <img class="fiche-image" src="${escapeHtml(photo)}" alt="${escapeHtml(prestataire.nomCommercial || "Photo prestataire")}" loading="lazy" decoding="async">
          </div>
          <div class="fiche-content">
            <p class="fiche-type">${escapeHtml(types || "Prestataire mariage")}</p>
            <h3>${escapeHtml(prestataire.nomCommercial || "Prestataire mariage")}</h3>
            ${prestataire.personnalisationUMH ? `<p class="fiche-lead">${escapeHtml(prestataire.personnalisationUMH)}</p>` : ""}
            ${prestataire.descriptionDesPrestationsProposees ? `<p class="fiche-description">${escapeHtml(prestataire.descriptionDesPrestationsProposees)}</p>` : ""}
            <div class="fiche-details">
              ${prestataire.email ? `<p class="fiche-detail"><strong>Email</strong> <a href="mailto:${escapeHtml(prestataire.email)}">${escapeHtml(prestataire.email)}</a></p>` : ""}
              ${phoneDisplay ? `<p class="fiche-detail"><strong>Telephone</strong> <span>${escapeHtml(phoneDisplay)}</span></p>` : ""}
              ${departements ? `<p class="fiche-detail"><strong>Departements</strong> <span>${escapeHtml(departements)}</span></p>` : ""}
            </div>
            <div class="fiche-actions">
              ${siteWeb ? `<a href="${escapeHtml(siteWeb)}" class="fiche-site-link annuaire-outbound" rel="noopener" target="_blank" data-link-label="Site web" data-source-area="fiche_prestataire_r4">En savoir plus</a>` : ""}
              ${buildSocialLinks(prestataire)}
            </div>
          </div>
        </div>
        <p class="fiche-return">
          <a href="../index.html#annuaire" class="fiche-return-link">Retour a nos partenaires</a>
        </p>
        ${payhipProductEmbed}
      </article>
    </div>
  </div>
  <script>
    (function () {
      var outboundLinks = document.querySelectorAll(".annuaire-outbound");
      if (!outboundLinks || !outboundLinks.length) return;
      outboundLinks.forEach(function (link) {
        link.addEventListener("click", function () {
          if (typeof window.gtag !== "function") return;
          window.gtag("event", "presta_outbound_click", {
            nomCommercial: ${JSON.stringify(prestataire.nomCommercial || "")},
            prestataireNom: ${JSON.stringify(prestataire.nomCommercial || "")},
            ficheSlug: ${JSON.stringify(slug)},
            ficheUrl: ${JSON.stringify(`prestataires/${slug}.html`)},
            typeActivite: ${JSON.stringify(types || "")},
            linkLabel: String(link.getAttribute("data-link-label") || ""),
            sourceArea: String(link.getAttribute("data-source-area") || ""),
            href: String(link.getAttribute("href") || "")
          });
        });
      });
    })();

    (function () {
      var embed = document.querySelector(".payhip-embed-page");
      if (!embed) return;

      var payhipConfig = window.UMH_PAYHIP_PRODUCTS || {};
      var payhipScriptUrl = String(payhipConfig.scriptUrl || "https://payhip.com/embed-page.js?v=24u68985").trim();
      if (!payhipScriptUrl) return;

      var existingScript = document.querySelector('script[data-umh-payhip-script-page="true"]');
      if (existingScript) return;

      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src = payhipScriptUrl;
      script.setAttribute("data-umh-payhip-script-page", "true");
      document.body.appendChild(script);
    })();
  </script>
</body>
</html>
`;
}

function buildSitemap(urls) {
  const items = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

async function cleanOutputDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
  const entries = await readdir(directoryPath, { withFileTypes: true });
  await Promise.all(entries.map((entry) => rm(path.join(directoryPath, entry.name), { recursive: true, force: true })));
}

async function main() {
  const raw = await readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw);
  const payhipProducts = await loadPayhipProducts();
  const sourcePrestataires = Array.isArray(parsed.prestataires) ? parsed.prestataires : [];
  const prestataires = sourcePrestataires.filter((item) => item && item.nomCommercial && item.enLigne !== false);
  const usedSlugs = new Set();
  const generatedUrls = [siteHomeUrl, ...staticIndexableUrls];

  await cleanOutputDirectory(outputDir);

  for (const prestataire of prestataires) {
    const slug = buildSlug(prestataire, usedSlugs);
    const html = await renderPrestatairePage(prestataire, slug, payhipProducts);
    const filePath = path.join(outputDir, `${slug}.html`);
    await writeFile(filePath, html, "utf8");
    generatedUrls.push(`${siteOrigin}/prestataires/${slug}.html`);
  }

  await writeFile(sitemapPath, buildSitemap(generatedUrls), "utf8");
  console.log(`${prestataires.length} fiche(s) prestataire generee(s).`);
  console.log("sitemap.xml mis a jour.");
}

async function loadPayhipProducts() {
  const raw = await readFile(payhipProductsPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(raw, sandbox, { filename: "payhip-products.js" });
  const products = Array.isArray(sandbox.window?.UMH_PAYHIP_PRODUCTS?.products)
    ? sandbox.window.UMH_PAYHIP_PRODUCTS.products
    : [];
  return products.filter((item) => item && item.enabled && String(item.key || "").trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
