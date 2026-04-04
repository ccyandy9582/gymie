# Gymie MVP

Gymie 是一個跑步 + 重訓的個人訓練追蹤 MVP，包含：

- 使用者註冊/登入（JWT + Refresh Token）
- 訓練偏好設定與計劃管理
- 跑步與重訓訓練紀錄
- PR（Personal Records）查詢
- AI 計劃生成（Anthropic Claude）與 Prompt 版本/使用紀錄

## 專案結構

- `db/init.sql`: PostgreSQL schema、索引、預設 prompt seed
- `backend`: Node.js + Express API
- `backend/openapi.yaml`: OpenAPI 3.1 規格

## 快速啟動（Backend）

1. 複製環境變數

```bash
cp .env.example .env
```

可在 root `.env` 統一修改：

- `BACKEND_PORT`（預設 `4101`）
- `FRONTEND_PORT`（預設 `4100`）
- `NEXT_PUBLIC_API_URL`（可選，留空時自動用 `BACKEND_PORT` 推導）
- `DATABASE_SSL`（預設 `false`；只有資料庫支援 SSL 才設為 `true`）
- `DATABASE_SSL_REJECT_UNAUTHORIZED`（預設 `false`）
- 若 `POSTGRES_PASSWORD` 含 `$`/`#` 等特殊字元，建議在 root `.env` 用單引號包起來（例如 `POSTGRES_PASSWORD='abc$#*123'`）

2. 建立資料庫並執行 `db/init.sql`

3. 安裝 backend 依賴並啟動

```bash
cd backend
npm install
npm start
```

4. 健康檢查

```bash
curl http://localhost:4101/api/health
```

## 主要 API 群組

- `POST /api/auth/register|login|refresh`
- `GET/PUT /api/users/me`
- `GET/POST /api/plans`
- `POST /api/plans/ai-generate`
- `POST /api/plans/:id/accept`
- `GET/POST/PUT /api/workouts...`
- `GET/POST/PUT /api/runs...`
- `GET /api/records/running|strength`
- `POST /api/ai/analyze-history|generate-plan|feedback`

完整欄位請看 `backend/openapi.yaml`。

## 快速啟動（Web Frontend）

1. 安裝與啟動

```bash
cd frontend
npm install
npm run dev
```

2. 開啟 `http://localhost:4100`（或你在 root `.env` 設定的 `FRONTEND_PORT`）

目前已實作頁面：

- `/login`（註冊/登入）
- `/dashboard`
- `/onboarding`
- `/preferences`
- `/plans`（AI 生成 + 預覽 + commit）
- `/workouts`（重訓記錄）
- `/runs`（跑步記錄）
- `/history`
- `/records`
