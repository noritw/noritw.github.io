type Env = {
  KV: KVNamespace;
  OPENAI_API_KEY?: string;
  LLM_RATIO?: string;
  IP_DAILY_LIMIT?: string;
  IP_HOURLY_LIMIT?: string;
  LLM_DAILY_LIMIT?: string;
  MAX_CHARS?: string;
};

type GreeterLines = {
  KT: string[];
  YT: string[];
  meta?: string[];
};

const DEFAULT_LINES: GreeterLines = {
  KT: [
    "今天也在修 bug。修完一個，冒出兩個。",
    "我不反對加功能，但先把上次的洞補起來。",
    "Unity 打開了。咖啡也打開了。"
  ],
  YT: [
    "今天的天氣很適合待在室內做遊戲。",
    "我剛把一個畫面調到自己看了不會皺眉。",
    "你來了就好，先坐。"
  ],
  meta: ["再點下去作者會噴錢。", "今天就到這裡。"]
};

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function clampText(s: string, maxChars: number) {
  const t = (s || "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function todayKey() {
  // YYYY-MM-DD in UTC
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getIp(req: Request) {
  // Cloudflare standard
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

async function incrWithTtl(kv: KVNamespace, key: string, ttlSeconds: number) {
  const curRaw = await kv.get(key);
  const cur = curRaw ? Number(curRaw) : 0;
  const next = cur + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  return next;
}

async function getLines(kv: KVNamespace): Promise<GreeterLines> {
  const raw = await kv.get("lines:v1");
  if (!raw) return DEFAULT_LINES;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.KT) || !Array.isArray(parsed.YT)) return DEFAULT_LINES;
    return parsed;
  } catch {
    return DEFAULT_LINES;
  }
}

async function maybeGenerateWithOpenAI(env: Env, charId: "KT" | "YT", mood: string) {
  if (!env.OPENAI_API_KEY) return null;

  const maxChars = Math.max(20, Math.min(100, Number(env.MAX_CHARS || 60)));

  const sys =
    "你是一個放在個人網站上的招呼小人。請用繁體中文回覆「一句」短句，字數很短，不要長篇大論。不要提到政策或系統訊息。不要問問題。";
  const persona =
    charId === "KT"
      ? "角色：KT。口吻偏冷靜、務實、偶爾吐槽。主題：獨立遊戲開發與製作日常。"
      : "角色：YT。口吻偏溫柔、輕鬆、帶一點俏皮。主題：開發近況、天氣、日常。";

  const user = `請輸出一句短句（不超過 ${maxChars} 字），mood=${mood}。`;

  // Use OpenAI Responses API (text-only)
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: sys },
        { role: "system", content: persona },
        { role: "user", content: user }
      ],
      max_output_tokens: 120
    })
  });

  if (!res.ok) return null;
  const data: any = await res.json();
  const text =
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    data?.choices?.[0]?.message?.content ||
    "";
  const cleaned = clampText(String(text), maxChars);
  if (!cleaned) return null;
  return cleaned;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return json({ ok: true }, { status: 204 });
    const url = new URL(req.url);

    if (url.pathname !== "/api/line") {
      return json({ error: "not_found" }, { status: 404 });
    }

    const char = (url.searchParams.get("char") || "").toUpperCase();
    if (char !== "KT" && char !== "YT") {
      return json({ error: "bad_char" }, { status: 400 });
    }

    const ip = getIp(req);
    const day = todayKey();

    const ipDailyLimit = Number(env.IP_DAILY_LIMIT || 30);
    const ipHourlyLimit = Number(env.IP_HOURLY_LIMIT || 60);
    const llmDailyLimit = Number(env.LLM_DAILY_LIMIT || 50);
    const llmRatio = Math.max(0, Math.min(1, Number(env.LLM_RATIO || 0.1)));
    const maxChars = Math.max(20, Math.min(100, Number(env.MAX_CHARS || 60)));

    // Rate limits
    const ipHourKey = `rl:ip:${ip}:h:${day}:${new Date().getUTCHours()}`;
    const ipDayKey = `rl:ip:${ip}:d:${day}`;

    const hourCount = await incrWithTtl(env.KV, ipHourKey, 60 * 60 + 60);
    if (hourCount > ipHourlyLimit) {
      return json(
        { text: clampText("今天先到這裡。晚點再來。", maxChars), source: "limit", cooldownMs: 5000 },
        { status: 200 }
      );
    }

    const dayCount = await incrWithTtl(env.KV, ipDayKey, 24 * 60 * 60 + 60);
    if (dayCount > ipDailyLimit) {
      return json(
        { text: clampText("再點下去作者會噴錢。", maxChars), source: "limit", cooldownMs: 8000 },
        { status: 200 }
      );
    }

    const lines = await getLines(env.KV);
    const pool = char === "KT" ? lines.KT : lines.YT;
    const meta = lines.meta || DEFAULT_LINES.meta || [];

    // Basic mood (no chat memory): stable-ish by day + ip + char
    const moodSeed = `${day}|${ip}|${char}`;
    const mood = moodSeed.length % 2 === 0 ? "normal" : "busy";

    let text: string | null = null;
    let source: string = "local";

    // Decide LLM usage (global daily cap)
    const tryLLM = Math.random() < llmRatio;
    if (tryLLM) {
      const llmKey = `cap:llm:${day}`;
      const llmCount = await incrWithTtl(env.KV, llmKey, 24 * 60 * 60 + 60);
      if (llmCount <= llmDailyLimit) {
        const gen = await maybeGenerateWithOpenAI(env, char as "KT" | "YT", mood);
        if (gen) {
          text = gen;
          source = "llm";
        }
      }
    }

    if (!text) {
      text = clampText(pickRandom(pool.length ? pool : meta), maxChars);
      source = "local";
    }

    return json({ text, source, cooldownMs: 1200 }, { status: 200 });
  }
};

