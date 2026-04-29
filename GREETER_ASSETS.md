## Greeter 換圖資源規格（KT / YT）

這份文件整理 `nori.tw` 的「招呼小人（Greeter）」在拖曳互動中會用到的**換圖資源檔名**與**行為規則**，方便你在不同電腦/環境維護時對齊。

> 放置位置：所有路徑皆以網站根目錄為基準（`noritw.github.io/`）。
> 圖檔請放在：`./assets/images/`

---

## 1) 角色小人：拖曳表情切換

### 檔名規格
- **KT**
  - **預設（idle）**：`./assets/images/KT.png`
  - **拖曳中（drag）**：`./assets/images/KT-drag.png`
- **YT**
  - **預設（idle）**：`./assets/images/YT.png`
  - **拖曳中（drag）**：`./assets/images/YT-drag.png`

### 觸發時機
- **開始拖曳（超過拖曳門檻）**：切換成 `*-drag.png`
- **拖曳結束（放開 / cancel）**：切回 `*.png`

### 缺檔/載入失敗時的行為
- 如果 `KT-drag.png` / `YT-drag.png` 不存在或載入失敗：
  - 拖曳中 **不會換成功**（會維持原本顯示的圖）
  - 放開時 **仍會強制回到** `KT.png` / `YT.png`（確保狀態一致）

---

## 2) 全站手繪 deco 背景：拖曳期間暫時換圖（`.global-deco-image`）

### 檔名規格
- **拖曳中背景（drag）**：`./assets/images/deco-drag.png`

### 觸發時機
- **開始拖曳（超過拖曳門檻）**：
  - 嘗試把 `.global-deco-image` 的 CSS 變數 `--global-deco-image` 換成拖曳用 deco
  - 同時記住「拖曳前的 `--global-deco-image`」以便還原
- **拖曳結束（放開 / cancel）**：
  - 如果先前有成功記錄到原始 `--global-deco-image`，則還原

### 缺檔/載入失敗時的行為
- 若 `deco-drag.png` 不存在或載入失敗：拖曳中 **不換背景**（no-op），放開也不會壞。

---

## 3) 目前程式會讀的檔名總表（複製貼上用）

```text
./assets/images/KT.png
./assets/images/YT.png
./assets/images/KT-drag.png
./assets/images/YT-drag.png
./assets/images/deco-drag.png
```

---

## 4) 備註（你可能會踩的點）

- 若你用 `file://` 直接打開 `index.html` 測試，瀏覽器可能會擋 `fetch` 讀 JSON（台詞庫）；但「換圖」本身是 `<img src>`，通常仍可看到（視瀏覽器安全策略而定）。建議用 Live Server 或任何靜態伺服器以 `http://` 測。
- 角色與背景換圖的路徑目前是寫死 `./assets/images/...`，如果你之後想改資料夾結構（例如分 `characters/`、`backgrounds/`），需要同步改 `script.js` 的路徑字串。

