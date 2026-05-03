(function () {
	const form = document.getElementById("prestataire-form");
	const typeSelect = document.getElementById("typeDePrestation");
	const typeCustom = document.getElementById("typeCustom");
	const photoFile = document.getElementById("photoFile");
	const status = document.getElementById("submit-status");
	const apiUrl = (window.UMH_CONFIG && window.UMH_CONFIG.apiUrl ? String(window.UMH_CONFIG.apiUrl) : "").trim();

	if (!form || !typeSelect || !typeCustom || !status) {
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
		const selected = Array.from(typeSelect.selectedOptions).map(function (opt) {
			return opt.value.trim();
		}).filter(Boolean);

		const custom = typeCustom.value.trim();
		if (custom && selected.indexOf(custom) === -1) {
			selected.push(custom);
		}
		return selected;
	}

	function getPhotoSelection() {
		if (!photoFile || !photoFile.files || !photoFile.files.length) {
			return null;
		}

		const file = photoFile.files[0];
		if (acceptedPhotoTypes.indexOf(file.type) === -1) {
			throw new Error("La photo doit etre au format JPG, PNG ou WebP.");
		}
		if (file.size > maxPhotoSize) {
			throw new Error("La photo ne doit pas depasser 5 Mo.");
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
				reject(new Error("La photo n'a pas pu etre lue."));
			};
			reader.readAsDataURL(file);
		});
	}

	async function buildPrestataireObject() {
		const selectedTypes = getSelectedTypes();
		if (!selectedTypes.length) {
			throw new Error("Selectionnez au moins un type de prestation.");
		}

		const rawDepartements = String(document.getElementById("departementsCouverts").value || "")
			.split(/[,;\s]+/g)
			.map(normalizeDepartement)
			.filter(Boolean);

		const departementsUniques = Array.from(new Set(rawDepartements));
		if (!departementsUniques.length) {
			throw new Error("Saisissez au moins un departement valide (ex: 74, 73, 2A, ALL).");
		}

		const instagram = document.getElementById("instagram").value.trim();
		if (!instagram) {
			throw new Error("Saisissez un profil Instagram.");
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
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		try {
			const prestataire = await buildPrestataireObject();
			setStatus("Envoi en cours...", false);
			await sendToApi(prestataire);
			if (apiUrl) {
				setStatus("Merci, votre demande a ete transmise.", false);
			} else {
				setStatus("Formulaire valide, mais apiUrl est vide dans assets/js/umh-config.js.", true);
			}
		} catch (error) {
			const message = String(error && error.message ? error.message : error);
			if (message.indexOf("Failed to fetch") !== -1) {
				setStatus("Erreur reseau/CORS. Verifie le deploiement Google Apps Script (Web app, acces Anyone, URL /exec).", true);
			} else {
				setStatus("Erreur: " + message, true);
			}
		}
	});

	if (photoFile) {
		photoFile.addEventListener("change", function () {
			try {
				const selectedPhoto = getPhotoSelection();
				if (selectedPhoto) {
					setStatus("Photo selectionnee: " + selectedPhoto.name, false);
				}
			} catch (error) {
				photoFile.value = "";
				setStatus("Erreur: " + String(error && error.message ? error.message : error), true);
			}
		});
	}

	loadTypes();
})();
