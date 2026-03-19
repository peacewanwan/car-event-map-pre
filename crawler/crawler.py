"""
Car Event MAP - クローラースクリプト
--------------------------------------
1. Supabase の sources テーブルから is_active=TRUE のサイト一覧を取得
2. 各サイトをスクレイピング（crawl_typeに応じてリンクも取得）
3. Claude API で正規化
4. events テーブルに upsert（差分があれば更新、なければスキップ）

必要なパッケージ:
    pip install requests beautifulsoup4 anthropic supabase python-dotenv

環境変数（.env または GitHub Actions Secrets に設定）:
    SUPABASE_URL
    SUPABASE_KEY
    ANTHROPIC_API_KEY
"""

import os
from dotenv import load_dotenv
load_dotenv()
import json
import time
import requests
from bs4 import BeautifulSoup
from anthropic import Anthropic
from supabase import create_client

# ---------------------------------------------------------------
# 設定
# ---------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
anthropic = Anthropic(api_key=ANTHROPIC_API_KEY)

# ---------------------------------------------------------------
# AI正規化プロンプト
# ---------------------------------------------------------------

NORMALIZE_PROMPT = """
以下のWebページのテキストから、車のイベント情報を抽出してください。
JSON配列のみ返してください。説明文やMarkdownのコードブロックは不要です。

抽出する項目：
- name: イベント名
- event_date: 開催日（YYYY-MM-DD形式）
- prefecture: 都道府県（例：大阪府、東京都）
- venue: 会場名
- genre: ジャンル（ドレスアップ / 旧車 / ミーティング / オフ会 / 走行会 / その他 から最も近いもの）
- category: イベントの種別。以下の6種類から1つを選ぶ：
  - meeting: オフ会・ミーティング・集まって見せ合う系
  - track: 走行会・サーキット・峠での走行体験
  - regular: 毎週・毎月など定期おはようMTG系
  - show: 展示・ショー・オートサロン・メッセ・博物館系
  - touring: ツーリング・一緒に走る・ドライブ系
  - unknown: 判断材料不足
- keywords: イベントを検索する際に役立つキーワードのリスト（配列形式）。車種・メーカー・ジャンル・地名・イベント特徴などを5〜10個程度。例：["ロードスター", "オープンカー", "静岡", "朝活", "初参加歓迎"]
- source_url: イベントの詳細ページURL（テキスト中にあれば。なければnull）
- target_vehicle: 対象車種・メーカー・ジャンル。以下の優先順位で抽出すること：
  1. イベント名や説明文に車種・メーカー名が含まれていればそのまま抽出（例：「ALFA Romeo Meeting」→「アルファロメオ」）
  2. ジャンルから推測できる場合は記載（例：「旧車」「ドレスアップ全般」「軽自動車」）
  3. 全く手がかりがない場合のみnull
  ※10文字以内で簡潔に。車種名・ジャンル名のみ。複数車種がある場合は最も代表的な1つ＋「等」で記載。

  【正規化済み表記リスト】できる限り以下の表記に統一すること：
  - 旧車・クラシック （80年代・90年代車、クラシックカー、旧車全般、旧車等、旧車・アメ車などはこれに統一）
  - 86/BRZ （AE86、86・BRZ等もこれに統一）
  - BMW/MINI （BMW等、MINI、ミニはこれに統一）
  - GRヤリス （GRヤリス等、GR車種もこれに統一）
  - ドリフト車 （ドリフト車等もこれに統一）
  - ドレスアップ （ドレスアップ全般、ドレスアップ等、ブルー系カスタムもこれに統一）
  - 商用車 （商用車全般もこれに統一）
  - ロードスター
  - コペン
  - 痛車
  - キャンピングカー
  - GT-R
  - マツダ
  - 軽自動車
  - アルファロメオ
  リストにない場合は最も近い表記で10文字以内で返す。

ルール：
- 取れない項目は null にする
- 過去のイベントは除外する
- 同じページに複数イベントがある場合は全て抽出する
- イベントではない情報（ナビメニュー、広告等）は無視する

【除外するイベント】以下に該当する場合はJSON配列に含めないこと：
- プロ・アマ問わずレース競技会（例：D1グランプリ、スーパーGT、スーパーフォーミュラ、耐久レース、F1、MotoGP、カートレース等）
- ジムカーナ・ラリー・ダートトライアル・ドリフト競技等のスピード競技会
- 観戦専用イベント（参加・展示・交流要素がなく、観るだけの観客向けイベント）

【残すイベント】以下は必ず抽出すること：
- 走行会（一般参加型・体験型）
- オフ会・ミーティング・クラブイベント
- カーショー・展示会・コンテスト
- 体験走行・ドライビングスクール
- ファンミーティング・オーナーズミーティング

テキスト：
{text}
"""

# ---------------------------------------------------------------
# キーワードマッチで対象車種を補完
# ---------------------------------------------------------------

def guess_prefecture(text: str):
    """テキストから都道府県を推定する"""
    prefectures = {
        "北海道": ["北海道", "札幌", "函館", "旭川", "釧路", "帯広", "富良野", "十勝"],
        "青森県": ["青森", "弘前", "八戸"],
        "岩手県": ["岩手", "盛岡", "花巻"],
        "宮城県": ["宮城", "仙台", "SUGO", "スポーツランドSUGO"],
        "秋田県": ["秋田"],
        "山形県": ["山形", "寒河江", "米沢"],
        "福島県": ["福島", "エビスサーキット", "郡山"],
        "茨城県": ["茨城", "筑波", "つくば", "水戸"],
        "栃木県": ["栃木", "もてぎ", "日光", "宇都宮"],
        "群馬県": ["群馬", "伊香保", "前橋", "高崎", "榛名"],
        "埼玉県": ["埼玉", "所沢", "さいたま", "本庄"],
        "千葉県": ["千葉", "袖ヶ浦", "袖ケ浦", "幕張", "木更津"],
        "東京都": ["東京", "お台場", "有明", "青海", "奥多摩"],
        "神奈川県": ["神奈川", "横浜", "川崎", "箱根", "大観山", "小田原", "湘南"],
        "新潟県": ["新潟", "上越", "長岡"],
        "富山県": ["富山"],
        "石川県": ["石川", "金沢"],
        "福井県": ["福井", "タカスサーキット"],
        "山梨県": ["山梨", "富士吉田", "富士山"],
        "長野県": ["長野", "軽井沢", "松本", "飯田", "天竜峡"],
        "静岡県": ["静岡", "富士スピードウェイ", "浜名湖", "浜松", "沼津"],
        "愛知県": ["愛知", "名古屋", "豊田", "岡崎", "トヨタ博物館"],
        "三重県": ["三重", "鈴鹿", "津"],
        "滋賀県": ["滋賀", "大津", "奥伊吹"],
        "京都府": ["京都", "嵐山", "高雄"],
        "大阪府": ["大阪", "泉大津", "堺", "インテックス"],
        "兵庫県": ["兵庫", "神戸", "姫路", "西宮", "淡路"],
        "奈良県": ["奈良", "名阪"],
        "和歌山県": ["和歌山"],
        "鳥取県": ["鳥取"],
        "島根県": ["島根"],
        "岡山県": ["岡山", "岡山国際サーキット", "笠岡"],
        "広島県": ["広島", "尾道"],
        "山口県": ["山口"],
        "徳島県": ["徳島"],
        "香川県": ["香川", "高松"],
        "愛媛県": ["愛媛", "松山"],
        "高知県": ["高知"],
        "福岡県": ["福岡", "博多", "北九州"],
        "佐賀県": ["佐賀"],
        "長崎県": ["長崎"],
        "熊本県": ["熊本", "大観峰", "阿蘇"],
        "大分県": ["大分", "オートポリス", "別府"],
        "宮崎県": ["宮崎"],
        "鹿児島県": ["鹿児島"],
        "沖縄県": ["沖縄", "那覇"],
    }
    for pref, keywords in prefectures.items():
        for kw in keywords:
            if kw in text:
                return pref
    return None



def guess_vehicle(name, description=""):
    text = (name + " " + (description or "")).lower()
    patterns = [
        (["alfa romeo", "アルファ"], "アルファロメオ"),
        (["rx-7", "rx7", "サバンナ"], "RX-7"),
        (["86", "ハチロク", "ae86"], "AE86・86"),
        (["gtr", "gt-r", "skyline", "スカイライン"], "スカイライン・GT-R"),
        (["porsche", "ポルシェ"], "ポルシェ"),
        (["bmw", "ビーエムダブリュー"], "BMW"),
        (["mercedes", "ベンツ", "amg"], "メルセデス・ベンツ"),
        (["ferrari", "フェラーリ"], "フェラーリ"),
        (["lamborghini", "ランボルギーニ"], "ランボルギーニ"),
        (["旧車", "oldcar", "old car", "オールド", "departure"], "旧車全般"),
        (["軽自動車", "軽car", "kcar", "k-car", "軽"], "軽自動車"),
        (["ドレスアップ", "dressup", "dress up", "vip", "carnival"], "ドレスアップ全般"),
        (["american", "アメ車", "usdm"], "アメ車"),
        (["euro", "ユーロ", "欧州"], "欧州車全般"),
        (["blue", "ブルー"], "ブルー系カスタム"),
        (["hotsprings", "hot springs"], "旧車・アメ車"),
    ]
    for keywords, label in patterns:
        if any(k in text for k in keywords):
            return label
    return None

# ---------------------------------------------------------------
# サイト別スクレイピング
# ---------------------------------------------------------------

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CarEventMapBot/1.0)"}

def fetch_generic(url):
    """汎用：テキスト＋リンクをMarkdown形式で埋め込んで取得"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        soup = BeautifulSoup(res.content, "html.parser")

        from urllib.parse import urlparse
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            text = a.get_text(strip=True)
            if not href or href.startswith("#") or href.startswith("javascript"):
                a.replace_with(text)
                continue
            if href.startswith("/"):
                href = base + href
            elif not href.startswith("http"):
                href = url.rstrip("/") + "/" + href
            if text:
                a.replace_with(f"[{text}]({href})")
            else:
                a.replace_with(href)

        text = soup.get_text(separator="\n", strip=True)
        return (text or "")[:5000], []

    except Exception as e:
        print(f"  [ERROR] スクレイピング失敗: {url} - {e}")
        return "", []

def fetch_dupcar(url):
    """ドレスアップカーイベント.com専用"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        soup = BeautifulSoup(res.content, "html.parser")

        events = []
        table = soup.find("table", id="list_all")
        if table:
            for row in table.find_all("tr"):
                date_td = row.find("td", class_="date_top")
                h5 = row.find("h5")
                link_tag = h5.find("a") if h5 else None
                if date_td and link_tag:
                    events.append({
                        "name": link_tag.get_text(strip=True),
                        "source_url": link_tag.get("href"),
                        "raw_date": date_td.get_text(strip=True),
                    })

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return (text or "")[:4000], events

    except Exception as e:
        print(f"  [ERROR] dupcarスクレイピング失敗: {url} - {e}")
        return "", []

def fetch_minkara(url):
    """みんカラ イベントカレンダー専用"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        soup = BeautifulSoup(res.content, "html.parser")

        events = []
        calendar_list = soup.find("ul", class_="calendar-list")
        if calendar_list:
            for li in calendar_list.find_all("li"):
                title_dt = li.find("dt", class_="eventTtl")
                link_tag = title_dt.find("a") if title_dt else None
                if link_tag:
                    href = link_tag.get("href") or ""
                    # 相対URLを絶対URLに変換
                    if href.startswith("/"):
                        href = "https://minkara.carview.co.jp" + href
                    events.append({
                        "name": link_tag.get_text(strip=True),
                        "source_url": href or None,
                    })

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return (text or "")[:4000], events

    except Exception as e:
        print(f"  [ERROR] みんカラスクレイピング失敗: {url} - {e}")
        return "", []

def fetch_suzuka(url):
    """鈴鹿サーキット専用 - Calendar_Contents div を直接抽出"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        soup = BeautifulSoup(res.content, "html.parser")
        cal = soup.find("div", class_="Calendar_Contents")
        if cal:
            text = cal.get_text(separator="\n", strip=True)
        else:
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
        return (text or "")[:4000], []
    except Exception as e:
        print(f"  [ERROR] 鈴鹿スクレイピング失敗: {url} - {e}")
        return "", []

def fetch_site(url, crawl_type):
    if crawl_type == "dupcar":
        return fetch_dupcar(url)
    elif crawl_type == "minkara":
        return fetch_minkara(url)
    elif crawl_type == "suzuka":
        return fetch_suzuka(url)
    else:
        return fetch_generic(url)

# ---------------------------------------------------------------
# AI正規化
# ---------------------------------------------------------------

def normalize(text, site_name, site_url, prefetched_events=None):
    try:
        message = anthropic.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": NORMALIZE_PROMPT.format(text=text)}]
        )
        raw = message.content[0].text.strip()
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end <= 0:
            print(f"  [WARN] JSONが見つかりません: {site_name}")
            return []
        events = json.loads(raw[start:end])

        for event in events:
            event["source_site"] = site_name
            event["source_site_url"] = site_url
            if not event.get("source_url"):
                event["source_url"] = site_url
            if not event.get("target_vehicle"):
                event["target_vehicle"] = guess_vehicle(
                    event.get("name") or "",
                    event.get("description") or ""
                )
            if not event.get("prefecture"):
                combined = (event.get("name") or "") + " " + (event.get("venue") or "")
                event["prefecture"] = guess_prefecture(combined)

        return events

    except Exception as e:
        print(f"  [ERROR] AI正規化失敗: {site_name} - {e}")
        return []

# ---------------------------------------------------------------
# DB保存
# ---------------------------------------------------------------

def save_events(events):
    saved = 0
    updated = 0
    skipped = 0

    for event in events:
        if event.get("target_vehicle") and len(event["target_vehicle"]) > 10:
            event["target_vehicle"] = event["target_vehicle"][:10]
        if not event.get("name") or not event.get("event_date"):
            skipped += 1
            continue

        try:
            existing = supabase.table("events").select(
                "id, name, genre, target_vehicle, source_url"
            ).eq("event_date", event["event_date"]).eq(
                "venue", event.get("venue", "")
            ).execute()

            new_data = {
                "name":             event.get("name"),
                "event_date":       event.get("event_date"),
                "prefecture":       event.get("prefecture"),
                "venue":            event.get("venue"),
                "genre":            event.get("genre"),
                "category":         event.get("category"),
                "keywords":         event.get("keywords"),
                "source_url":       event.get("source_url"),
                "source_site":      event.get("source_site"),
                "source_site_url":  event.get("source_site_url"),
                "target_vehicle":   event.get("target_vehicle"),
            }

            if existing.data:
                old = existing.data[0]
                has_diff = any([
                    old.get("name") != new_data["name"],
                    old.get("genre") != new_data["genre"],
                    old.get("target_vehicle") != new_data["target_vehicle"],
                    old.get("source_url") != new_data["source_url"],
                ])
                if has_diff:
                    supabase.table("events").update(new_data).eq("id", old["id"]).execute()
                    updated += 1
                else:
                    skipped += 1
            else:
                supabase.table("events").insert(new_data).execute()
                saved += 1

        except Exception as e:
            print(f"  [ERROR] DB保存失敗: {event.get('name')} - {e}")
            skipped += 1

    return saved, updated, skipped

# ---------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------

def main():
    print("=== Car Event MAP クローラー 開始 ===\n")

    result = supabase.table("sources").select("*").eq("is_active", True).execute()
    sources = result.data

    print(f"対象サイト数: {len(sources)}\n")

    total_saved = 0
    total_updated = 0
    total_skipped = 0

    for source in sources:
        site_name = source["site_name"]
        site_url = source["url"]
        crawl_type = source.get("crawl_type", "generic")
        print(f"[{site_name}] クロール中... (type: {crawl_type})")

        error_message = None
        saved = updated = skipped = 0
        try:
            text, prefetched = fetch_site(site_url, crawl_type)
            if not text:
                print(f"  → テキスト取得失敗、スキップ\n")
                error_message = "テキスト取得失敗"
            else:
                if prefetched:
                    print(f"  → {len(prefetched)}件のリンクを事前取得")
                events = normalize(text, site_name, site_url, prefetched)
                print(f"  → {len(events)}件のイベントを抽出")
                saved, updated, skipped = save_events(events)
                print(f"  → 新規: {saved}件 / 更新: {updated}件 / スキップ: {skipped}件\n")
        except Exception as e:
            error_message = str(e)
            print(f"  [ERROR] {site_name}: {e}\n")

        try:
            supabase.table("crawl_logs").insert({
                "site_name":     site_name,
                "new_count":     saved,
                "updated_count": updated,
                "skipped_count": skipped,
                "error_message": error_message,
            }).execute()
        except Exception as e:
            print(f"  [WARN] crawl_logs書き込み失敗: {e}")

        total_saved += saved
        total_updated += updated
        total_skipped += skipped

        time.sleep(1)

    print(f"=== 完了 ===")
    print(f"合計 新規: {total_saved}件 / 更新: {total_updated}件 / スキップ: {total_skipped}件")

if __name__ == "__main__":
    main()
