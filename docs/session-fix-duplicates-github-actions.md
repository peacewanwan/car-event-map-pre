# セッション記録：二輪四輪オフマップ 開発ログ

**ブランチ**：`claude/fix-duplicates-github-actions-CfIaz`
**作業期間**：2026年3月16日〜3月24日
**担当**：Claude Code

---

## 全体の流れ

| 日付 | 内容 |
|---|---|
| 3/16 | 初回コミット・旧フォルダ削除 |
| 3/17 | クローラー安定化・フィルターUI追加 |
| 3/18 | UI改善・重複排除修正・GitHub Actions整備 |
| 3/19 | サイト名変更・管理画面・イベント投稿フォーム追加 |
| 3/23 | /spotsページ新設（Leaflet→Google Maps移行） |
| 3/24 | /spotsマップUI改善・チェックイン機能・ポップアップ改善 |

---

## 主な変更内容

### 1. クローラー安定化（3/17〜3/18）

- gazoo / eventmania を無効化（スクレイピング失敗のため）
- Supabaseの1000件上限を回避するクエリ修正
- JSON切り捨て・NoneTypeエラー修正
- `target_vehicle` を10文字に制限（正規化プロンプト改善）
- `fetch_generic` のリンク収集・URLマッチング精度向上
- **重複排除キーを `event_date + name` に変更**
- **`venue=null` 時は `event_date + source_url` でフォールバック**

### 2. GitHub Actions 整備（3/18）

- `crawler.yml` 新規作成（毎日AM4時 JST 実行）
- `actions/checkout` v3→v4、`actions/setup-python` v4→v5（Node.js警告解消）

### 3. フロントエンド UI 改善（3/18〜3/19）

- タブ・バッジ・カードデザインのカラー化
- 定期開催イベントタブ追加
- 車種フィルターをセレクトボックス化（DB動的取得）
- 「エリア情報なし」オプション追加
- categoryバッジ追加（meeting / track / regular 等）
- ページネーション（30件ずつ）
- フリーワード検索・キーワード付与クローラー
- 管理者ダッシュボード（`/admin`）追加
- Vercel Analytics・検索ログ（`search_logs`）追加
- ヘッダーに最終更新日時表示
- サイト名を「二輪四輪オフマップ」に変更

### 4. イベント投稿フォーム（3/19）

- 「イベントを投稿」ボタン → モーダル表示
- `/api/submit-event` ルート追加
- ボタンスタイル改善

### 5. /spots ページ新設（3/23〜3/24）

- react-leaflet で初期実装 → マーカーずれ問題で **Google Maps（@vis.gl/react-google-maps）に移行**
- Supabaseブラウザクライアントを `@supabase/ssr` に変更
- フィルターUI（エリア・都道府県）のレイアウト修正（複数回試行）
- CLAUDE.md 追加
- マーカーをSVGピン形状に変更
- InfoWindowをカスタムポップアップに変更（Tailwind未適用問題を回避）
- 「ここにいるナウ」ボタン追加
- スポット名クリックで詳細ページへ遷移
- チェックイン・予定登録機能（`spot_checkins` テーブル）
- ヘルプモーダル（「オフ会メーカー」）追加
- 位置情報ボタン・都道府県フィルターオーバーレイ追加

---

## 未解決の課題

- `/spots` フィルターUIが地図に隠れる問題（CLAUDE.mdに詳細記載）
- チェックインUIの完成度（投稿後の表示など）

---

## 関連情報

- DBテーブル：`events`（重複キー：`event_date+name`）、`spots`、`spot_checkins`
- クロールスケジュール：毎日AM4時 JST（GitHub Actions）
- 本番URL：https://car-event-map-pre.vercel.app/
