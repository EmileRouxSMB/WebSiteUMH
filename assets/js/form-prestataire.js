(function () {
	const form = document.getElementById("prestataire-form");
	const typeSelect = document.getElementById("typeDePrestation");
	const photoFile = document.getElementById("photoFile");
	const status = document.getElementById("submit-status");
	const captchaQuestion = document.getElementById("captchaQuestion");
	const captchaAnswer = document.getElementById("captchaAnswer");
	const captchaRefresh = document.getElementById("captchaRefresh");
	const honeypotField = document.getElementById("website");
	const apiUrl = (window.UMH_CONFIG && window.UMH_CONFIG.apiUrl ? String(window.UMH_CONFIG.apiUrl) : "").trim();

	let captchaExpectedAnswer = "";

	if (!form || !typeSelect || !status) {
		return;
	}

	const maxPhotoSize = 5 * 1024 * 1024;
	const acceptedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
	const defaultTypes = ["Lieu", "Photo / Vidéo", "Traiteur", "Coiffure", "Maquillage", "Animation", "Musique / DJ", "Décoration", "Officiant de cérémonie", "Service / Maitre d'hôtel", "Création robes de mariées", "Cadeaux personnalisés", "Papeterie", "Fleuriste", "Patisserie", "Autre"];

	function getTodayDate() {
		return new Date().toISOString().slice(0, 10);
	}

	function normalizeDepartement(token) {
		const value = String(token || "").trim().toUpperCase();
		if (!value) return "";
		if (value === "ALL") return value;
		if (value === "2A" || value === "2B") return value;
		if (/^[0-9]{1,3}$/.test(value)) return value;
		return "";
	}

	function getSelectedTypes() {
		return Array.from(typeSelect.selectedOptions).map(function (opt) {
			return opt.value.trim();
		}).filter(Boolean);
	}

	function randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function refreshCaptcha() {
		if (!captchaQuestion || !captchaAnswer) {
			return;
		}

		const left = randomInt(2, 9);
		const right = randomInt(1, 9);
		const useAddition = Math.random() >= 0.5;

		if (useAddition) {
			captchaExpectedAnswer = String(left + right);
			captchaQuestion.textContent = "Combien font " + left + " + " + right + " ?";
		} else {
			const maxValue = Math.max(left, right);
			const minValue = Math.min(left, right);
			captchaExpectedAnswer = String(maxValue - minValue);
			captchaQuestion.textContent = "Combien font " + maxValue + " - " + minValue + " ?";
		}

		captchaAnswer.value = "";
	}

	function validateCaptcha() {
		if (honeypotField && honeypotField.value.trim()) {
			throw new Error("Validation anti-spam refusée.");
		}

		if (!captchaAnswer || captchaAnswer.value.trim() !== captchaExpectedAnswer) {
			refreshCaptcha();
			throw new Error("Le CAPTCHA est incorrect. Merci de réessayer.");
		}
	}

	function normalizeInstagramHandle(value) {
		const trimmedValue = String(value || "").trim();
		if (!trimmedValue) return "";
		if (/^https?:\/\//i.test(trimmedValue) || /instagram\.com/i.test(trimmedValue) || /[/?#]/.test(trimmedValue)) {
			return trimmedValue;
		}
		return trimmedValue.charAt(0) === "@" ? trimmedValue : "@" + trimmedValue;
	}

	function validateInstagramField() {
		const instagramField = document.getElementById("instagram");
		if (!instagramField) {
			return "";
		}

		const normalizedValue = normalizeInstagramHandle(instagramField.value);
		if (instagramField.value !== normalizedValue) {
			instagramField.value = normalizedValue;
		}

		if (!normalizedValue) {
			instagramField.setCustomValidity("Saisissez un profil Instagram.");
			return "";
		}
		if (/^https?:\/\//i.test(normalizedValue) || /instagram\.com/i.test(normalizedValue) || /[/?#]/.test(normalizedValue)) {
			instagramField.setCustomValidity("Saisissez uniquement le compte Instagram au format @moncompte, sans URL.");
			return normalizedValue;
		}
		if (!/^@[A-Za-z0-9._]{1,30}$/.test(normalizedValue)) {
			instagramField.setCustomValidity("Le compte Instagram doit commencer par @ et contenir seulement lettres, chiffres, points ou underscores.");
			return normalizedValue;
		}

		instagramField.setCustomValidity("");
		return normalizedValue;
	}

	function getPhotoSelection() {
		if (!photoFile || !photoFile.files || !photoFile.files.length) {
			return null;
		}

		const file = photoFile.files[0];
		if (acceptedPhotoTypes.indexOf(file.type) === -1) {
			throw new Error("La photo doit être au format JPG, PNG ou WebP.");
		}
		if (file.size > maxPhotoSize) {
			throw new Error("La photo ne doit pas dépasser 5 Mo.");
		}
		return file;
	}

	function readFileAsBase64(file) {
		return new Promise(function (resolve, reject) {
			const reader = new FileReader();
			reader.onload = function () {
				const result = String(reader.result || "");
				resolve(result.split(",")[1] || "");
			};
			reader.onerror = function () {
				reject(new Error("La photo n'a pas pu être lue."));
			};
			reader.readAsDataURL(file);
		});
	}

	async function buildPrestataireObject() {
		const selectedTypes = getSelectedTypes();
		if (!selectedTypes.length) {
			throw new Error("Sélectionnez au moins un type de prestation.");
		}

		const rawDepartements = String(document.getElementById("departementsCouverts").value || "")
			.split(/[,;\s]+/g)
			.map(normalizeDepartement)
			.filter(Boolean);

		const departementsUniques = Array.from(new Set(rawDepartements));
		if (!departementsUniques.length) {
			throw new Error("Saisissez au moins un département valide (ex: 74, 73, 2A, ALL).");
		}

		const instagram = validateInstagramField();
		if (!instagram || !form.checkValidity()) {
			throw new Error("Saisissez le compte Instagram au format @moncompte, sans URL.");
		}

		const selectedPhoto = getPhotoSelection();
		const prestataire = {
			nomCommercial: document.getElementById("nomCommercial").value.trim(),
			numeroSiret: document.getElementById("numeroSiret").value.trim(),
			numeroDeTel: document.getElementById("numeroDeTel").value.trim(),
			email: document.getElementById("email").value.trim(),
			typeDePrestation: selectedTypes,
			departementsCouverts: departementsUniques,
			siteWeb: document.getElementById("siteWeb").value.trim(),
			instagram: instagram,
			facebook: document.getElementById("facebook").value.trim(),
			tiktok: document.getElementById("tiktok").value.trim(),
			descriptionDesPrestationsProposees: document.getElementById("descriptionDesPrestationsProposees").value.trim(),
			personnalisationUMH: "",
			miseEnAvant: false,
			photo: "",
			dateInscription: getTodayDate(),
			dateMAJ: "",
			enLigne: false,
			cgAcceptee: document.getElementById("cgAcceptee").checked
		};

		if (selectedPhoto) {
			prestataire.photoUpload = {
				name: selectedPhoto.name,
				mimeType: selectedPhoto.type,
				size: selectedPhoto.size,
				data: await readFileAsBase64(selectedPhoto)
			};
		}

		return prestataire;
	}

	function setStatus(message, isError) {
		status.textContent = message;
		status.style.color = isError ? "#9a2f2f" : "#2f5f45";
	}

	function setSubmittingState(isSubmitting) {
		const submitButton = form.querySelector('button[type="submit"]');
		if (!submitButton) {
			return;
		}

		submitButton.disabled = isSubmitting;
		submitButton.textContent = isSubmitting ? "Envoi en cours..." : "Envoyer";
	}

	function fillTypeOptions(types) {
		typeSelect.innerHTML = "";
		types.forEach(function (type) {
			const option = document.createElement("option");
			option.value = type;
			option.textContent = type;
			typeSelect.appendChild(option);
		});
	}

	function loadTypes() {
		fillTypeOptions(defaultTypes);
	}

	function sendToApi(prestataire) {
		if (!apiUrl) {
			return Promise.resolve({ skipped: true });
		}

		return fetch(apiUrl, {
			method: "POST",
			headers: {
				// text/plain evite le preflight CORS sur Apps Script
				"Content-Type": "text/plain;charset=utf-8"
			},
			body: JSON.stringify(prestataire),
			redirect: "follow"
		}).then(function (response) {
			if (!response.ok) {
				throw new Error("Echec envoi API (" + response.status + ")");
			}
			return response.text();
		});
	}

	form.addEventListener("submit", async function (event) {
		event.preventDefault();
		validateInstagramField();
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		setSubmittingState(true);

		try {
			validateCaptcha();
			const prestataire = await buildPrestataireObject();
			setStatus("Envoi en cours...", false);
			await sendToApi(prestataire);
			if (apiUrl) {
				window.location.href = "confirmation-prestataire.html";
				return;
			}
			setStatus("Formulaire valide, mais apiUrl est vide dans assets/js/umh-config.js.", true);
		} catch (error) {
			const message = String(error && error.message ? error.message : error);
			if (message.indexOf("Failed to fetch") !== -1) {
				setStatus("Erreur reseau/CORS. Verifie le deploiement Google Apps Script (Web app, acces Anyone, URL /exec).", true);
			} else {
				setStatus("Erreur: " + message, true);
			}
			if (message.indexOf("CAPTCHA") !== -1 && captchaAnswer) {
				captchaAnswer.focus();
			}
		} finally {
			setSubmittingState(false);
		}
	});

	if (photoFile) {
		photoFile.addEventListener("change", function () {
			try {
				const selectedPhoto = getPhotoSelection();
				if (selectedPhoto) {
					setStatus("Photo selectionnee : " + selectedPhoto.name, false);
				}
			} catch (error) {
				photoFile.value = "";
				setStatus("Erreur: " + String(error && error.message ? error.message : error), true);
			}
		});
	}

	const instagramField = document.getElementById("instagram");
	if (instagramField) {
		instagramField.addEventListener("input", function () {
			instagramField.setCustomValidity("");
		});
		instagramField.addEventListener("blur", validateInstagramField);
	}

	if (captchaRefresh) {
		captchaRefresh.addEventListener("click", refreshCaptcha);
	}

	loadTypes();
	refreshCaptcha();
})();
