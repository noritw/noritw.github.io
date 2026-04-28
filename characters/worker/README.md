## nori Greeter Worker（Cloudflare）

這是給 `nori.tw` 網站用的「招呼小人」後端：
- 前端無輸入，後端回一句短句
- 台詞庫為主，少量（預設 10%）用 OpenAI 補洞
- IP 限流 + 每日配額 + 全站每日 LLM 上限
- API Key 只放在 Worker secret，避免外流

### 1) 前置需求
- Cloudflare 帳號
- 安裝 Node.js（LTS）
- 登入 Cloudflare Wrangler

### 2) 建 KV（用來做限流/配額/台詞庫）
在 Cloudflare Dashboard 建一個 KV namespace（名稱隨意，例如 `NORI_GREETER_KV`），把 ID 填回 `wrangler.toml`：

`characters/worker/wrangler.toml`
```toml
{ binding = "KV", id = "REPLACE_WITH_KV_ID" }
```

### 3) 放台詞庫到 KV（可選）
你可以把 `characters/greeter-lines.json` 的內容丟到 KV key `lines:v1`。

### 4) 設定 OpenAI API Key（secret）
在 `characters/worker` 內執行：
```bash
npm install
npx wrangler secret put OPENAI_API_KEY
```

### 5) 部署
```bash
npx wrangler deploy
```

部署後你會拿到一個 Worker URL（例如 `https://nori-greeter.<something>.workers.dev/api/line`）

### 6) 讓前端指到 Worker
最簡單做法：在 `index.html` 的 `<body>` 底部 `script.js` 之前，加一行：
```html
<script>window.__GREETER_API__="https://你的-worker-url/api/line"</script>
```

或者把 Worker 綁到你的自訂網域，讓它變成同源 `/api/line`（那就不用加這段）。

