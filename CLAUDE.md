# CLAUDE.md — 二輪四輪オフマップ
最終更新：2026年4月6日

Claude Codeがこのリポジトリで作業する際の参照ドキュメント。

---

## ⚠️ 作業開始前に必ず読むこと

以下のファイルを順番に読んでからタスクに着手すること：

1. 最新の `project_knowledge_vol*.md`（リポジトリルートに存在する場合）
2. 最新のセッションまとめ：
   `/Users/takeomba/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVault/24offmap/sessions/`
   にある最新の `session-summary-*.md` を読む
3. 上記が存在しない場合はこのCLAUDE.mdのみで作業する

---

## プロジェクト概要

車・バイクのオフ会・ミーティング情報をクローラーで自動収集し提供する**初参加者向けイベント発見サイト**。

- **サービス名**：二輪四輪オフマップ（愛称：オフマップ）
- **ドメイン**：https://24offmap.jp
- **GitHub**：https://github.com/peacewanwan/car-event-map-pre
- **ローカル**：`/Users/takeomba/car-event-map-pre`

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js + Tailwind CSS（`frontend/`ディレクトリ） |
| DB | Supabase / PostgreSQL |
| ホスティング | Vercel（Hobbyプラン） |
| 地図 | @vis.gl/react-google-maps |
| クローラー | Python（requests + BeautifulSoup） |
| AI正規化 | Anthropic Claude API |
| CI/CD | GitHub Actions（毎日AM4時JST） |

---

## フォルダ構成

```
/Users/takeomba/car-event-map-pre/
├── .env
├── CLAUDE.md
├── .github/workflows/crawler.yml
├── crawler/
│   ├── crawler.py
│   ├── check_sources.py
│   └── update_recurring_ids.py
└── frontend/
    ├── app/
    │   ├── page.tsx              ← トップページ
    │   ├── layout.tsx
    │   ├── globals.css           ← テーマ定義（CSSカスタムプロパティ）
    │   ├── sitemap.ts
    │   ├── admin/page.tsx
    │   ├── faq/page.tsx
    │   ├── contact/page.tsx
    │   ├── spots/
    │   │   ├── page.tsx
    │   │   ├── layout.tsx
    │   │   ├── SpotCard.tsx
    │   │   └── MapView.tsx
    │   └── api/
    │       ├── contact/route.ts
    │       └── submit-event/route.ts
    └── lib/
        ├── supabase.ts           ← サーバー/SSR用
        └── supabase/client.ts   ← ブラウザ用
```

---

## 環境変数（Vercel）

| Key | 用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL |
| NEXT_PUBLIC_SUPABASE_KEY | Supabase Publishable key |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Legacy anon key（/spots用） |
| NEXT_PUBLIC_ADMIN_PASSWORD | carmap2026 |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | Google Maps JavaScript API |
| ANTHROPIC_API_KEY | Claude API（サーバーサイドのみ） |

---

## DBテーブル一覧

### events
重複排除キー：`event_date + name`
category：`meeting` / `track` / `regular` / `show` / `touring` / `unknown`

### sources
crawl_type：`dupcar` / `minkara` / `eventmania` / `generic`
`is_active=true` のみクロール対象（約69件登録済み）

### recurring_events
定期開催イベント（7件登録済み）。eventsのrecurring_idで紐付け。

### spots
ミーティングスポット137件登録済み（道の駅・SA/PA・展望台・駐車場）
座標はGoogle Maps URLから手動取得（Geocoding API不使用）

### spot_checkins
checkin_type：`now`（expires_at = 登録時刻+3時間）/ `plan`（planned_at指定）
time_slot：`morning` / `afternoon` / `evening` / `flexible`
認証：匿名（ニックネームのみ）

---

## デザイン方針

- **モバイル**：ダークテーマ（slate-950ベース）
- **デスクトップ（lg以上）**：ライトテーマ（slate-100ベース）
- テーマ切り替えはCSSカスタムプロパティ（globals.css）で管理
- トップページアクセント：sky-400（モバイル）/ sky-600（デスクトップ）
- オフ会メーカーアクセント：emerald-400

---

## コーディング規約・注意事項

- Pythonパッケージ：`pip3 install --break-system-packages`
- Supabaseブラウザクライアント：`@/lib/supabase/client` から `createClient()`
- Supabaseサーバークライアント：`@/lib/supabase.ts` から `supabase`
- `createClient()` はモジュールスコープに置かない（SSRビルド時クラッシュ）
- 地図：`@vis.gl/react-google-maps`（Leaflet不使用）
- `useMap()` は必ず `<Map>` の子コンポーネント内で呼ぶ（MapInner分離パターン）
- コミット後は必ず `git add -A && git commit -m "メッセージ" && git push origin main` まで実行

---

## 意思決定の原則

- 管理者作業は**100%自動化**が前提（手動入力なし）
- 取得率40〜50%の属性はサブDBとして許容
- SNS API（X・Instagram・Facebook）はスコープ外
- iOSアプリ化はCapacitor（PWAラップ）予定（チェックイン週30件超えてから）

---

## オーナー情報

- **名前**：Takeo
- **拠点**：八王子、東京
- **役割**：sole developer & operator（自身もターゲットユーザー）

---

## AI活用スタイル

| AI | 用途 |
|---|---|
| ChatGPT | ブレスト・評価 |
| Gemini | リサーチ・リスト生成 |
| Claude | 実装・深い継続作業 |

**開発フロー**：Claude Code に一本化（壁打ちから実装まで完結）

---

## 作業スタイル

- モバイルからの作業が多い（コンソールアクセス不可時）
- GitHub Actions UI と Supabase SQL Editor をモバイルから操作
- 自動化優先、手動作業は極力排除
- 構造的思考、マーケより実装・構築を重視

---

## 知識管理システム

- Obsidian Vault 構築済み（iCloud同期）
- セッションまとめ自動保存：`~/Downloads/session-summary-*.md` → Obsidian/sessions/
- project_knowledge 自動同期：`~/Downloads/project_knowledge_vol*.md` → リポジトリ + Obsidian
- Claude Export 自動変換：`~/Downloads/data-*.zip` → Obsidian/chats/
- post-commit フック：コミット時にソースコードを Obsidian/source/ へ自動同期
