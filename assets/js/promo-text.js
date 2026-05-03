window.UMH_PROMO_TEXT = "Une experience complete vous attend : -10% des 20EUR -20% des 40EUR avec les codes HAPPY10 / HAPPY20";

(function () {
	const promoElement = document.getElementById("umh-promo-text");
	document.body.classList.remove("is-preload");
	if (promoElement) {
		promoElement.textContent = window.UMH_PROMO_TEXT;
	}
})();
