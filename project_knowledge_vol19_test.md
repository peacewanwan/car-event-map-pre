# 二輪四輪オフマップ — Project Knowledge

最終更新：2026年4月6日（Vol.19）

-----

## 1. プロジェクト概要・コンセプト

### サービス定義

車・バイクのオフ会・ミーティング情報をWebクローラーで自動収集し、DBに蓄積・正規化して提供する**初参加者向けのイベント発見サイト**。

### サービス名・ドメイン

|項目        |内容                                              |
|----------|------------------------------------------------|
|正式名称      |二輪四輪オフマップ                                       |
|愛称        |オフマップ                                           |
|ドメイン      |24offmap.jp                                     |
|ロゴ表記      |「2輪4輪」小さめ＋「offmap」メイン                           |
|公開サイト     |https://24offmap.jp（Valid Configuration確認済み）      |
|旧URL      |https://car-event-map-pre.vercel.app/           |
|GitHub    |https://github.com/peacewanwan/car-event-map-pre|
|ローカル作業フォルダ|`/Users/takeomba/car-event-map-pre`             |

### 本質的な課題

既存サービス（みんカラ・X・Instagram等）は「すでにコミュニティにいる人のための場」であり、以下のユーザーに対応できていない：

- まだコミュニティに入っていない人
- 車を買ったばかりの人
- 1回行ってみたい人
- SNSを深追いしたくない人

### コアバリュー

キャッチコピー：「オフ会・イベントが すぐ見つかる。」（確定）

**サービスの本質的な価値：「このイベント行って大丈夫か？」を解決するサービス**

### 運用方針（確定）

- 管理者は**100%自動化**を前提とする
- 手動入力・人力確認は行わない
- クローラーで取得できない属性は原則持たない
- 40〜50%の取得率でも価値がある属性は「サブDB」として許容

### フェーズ全体像

|フェーズ   |内容                           |状態    |
|-------|-----------------------------|------|
|Phase 1|クローラー自動収集の車イベント検索サイト         |進行中   |
|Phase 2|ユーザー投稿フォーム・レビュー機能・過去イベント履歴リンク|一部実装済み|
|Phase 3|iOSアプリ化・「今ここにいるナウ」チェックインマップ  |実装中   |

-----

## 2. 技術スタック・環境情報

|レイヤー    |技術                                           |備考                                         |
|--------|---------------------------------------------|-------------------------------------------|
|クローラー   |Python（requests + BeautifulSoup、一部Playwright）|GitHub Actionsで毎日AM4時JST自動実行               |
|AI正規化   |Anthropic Claude API                         |JSON形式で抽出                                  |
|DB      |Supabase                                     |PostgreSQL                                 |
|フロントエンド |Next.js + Tailwind CSS                       |                                           |
|ホスティング  |Vercel（Hobbyプラン）                             |無料枠で運用中                                    |
|地図      |@vis.gl/react-google-maps                    |Google Maps JavaScript API（オフ会メーカーページで使用）  |
|アプリ化（予定）|Capacitor（PWAラップ）                            |iOS対象                                      |

### アカウント・環境情報

|項目                  |値                                       |
|--------------------|----------------------------------------|
|GitHub              |peacewanwan                             |
|Vercel              |peacewanwan-7406                        |
|Supabase Project URL|https://rqrezpinuwfaxazukmka.supabase.co|

### フォルダ構成

```
/Users/takeomba/car-event-map-pre/
├── .env
├── .gitignore
├── .github/workflows/
│   └── crawler.yml
├── crawler/
│   ├── crawler.py
│   ├── check_sources.py     ← URL死活確認スクリプト
│   └── update_recurring_ids.py
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   ├── sitemap.ts        ← サイトマップ自動生成
    │   ├── admin/
    │   │   └── page.tsx
    │   ├── faq/
    │   │   └── page.tsx
    │   ├── contact/
    │   │   └── page.tsx
    │   ├── spots/
    │   │   ├── page.tsx         ← オフ会メーカーページ（リスト+地図タブ）
    │   │   ├── layout.tsx       ← spotsレイアウト・メタデータ
    │   │   ├── SpotCard.tsx     ← スポットカードコンポーネント（アコーディオン・チェックインUI）
    │   │   └── MapView.tsx      ← Google Mapsコンポーネント
    │   └── api/
    │       ├── contact/
    │       │   └── route.ts
    │       └── submit-event/
    │           └── route.ts
    ├── lib/
    │   ├── supabase.ts
    │   └── supabase/
    │       └── client.ts        ← ブラウザ用Supabaseクライアント
    ├── scripts/
    │   └── fix_coordinates.py   ← スポット座標一括更新スクリプト
    └── .env.local
```

-----

## 3. DBスキーマ設計

### eventsテーブル

|カラム            |型        |説明                        |
|---------------|---------|--------------------------|
|id             |BIGINT   |PK                        |
|name           |TEXT     |イベント名                     |
|event_date     |DATE     |開催日（開始日）                  |
|event_date_end |DATE     |複数日イベントの終了日（単日はNULL）      |
|prefecture     |TEXT     |都道府県                      |
|venue          |TEXT     |会場名                       |
|genre          |TEXT     |ジャンル（DB保持・表示なし）           |
|category       |TEXT     |イベントカテゴリ（表示・フィルタ用）        |
|source_url     |TEXT     |イベント詳細URL                 |
|source_site    |TEXT     |情報元サイト名                   |
|source_site_url|TEXT     |情報元サイトURL                 |
|target_vehicle |TEXT     |対象車種（10文字以内・正規化済み）        |
|recurring_id   |BIGINT   |recurring_eventsへの外部キー    |
|keywords       |TEXT[]   |検索キーワード配列（AI生成）           |
|created_at     |TIMESTAMP|作成日時                      |

> 重複排除：`event_date + name` で判定（venue・source_urlによらず同一イベントを統一）

### categoryカラムの値定義

|値        |表示名       |判断基準           |
|---------|----------|---------------|
|`meeting`|オフ会・ミーティング|集まって見せ合う系      |
|`track`  |走行会       |サーキット・峠での走行体験  |
|`regular`|定例MTG     |毎週・毎月など定期系     |
|`show`   |展示・ショー    |オートサロン・メッセ・博物館系|
|`touring`|ツーリング     |一緒に走る・ドライブ系    |
|`unknown`|非表示       |判断材料不足         |

### sourcesテーブル

|カラム       |型        |説明                                        |
|----------|---------|------------------------------------------|
|id        |BIGINT   |PK                                        |
|site_name |TEXT     |サイト名                                      |
|url       |TEXT     |URL                                       |
|is_active |BOOLEAN  |クロール対象かどうか                                |
|crawl_type|TEXT     |クロール方式（dupcar/minkara/eventmania/generic）|
|created_at|TIMESTAMP|作成日時                                      |

### recurring_eventsテーブル

|カラム           |型        |説明                            |
|--------------|---------|------------------------------|
|id            |BIGINT   |PK                            |
|name          |TEXT     |イベント名                         |
|organizer     |TEXT     |主催者・コミュニティ名                   |
|frequency     |TEXT     |開催頻度（weekly/monthly/irregular）|
|day_of_week   |TEXT     |開催曜日                          |
|time_of_day   |TEXT     |開催時間                          |
|prefecture    |TEXT     |都道府県                          |
|venue         |TEXT     |会場名                           |
|target_vehicle|TEXT     |対象車種                          |
|source_url    |TEXT     |情報元URL                        |
|source_site   |TEXT     |情報元サイト名                       |
|created_at    |TIMESTAMP|作成日時                          |

### recurring_events登録済みデータ（7件）

|name               |organizer      |frequency|prefecture|
|-------------------|---------------|---------|----------|
|浜名湖おはようツーリング       |三遠南信ロードスターの会   |monthly  |静岡県       |
|ちばろど定例ミーティング       |ちばろど           |monthly  |千葉県       |
|おはよう埼玉まるごとロードスターMTG|おはよう埼玉ロードスター   |monthly  |埼玉県       |
|倶楽部ロードスター滋賀定例ミーティング|倶楽部ロードスター滋賀    |monthly  |滋賀県       |
|おはよう新潟ロードスターMTG    |おはよう新潟ロードスター   |monthly  |新潟県       |
|おはくま（おはよう熊本）       |おはくま           |monthly  |熊本県       |
|ロードスター奥多摩ミーティング    |ロードスター奥多摩ミーティング|monthly  |東京都       |

### spotsテーブル

```sql
create table spots (
  id bigint generated always as identity primary key,
  name text not null,
  name_kana text,
  prefecture text not null,
  region text not null,
  category text,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  description text,
  created_at timestamptz default now()
);
```

#### 登録済みスポット（137件・id 9〜144相当）

Vol.16時点の86件（id 9〜94）に加え、以下51件を追加済み：
- 関西：道の駅7件・SA/PA8件・展望台・峠3件・駐車場3件
- 東北：道の駅9件・SA/PA10件・展望台・峠3件
- 北関東：道の駅5件・SA/PA4件・展望台・峠3件
- 関東追加：奥多摩湖大麦代駐車場1件

> 座標はGoogle Maps URLから手動取得。Geocoding APIは精度不足のため不採用。
> descriptionは全件NULL（メモ類はクリア済み）。
> 残り拡充予定：九州・北海道

### spot_checkinsテーブル

```sql
create table spot_checkins (
  id uuid primary key default gen_random_uuid(),
  spot_id bigint references spots(id) on delete cascade,
  nickname text not null,
  checkin_type text not null check (checkin_type in ('now', 'plan')),
  planned_at timestamptz,
  vehicle_type text,
  comment text,
  expires_at timestamptz,
  left_at timestamptz,
  time_slot text check (time_slot in ('morning', 'afternoon', 'evening', 'flexible')),
  created_at timestamptz default now()
);
```

> vehicle_typeはフリーテキスト（車種名を直接入力）。CHECK制約は削除済み。
> チェックイン有効期限：「今いるナウ」は登録時刻 + 3時間。expires_atはクライアント側でセット。
> 手動退出時はleft_atに退出時刻を記録。
> 認証は匿名（ニックネームのみ）。
> planned_atは日付部分のみ使用（時刻は00:00:00固定）。時間帯はtime_slotカラムで管理。

**time_slotカラム（ALTER TABLE実行済み）**

| 値 | 表示 |
|---|---|
| `morning` | 🌅 午前 |
| `afternoon` | ☀️ 午後 |
| `evening` | 🌆 夕方〜夜 |
| `flexible` | 🌀 気分次第 |

### reviewsテーブル（新設・未実装）

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  recurring_event_id bigint references recurring_events(id),
  beginner_score int check (beginner_score in (1,2,3)),
  car_count_score int check (car_count_score in (1,2,3)),
  custom_score int check (custom_score in (1,2,3)),
  tags text[],
  created_at timestamptz default now()
);
```

### search_logsテーブル

|カラム         |型        |説明      |
|------------|---------|--------|
|id          |BIGINT   |PK      |
|searched_at |TIMESTAMP|検索日時    |
|freeword    |TEXT     |フリーワード  |
|vehicle     |TEXT     |車種フィルタ  |
|prefecture  |TEXT     |エリアフィルタ |
|category    |TEXT     |カテゴリフィルタ|
|date_from   |DATE     |開始日     |
|date_to     |DATE     |終了日     |
|result_count|INTEGER  |結果件数    |

### crawl_logsテーブル

|カラム          |型        |説明    |
|-------------|---------|------|
|id           |BIGINT   |PK    |
|executed_at  |TIMESTAMP|実行日時  |
|site_name    |TEXT     |サイト名  |
|new_count    |INTEGER  |新規件数  |
|updated_count|INTEGER  |更新件数  |
|skipped_count|INTEGER  |スキップ件数|
|error_message|TEXT     |エラー内容 |

-----

## 4. クローラー設計

### 基本動作フロー

1. Supabaseの`sources`テーブルから`is_active=TRUE`のサイトを取得
1. `crawl_type`によってスクレイピング方法を切り替え
1. Claude APIでJSON形式に正規化
1. 重複排除（`event_date + name` で判定）
1. `guess_vehicle`関数でtarget_vehicleを補完
1. `guess_prefecture`関数でprefectureをテキストから推定補完
1. eventsテーブルに保存
1. crawl_logsテーブルに実行結果を記録

### クロール方式

|crawl_type |対象                |備考                                      |
|-----------|------------------|------------------------------------------|
|dupcar     |ドレスアップカーイベント.com  |専用パーサー                                  |
|minkara    |みんカラ イベントカレンダー    |一覧ページ+詳細ページ方式（AIノーマライズなし）              |
|eventmania |イベントマニア           |月別ページループ・div.infoboxパース・AIノーマライズなし      |
|generic    |その他全サイト           |Markdownリンク埋め込み方式でテキスト抽出→AI正規化          |

### fetch_genericの動作

- `<a>`タグを `[テキスト](URL)` 形式に変換してからテキスト抽出
- AIがコンテキストを見てsource_urlを判断できる
- テキスト上限5000文字
- linksは空リスト固定（prefetched_eventsはdupcar/minkaraのみ使用）

### crawl_minkaraの動作

- 一覧URL：`/calendar/list.aspx?fd={今日}&ed={1年後}&pn={N}`
- pn=1からループ、リンク0件で終了（最大50ページ）
- `<a href="/calendar/{id}/">` でIDを収集
- 既取得ID（source_urlがDBに存在）はフェッチをスキップ
- 詳細ページ（`/calendar/{id}/`）をBeautifulSoupでパース
- 取得項目：イベント名・開催日・都道府県・会場名・カテゴリ・車種・ジャンル
- 緯度経度：JS内の `center: [lng, lat]` を正規表現で抽出（任意）
- source_url = `https://minkara.carview.co.jp/calendar/{id}/`
- event_date < 今日 の場合はスキップ（保存しない）
- AIノーマライズをバイパス（detailTableから直接パース）
- robots.txt確認済み：`/calendar/` `/group/` への Disallow なし

### crawl_eventmaniaの動作

- 対象URL：`https://www.mach5.jp/eventmania/areaevent.php?date={YYYY-MM}&pref=null`
- 今日から1年後まで月別にループ
- イベント1件 = `div.infobox`
- カテゴリタグ = `div#category` 内の `p.tag`（1つ目：ジャンル、2つ目：都道府県）
- 以下のジャンルは除外：ゴルフ・花火・お祭り・フリーマーケット・温泉・キャンプ
- 日付パース：単日「2026/03/15 (日)」→ event_date のみ、複数日「～」区切り → event_date + event_date_end
- source_url：div.title内の`<a href>`があればそのURL、なければクロールしたページURL
- AIノーマライズをバイパス（div.infoboxから直接パース）
- keywordsのみClaude APIで生成
- event_date < 今日 の場合はスキップ
- source_urlが `mach5.jp` を含む場合はsource_site_urlと同値として保存・フロントで「情報元を見る」表示
- categoryマッピング：
  - クラシックカー・旧車・ドレスアップカー・バイク・その他車関係イベント → meeting
  - カーレース・その他レース → track
  - それ以外 → unknown
- 課題：source_urlが取れないイベント（約半数）はページURLそのまま保存→「情報元を見る」表示で対処済み

### Claude APIプロンプト抽出項目

- name、event_date、prefecture、venue、genre
- target_vehicle：正規化済み車種リストから選択（10文字以内）
- category：meeting/track/regular/show/touring/unknownから選択
- keywords：検索キーワード配列（5〜10個）
- source_url：ページ内のMarkdownリンクから判断

### target_vehicle 正規化リスト（確定版）

|正規化後    |統合される表記                          |
|--------|---------------------------------|
|旧車・クラシック|80-90年代車系・クラシックカー・旧車全般・旧車等・旧車・アメ車|
|86/BRZ  |86・BRZ等・AE86・86                  |
|BMW/MINI|BMW等・ミニ                          |
|GRヤリス   |GRヤリス等・GR車種                      |
|ドリフト車   |ドリフト車等                           |
|ドレスアップ  |ドレスアップ全般・ドレスアップ等・ブルー系カスタム        |
|商用車     |商用車全般                            |

その他：ロードスター・コペン・痛車・キャンピングカー・GT-R・マツダ・軽自動車等はそのまま維持

### クローラー既知の問題・対応待ち

|問題                                      |対応方針                                          |
|-----------------------------------------|------------------------------------------------|
|みんカラグループ系のsource_urlがグループトップ止まり          |crawl_type=playwrightを追加してBBS個別URLを取得（Claude Code復活後）|
|dupcar/generic系に過去イベントスキップ未実装            |save_events()にevent_date < 今日フィルタ追加済み          |

### check_sources.py（URL死活確認スクリプト）

- パス：`crawler/check_sources.py`
- 対象URLリストにrequests.getでアクセス（タイムアウト10秒・User-Agent設定）
- チェック内容：ステータスコード・robots.txt確認・イベント関連ワード存在確認
- 結果を `crawler/check_sources_result.csv` に出力
- judgment：OK / WARN / NG
- robots.txt判定：`line.strip() == 'Disallow: /'` の完全一致のみNG（誤検知修正済み）
- みんカラのrobots.txtは `/group/` `/calendar/` へのDisallowなし（既存クローラーと同様に問題なし）
- LLM生成URL38件確認結果：OK 2件・WARN 3件・NG 32件（DNS失効21件）
- **教訓：LLM生成URLの信頼性は低い→必ずcheck_sources.pyで確認してからINSERT**

-----

## 5. sourcesテーブル登録状況

### is_active = true（クロール対象・約69件）

#### 専用イベントサイト

|site_name       |url                                                   |crawl_type |
|----------------|------------------------------------------------------|-----------|
|ドレスアップカーイベント.com|https://dupcar-event.com                              |dupcar     |
|みんカラ イベントカレンダー  |https://minkara.carview.co.jp/calendar                |minkara    |
|イベントマニア          |https://www.mach5.jp/eventmania/                      |eventmania |
|走行会.com         |https://sokokai.com/                                  |generic    |
|F-DESIGN痛車イベント  |https://f-designpro.com/event/                        |generic    |
|痛車天国プロジェクト      |https://itasha-tengoku.yaesu-net.co.jp/event-calendar/|generic    |

#### メーカー・公式系

|site_name                       |url                                           |
|--------------------------------|----------------------------------------------|
|MAZDA FAN FESTA                 |https://www.mazda.co.jp/experience/event/     |
|モーターファンフェスタ                     |https://motorfanfesta.com/                    |
|TOYOTAGAZOO Racing GR EXPERIENCE|https://toyotagazooracing.com/jp/experience/  |
|トヨタ博物館                          |https://toyota-automobile-museum.jp/event/    |
|Honda イベント情報                    |https://www.honda.co.jp/event/                |
|NISMOパフォーマンスセンター                |https://www.nismo.co.jp/driving-event/        |
|NISMOスタッフブログ                    |https://npc-staffblog.nismo.co.jp/            |
|SUBARU公式イベント                    |https://www.subaru.jp/event/                  |
|ノスタルジック2デイズ                     |https://nos2days.com/                         |
|大阪オートメッセ                        |https://www.automesse.jp/                     |
|東京オートサロン                        |https://www.tokyoautosalon.jp/                |
|SBM スタイルボックスミーティング              |https://www.1box-sbm.com/                     |
|D1グランプリ公式                       |https://d1gp.co.jp/                           |
|キャンピングカーファンフェス                  |https://campingcarfanfes.com/                 |
|JRVAイベント                        |https://jrva-event.com/                       |
|迅天祭SWIFT FUN FESTIVAL           |https://jintensai-25th-swift-fun-festival.com/|

#### サーキット系

|site_name   |url                                          |
|------------|---------------------------------------------|
|オートポリス      |https://www.autopolis.jp/                    |
|スポーツランドSUGO |https://www.sportsland-sugo.co.jp/           |
|日光サーキット     |https://www.nikko-circuit.jp/                |
|モビリティリゾートもてぎ|https://www.mr-motegi.jp/calendar_m/         |
|岡山国際サーキット   |https://www.okayama-international-circuit.jp/|

#### ディーラー系

|site_name              |url                                                              |
|-----------------------|-----------------------------------------------------------------|
|トヨタモビリティ神奈川            |https://www.toyota-mobility-kanagawa.jp/event                    |
|兵庫トヨタ                  |https://www.hyogotoyota.co.jp/event                              |
|GR Yaris Owners Meeting|https://kyoto-toyota.jp/store/grgarage-kyotofushimi/event_gryaris|

#### ロードスター系

|site_name            |url                                                                |
|---------------------|-------------------------------------------------------------------|
|RCOJ                 |http://www.open-inc.co.jp/rcoj/                                    |
|RCOJ イベント情報          |https://www.open-inc.co.jp/rcoj/event_info/index.html              |
|おはきた                 |https://obhr.main.jp/ohakitainfo/                                  |
|おはよう埼玉ロードスター         |https://minkara.carview.co.jp/group/ohatam/                        |
|ちばろど                 |https://minkara.carview.co.jp/group/chibaroad/                     |
|倶楽部ロードスター滋賀          |https://minkara.carview.co.jp/group/rodosutashiga/bbs/13172071/l10/|
|三遠南信ロードスターの会（浜名湖おはツー）|https://minkara.carview.co.jp/group/oyajirodo/                     |
|RoadsterFreakers大阪   |https://roadster-freakers.com/osaka/event.html                     |
|E.S.A.H.姫路           |https://esah.okoshi-yasu.com/index.html                            |
|塩ビの会                 |https://sites.google.com/view/enbinokai/top                        |
|ROCK'S 北海道ロードスター     |https://www.rock-s.info/                                           |
|いいがやミーティング           |https://www.plotonline.com/car/roadster/                           |
|軽井沢ミーティング            |https://karuizawa-meeting.com/                                     |
|ロードスター奥多摩ミーティング      |https://minkara.carview.co.jp/group/J7DTiKf/                       |

#### 86/BRZ系

|site_name             |url                                             |
|----------------------|------------------------------------------------|
|AUTOPOLIS 86/BRZ STYLE|https://autopolis.jp/ap/entry/event/86_brz/     |
|九州山口86BRZ友の会          |https://minkara.carview.co.jp/group/kyushu86brz/|
|ハチロク祭                 |https://www.procrews.co.jp/86/                  |
|KANSAI 86&BRZ MEETING |https://www.auto-craft.net/                     |
|Autoage CLUB 86       |https://autoage.jp/community/club86-b           |
|86 BRZ Avengers       |http://86brz-avengers.com/                      |

#### BMW/MINI系

|site_name        |url                                                                 |
|-----------------|--------------------------------------------------------------------|
|MOG MINI みんカラ    |https://minkara.carview.co.jp/group/minioffgroup/                   |
|BMW公式イベント        |https://www.bmw.co.jp/ja/topics/brand-and-technology/news/event.html|
|BMW&MINI Racing  |https://bmwminiracing.jp/                                           |
|TMME 東北MINIミーティング|https://tmme.jp/                                                    |
|MINI FES.        |https://www.procrews.co.jp/minifes/                                 |

#### GRヤリス系

|site_name     |url                                         |
|--------------|--------------------------------------------|
|GRヤリス みんカラグループ|https://minkara.carview.co.jp/group/gryaris/|
|GRヤリス北海道      |https://minkara.carview.co.jp/group/grhkd/  |
|クラブGRヤリス      |https://mg.i-car.jp/group_detail/72/        |

#### コペン系

|site_name          |url                                                 |
|-------------------|----------------------------------------------------|
|みんカラコペン倶楽部         |https://minkara.carview.co.jp/group/minkaracopeclub/|
|石川コペンオーナーズネット（icon）|https://minkara.carview.co.jp/society/icon/         |
|九州Copen倶楽部         |https://minkara.carview.co.jp/group/kycc/           |
|エスコペABC            |https://liaf-liaf.net/                              |
|Copen Life ダイハツ公式  |https://copen.daihatsu.co.jp/life                   |
|ひろしまあたりのコペン好きの集い   |https://sites.google.com/view/hiroco                |

#### GT-R系

|site_name         |url                      |
|------------------|-------------------------|
|R's Meeting GT-R公式|https://gtr.automesse.jp/|

#### フェラーリ・スタンス系

|site_name                |url                              |
|-------------------------|---------------------------------|
|Ferrari Owners Club Japan|https://www.ferrariownersclub.jp/|
|Stancenation Japan       |https://stancenation-japan.com/  |

#### ホンダ・ビート系

|site_name      |url                                          |
|---------------|---------------------------------------------|
|奥多摩湖BEATミーティング|https://minkara.carview.co.jp/group/km6Mc5C/ |

#### その他コミュニティ・クラブ系

|site_name       |url                                                   |
|----------------|------------------------------------------------------|
|よねおやじ旧車催事暦      |https://www.midoriga-oka.com/yog/infome.htm           |
|アメ車マガジン         |https://www.amemaga.com/                              |
|中部ミーティング        |https://www.chubumeeting.com/                         |
|日本自動車博物館        |https://www.motorcar-museum.jp/                       |
|富士モータースポーツミュージアム|https://fuji-motorsports-museum.jp/                   |
|A PIT オートバックス   |https://www.apit-autobacs.com/event/                  |
|スーパーオートバックス     |https://www.autobacs.com/static_html/shp/sa/event.html|
|日産グローバル本社ギャラリー  |https://ghq-gallery-cms.nissan.co.jp/GALLERY/HQ/EVENT/|
|オートメッセウェブ       |https://www.automesseweb.jp/                          |
|PassMarket 車    |https://passmarket.yahoo.co.jp/                       |
|LivePocket 車    |https://t.livepocket.jp/                              |
|モーターランドネット      |https://www.motor-land.net/                           |
|AUTO CRAFT京都    |https://ameblo.jp/auto-craft-kyoto/                   |
|メルスユーロ          |https://mels-drive.jp/                                |
|Team star☆dust  |https://minkara.carview.co.jp/group/stardust2016/     |
|Alfa Romeo Day  |http://alfaday.com/                                   |年1回開催・crawl_type=generic|

### 次回追加候補

|site_name  |url                              |備考                                  |
|-----------|---------------------------------|------------------------------------|
|フェンダリストM  |https://fenderist.jp/m/index.html|ドレスアップ＋ドリフト大型イベント・crawl_type=generic|

### is_active = false（無効化済み）

|site_name           |理由                                    |
|--------------------|--------------------------------------|
|クラフト ブログ            |ブログトップはイベントページでないため（施工記録ブログ）          |
|日産プリンス兵庫ブログ         |ディーラー販促イベントがノイズになるため                  |
|FUJI 86/BRZ STYLE   |403                                   |
|BMW@Kansai          |403                                   |
|イベントマニア             |※is_active=trueに復活済み（静的HTMLと確認・誤判定だった）|
|GAZOO オフミーティング      |JS動的レンダリング                            |
|千石峡秘密基地             |Wix・Playwright必要                      |
|十勝スピードウェイ           |DNS解決失敗                               |
|JRVAイベント            |403                                   |
|ACJ谷保天満宮            |JSONパースエラー                            |
|ROADSTER OVER40S    |DNS解決失敗                               |
|D-Technique イベント    |403                                   |
|S2000 ALL JAPAN MEET|Wix                                   |
|筑波サーキット             |未確認                                   |
|富士スピードウェイ           |未確認                                   |
|袖ヶ浦フォレストレースウェイ      |未確認                                   |
|エビスサーキット            |未確認                                   |
|JLOC                |未確認                                   |
|日本ポルシェクラブ関東支部       |未確認                                   |
|JCJ ジムニークラブ         |未確認                                   |
|スバコミ                |ログイン必要                                |
|GR Garage総合         |JS動的                                  |
|JAFモータースポーツカレンダー    |未確認                                   |
|ターンパイク箱根予約カレンダー     |未確認                                   |
|代官山T-SITE           |未確認                                   |
|HIACE Style         |イベント情報なし（WARN判定）                      |

-----

## 6. フロントエンド仕様

### デザイン方針（確定）

- **モバイル**：ダークテーマ（slate-950ベース）
- **デスクトップ（lg以上）**：ライトテーマ（slate-100ベース）
- **トップページアクセント**：sky-400（モバイル）/ sky-600（デスクトップ）
- **オフ会メーカーアクセント**：emerald-400（緑）
- テーマ切り替えはCSSカスタムプロパティ（globals.css）で管理

### CSSカスタムプロパティ（globals.css）

| 変数 | モバイル | デスクトップ(lg+) |
|---|---|---|
| --background | slate-950 (#020617) | slate-100 (#f1f5f9) |
| --foreground | slate-100 | slate-900 (#0f172a) |
| --bg-page | slate-950 | slate-100 (#f1f5f9) |
| --bg-card | slate-900 (#0f172a) | white (#ffffff) |
| --bg-filter | slate-900 | white |
| --bg-input | slate-800 (#1e293b) | slate-100 (#f1f5f9) |
| --bg-header | slate-950 | white |
| --border-card | slate-800 | slate-200 (#e2e8f0) |
| --text-main | slate-100 | slate-900 (#0f172a) |
| --text-sub | slate-400 | slate-500 (#64748b) |
| --accent | sky-400 | sky-600 (#0284c7) |

### トップページ（/）

**ヘッダー（sticky）**
- 左：「2輪4輪 offmap」ロゴ表記
- 右：「オフ会メーカー」（/spotsリンク・emerald系）、「イベント投稿」（モーダル・sky系）、「?」（HelpCircle・/faqリンク）

**ヒーローセクション**
- sky-600/10 のグロー背景
- キャッチコピー：「はじめてのオフ会が、すぐ見つかる。」
- 安心ラベル：「✓ 全国のイベントを自動収集　✓ SNS登録不要　✓ 無料」
- 「条件を絞り込む」折りたたみボタン（デフォルト閉じ・デスクトップは常時展開）
- 最終更新日時（crawl_logsから取得・JST変換済み）

**フィルタパネル**
- フリーワード / 車種・エリア2カラム / カテゴリトグルボタン / 日付範囲 / リセット
- フィルタ変更で即時反映・displayCountリセット
- デスクトップ（lg以上）：常時展開・折りたたみボタン非表示

**カードグリッド**
- モバイル：1カラム
- デスクトップ（lg以上）：2カラム（lg:grid-cols-2）
- 大画面（xl以上）：3カラム（xl:grid-cols-3）

**タブ切り替え（sticky）**
- 「イベント一覧」「定期開催」
- アクティブ下線：sky-400（var(--accent)）

**イベントカード（EventCard）**
- 上部カテゴリカラーバー（h-0.5）
- 日付バッジ：今日=orange / 明日=amber / 7日以内=sky / 8日以降なし
- 複数日表示：event_date_endがある場合「3/21（土）〜 3/22（日）」形式
- カテゴリバッジ・定期開催バッジ（emerald）
- keywords → #タグ（先頭3件）
- 「詳細を見る」＋「🗺️ ナビ」ボタン
  - source_url === source_site_url の場合は「情報元を見る」と表示
  - ナビURL：`https://www.google.com/maps/search/?api=1&query={encodeURIComponent(venue || name)}`

**カテゴリバッジ色**

| category | bg / text / border |
|---|---|
| meeting | purple-500/15, purple-300, purple-500/30 |
| track | red-500/15, red-300, red-500/30 |
| show | yellow-500/15, yellow-300, yellow-500/30 |
| touring | teal-500/15, teal-300, teal-500/30 |
| regular | slate-500/15, slate-300, slate-500/30 |

**定期開催カード（RecurringCard）**
- 左 sky-500 の 2px ボーダー
- frequency → weekly=毎週 / monthly=毎月 / irregular=不定期

**件数表示**
- フィルタなし：「N件のイベント」
- フィルタあり：「N件 / 全M件」＋「✕ 絞り込みを解除」

**投稿モーダル（ボトムシート）**
- フリーテキスト入力 → `POST /api/submit-event` に `{ text }` を送信
- 送信後「✅ 投稿を受け付けました」表示

**フッター**
- コピーライト＋掲載削除リンク（Googleフォーム）

### オフ会メーカーページ（/spots）

**ページ名**：オフ会メーカー

**サブテキスト**：
```
今日はどこ行く？
誰かに会いに行く？誰かが来てくれるのを待つ？
今いる場所・行く予定を共有して仲間を増やそう
```

**ヘッダー（sticky）**
- 左：「← 2輪4輪 offmap」ロゴ風（「2輪4輪」白小さめ＋「offmap」sky-400・トップロゴより小さめ）
- 右：「使い方」ボタン → モーダル（emerald系）、「?」（HelpCircle・/faqリンク）

**サブテキスト背景**：`bg-gradient-to-b from-emerald-950/20 to-transparent`

**タブ切り替え（モバイルのみ・sticky）**
- 「リスト」「地図」
- アクティブ下線：emerald-400

**デスクトップ（lg以上）レイアウト**
- 左カラム（40%）：フィルター＋リスト（独立スクロール）
- 右カラム（60%）：地図（sticky・100vh固定）
- タブ切り替えなし・両カラム常時表示
- モバイル（lg未満）は従来のタブ切り替え式を維持

**リスト→地図連携**
- SpotCardクリック時にMapView側で該当ピンにpanTo＋ポップアップ表示
- page.tsxで `selectedSpotId` stateを管理
- MapViewに `focusSpotId?: number` propsを追加
- 既存の地図→リストの `onSpotSelect` 連携は維持

**デスクトップライトテーマ対応（/spots）**
- SpotCard.tsx・spots/page.tsx のハードコード色をCSSカスタムプロパティ経由に変更
- lg以上でトップページと同様のライトテーマが適用される
- emerald系アクセントカラーは維持

**フィルタ（リストタブ・常時表示）**
- スポット名 / ハンドル名 / 車種 統合フリーワード + 都道府県セレクト + 「今いる人あり」トグル + 「行く予定の人あり」トグル
- Nowフィルタ：現在時刻 < expires_at かつ left_at IS NULL
- Planフィルタ：planned_at が今日以降（向こう2週間）
- フォーカス色：emerald-500

**SpotCard（アコーディオン）**
- 誰もいない：`border-slate-800`
- 誰かいる：`border-l-2 border-l-emerald-500 border-emerald-500/40` + animate-pulse ドット
- カード全体クリックでアコーディオン展開
- カードヘッダー右端にナビボタン（Google Maps検索URL）

**スポットカテゴリ色**

| category | text |
|---|---|
| 道の駅 | lime-400 |
| SA・PA | amber-400 |
| 展望台・峠 | orange-400 |
| 駐車場 | slate-400 |

**アコーディオン展開エリア**
- 「今いるナウ」セクション：チェックイン中一覧 + 登録フォーム + 退出ボタン
- カレンダーセクション：先1ヶ月・予定あり日はemerald強調
- 「行く予定」登録フォーム（時間帯：🌅/☀️/🌆/🌀）

**チェックイン仕様**
- `checkin_type='now'`：expires_at = 登録時刻 + 3時間（クライアント側セット）
- `checkin_type='plan'`：planned_atを指定
- localStorage管理：`checkin_{spot_id}`、`plan_{spot_id}`
- 退出：left_atに退出時刻を記録

**MapView.tsx 構造（重要）**
- `useMap()` は `<Map>` の子コンポーネント（`MapInner`）内でのみ呼ぶ
- `MapInner` は `onMapReady` コールバックでmapインスタンスを親に渡す
- 親（`MapView`）が `mapInstance` として保持し操作
- オーバーレイは `<Map>` の**兄弟要素**として `position:absolute`
- ポップアップは `position:fixed`（Map外）
- **`createClient()` はモジュールスコープに置かない。SSRビルド時に `NEXT_PUBLIC_SUPABASE_ANON_KEY` が未定義でクラッシュする。必ず関数・コンポーネント内部で呼ぶこと。**

**30秒ポーリング**
- page.tsx でnowCountMapを30秒おきに再取得

### オフ会メーカーページ（/spots）のSEOメタデータ

| 項目 | 内容 |
|---|---|
| title | オフ会メーカー - 今いる場所・予定を共有｜2輪4輪オフマップ |
| description | 【車・バイク好きの合流ツール】大黒PAや箱根、道の駅など全国のスポットに今誰がいるか、次いつ行くかをチェック。ハンドル名と車種だけでゆるく繋がれる。 |

### FAQページ（/faq）

- パス：`/app/faq/page.tsx`
- UIテーマ：ダークテーマ継承・アコーディオン形式（lucide-react: HelpCircle使用）
- Q4（掲載削除依頼）はひとまず非掲載

### 管理者ダッシュボード（/admin）

- パスワード：`carmap2026`（環境変数：`NEXT_PUBLIC_ADMIN_PASSWORD`）
- 検索ログ集計（過去7日・フリーワード/車種/エリアTOP10）
- ソース別イベント件数グラフ（上位20件）
- クロールログ（直近20件）

-----

## 7. インフラ・デプロイ

|項目                  |内容                                             |
|--------------------|-----------------------------------------------|
|ホスティング              |Vercel（Hobbyプラン・無料）                            |
|DB                  |Supabase                                       |
|クローラー定期実行           |GitHub Actions（毎日AM4:00 JST・cron: '0 19 * * *'）|
|Actions checkout    |v4                                             |
|Actions setup-python|v5                                             |
|ドメイン                |24offmap.jp（お名前.com取得・Vercel連携設定済み・Valid Configuration確認済み）|
|SSL                 |無料（Vercel自動発行）                                 |

### DNS設定（お名前.com側）

|Type |ホスト名|Value                               |
|-----|----|------------------------------------|
|A    |@   |216.198.79.1                        |
|CNAME|www |8e1cc888ad25b830.vercel-dns-017.com.|

### Vercel環境変数

|Key                            |備考                                |
|-------------------------------|----------------------------------|
|NEXT_PUBLIC_SUPABASE_URL       |Supabase Project URL              |
|NEXT_PUBLIC_SUPABASE_KEY       |Supabase Publishable key          |
|NEXT_PUBLIC_SUPABASE_ANON_KEY  |Supabase Legacy anon key（/spots用） |
|NEXT_PUBLIC_ADMIN_PASSWORD     |管理者パスワード（carmap2026）              |
|NEXT_PUBLIC_GOOGLE_MAPS_API_KEY|Google Maps JavaScript API        |
|ANTHROPIC_API_KEY              |Claude API（NEXT_PUBLIC_なし・サーバーサイド）|

### Google Search Console

- 登録済み（2026年3月30日）
- DNS TXTレコード確認済み・サイトマップ送信済み（`https://24offmap.jp/sitemap.xml`）
- `app/sitemap.ts` 作成済み（静的3ページ：/・/spots・/faq）

-----

## 8. アプリ化方針（iOS）

- Capacitor（PWAラップ）→ App Store申請
- Apple Developer Program $99/年必須
- iOSのみ対象
- **当面凍結**（チェックイン週30件超え・アクセス安定後に着手）

-----

## 9. 将来フェーズ構想

### Phase 2

- タグ式レビュー機能：「初参加でも浮かなかった」等のタグ選択式（チェックイン週30件超えてから）
- 過去イベント履歴リンク：同一イベントの過去開催をたぐる

### Phase 3

- iOSアプリ化：Capacitor（PWAラップ）→ App Store申請

### X運用（進行中）

**アカウント情報**
- 専用Xアカウント取得済み（2026年3月）
- ID：@24offmap_jp
- 表示名：二輪四輪オフマップ
- 専用Gmailアドレスも取得済み
- プロフィールURLに `https://24offmap.jp` 設定済み
- ヘッダー画像：サイトのスクリーンショット設定済み

**プロフィール文（確定・126文字）**
```
車・バイクのオフ会を探せる＆作れるサービス🚗🏍 全国のミーティング情報を自動収集／定番ドライブスポットで「今ここにいる」を共有するオフ会メーカーも。現在パイロット版として運営中。感想・ご意見はリプにて！ → https://24offmap.jp
```

**投稿の3タイプ黄金比**
| タイプ | 比率 | 目的 |
|---|---|---|
| 告知型 | 50% | 自動収集イベント情報・情報価値・検索流入 |
| 煽り型（スポット） | 30% | ライブ感・FOMO・拡散 |
| 質問型 | 20% | エンゲージメント・双方向化 |

**4月分投稿**：週まとめ10本＋単発9本＝計19本を予約投稿設定済み

**リプ営業キーワードリスト**
```
# 不安系（コアターゲット）
「オフ会 行きたい」「ミーティング 初めて」「一人で行くの怖い」「納車 オフ会」

# 能動系（拡散してくれる層）
「オフ会 告知」「ミーティング 参加者募集」「今週末 どこか行く」
```
→ 不安系には「安心・安全な閲覧専用ツール」として提案・1日3〜5件程度・初期フェーズのみ

**投稿に関する方針**
- 文字数：140文字以内厳守（URLは23文字固定カウント）
- 「初参加OK」等の文言はDBで取得できないため使用しない
- 必ず「詳細 → サイトURL」で情報元へ誘導する形を維持

### 認知・アクセス向上戦略

**戦略の核心：「特定の穴に深く杭を打ち込む」**

全方位で薄く広げるのではなく、最もデータ密度が高く、コミュニティが濃い「ロードスター × 関東」クラスタを最優先攻略対象とする。

**最優先KPI**
| 時期 | KPI | 目標値 |
|---|---|---|
| 4月末 | spotsチェックイン数 | 週10件 |
| 5月末 | spotsチェックイン数 | 週30件 |
| 6月末 | 1日アクセス数 | 200〜300 |
| 9月末 | SEO流入比率 | 30%超 |

> チェックイン数を最重要KPIとする理由：spotsは「人がいる前提」で価値が出るため、PV数より先に賑わいを作ることが本質的な課題。

**Phase 0（〜4月末）：賑わいの種を作る**
- ターゲット：ロードスター × 関東（recurring_eventsに5件登録済みでDB密度が最も高い）
- 定点スポット：大黒PA・宮ヶ瀬湖
- 管理者が週末に実際にスポットへ赴きチェックインし、利用中のスクショをXでシェア
- 毎週金曜夜に定点宣言投稿を予約投稿

**Phase 1（3〜4月末）：X運用の改善**
- 投稿3タイプの黄金比を実施
- リプ営業（エゴサキーワードで1日3〜5件）
- Google Search Console登録・データ蓄積開始

**Phase 2（5〜6月）：SEOの仕込み**
- 都道府県別ページ（`/events/[prefecture]`）を静的生成
- 車種別ページ（`/events/vehicle/[type]`）を静的生成
- フッターにリンクを並べてGoogleに認識させる
- SpotCardにXシェアボタン追加（「今〇〇PAに3人います」を自動文言生成）
- `@vercel/og`による動的OGP生成

**Phase 3（7月〜）：自然流入サイクルの確立**
- SEOロングテール本格化
- チェックイン数が週30件超えたタイミングでレビュー機能を追加

**当面やらないこと（凍結）**
- レビュー機能（チェックイン週30件超えてから）
- 全方位SEO
- アプリ化

-----

## 10. 意思決定ログ

|日付        |決定事項                                                                          |
|----------|------------------------------------------------------------------------------|
|2026-03   |SNS有料API（X・Instagram・Facebook）はスコープ外                                         |
|2026-03   |管理者は100%自動化前提                                                                |
|2026-03   |取得率40〜50%の属性はサブDBとして許容                                                       |
|2026-03-17|サービスコンセプトを「初参加者向けのイベント発見サイト」に定義                                              |
|2026-03-17|アプリ化方式をCapacitor（PWAラップ）に決定・iOSのみ対象                                          |
|2026-03-18|FUJI 86/BRZ STYLE・BMW@Kansaiを403エラーによりis_active=falseに変更                     |
|2026-03-18|重複排除ロジック修正：venue=nullの場合はevent_date+source_urlをキーに変更                         |
|2026-03-18|GitHub Actions: checkout v3→v4、setup-python v4→v5に更新                         |
|2026-03-18|recurring_eventsテーブル新設・eventsにrecurring_idカラム追加                              |
|2026-03-18|フロントをタブ切り替え式（イベント一覧・定期開催）に変更                                                 |
|2026-03-18|categoryカラム新設（6種類）・既存データをgenreから一括変換                                         |
|2026-03-18|target_vehicle正規化リストを確定・既存データを一括更新                                           |
|2026-03-18|車種・エリア・カテゴリフィルタをセレクト式（DB値ベース）に変更                                             |
|2026-03-18|keywordsカラム（TEXT[]）追加・クローラーでAI生成                                             |
|2026-03-18|guess_prefecture関数追加・search_logs・crawl_logsテーブル追加                            |
|2026-03-18|Vercel Analytics有効化・管理者ダッシュボード（/admin）実装                                     |
|2026-03-19|サービス名を「二輪四輪オフマップ」・ドメインを「24offmap.jp」に決定                                      |
|2026-03-19|ユーザー投稿フォーム（モーダル・フリーテキスト・Claude API解析）実装                                      |
|2026-03-19|fetch_genericをMarkdownリンク埋め込み方式に変更                                           |
|2026-03-23|日産プリンス兵庫ブログをis_active=falseに変更                                               |
|2026-03-23|重複排除キーをevent_date+nameに変更・既存重複データ削除                                          |
|2026-03-23|spots・spot_checkinsテーブル新設・地図ライブラリをLeaflet→@vis.gl/react-google-mapsに変更      |
|2026-03-24|spotsテーブルに86件登録完了（id 9〜94）・座標はGoogle Maps URLから手動取得                          |
|2026-03-24|チェックイン有効期限を「登録時刻+3時間」に変更・vehicle_typeをフリーテキストに変更                            |
|2026-03-24|/spotsページ名を「オフ会メーカー」に決定・リスト↔地図タブ切り替え実装                                       |
|2026-03-25|page.tsx全面リニューアル・/spotsページ全面リニューアル                                           |
|2026-03-25|MapView.tsxをuseMap()スコープ問題で修正（MapInner分離パターンに変更）                               |
|2026-03-25|Claude Code作業後は必ずgit add/commit/push/mergeを確認する運用を確定                         |
|2026-03-25|FAQページ（/faq）新規作成・/spotsページSEOメタデータ確定                                        |
|2026-03-26|spot_checkinsにtime_slotカラム追加・Plan登録ボタンのバグ修正                                   |
|2026-03-26|eventsテーブルにevent_date_endカラム追加（複数日イベント対応）                                      |
|2026-03-26|イベントマニアクローラー新規追加（crawl_type=eventmania・193件新規取得）                              |
|2026-03-26|check_sources.py作成・LLM生成URL38件確認→OK2件・WARN3件・NG32件                          |
|2026-03-26|dupcar/generic系の過去イベントスキップ追加                                                  |
|2026-03-26|トップページデスクトップ対応（ライトテーマ・2〜3カラム・フィルタ常時展開）                                      |
|2026-03-27|Alfa Romeo DayをsourcesにINSERT（is_active=true・generic・年1回開催）                   |
|2026-03-27|HIACE StyleをsourcesにINSERT（is_active=false・イベント情報なし）                          |
|2026-03-27|spotsテーブルに51件追加（関西・東北・北関東・奥多摩湖大麦代）→計137件                                     |
|2026-03-27|デスクトップ版ヘッダーボタン視認性改善（ライトテーマ対応）                                                |
|2026-03-27|/spotsページデスクトップ2カラム対応（左40%リスト・右60%地図・リスト→地図panTo連携）                          |
|2026-03-27|SpotCard・spots/page.tsxデスクトップライトテーマ対応（CSSカスタムプロパティ化）                          |
|2026-03-30|X専用アカウント・Gmail取得・表示名を「24offmap.jp」→「二輪四輪オフマップ」に変更                            |
|2026-03-30|XプロフィールURL・ヘッダー画像設定完了                                                        |
|2026-03-30|Xプロフィール文確定（126文字・パイロット版運営中・リプ感想募集）                                          |
|2026-03-30|X投稿の3タイプ黄金比確定（告知50%・煽り30%・質問20%）                                            |
|2026-03-30|「初参加OK」文言はDB未取得のため投稿では使用しないと決定                                              |
|2026-03-30|4月分X投稿19本を予約投稿設定完了                                                          |
|2026-03-30|認知向上戦略確定：「ロードスター × 関東」を最優先クラスタに設定                                          |
|2026-03-30|最重要KPIをPV数→spotsチェックイン数に変更                                                   |
|2026-03-30|定点スポットを大黒PA・宮ヶ瀬湖に設定                                                          |
|2026-03-30|レビュー機能・全方位SEO・アプリ化を当面凍結                                                      |
|2026-03-30|Google Search Console登録・DNS確認済み・サイトマップ送信済み                                   |
|2026-03-30|app/sitemap.ts新規作成（/・/spots・/faq）                                           |
|2026-03-30|MapView.tsxのcreateClient()をモジュールスコープから関数内部に移動（SSRビルドエラー修正）                   |
|2026-04-06|トップキャッチコピーを「オフ会・イベントが すぐ見つかる。」に確定                                             |
|2026-04-06|/spotsページ正式名称を「二輪四輪オフ会メーカー」に変更                                                |
|2026-04-06|トップページヒーロー2ボタン化（「今いる場所を共有する」「条件からイベントを探す」）・分岐モーダル実装                        |
|2026-04-06|Obsidian Vault: iCloud直下の `ObsidianVault/` フォルダに確定                           |
|2026-04-06|Git post-commitフック設置（ソースコードをObsidian `24offmap/source/` に自動同期）              |
|2026-04-06|CLAUDE.md最新化・セッションまとめ自動参照指示を追加                                               |
|2026-04-06|launchd + fswatch でDownloads監視：session-summary-*.md → Obsidian自動移動           |
|2026-04-06|launchd + fswatch でDownloads監視：data-*.zip → MD変換 → Obsidian自動保存            |
|2026-04-06|convert_claude_export.py作成（Claude Export JSON → Markdown変換・既存スキップ）          |
|2026-04-06|~/scripts/ に各種スクリプト集約（watch_session_summary.sh・watch_claude_export.sh・convert_claude_export.py）|

-----

## 11. 実装ステータス・TODO

### ✅ 完了

- DB設計（全テーブル）・Supabase連携
- クローラー基本実装（dupcar/minkara/generic/eventmania対応）
- Vercelデプロイ・GitHub Actions自動化（毎日AM4時）
- フィルタリング実装（フリーワード・車種・エリア・カテゴリ・日付範囲）
- recurring_events 7件登録・events紐付け
- sourcesテーブル約69件登録済み
- 管理者ダッシュボード（/admin）・Vercel Analytics
- ユーザー投稿フォーム（モーダル・フリーテキスト・Claude API解析）
- サービス名「二輪四輪オフマップ」・ドメイン24offmap.jp設定
- spots・spot_checkinsテーブル作成・RLS設定・137件登録
- page.tsx全面リニューアル（ヒーロー・折りたたみフィルタ・ナビボタン・近日バッジ・keywordsタグ）
- /spotsページ全面リニューアル（SpotCard.tsx・MapView.tsx・アコーディオン・チェックインUI）
- /spotsページデスクトップ2カラム対応（左40%リスト・右60%地図・連携）
- SpotCard・spots/page.tsxデスクトップライトテーマ対応
- FAQページ新規作成（/faq）・SEOメタデータ追加
- みんカラクローラー改修（一覧+詳細ページ方式）
- イベントマニアクローラー新規追加（193件新規取得）
- check_sources.py作成・dupcar/generic系の過去イベントスキップ追加
- トップページデスクトップ対応（ライトテーマ・2〜3カラム）
- デスクトップ版ヘッダーボタン視認性改善
- X専用アカウント・プロフィール整備・4月分投稿19本予約設定完了
- Google Search Console登録・サイトマップ送信完了
- app/sitemap.ts作成（/sitemap.xml配信）
- MapView.tsxのSSRビルドエラー修正（createClient()をモジュールスコープから除去）
- Obsidian知識ベース構築（Gitフック・launchd監視・Export変換スクリプト）
- CLAUDE.md最新化・セッションまとめ自動参照追加
- トップページヒーロー2ボタン化・分岐モーダル実装

### 🔧 直近TODO

| # | タスク | 備考 |
|---|---|---|
| ⑤ | おはよう新潟・おはくまのevents紐付け | 次回クロール後にrecurring_id再設定 |
| - | 指示書②（spots関連・矢印修正）の実行・動作確認 | session_20260406_morning.md参照 |
| - | 管理者による定点スポットチェックイン（週末・大黒PA or 宮ヶ瀬）＋Xスクショ投稿 | Phase 0の賑わい作り |
| - | X投稿の反応確認（週1程度）→ 反応良い投稿をメモ → 5月分投稿に反映 | |
| - | 5月分X投稿作成（GWイベント多め） | |

### 📋 PENDING

- [ ] スポットデータ拡充（九州・北海道）
- [ ] スポットデータ拡充（九州・北海道）
- [ ] イベントリストページからオフ会メーカーへの導線設計
- [ ] ブラックリストスポット管理（大黒PA等の除外仕組み）
- [ ] recurring_eventsのデータ拡充（現在7件）
- [ ] みんカラグループ系crawl_type=playwright対応
- [ ] BMW公式イベント：タイムアウト頻発・様子見
- [ ] MINI FES. 0件の原因確認
- [ ] 86 BRZ Avengers 2026年開催告知後に取得確認
- [ ] is_active=false「未確認」サイトの再調査
- [ ] 24offmap.net・offmap.jp の追加取得判断
- [ ] ロゴ・favicon・OGP作成（Midjourney）
- [ ] SpotCardにXシェアボタン追加（「今〇〇に〇人います」自動文言生成）
- [ ] 動的OGP生成（@vercel/og・イベント名・件数入り画像）
- [ ] 都道府県別ページ静的生成（/events/[prefecture]）
- [ ] 車種別ページ静的生成（/events/vehicle/[type]）

### 🚀 長期TODO

- [ ] Phase 2：タグ式レビュー機能（チェックイン週30件超えてから）
- [ ] Phase 2：過去イベント履歴リンク
- [ ] Phase 3：Apple Developer Program登録（$99/年）
- [ ] Phase 3：next-pwa・Capacitor導入・App Store申請

-----

*このドキュメントはセッション終了時に決定事項を追記する運用で管理しています。*
