function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function setupFooterYear() {
  const y = qs("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

function setupSmoothScrollOffset() {
  // sticky topbar offset
  qsa('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = qs(id);
      if (!target) return;
      e.preventDefault();

      const topbar = qs(".topbar");
      const offset = topbar ? topbar.getBoundingClientRect().height + 10 : 0;
      const y = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      history.replaceState(null, "", id);
    });
  });
}

function setupReveal() {
  const els = qsa("[data-reveal]");
  if (!els.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) continue;
        const el = ent.target;
        el.classList.add("is-in");
        io.unobserve(el);
      }
    },
    { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
  );

  els.forEach((el) => io.observe(el));
}

function setupHeroStagger() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const items = qsa("[data-stagger]");
  items.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(240, i * 70)}ms`;
  });
}

document.documentElement.classList.add("js");
setupFooterYear();
setupSmoothScrollOffset();
setupHeroStagger();
setupReveal();

