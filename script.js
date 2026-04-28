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

async function loadGreeterLines() {
  try {
    const res = await fetch("./characters/greeter-lines.json", { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}



function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampText(s, maxLen) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}

function setupGreeter() {
  const buttons = qsa("[data-greeter]");
  if (!buttons.length) return;

  const bubble = qs(".greeter-float-bubble");
  const speakerEl = qs("[data-greeter-speaker]");
  const textEl = qs("[data-greeter-text]");
  const subEl = qs("[data-greeter-sub]");

  let lines = null;
  let cooldownUntil = 0;

  const setBubble = (speaker, text, sub) => {
    if (speakerEl) speakerEl.textContent = speaker || "—";
    if (textEl) textEl.textContent = text || "";
    if (subEl) subEl.textContent = sub || "";
    if (bubble) bubble.hidden = false;
  };

  const setDisabled = (disabled) => {
    buttons.forEach((b) => (b.disabled = disabled));
  };

  const localReply = (charId) => {
    const pool = lines && lines[charId];
    const meta = lines && lines.meta;
    const t = pickRandom(pool) || pickRandom(meta) || "……";
    return { text: t, source: "local" };
  };

  const onClick = async (charId) => {
    const now = Date.now();
    if (now < cooldownUntil) return;

    setDisabled(true);
    setBubble(charId, "……", "（思考中）");

    // 先本地台詞庫跑起來，再慢慢接後端
    if (!lines) lines = await loadGreeterLines();

    try {
      // 目前先固定只用台詞庫（後端接好再開）
      const reply = localReply(charId);
      const text = clampText(reply.text, 60);
      setBubble(charId, text, "");
      const cd = 1200;
      cooldownUntil = Date.now() + Math.min(5000, Math.max(600, cd));
    } catch {
      const reply = localReply(charId);
      setBubble(charId, clampText(reply.text, 60), "");
      cooldownUntil = Date.now() + 1200;
    } finally {
      setTimeout(() => setDisabled(false), Math.max(0, cooldownUntil - Date.now()));
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => onClick(btn.getAttribute("data-greeter")));
  });
}

document.documentElement.classList.add("js");
setupFooterYear();
setupSmoothScrollOffset();
setupHeroStagger();
setupReveal();
setupGreeter();

