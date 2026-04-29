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

function setupHeroBgRotation() {
  const img = qs("#heroBgImg");
  if (!img) return;

  // 你可以在 assets/images/ 放更多張：
  // hero-bg.jpg, hero-bg-2.jpg, hero-bg-3.jpg ...
  const candidates = [
    "./assets/images/hero-bg.jpg",
    "./assets/images/hero-bg-2.jpg",
    "./assets/images/hero-bg-3.jpg",
    "./assets/images/hero-bg-4.jpg",
  ];

  const unique = Array.from(new Set(candidates));
  const shuffled = unique
    .map((v) => ({ v, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.v);

  const tryLoad = (srcIdx) =>
    new Promise((resolve) => {
      if (srcIdx >= shuffled.length) return resolve(null);
      const src = shuffled[srcIdx];
      const probe = new Image();
      probe.onload = () => resolve(src);
      probe.onerror = () => resolve(tryLoad(srcIdx + 1));
      probe.src = src;
    });

  tryLoad(0).then((src) => {
    if (!src) return;
    img.src = src;
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

function getTimeContext(now = new Date()) {
  const hour = now.getHours(); // visitor local time
  const timeStr = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  let slot = "day";
  if (hour >= 0 && hour <= 4) slot = "lateNight";
  else if (hour >= 5 && hour <= 8) slot = "early";
  else if (hour >= 9 && hour <= 11) slot = "morning";
  else if (hour >= 12 && hour <= 13) slot = "noon";
  else if (hour >= 14 && hour <= 17) slot = "afternoon";
  else if (hour >= 18 && hour <= 20) slot = "dinner";
  else slot = "night";

  return { hour, slot, timeStr };
}

function maybeAddTimeFlavor(baseText, speaker, config) {
  const t = (baseText || "").trim();
  if (!t) return t;

  const flavor = config && typeof config === "object" ? config : null;
  if (!flavor) return t;
  const chance = Number.isFinite(flavor.chance) ? flavor.chance : 0;
  if (chance <= 0) return t;

  // Avoid making every line time-aware; keep it occasional.
  if (Math.random() > chance) return t;

  const { slot } = getTimeContext();
  const kt = flavor.KT && typeof flavor.KT === "object" ? flavor.KT : null;
  const yt = flavor.YT && typeof flavor.YT === "object" ? flavor.YT : null;
  if (!kt || !yt) return t;
  const tail = (speaker === "KT" ? kt : yt)[slot];
  if (!tail) return t;

  // Keep it short; avoid double punctuation.
  const joiner = t.endsWith("。") || t.endsWith("！") || t.endsWith("？") ? " " : "。";
  return `${t}${joiner}${tail}`;
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
  const autoSpoken = new Set();
  const recentClicks = {
    KT: [],
    YT: [],
  };

  const positionBubbleNear = (btn) => {
    if (!bubble) return;
    const rect = btn.getBoundingClientRect();
    const pad = 12;
    const bw = bubble.getBoundingClientRect().width || 360;
    const bh = bubble.getBoundingClientRect().height || 120;

    // default place above the character
    let left = rect.left + rect.width / 2 - bw / 2;
    let top = rect.top - bh - pad;

    // if not enough space above, place below
    if (top < pad) top = rect.bottom + pad;

    // keep within viewport
    left = Math.max(pad, Math.min(left, window.innerWidth - bw - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - bh - pad));

    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  };

  const setBubble = (speaker, text, sub) => {
    if (speakerEl) speakerEl.textContent = speaker || "—";
    if (textEl) textEl.textContent = text || "";
    if (subEl) subEl.textContent = sub || "";
    if (bubble) {
      bubble.classList.remove("is-left", "is-right");
      if (speaker === "KT") bubble.classList.add("is-left");
      else if (speaker === "YT") bubble.classList.add("is-right");
    }
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

  const rapidClickReply = (charId) => {
    const kt = [
      "……你很閒嗎。",
      "停。作者要噴錢了。",
      "我知道你很喜歡，但先停。",
    ];
    const yt = [
      "欸欸欸你也點太快了吧。",
      "好啦好啦我知道你很愛點，但先休息一下。",
      "再點下去作者真的會噴錢喔。",
    ];
    const pool = charId === "KT" ? kt : yt;
    return { text: pickRandom(pool), source: "easter" };
  };

  const recordClick = (charId) => {
    const now = Date.now();
    const arr = recentClicks[charId] || [];
    arr.push(now);
    // keep last 10s
    while (arr.length && now - arr[0] > 10_000) arr.shift();
    recentClicks[charId] = arr;
    return arr.length;
  };

  const sectionReply = (sectionId) => {
    const sec = lines && lines.sections && lines.sections[sectionId];
    if (!sec) return null;
    // 兩隻小人都在，挑一隻講就好（偏向 YT，避免太「客服」）
    const speaker = Math.random() < 0.55 ? "YT" : "KT";
    const pool = sec[speaker] || [];
    const text = pickRandom(pool);
    if (!text) return null;
    return { speaker, text, source: `section:${sectionId}` };
  };

  const onClick = async (charId, btn) => {
    const now = Date.now();
    if (now < cooldownUntil) return;

    setDisabled(true);
    setBubble(charId, "……", "（思考中）");
    if (btn) positionBubbleNear(btn);

    // 先本地台詞庫跑起來，再慢慢接後端
    if (!lines) lines = await loadGreeterLines();

    try {
      const clickCount = recordClick(charId);

      // 連點彩蛋：10 秒內同一隻點太多次，回吐槽並延長冷卻
      const isRapid = clickCount >= 6;
      const reply = isRapid ? rapidClickReply(charId) : localReply(charId);
      const flavored = maybeAddTimeFlavor(reply.text, charId, lines && lines.timeFlavor);
      const text = clampText(flavored, 60);
      setBubble(charId, text, "");
      if (btn) positionBubbleNear(btn);
      const cd = isRapid ? 4200 : 1200;
      cooldownUntil = Date.now() + Math.min(5000, Math.max(600, cd));
    } catch {
      const reply = localReply(charId);
      const flavored = maybeAddTimeFlavor(reply.text, charId, lines && lines.timeFlavor);
      setBubble(charId, clampText(flavored, 60), "");
      if (btn) positionBubbleNear(btn);
      cooldownUntil = Date.now() + 1200;
    } finally {
      setTimeout(() => setDisabled(false), Math.max(0, cooldownUntil - Date.now()));
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => onClick(btn.getAttribute("data-greeter"), btn));
  });

  // Auto speak on section enter (once per section per page load)
  const sectionMap = {
    top: "#top",
    what: "#what",
    works: "#works",
    dyh: "#work-dyh",
    aw: "#work-aw",
    highlights: 'section[aria-label="活動與分享"]',
    about: "#about",
    contact: "#contact",
  };

  const getSectionEl = (key) => qs(sectionMap[key]);

  const runAutoSpeak = async (key) => {
    const now = Date.now();
    if (now < cooldownUntil) return;
    if (autoSpoken.has(key)) return;
    autoSpoken.add(key);

    if (!lines) lines = await loadGreeterLines();
    const r = sectionReply(key);
    if (!r) return;

    // 找對應角色按鈕定位氣泡
    const btn = qs(`[data-greeter="${r.speaker}"]`);
    const flavored = maybeAddTimeFlavor(r.text, r.speaker, lines && lines.timeFlavor);
    setBubble(r.speaker, clampText(flavored, 60), "");
    if (btn) positionBubbleNear(btn);
    cooldownUntil = Date.now() + 1400;
  };

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const key = ent.target.getAttribute("data-auto-say");
          if (key) runAutoSpeak(key);
        }
      },
      { root: null, rootMargin: "-35% 0px -45% 0px", threshold: 0.01 }
    );

    for (const key of Object.keys(sectionMap)) {
      const el = getSectionEl(key);
      if (!el) continue;
      el.setAttribute("data-auto-say", key);
      io.observe(el);
    }
  }
}

document.documentElement.classList.add("js");
setupFooterYear();
setupSmoothScrollOffset();
setupHeroStagger();
setupHeroBgRotation();
setupReveal();
setupGreeter();

