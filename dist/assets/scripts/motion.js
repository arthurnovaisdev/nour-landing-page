(() => {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealItems = [...document.querySelectorAll(".reveal")];
  const nssVisuals = [...document.querySelectorAll(".nss-card, .nss-detail")];
  const animatedCounters = new WeakSet();

  const setCounterValue = (element, value) => {
    element.textContent = String(Math.round(value));
  };

  const animateCounter = (element) => {
    if (animatedCounters.has(element)) return;
    animatedCounters.add(element);

    const target = Number(element.dataset.countTo);
    if (!Number.isFinite(target)) return;

    if (motionPreference.matches) {
      setCounterValue(element, target);
      return;
    }

    const duration = 1100;
    const startedAt = performance.now();
    setCounterValue(element, 0);

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounterValue(element, target * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  };

  const activateNss = (visual) => {
    visual.classList.add("is-animated");
    visual.querySelectorAll("[data-count-to]").forEach(animateCounter);
  };

  const showEverything = () => {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    nssVisuals.forEach(activateNss);
  };

  if (motionPreference.matches || !("IntersectionObserver" in window)) {
    showEverything();
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }),
      { threshold: 0.12, rootMargin: "0px 0px -7%" },
    );

    const nssObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        activateNss(entry.target);
        nssObserver.unobserve(entry.target);
      }),
      { threshold: 0.3 },
    );

    revealItems.forEach((item) => revealObserver.observe(item));
    nssVisuals.forEach((visual) => nssObserver.observe(visual));
  }

  const hero = document.querySelector(".hero");
  const whatsapp = document.querySelector(".whatsapp");
  if (hero && whatsapp && "IntersectionObserver" in window) {
    const whatsappObserver = new IntersectionObserver(
      ([entry]) => whatsapp.classList.toggle("is-hidden", entry.isIntersecting),
      { threshold: 0.12 },
    );
    whatsappObserver.observe(hero);
  }

  motionPreference.addEventListener?.("change", (event) => {
    if (event.matches) showEverything();
  });
})();
