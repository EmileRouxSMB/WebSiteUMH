(function () {
	const typeSelect = document.getElementById("filtre-type");
	const departementInput = document.getElementById("filtre-departement");
	const departementList = document.getElementById("liste-departements");
	const resultsContainer = document.getElementById("annuaire-results");
	const countElement = document.getElementById("annuaire-count");
	const resetButton = document.getElementById("annuaire-reset");
	const detailContainer = document.getElementById("fiche-prestataire-content");
	const payhipContainer = document.getElementById("fiche-prestataire-payhip");
	const annuaireArticle = document.getElementById("annuaire");
	const ficheArticle = document.getElementById("fiche-prestataire");
	const payhipConfig = window.UMH_PAYHIP_PRODUCTS || { products: [] };
	const payhipScriptUrl = String(payhipConfig.scriptUrl || "https://payhip.com/embed-page.js?v=24u68985").trim();

	if (!typeSelect || !departementInput || !departementList || !resultsContainer || !countElement || !resetButton || !detailContainer || !payhipContainer) {
		return;
	}

	const ficheReturnLinks = ficheArticle ? ficheArticle.querySelectorAll(".fiche-return") : [];
	const lastFicheReturn = ficheReturnLinks.length ? ficheReturnLinks[ficheReturnLinks.length - 1] : null;
	if (lastFicheReturn && lastFicheReturn.parentNode) {
		lastFicheReturn.insertAdjacentElement("afterend", payhipContainer);
	}

	let prestataires = [];
	let typeOptions = [];
	let currentPrestataireId = "";

	function getTypes(prestataire) {
		if (Array.isArray(prestataire && prestataire.typeDePrestation)) {
			return prestataire.typeDePrestation.filter(Boolean);
		}

		if (prestataire && prestataire.typeDePrestation) {
			return [prestataire.typeDePrestation];
		}

		return [];
	}

	function sanitizeDepartementValue(value, allowPartialAll) {
		const rawUpper = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
		if (allowPartialAll && (rawUpper === "A" || rawUpper === "AL")) {
			return rawUpper;
		}
		if (rawUpper === "ALL" || rawUpper.startsWith("ALL")) {
			return "ALL";
		}

		const upper = String(value || "").toUpperCase().replace(/[^0-9AB]/g, "");

		if (upper.startsWith("2A")) {
			return "2A";
		}

		if (upper.startsWith("2B")) {
			return "2B";
		}

		return upper.replace(/\D/g, "").slice(0, 2);
	}

	function normalizeDepartementToken(value) {
		const token = String(value || "").trim().toUpperCase();
		if (!token) {
			return "";
		}
		return token === "ALL" ? "ALL" : token;
	}

	function formatDepartementsCouverts(values) {
		const list = (values || []).map(function (item) {
			const token = normalizeDepartementToken(item);
			return token === "ALL" ? "France entière" : token;
		}).filter(Boolean);
		return list.join(", ");
	}

	function escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function hasText(value) {
		return String(value || "").trim().length > 0;
	}

	function truncateText(value, maxChars) {
		const raw = String(value || "").replace(/\s+/g, " ").trim();
		if (!raw || raw.length <= maxChars) {
			return raw;
		}

		const cutoff = raw.slice(0, maxChars + 1);
		const lastSpace = cutoff.lastIndexOf(" ");
		const truncated = (lastSpace > Math.floor(maxChars * 0.6) ? cutoff.slice(0, lastSpace) : raw.slice(0, maxChars)).trim();
		return truncated + "...";
	}

	function formatPhoneNumber(value) {
		const raw = String(value || "").trim();
		if (!raw) {
			return "";
		}

		const compact = raw.replace(/[^\d+]/g, "");
		if (!compact) {
			return raw;
		}

		if (compact.startsWith("+33")) {
			const localFromIntl = "0" + compact.slice(3);
			return formatPhoneNumber(localFromIntl);
		}

		const digits = compact.replace(/\D/g, "");
		const normalizedDigits = digits.length === 9 ? "0" + digits : digits;
		if (!/^0\d{9}$/.test(normalizedDigits)) {
			return raw;
		}

		return normalizedDigits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
	}

	function normalizeExternalUrl(url, label) {
		const raw = String(url || "").trim();
		if (!raw) {
			return "";
		}

		if (/^https?:\/\//i.test(raw)) {
			return raw;
		}

		if (/^\/\//.test(raw)) {
			return "https:" + raw;
		}

		const cleanLabel = String(label || "").toLowerCase();
		const handle = raw.startsWith("@") ? raw.slice(1) : raw;

		if (cleanLabel === "instagram") {
			return "https://www.instagram.com/" + handle;
		}

		if (cleanLabel === "facebook") {
			return "https://www.facebook.com/" + handle;
		}

		if (cleanLabel === "tiktok") {
			return "https://www.tiktok.com/@" + handle;
		}

		return "https://" + raw;
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

	function getPhotoHandle(prestataire) {
		const explicitHandle = String(prestataire && prestataire.photo || "").trim().toLowerCase();
		if (explicitHandle) {
			return explicitHandle;
		}
		return getInstagramHandle(prestataire && prestataire.instagram);
	}

	function getPhotoCandidates(prestataire, forThumbnail) {
		const handle = getPhotoHandle(prestataire);
		if (!handle) {
			return [];
		}

		const thumbCandidates = ["webp", "jpg", "jpeg", "png"].map(function (extension) {
			return "images/partenaires/thumbs/" + handle + "." + extension;
		});
		const hdCandidates = ["jpg", "jpeg", "png", "webp"].map(function (extension) {
			return "images/partenaires/" + handle + "." + extension;
		});

		const ordered = forThumbnail ? thumbCandidates.concat(hdCandidates) : hdCandidates.concat(thumbCandidates);
		return Array.from(new Set(ordered));
	}

	window.umhUseNextPartnerPhoto = function (image) {
		const candidates = String(image.getAttribute("data-photo-candidates") || "").split("|").filter(Boolean);
		const nextIndex = Number(image.getAttribute("data-photo-index") || 0) + 1;

		if (nextIndex < candidates.length) {
			image.setAttribute("data-photo-index", String(nextIndex));
			image.src = candidates[nextIndex];
			return;
		}

		image.onerror = null;
		image.src = "images/logo.png";
	};

	function getSocialIcon(label) {
		const key = String(label || "").toLowerCase();
		if (key === "instagram") return "fa-brands fa-instagram";
		if (key === "facebook") return "fa-brands fa-facebook-f";
		if (key === "tiktok") return "fa-brands fa-tiktok";
		if (key === "site web") return "fa-solid fa-globe";
		return "";
	}

	function safeLink(url, label, prestataire, sourceArea) {
		if (!url) {
			return "";
		}

		const normalizedUrl = normalizeExternalUrl(url, label);
		if (!normalizedUrl) {
			return "";
		}

		const prestaId = prestataire && prestataire._uid ? escapeHtml(prestataire._uid) : "";
		const linkLabel = escapeHtml(label);
		const area = escapeHtml(sourceArea || "annuaire");
		const labelKey = String(label || "").toLowerCase();

		if (labelKey === "instagram") {
			return '<a href="' + escapeHtml(normalizedUrl) + '" target="_blank" rel="noopener" class="annuaire-social annuaire-social-icon annuaire-outbound" data-presta-id="' + prestaId + '" data-link-label="' + linkLabel + '" data-source-area="' + area + '" aria-label="Instagram"><img src="images/instagram.png" alt="Instagram" class="annuaire-social-image"></a>';
		}

		if (labelKey === "facebook") {
			return '<a href="' + escapeHtml(normalizedUrl) + '" target="_blank" rel="noopener" class="annuaire-social annuaire-social-icon annuaire-outbound" data-presta-id="' + prestaId + '" data-link-label="' + linkLabel + '" data-source-area="' + area + '" aria-label="Facebook"><img src="images/logo-facebook.png" alt="Facebook" class="annuaire-social-image"></a>';
		}

		const iconClass = getSocialIcon(label);
		const iconHtml = iconClass ? '<i class="' + iconClass + '" aria-hidden="true"></i>' : "";
		return '<a href="' + escapeHtml(normalizedUrl) + '" target="_blank" rel="noopener" class="annuaire-social annuaire-outbound" data-presta-id="' + prestaId + '" data-link-label="' + linkLabel + '" data-source-area="' + area + '">' + iconHtml + '<span>' + label + "</span></a>";
	}

	function buildWebsiteDetail(url, prestataire, sourceArea, extraClass, displayText) {
		if (!hasText(url)) {
			return "";
		}
		const normalizedUrl = normalizeExternalUrl(url, "Site web");
		const prestaId = prestataire && prestataire._uid ? escapeHtml(prestataire._uid) : "";
		const area = escapeHtml(sourceArea || "annuaire");
		const displayUrl = escapeHtml(displayText || normalizedUrl);
		const classNames = ("annuaire-outbound " + (extraClass || "")).trim();
		return '<a href="' + escapeHtml(normalizedUrl) + '" target="_blank" rel="noopener" class="' + escapeHtml(classNames) + '" data-presta-id="' + prestaId + '" data-link-label="Site web" data-source-area="' + area + '">' + displayUrl + '</a>';
	}

	function createPhotoMarkup(prestataire) {
		const photoCandidates = getPhotoCandidates(prestataire, true);
		const photoSrc = photoCandidates.length ? escapeHtml(photoCandidates[0]) : "images/logo.png";
		const fallbackAttr = photoCandidates.length ? ' data-photo-candidates="' + escapeHtml(photoCandidates.join("|")) + '" data-photo-index="0"' : "";
		const altText = escapeHtml(prestataire.nomCommercial || "Partenaire");
		const prestaId = prestataire && prestataire._uid ? escapeHtml(prestataire._uid) : "";
		return '<a href="#fiche-prestataire" class="annuaire-photo-link annuaire-name-link" data-presta-id="' + prestaId + '" aria-label="Voir la fiche de ' + altText + '"><img class="annuaire-photo" src="' + photoSrc + '" alt="' + altText + '" loading="lazy" decoding="async"' + fallbackAttr + ' onerror="window.umhUseNextPartnerPhoto(this);"></a>';
	}

	function trackPrestataireClick(prestataire) {
		if (typeof window.gtag !== "function") {
			return;
		}

		window.gtag("event", "presta_click", {
			nomCommercial: prestataire.nomCommercial || ""
		});
	}

	function trackOutboundClick(prestataire, linkLabel, href, sourceArea) {
		if (typeof window.gtag !== "function") {
			return;
		}

		window.gtag("event", "presta_outbound_click", {
			nomCommercial: prestataire.nomCommercial || ""
		});
	}

	function getRandomPayhipProduct() {
		const products = Array.isArray(payhipConfig.products) ? payhipConfig.products : [];
		const enabledProducts = products.filter(function (product) {
			return product && product.enabled !== false && String(product.key || "").trim();
		});

		if (!enabledProducts.length) {
			return null;
		}

		return enabledProducts[Math.floor(Math.random() * enabledProducts.length)];
	}

	function renderPayhipEmbed() {
		const product = getRandomPayhipProduct();
		if (!product) {
			return "";
		}

		const key = escapeHtml(String(product.key || "").trim());
		const title = escapeHtml(product.title || "Ressource recommandee");

		return "" +
			'<section class="fiche-payhip" aria-label="Produit recommandé">' +
			'<p class="fiche-payhip-eyebrow">Pour aller plus loin</p>' +
			'<h4 class="fiche-payhip-title">' + title + "</h4>" +
			'<div class="payhip-embed-page" data-key="' + key + '">...</div>' +
			"</section>";
	}

	function refreshPayhipEmbed() {
		const section = payhipContainer.querySelector(".fiche-payhip");
		const embed = payhipContainer.querySelector(".payhip-embed-page");
		if (!section || !embed || !payhipScriptUrl) {
			return;
		}

		const existingScripts = payhipContainer.querySelectorAll('script[data-umh-payhip-script="true"]');
		existingScripts.forEach(function (scriptNode) {
			if (scriptNode.parentNode) {
				scriptNode.parentNode.removeChild(scriptNode);
			}
		});

		const globalScript = document.querySelector('script[data-umh-payhip-script-global="true"]');
		if (globalScript && globalScript.parentNode) {
			globalScript.parentNode.removeChild(globalScript);
		}

		const script = document.createElement("script");
		script.type = "text/javascript";
		script.src = payhipScriptUrl;
		script.setAttribute("data-umh-payhip-script", "true");
		script.setAttribute("data-umh-payhip-script-global", "true");
		section.appendChild(script);
	}

	function renderPrestataireDetail(prestataire) {
		const types = getTypes(prestataire);
		const typeLabel = types.join(" / ");
		const photoCandidates = getPhotoCandidates(prestataire, false);
		const photoSrc = photoCandidates.length ? escapeHtml(photoCandidates[0]) : "images/logo.png";
		const fallbackAttr = photoCandidates.length ? ' data-photo-candidates="' + escapeHtml(photoCandidates.join("|")) + '" data-photo-index="0"' : "";
		const socials = [
			safeLink(prestataire.instagram, "Instagram", prestataire, "fiche_prestataire"),
			safeLink(prestataire.facebook, "Facebook", prestataire, "fiche_prestataire")
		].filter(Boolean).join("");
		const websiteDetail = buildWebsiteDetail(prestataire.siteWeb, prestataire, "fiche_prestataire", "fiche-site-link", "Retrouvez-moi ici");

		detailContainer.innerHTML = "" +
			'<div class="fiche-media">' +
			'<img class="fiche-image" src="' + photoSrc + '" alt="' + escapeHtml(prestataire.nomCommercial) + '"' + fallbackAttr + ' onerror="window.umhUseNextPartnerPhoto(this);">' +
			"</div>" +
			'<div class="fiche-content">' +
			'<p class="fiche-type">' + escapeHtml(typeLabel) + "</p>" +
			"<h3>" + escapeHtml(prestataire.nomCommercial) + "</h3>" +
			(hasText(prestataire.personnalisationUMH) ? '<p class="fiche-lead">' + escapeHtml(prestataire.personnalisationUMH) + "</p>" : "") +
			(hasText(prestataire.descriptionDesPrestationsProposees) ? '<p class="fiche-description">' + escapeHtml(prestataire.descriptionDesPrestationsProposees) + "</p>" : "") +
			'<div class="fiche-details">' +
			(hasText(prestataire.numeroDeTel) ? '<p class="fiche-detail"><strong>Telephone</strong><span>' + escapeHtml(formatPhoneNumber(prestataire.numeroDeTel)) + "</span></p>" : "") +
			'<p class="fiche-detail"><strong>Email</strong><a href="mailto:' + escapeHtml(prestataire.email) + '">' + escapeHtml(prestataire.email) + "</a></p>" +
			'<p class="fiche-detail"><strong>Departements</strong><span>' + escapeHtml(formatDepartementsCouverts(prestataire.departementsCouverts || [])) + "</span></p>" +
			"</div>" +
			'<div class="fiche-actions">' +
			(websiteDetail ? websiteDetail : "") +
			(socials ? '<div class="fiche-socials">' + socials + "</div>" : "") +
			"</div>" +
			"</div>";

		payhipContainer.innerHTML = renderPayhipEmbed();
	}

	function showAnnuaire() {
		currentPrestataireId = "";
		payhipContainer.innerHTML = "";
		document.body.classList.remove("is-fiche-prestataire-visible");
		if (annuaireArticle) {
			annuaireArticle.hidden = false;
		}
		if (ficheArticle) {
			ficheArticle.hidden = true;
		}
	}

	function showPrestataire(prestataire) {
		currentPrestataireId = prestataire._uid;
		renderPrestataireDetail(prestataire);
		refreshPayhipEmbed();
		document.body.classList.add("is-fiche-prestataire-visible");
		if (annuaireArticle) {
			annuaireArticle.hidden = true;
		}
		if (ficheArticle) {
			ficheArticle.hidden = false;
			ficheArticle.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}

	function syncViewFromHash() {
		if (location.hash !== "#fiche-prestataire" || !currentPrestataireId) {
			showAnnuaire();
		}
	}

	function renderCards(items) {
		if (!items.length) {
			resultsContainer.innerHTML = '<div class="annuaire-empty">Aucun partenaire ne correspond à ce filtrage.</div>';
			countElement.textContent = "0 partenaire trouvé";
			return;
		}

		countElement.textContent = items.length + " partenaire" + (items.length > 1 ? "s trouvés" : " trouvé");

		resultsContainer.innerHTML = items.map(function (prestataire) {
			const topSocials = [
				safeLink(prestataire.instagram, "Instagram", prestataire, "annuaire_card"),
				safeLink(prestataire.facebook, "Facebook", prestataire, "annuaire_card")
			].filter(Boolean).join("");

			return "" +
				'<section class="annuaire-card' + (prestataire.miseEnAvant ? " is-featured" : "") + '">' +
				'<div class="annuaire-card-header">' +
				"<div>" +
				'<h3><a href="#fiche-prestataire" class="annuaire-name-link" data-presta-id="' + escapeHtml(prestataire._uid) + '">' + escapeHtml(prestataire.nomCommercial) + "</a></h3>" +
				(topSocials ? '<div class="annuaire-socials">' + topSocials + "</div>" : "") +
				"</div>" +
				createPhotoMarkup(prestataire) +
				"</div>" +
				(hasText(prestataire.descriptionDesPrestationsProposees) ? '<p class="annuaire-description">' + escapeHtml(truncateText(prestataire.descriptionDesPrestationsProposees, 260)) + "</p>" : "") +
				"</section>";
		}).join("");
	}

	function applyFilters() {
		const selectedType = typeSelect.value;
		const selectedDepartement = sanitizeDepartementValue((departementInput.value || "").trim(), false);

		const filtered = prestataires.filter(function (prestataire) {
			const prestataireTypes = getTypes(prestataire);
			const matchesType = !selectedType || prestataireTypes.indexOf(selectedType) !== -1;
			const departements = (prestataire.departementsCouverts || []).map(normalizeDepartementToken);
			const hasAll = departements.indexOf("ALL") !== -1;
			const matchesDepartement = !selectedDepartement
				|| (selectedDepartement === "ALL"
					? hasAll
					: (departements.indexOf(selectedDepartement) !== -1 || hasAll));
			return matchesType && matchesDepartement;
		});

		renderCards(filtered);
	}

	function populateFilters(items, availableTypes) {
		const types = (availableTypes || []).length
			? availableTypes.slice().sort()
			: Array.from(new Set(items.flatMap(function (item) {
				return getTypes(item);
			}))).sort();

		const departements = Array.from(new Set(items.flatMap(function (item) {
			return (item.departementsCouverts || []).map(normalizeDepartementToken);
		}))).sort(function (a, b) {
			if (a === "ALL") return -1;
			if (b === "ALL") return 1;
			return a.localeCompare(b, "fr", { numeric: true });
		});

		typeSelect.innerHTML = '<option value="">Tous les types</option>' + types.map(function (type) {
			return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + "</option>";
		}).join("");

		departementList.innerHTML = departements.map(function (departement) {
			const label = departement === "ALL" ? "ALL (France entière)" : departement;
			return '<option value="' + escapeHtml(departement) + '">' + escapeHtml(label) + "</option>";
		}).join("");
	}

	function handleAnnuaireData(data) {
		const rawPrestataires = Array.isArray(data) ? data : (data.prestataires || []);
		typeOptions = Array.isArray(data && data.typeDePrestationOptions) ? data.typeDePrestationOptions : [];

		prestataires = rawPrestataires.filter(function (item) {
			return item && item.nomCommercial && item.enLigne !== false;
		}).sort(function (a, b) {
			if (a.miseEnAvant === b.miseEnAvant) {
				return a.nomCommercial.localeCompare(b.nomCommercial, "fr");
			}
			return a.miseEnAvant ? -1 : 1;
		}).map(function (item, index) {
			item._uid = String(index);
			return item;
		});

		populateFilters(prestataires, typeOptions);
		applyFilters();
	}

	function loadAnnuaire() {
		fetch("data/prestataires.json")
			.then(function (response) {
				if (!response.ok) {
					throw new Error("Impossible de charger les partenaires.");
				}
				return response.json();
			})
			.then(handleAnnuaireData)
			.catch(function () {
				countElement.textContent = "Erreur de chargement";
				resultsContainer.innerHTML = '<div class="annuaire-empty">Le fichier partenaires n\'a pas pu être chargé. Vérifie data/prestataires.json ou lance le site via un serveur local pour tester la page.</div>';
			});
	}

	typeSelect.addEventListener("change", applyFilters);
	departementInput.addEventListener("input", function () {
		const sanitized = sanitizeDepartementValue(departementInput.value, true);
		if (departementInput.value !== sanitized) {
			departementInput.value = sanitized;
		}
		applyFilters();
	});
	departementInput.addEventListener("change", function () {
		departementInput.value = sanitizeDepartementValue(departementInput.value, false);
		applyFilters();
	});
	resetButton.addEventListener("click", function (event) {
		event.preventDefault();
		typeSelect.value = "";
		departementInput.value = "";
		applyFilters();
	});

	resultsContainer.addEventListener("click", function (event) {
		const link = event.target.closest(".annuaire-name-link");
		if (!link) {
			return;
		}

		const id = link.getAttribute("data-presta-id");
		const prestataire = prestataires.find(function (item) {
			return item._uid === id;
		});

		if (!prestataire) {
			return;
		}

		trackPrestataireClick(prestataire);
		showPrestataire(prestataire);
	});

	document.querySelectorAll(".fiche-return-link").forEach(function (link) {
		link.addEventListener("click", function () {
			showAnnuaire();
		});
	});

	window.addEventListener("hashchange", syncViewFromHash);

	function bindOutboundTracking(container) {
		container.addEventListener("click", function (event) {
			const link = event.target.closest(".annuaire-outbound");
			if (!link) {
				return;
			}

			const id = link.getAttribute("data-presta-id");
			const prestataire = prestataires.find(function (item) {
				return item._uid === id;
			});
			if (!prestataire) {
				return;
			}

			trackOutboundClick(
				prestataire,
				link.getAttribute("data-link-label"),
				link.getAttribute("href"),
				link.getAttribute("data-source-area")
			);
		});
	}

	bindOutboundTracking(resultsContainer);
	bindOutboundTracking(detailContainer);

	showAnnuaire();
	loadAnnuaire();
})();
