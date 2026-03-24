# CLAUDE.md — 二輪四輪オフマップ
最終更新：2026年3月23日

Claude Codeがこのリポジトリで作業する際の参照ドキュメント。

---

## プロジェクト概要

車・バイクのオフ会・ミーティング情報をクローラーで自動収集し提供する**初参加者向けイベント発見サイト**。

- **サービス名**：二輪四輪オフマップ（愛称：オフマップ）
- **URL**：https://24offmap.jp（DNS反映待ち） / https://car-event-map-pre.vercel.app/
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
├── .env                          ← SUPABASE_URL, SUPABASE_KEY, GOOGLE_MAPS_API_KEY等
├── .github/workflows/crawler.yml
├── crawler/crawler.py
└── frontend/
    ├── app/
    │   ├── page.tsx              ← トップページ（イベント一覧・定期開催タブ）
    │   ├── admin/page.tsx        ← 管理者ダッシュボード（PW: carmap2026）
    │   ├── spots/
    │   │   ├── page.tsx          ← スポットマップページ
    │   │   └── MapView.tsx       ← Google Mapsコンポーネント
    │   └── api/submit-event/route.ts
    ├── lib/
    │   ├── supabase.ts           ← サーバー/SSR用クライアント
    │   └── supabase/client.ts   ← ブラウザ用（createBrowserClient）
    └── scripts/
        └── fix_coordinates.py   ← スポット座標一括更新
```

---

## 環境変数

### Vercel（本番）
| Key | 用途 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL |
| NEXT_PUBLIC_SUPABASE_KEY | Supabase Publishable key |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Legacy anon key（/spots用） |
| NEXT_PUBLIC_ADMIN_PASSWORD | carmap2026 |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | Google Maps JavaScript API |
| ANTHROPIC_API_KEY | Claude API（サーバーサイドのみ） |

### ローカル .env
上記に加えて `GOOGLE_MAPS_API_KEY`（fix_coordinates.py用）

---

## DBテーブル一覧

### events
イベント情報メインテーブル。重複排除キー：`event_date + name`

主要カラム：id, name, event_date, prefecture, venue, genre, category, source_url, source_site, source_site_url, target_vehicle, recurring_id, keywords, created_at

categoryの値：`meeting` / `track` / `regular` / `show` / `touring` / `unknown`

### sources
クロール対象サイト一覧。`is_active=true`のみ対象。crawl_type：`dupcar` / `minkara` / `generic`

### recurring_events
定期開催イベント（7件登録済み）。eventsのrecurring_idで紐付け。

### spots
ミーティングスポット（道の駅・PA・展望台等）。関東8件登録済み。
主要カラム：id, name, name_kana, prefecture, region, category, lat, lng, description

### spot_checkins
スポットへのチェックイン。checkin_type：`now`（当日23:59まで有効）/ `plan`（日時指定）
認証：匿名（ニックネームのみ）

### search_logs / crawl_logs
検索ログ・クロール実行ログ。

---

## 現在の未解決バグ

### /spots フィルターUIが地図に隠れる
- **症状**：地図が全画面になりエリア・都道府県フィルターが見えない
- **原因**：MapViewの地図コンポーネントが親要素を突き破る
- **試した対策**：`calc(100vh - 92px)`、`flex-1 min-h-0` → いずれも未解決
- **現状のレイアウト構造**：
```tsx
<div className="flex flex-col" style={{ height: '100vh' }}>
  <header />          {/* flex-shrink-0 */}
  <div className="フィルター" />  {/* flex-shrink-0 */}
  <div className="flex-1 min-h-0">  {/* ← 地図コンテナ・ここが問題 */}
    <APIProvider>
      <MapView />  {/* style={{ width:'100%', height:'100%' }} */}
    </APIProvider>
  </div>
</div>
```
- **次回試すべき対策**：Mapのstyleにheightをpxで明示指定 or position:absoluteで回避

---

## 直近TODO

- [ ] /spotsフィルターUIバグ修正（最優先）
- [ ] チェックインUI実装（「今いるナウ」「○月○日行く予定」）
- [ ] フェンダリストM（https://fenderist.jp/m/index.html）をsourcesに追加
- [ ] 「イベントを投稿」ボタンの色変更
- [ ] recurring_eventsデータ拡充（現在7件）
- [ ] おはよう新潟・おはくまのevents紐付け
- [ ] ロゴ・favicon・OGP画像作成

---

## コーディング規約・注意事項

- Pythonパッケージインストール時は `pip3 install --break-system-packages` を使う（`pip`コマンドは存在しない）
- Supabaseブラウザクライアントは `@/lib/supabase/client` から `createClient()` を使う
- Supabaseサーバークライアントは `@/lib/supabase.ts` から `supabase` を使う
- 地図はLeafletではなく `@vis.gl/react-google-maps` を使う（Leafletはマーカーずれ問題あり）
- スポット座標はGeocoding APIではなくGoogle Maps URLから手動取得する（精度不足のため）
- コミット後は必ず `git push origin main` まで実行する
- 新規ファイル作成・変更後は `git add -A && git commit -m "メッセージ" && git push` を1コマンドで実行する

---

## 意思決定の原則

- 管理者作業は**100%自動化**が前提（手動入力なし）
- 取得率40〜50%の属性はサブDBとして許容
- SNS（X・Instagram・Facebook）APIはスコープ外
- 大黒PA等の迷惑行為スポットはブラックリスト管理で除外
- iOSアプリ化はCapacitor（PWAラップ）で実施予定（React Native不使用）
