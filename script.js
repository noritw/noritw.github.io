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

  const speakerEl = qs("#greeterSpeaker");
  const textEl = qs("#greeterText");
  const subEl = qs("#greeterSub");

  let lines = null;
  let cooldownUntil = 0;

  const setBubble = (speaker, text, sub) => {
    if (speakerEl) speakerEl.textContent = speaker || "—";
    if (textEl) textEl.textContent = text || "";
    if (subEl) subEl.textContent = sub || "";
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

  const apiReply = async (charId) => {
    // 預設走同源 /api/line（若你未部署後端，會自動 fallback 到本地台詞庫）
    // 你部署 Worker 後，想改成外部網址可在 index.html 加：
    // <script>window.__GREETER_API__="https://xxx.workers.dev/api/line"</script>
    const base = window.__GREETER_API__ || "/api/line";

    const url = new URL(base);
    url.searchParams.set("char", charId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  };

  const onClick = async (charId) => {
    const now = Date.now();
    if (now < cooldownUntil) return;

    setDisabled(true);
    setBubble(charId, "……", "（思考中）");

    // 先本地台詞庫跑起來，再慢慢接後端
    if (!lines) lines = await loadGreeterLines();

    // 10% 試著打 API；失敗就退回本地
    const useApi = Math.random() < 0.1;
    try {
      const reply = useApi ? await apiReply(charId) : localReply(charId);
      const text = clampText(reply.text, 60);
      setBubble(charId, text, reply.source ? `(${reply.source})` : "");
      const cd = Number(reply.cooldownMs || 1200);
      cooldownUntil = Date.now() + Math.min(5000, Math.max(600, cd));
    } catch {
      const reply = localReply(charId);
      setBubble(charId, clampText(reply.text, 60), "(local)");
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

