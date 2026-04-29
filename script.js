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

function setupSectionColorBlocks() {
  const sections = qsa("main .section:not(.hero)");
  if (!sections.length) return;

  const variants = ["block-sky", "block-mint", "block-peach", "block-lilac"];
  let prev = "";

  sections.forEach((section) => {
    section.classList.add("has-color-blocks");
    const pool = variants.filter((v) => v !== prev);
    const pick = pool[Math.floor(Math.random() * pool.length)] || variants[0];
    section.classList.add(pick);
    prev = pick;
  });
}

function setupGlobalDecoImage() {
  const candidates = [
    "./assets/images/deco-1.png",
    "./assets/images/deco-2.png",
    "./assets/images/deco-3.png",
  ];
  if (!candidates.length) return;

  const unique = Array.from(new Set(candidates));
  const storageKey = "global-deco-last";
  const last = sessionStorage.getItem(storageKey);
  const pool = unique.filter((src) => src !== last);
  const shuffled = (pool.length ? pool : unique)
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
    const exists = qs(".global-deco-image");
    if (exists) exists.remove();
    const deco = document.createElement("div");
    deco.className = "global-deco-image";
    deco.style.setProperty("--global-deco-image", `url("${src}")`);
    document.body.appendChild(deco);
    sessionStorage.setItem(storageKey, src);
  });
}

async function loadGreeterLines() {
  const FALLBACK = {
    KT: ["……", "收到。晚點我會處理。", "別跟我說「應該」。給我重現步驟。"],
    YT: ["……", "你來了就好，先坐。", "存檔、備份、再存檔。"],
    meta: ["……", "（沉默）……作者在忙。", "今天先到這裡。作者要回去做事。"],
    dropzones: {
      _notes:
        "可選：拖曳放下（drop）命中特定區域時的「拖曳專用」台詞。若不填，前端會自動重用 sections.<zoneId> 的台詞（避免維護兩套）。",
    },
    collisions: {
      KT_on_YT: ["別擋路。"],
      YT_on_KT: ["欸你很兇耶。"],
    },
    dialogues: {
      YT_on_KT: [
        { speaker: "YT", text: "欸嘿", delayMs: 0 },
        { speaker: "KT", text: "……（臉紅）", delayMs: 520 },
      ],
    },
  };
  try {
    const res = await fetch("./characters/greeter-lines.json", { cache: "no-cache" });
    if (!res.ok) return FALLBACK;
    return await res.json();
  } catch {
    return FALLBACK;
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
  let suppressClickUntil = 0;
  let dialoguePlaying = false;
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

    // 以人物頭部作為箭頭目標點，箭頭方向依相對位置動態切換
    const headX = rect.left + rect.width / 2;
    const headY = rect.top + rect.height * 0.28;
    const relX = headX - left;
    const relY = headY - top;
    const edgePad = 24;

    bubble.classList.remove("tail-left", "tail-right", "tail-top", "tail-bottom");
    // 先重置，避免前一次方向殘留造成偶發錯位
    bubble.style.removeProperty("--tail-x");
    bubble.style.removeProperty("--tail-y");

    // 從氣泡中心朝人物頭部做射線，命中哪條邊就把箭頭放在哪條邊
    const cx = bw / 2;
    const cy = bh / 2;
    const dx = relX - cx;
    const dy = relY - cy;

    const tx =
      dx === 0
        ? Number.POSITIVE_INFINITY
        : ((dx > 0 ? bw : 0) - cx) / dx;
    const ty =
      dy === 0
        ? Number.POSITIVE_INFINITY
        : ((dy > 0 ? bh : 0) - cy) / dy;
    const hitVertical = tx > 0 && tx <= ty;
    const t = hitVertical ? tx : ty;
    const ix = cx + dx * t;
    const iy = cy + dy * t;

    if (hitVertical) {
      const tailY = Math.max(edgePad, Math.min(iy, bh - edgePad));
      bubble.style.setProperty("--tail-y", `${Math.round(tailY)}px`);
      if (dx < 0) bubble.classList.add("tail-left");
      else bubble.classList.add("tail-right");
    } else {
      // 上下邊箭頭時，X 位置優先貼近頭部水平位置
      const tailX = Math.max(edgePad, Math.min(relX, bw - edgePad));
      bubble.style.setProperty("--tail-x", `${Math.round(tailX)}px`);
      if (dy < 0) bubble.classList.add("tail-top");
      else bubble.classList.add("tail-bottom");
    }
  };

  const setBubble = (speaker, text, sub) => {
    if (speakerEl) speakerEl.textContent = speaker || "—";
    if (textEl) textEl.textContent = text || "";
    if (subEl) subEl.textContent = sub || "";
    if (bubble) {
      bubble.classList.remove("speaker-kt", "speaker-yt");
      if (speaker === "KT") bubble.classList.add("speaker-kt");
      else if (speaker === "YT") bubble.classList.add("speaker-yt");
    }
    if (bubble) bubble.hidden = false;
  };

  const setDisabled = (disabled) => {
    buttons.forEach((b) => (b.disabled = disabled));
  };

  const getCharId = (btn) => (btn && btn.getAttribute("data-greeter")) || "";
  const getBtnByChar = (charId) => buttons.find((b) => getCharId(b) === charId) || null;

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
    if (now < suppressClickUntil) return;
    if (dialoguePlaying) return;

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
    btn.addEventListener("click", (e) => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick(getCharId(btn), btn);
    });
  });

  // --- Drag interactions (pointer-based; mouse + touch) ---
  // Convert initial CSS positions (incl. right/bottom) into left/top so we can drag consistently.
  const normalizeToLeftTop = (btn) => {
    const rect = btn.getBoundingClientRect();
    btn.style.left = `${Math.round(rect.left)}px`;
    btn.style.top = `${Math.round(rect.top)}px`;
    btn.style.right = "auto";
    btn.style.bottom = "auto";
  };

  const safeNumber = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

  const getInlineLeftTop = (btn) => {
    const left = safeNumber(parseFloat(btn.style.left), btn.getBoundingClientRect().left);
    const top = safeNumber(parseFloat(btn.style.top), btn.getBoundingClientRect().top);
    return { left, top };
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  const rectOverlapArea = (a, b) => {
    const x1 = Math.max(a.left, b.left);
    const y1 = Math.max(a.top, b.top);
    const x2 = Math.min(a.right, b.right);
    const y2 = Math.min(a.bottom, b.bottom);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    return w * h;
  };

  const trySwapImageSrc = (imgEl, nextSrc) =>
    new Promise((resolve) => {
      if (!imgEl || !nextSrc) return resolve(false);
      const probe = new Image();
      probe.onload = () => {
        imgEl.src = nextSrc;
        resolve(true);
      };
      probe.onerror = () => resolve(false);
      probe.src = nextSrc;
    });

  const maybeSetGlobalDecoDragging = (() => {
    const dragSrc = "./assets/images/deco-drag.png";

    const setCssUrl = (el, urlValue) => {
      if (!el) return;
      if (!urlValue) el.style.removeProperty("--global-deco-image");
      else el.style.setProperty("--global-deco-image", urlValue);
    };

    const canLoad = async (src) =>
      await new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = src;
      });

    return async (isDragging) => {
      const deco = qs(".global-deco-image");
      if (!deco) return;

      if (isDragging) {
        // Use computed style + element dataset to make restore robust
        // even if the element gets recreated or inline styles change.
        if (!deco.dataset.decoPrev) {
          const computed = getComputedStyle(deco).getPropertyValue("--global-deco-image");
          deco.dataset.decoPrev = (computed || "").trim();
        }
        const ok = await canLoad(dragSrc);
        if (!ok) return;
        setCssUrl(deco, `url("${dragSrc}")`);
      } else {
        const prev = deco.dataset.decoPrev;
        if (prev == null) return;
        if (!String(prev).trim()) setCssUrl(deco, null);
        else setCssUrl(deco, String(prev).trim());
        delete deco.dataset.decoPrev;
      }
    };
  })();

  const setCharDraggingVisual = async (btn, isDragging) => {
    if (!btn) return;
    btn.classList.toggle("is-dragging", !!isDragging);
    const img = qs(".greeter-float-img", btn);
    const charId = getCharId(btn);
    if (!img || (charId !== "KT" && charId !== "YT")) return;
    const dragSrc = `./assets/images/${charId}-drag.png`;
    const idleSrc = `./assets/images/${charId}.png`;
    if (isDragging) {
      await trySwapImageSrc(img, dragSrc);
    } else {
      // always restore to idle (even if dragSrc never existed)
      img.src = idleSrc;
    }
  };

  const getDropzones = () => qsa("[data-dropzone]");

  const dropzoneReply = (zoneId, dragChar) => {
    // Goal: avoid maintaining two sets of the same content.
    // Priority:
    // 1) dropzones[zoneId][dragChar] (drag-specific lines, optional)
    // 2) sections[zoneId][dragChar]  (reuse existing "auto speak on section enter" lines)
    // 3) sections[zoneId][otherChar] (fallback to other speaker if needed)
    const dz = lines && lines.dropzones && lines.dropzones[zoneId];
    if (dz && (dragChar === "KT" || dragChar === "YT")) {
      const pool = dz[dragChar] || [];
      const t = pickRandom(pool);
      if (t) return { speaker: dragChar, text: t, source: `dropzone:${zoneId}` };
    }

    const sec = lines && lines.sections && lines.sections[zoneId];
    if (!sec) return null;
    if (dragChar !== "KT" && dragChar !== "YT") return sectionReply(zoneId);

    const primary = pickRandom(sec[dragChar] || []);
    if (primary) return { speaker: dragChar, text: primary, source: `section:${zoneId}` };

    const other = dragChar === "KT" ? "YT" : "KT";
    const fallback = pickRandom(sec[other] || []);
    if (fallback) return { speaker: other, text: fallback, source: `section:${zoneId}` };

    return null;
  };

  const normalizeDialogueSteps = (seq) => {
    if (!Array.isArray(seq) || seq.length === 0) return [];
    return seq
      .map((s) => ({
        speaker: (s && String(s.speaker || "")).toUpperCase(),
        text: typeof s?.text === "string" ? s.text : "",
        delayMs: Number.isFinite(s?.delayMs) ? s.delayMs : 0,
      }))
      .filter((s) => (s.speaker === "KT" || s.speaker === "YT") && s.text.trim());
  };

  const collisionDialogue = (dragChar, targetChar) => {
    const key = `${dragChar}_on_${targetChar}`;
    const raw = lines && lines.dialogues && lines.dialogues[key];
    if (!raw) return null;

    // Supported formats:
    // 1) dialogues[key] = Step[]
    // 2) dialogues[key] = Step[][]  (variants)
    // 3) dialogues[key] = { variants: Step[][] }
    let picked = null;
    if (Array.isArray(raw)) {
      const looksLikeStep = raw.some((x) => x && typeof x === "object" && ("speaker" in x || "text" in x));
      const looksLikeVariants = Array.isArray(raw[0]);
      if (looksLikeVariants) picked = pickRandom(raw);
      else if (looksLikeStep) picked = raw;
    } else if (raw && typeof raw === "object" && Array.isArray(raw.variants)) {
      picked = pickRandom(raw.variants);
    }

    const steps = normalizeDialogueSteps(picked);
    return steps.length ? { key, steps } : null;
  };

  const collisionReply = (dragChar, targetChar) => {
    const key = `${dragChar}_on_${targetChar}`;
    const pool = lines && lines.collisions && lines.collisions[key];
    const t = pickRandom(pool || []);
    if (!t) return null;
    return { speaker: dragChar, text: t, source: `collision:${key}` };
  };

  const sleep = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms | 0)));

  const playDialogue = async (steps) => {
    const now = Date.now();
    if (now < cooldownUntil) return false;
    if (dialoguePlaying) return false;
    if (!Array.isArray(steps) || steps.length === 0) return false;
    if (!lines) lines = await loadGreeterLines();

    dialoguePlaying = true;
    setDisabled(true);
    suppressClickUntil = Date.now() + 1200;

    try {
      for (const step of steps) {
        const speaker = step.speaker;
        const text = step.text;
        const delayMs = Number.isFinite(step.delayMs) ? step.delayMs : 0;
        if (delayMs > 0) await sleep(delayMs);

        const anchorBtn = getBtnByChar(speaker);
        setBubble(speaker, clampText(text, 60), "");
        if (anchorBtn) positionBubbleNear(anchorBtn);
      }

      cooldownUntil = Date.now() + 1600;
      return true;
    } finally {
      setTimeout(() => setDisabled(false), Math.max(0, cooldownUntil - Date.now()));
      dialoguePlaying = false;
    }
  };

  const triggerSay = async (speaker, text, anchorBtn) => {
    const now = Date.now();
    if (now < cooldownUntil) return false;
    if (dialoguePlaying) return false;
    if (!lines) lines = await loadGreeterLines();
    const flavored = maybeAddTimeFlavor(text, speaker, lines && lines.timeFlavor);
    setBubble(speaker, clampText(flavored, 60), "");
    if (anchorBtn) positionBubbleNear(anchorBtn);
    cooldownUntil = Date.now() + 1400;
    return true;
  };

  // Initialize drag positions to left/top once.
  buttons.forEach((btn) => normalizeToLeftTop(btn));

  const DRAG_THRESHOLD = 8;
  const SOFT_PAD = 24; // allow slight overflow while dragging
  const SNAP_MS = 140;

  const dragState = {
    active: false,
    moved: false,
    pointerId: null,
    btn: null,
    charId: "",
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,
  };

  const setBtnLeftTop = (btn, left, top) => {
    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;
  };

  const snapBtnIntoViewport = (btn) => {
    const rect = btn.getBoundingClientRect();
    const { left, top } = getInlineLeftTop(btn);
    const w = rect.width || 1;
    const h = rect.height || 1;
    const minL = 0;
    const minT = 0;
    const maxL = Math.max(0, window.innerWidth - w);
    const maxT = Math.max(0, window.innerHeight - h);
    const clampedL = clamp(left, minL, maxL);
    const clampedT = clamp(top, minT, maxT);
    btn.classList.add("is-snapping");
    setBtnLeftTop(btn, clampedL, clampedT);
    window.setTimeout(() => btn.classList.remove("is-snapping"), SNAP_MS + 40);
  };

  const handleDropTriggers = async (dragBtn, dragChar) => {
    if (!dragBtn || (dragChar !== "KT" && dragChar !== "YT")) return;
    if (!lines) lines = await loadGreeterLines();
    if (dialoguePlaying) return;

    const dragRect = dragBtn.getBoundingClientRect();

    // 1) Collision with the other greeter
    const otherBtn = buttons.find((b) => b !== dragBtn);
    if (otherBtn) {
      const otherChar = getCharId(otherBtn);
      const otherRect = otherBtn.getBoundingClientRect();
      const area = rectOverlapArea(dragRect, otherRect);
      if (area > 0) {
        const d = collisionDialogue(dragChar, otherChar);
        if (d) {
          const ok = await playDialogue(d.steps);
          if (ok) return;
        }
        const r = collisionReply(dragChar, otherChar);
        if (r) {
          await triggerSay(r.speaker, r.text, dragBtn);
          return;
        }
      }
    }

    // 2) Dropzones
    const zones = getDropzones();
    let best = null;
    for (const z of zones) {
      const zoneId = z.getAttribute("data-dropzone");
      if (!zoneId) continue;
      const zr = z.getBoundingClientRect();
      const area = rectOverlapArea(dragRect, zr);
      if (area <= 0) continue;
      if (!best || area > best.area) best = { zoneId, area };
    }
    if (best) {
      const r = dropzoneReply(best.zoneId, dragChar);
      if (r) {
        const anchorBtn = getBtnByChar(r.speaker) || dragBtn;
        await triggerSay(r.speaker, r.text, anchorBtn);
      }
    }
  };

  const onPointerDown = async (e, btn) => {
    if (!btn || btn.disabled) return;
    if (e.button != null && e.button !== 0) return; // left click only
    if (dialoguePlaying) return;
    const charId = getCharId(btn);
    if (charId !== "KT" && charId !== "YT") return;

    dragState.active = true;
    dragState.moved = false;
    dragState.pointerId = e.pointerId;
    dragState.btn = btn;
    dragState.charId = charId;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    const { left, top } = getInlineLeftTop(btn);
    dragState.originLeft = left;
    dragState.originTop = top;

    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = async (e) => {
    if (!dragState.active) return;
    if (dragState.pointerId !== e.pointerId) return;
    const btn = dragState.btn;
    if (!btn) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const dist = Math.hypot(dx, dy);

    if (!dragState.moved) {
      if (dist < DRAG_THRESHOLD) return;
      dragState.moved = true;
      suppressClickUntil = Date.now() + 600;
      document.body.classList.add("is-greeter-dragging");
      if (bubble) bubble.hidden = true;
      await setCharDraggingVisual(btn, true);
      await maybeSetGlobalDecoDragging(true);
    }

    const rect = btn.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const minL = -SOFT_PAD;
    const minT = -SOFT_PAD;
    const maxL = window.innerWidth - w + SOFT_PAD;
    const maxT = window.innerHeight - h + SOFT_PAD;

    const nextL = clamp(dragState.originLeft + dx, minL, maxL);
    const nextT = clamp(dragState.originTop + dy, minT, maxT);
    setBtnLeftTop(btn, nextL, nextT);
  };

  const endDrag = async (e) => {
    if (!dragState.active) return;
    if (dragState.pointerId !== e.pointerId) return;
    const btn = dragState.btn;
    const charId = dragState.charId;
    const moved = dragState.moved;

    dragState.active = false;
    dragState.moved = false;
    dragState.pointerId = null;
    dragState.btn = null;
    dragState.charId = "";

    if (btn) {
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (!btn) return;

    if (moved) {
      // no snap-back; keep the dropped position
      await handleDropTriggers(btn, charId);
    }

    document.body.classList.remove("is-greeter-dragging");
    await setCharDraggingVisual(btn, false);
    await maybeSetGlobalDecoDragging(false);
  };

  buttons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => onPointerDown(e, btn));
  });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

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
setupSectionColorBlocks();
setupGlobalDecoImage();
setupReveal();
setupGreeter();

