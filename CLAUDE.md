# CLAUDE.md — 二輪四輪オフマップ
最終更新：2026年4月10日

Claude Codeがこのリポジトリで作業する際の参照ドキュメント。

---

## ⚠️ 作業開始前に必ず読むこと

以下のファイルを順番に読んでからタスクに着手すること：

1. 最新の `project_knowledge_vol*.md`（リポジトリルートに存在する場合）
2. 最新のセッションまとめ：
   `/Users/takeomba/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/24offmap/sessions/`
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
    │   ├── page.tsx              ← トップページ（イベント一覧+定期開催）
    │   ├── layout.tsx            ← lang="ja"
    │   ├── globals.css           ← テーマ定義（CSSカスタムプロパティ）
    │   ├── sitemap.ts
    │   ├── components/
    │   │   └── Header.tsx        ← 統一ヘッダー（全ページ共通）
    │   ├── admin/page.tsx
    │   ├── faq/page.tsx
    │   ├── contact/page.tsx
    │   ├── spots/
    │   │   ├── page.tsx          ← オフ会メーカー
    │   │   ├── layout.tsx
    │   │   ├── SpotCard.tsx      ← タブUI（イマココ/行くカモ）
    │   │   └── MapView.tsx       ← フィルタ連動fitBounds
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

### UI設計の経緯（2026年4月）

- **統一ヘッダー**：`Header.tsx` で全ページ共通化（ロゴ + イベント/スポット切替タブ + FAQ）
- **Hero CTA**：「イベントを探す」1ボタンに集約。「イベント投稿」はヒーロー下に控えめリンクとして配置
- **SpotCard**：旧アコーディオン全展開 → タブUI分離（イマココ / 行くカモ）。カレンダー廃止→シンプルリスト
- **用語統一**：「今いるナウ」→「イマココ」、「行く予定」→「行くカモ」（全ページ・MapView含む）
- **フィルター**：「イマココ有」「予定有」ボタンは両方ONでOR条件（どちらかに該当すればOK）
- **地図連動**：フィルタ済みスポットにfitBoundsで地図表示エリアを自動調整
- **V0レビュー活用**：UIデザイン評価はV0に投げて意見を取得。ただし実装判断はClaude側で開発経緯・ユーザー規模・優先度を踏まえて精査する（V0提案を鵜呑みにしない）
- **現時点のV0スコア**：80/100（初回70→改修後80）

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
| V0 | UIデザインレビュー・改善提案（実装判断はClaude側で精査） |

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
- Vault パス：`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/`
- **注意**：macOS FinderからiCloudのObsidianコンテナは直接ブラウズ不可（Terminalからはアクセス可能）

### Obsidian Vault 構成

```
ObsidianVault/
├── 24offmap/
│   ├── sessions/          ← セッションまとめ
│   ├── chats/             ← Claude Export変換済み
│   ├── note-articles/     ← note記事
│   └── knowledge/         ← project_knowledge
├── personal/
├── Analysis/
├── LLM Chats/
├── MOC/
└── _inbox/                ← 自動分類用（→ organize_vault.pyで振り分け）
```

### Downloads監視ウォッチャー（launchd常駐）

| ウォッチャー | plist | 対象 | 保存先 |
|---|---|---|---|
| session-summary | `jp.24offmap.session-summary-watcher` | `session-summary-*.md` | Obsidian/sessions/ |
| session-summary | 同上 | `note_article_*.md` | Obsidian/note-articles/ |
| session-summary | 同上 | `project_knowledge_vol*.md` | リポジトリルート + Obsidian/knowledge/（両方） |
| claude-export | `jp.24offmap.claude-export-watcher` | `data-*.zip` | Obsidian/chats/（MD変換後） |
| inbox | `jp.24offmap.inbox-watcher` | `_inbox/*.md` | organize_vault.pyでキーワード分類→自動振り分け |

### スクリプト一覧（~/scripts/）

| スクリプト | 用途 |
|---|---|
| `watch_session_summary.sh` | Downloads監視（session/note/knowledge） |
| `watch_claude_export.sh` | Downloads監視（Claude Export ZIP） |
| `watch_inbox.sh` | Obsidian _inbox監視（iCloudマウント待ち付き） |
| `convert_claude_export.py` | Claude Export JSON → Markdown変換 |
| `organize_vault.py` | キーワード分類+NFC正規化（単ファイルモード対応） |

- post-commit フック：コミット時にソースコードを Obsidian/source/ へ自動同期

---

## 関連リポジトリ：MAGI EVOLVE SYSTEM（note記事生成パイプライン）

オフマップの開発過程をnote記事として発信するためのパイプライン。

- **リポジトリ**：`/Users/takeomba/Claude Agent/magi-evolve-system`
- **GitHub**：https://github.com/peacewanwan/magi-evolve-system
- **役割**：note.com記事の半自動生成（構想→執筆→推敲→投稿最適化）
- **CLAUDE.md**：上記パスのCLAUDE.mdを参照

### 関係性
- オフマップの開発過程・学び・失敗談がnote記事のネタになる
- noteの発信がオフマップの認知度向上に繋がる（note → X → 24offmap.jp）
- NOTE_CONCEPT.md にアカウント全体のコンセプト定義あり
- 記事の構想は `magi-evolve-system/NotePublishing/Ideas/` に置く
- 開発中に気づいたことや記事ネタは、このリポジトリでの作業中でもメモしてIdeas/に残してよい
- セッション中にmagi-evolve-system側のファイルを変更した場合、コミットはあちら側のリポジトリで行う
- 作業開始時や状況が不明な場合は、両方のリポジトリのgit logを確認して最新状態を把握すること
