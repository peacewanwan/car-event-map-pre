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
import re
import time
import requests
from datetime import datetime, timedelta
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

def _parse_minkara_date(raw_date):
    """みんカラの日付文字列をYYYY-MM-DD形式に変換"""
    if not raw_date:
        return None
    m = re.search(r"(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})", raw_date)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return None


def _minkara_to_category(raw_category):
    """みんカラのカテゴリをDBのcategory値に変換"""
    if not raw_category:
        return "meeting"
    c = raw_category
    if any(k in c for k in ["走行会", "サーキット", "ジムカーナ"]):
        return "track"
    if any(k in c for k in ["ツーリング", "ドライブ"]):
        return "touring"
    if any(k in c for k in ["展示", "ショー", "オートサロン"]):
        return "show"
    if any(k in c for k in ["定例", "定期", "おはよう"]):
        return "regular"
    return "meeting"


def crawl_minkara(site_name, site_url):
    """みんカラ専用クローラー: list.aspxページネーション + 詳細ページ直接パース"""
    base = "https://minkara.carview.co.jp"
    today = datetime.now()
    one_year_later = today + timedelta(days=365)
    today_str = today.strftime("%Y%m%d")
    end_str = one_year_later.strftime("%Y%m%d")

    # 既取得IDをDBから収集
    try:
        existing = supabase.table("events").select("source_url").like(
            "source_url", "https://minkara.carview.co.jp/calendar/%"
        ).execute()
        existing_ids = set()
        for row in (existing.data or []):
            m = re.search(r"/calendar/(\d+)/", row.get("source_url") or "")
            if m:
                existing_ids.add(m.group(1))
    except Exception as e:
        print(f"  [WARN] 既存ID取得失敗: {e}")
        existing_ids = set()

    print(f"  → 既存ID数: {len(existing_ids)}")

    # ページネーションでイベントID収集
    all_ids = []
    for pn in range(1, 50):
        list_url = f"{base}/calendar/list.aspx?fd={today_str}&ed={end_str}&pn={pn}"
        try:
            res = requests.get(list_url, headers=HEADERS, timeout=15)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, "html.parser")
            found = []
            for a in soup.find_all("a", href=True):
                m = re.match(r"^/calendar/(\d+)/?$", a["href"])
                if m:
                    found.append(m.group(1))
            found = list(dict.fromkeys(found))
            if not found:
                print(f"  → pn={pn}: リンクなし、ページネーション終了")
                break
            print(f"  → pn={pn}: {len(found)}件のIDを取得")
            all_ids.extend(found)
            time.sleep(1)
        except Exception as e:
            print(f"  [ERROR] みんカラ一覧フェッチ失敗 pn={pn}: {e}")
            break

    all_ids = list(dict.fromkeys(all_ids))
    new_ids = [i for i in all_ids if i not in existing_ids]
    print(f"  → 合計{len(all_ids)}件、うち新規{len(new_ids)}件をフェッチ")

    events = []
    for event_id in new_ids:
        detail_url = f"{base}/calendar/{event_id}/"
        try:
            res = requests.get(detail_url, headers=HEADERS, timeout=15)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, "html.parser")

            event = {
                "source_url": detail_url,
                "source_site": site_name,
                "source_site_url": site_url,
            }

            # detailTable をパース（複数セレクタを試行）
            table = (
                soup.find("table", class_="detailTable")
                or soup.find("table", id="detailTable")
                or soup.find("table", attrs={"class": re.compile(r"detail", re.I)})
            )
            if table:
                for row in table.find_all("tr"):
                    # みんカラのdetailTableは th なしで td/td 構造
                    cells = row.find_all("td")
                    if len(cells) < 2:
                        continue
                    label = cells[0].get_text(strip=True)
                    value = cells[1].get_text(strip=True)

                    if any(k in label for k in ["タイトル", "イベント名", "名称"]):
                        event["name"] = value
                    elif any(k in label for k in ["開催日", "日時", "日程"]):
                        event["raw_date"] = value
                    elif any(k in label for k in ["開催地", "場所", "会場", "住所"]):
                        event["raw_location"] = value
                    elif "カテゴリ" in label:
                        event["raw_category"] = value
                    elif any(k in label for k in ["車種", "対象車種", "参加車種"]):
                        v = value[:10] if value else None
                        event["target_vehicle"] = v
                    elif "ジャンル" in label:
                        event["genre"] = value

            # イベント名フォールバック（h1.content-title-201612 → 非空h1 → h2）
            if not event.get("name"):
                el = soup.select_one("h1.content-title-201612")
                if not el:
                    for h in soup.find_all(["h1", "h2"]):
                        text = h.get_text(strip=True)
                        if text:
                            el = h
                            break
                if el:
                    event["name"] = el.get_text(strip=True)

            # source_url は必ず詳細ページURL
            event["source_url"] = detail_url

            # 日付パース
            event["event_date"] = _parse_minkara_date(event.pop("raw_date", None))

            # 過去イベントはスキップ
            if event["event_date"] and event["event_date"] < datetime.now().strftime("%Y-%m-%d"):
                print(f"  [SKIP] ID={event_id}: 過去イベント ({event['event_date']})")
                time.sleep(1)
                continue

            # 場所パース
            raw_location = event.pop("raw_location", None)
            if raw_location:
                event["prefecture"] = guess_prefecture(raw_location)
                event["venue"] = raw_location

            # カテゴリ変換
            event["category"] = _minkara_to_category(event.pop("raw_category", None))

            # target_vehicle / prefecture 補完
            if not event.get("target_vehicle"):
                event["target_vehicle"] = guess_vehicle(event.get("name") or "")
            if not event.get("prefecture"):
                event["prefecture"] = guess_prefecture(
                    (event.get("name") or "") + " " + (event.get("venue") or "")
                )

            # lat/lng: JS内の center: [lng, lat] を抽出（任意）
            for script in soup.find_all("script"):
                if script.string:
                    m = re.search(
                        r"center\s*:\s*\[\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\]",
                        script.string,
                    )
                    if m:
                        event["lng"] = float(m.group(1))
                        event["lat"] = float(m.group(2))
                        break

            if event.get("name") and event.get("event_date"):
                events.append(event)
                print(f"  ✓ {event['name']} ({event['event_date']})")
            else:
                print(f"  [SKIP] ID={event_id}: 名前または日付なし")

            time.sleep(1)

        except Exception as e:
            print(f"  [ERROR] 詳細フェッチ失敗 ID={event_id}: {e}")
            time.sleep(1)

    return events

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

def generate_keywords(event: dict) -> list | None:
    """Claude Haiku でイベントのキーワードを生成"""
    try:
        text = (
            f"イベント名：{event.get('name', '')}\n"
            f"都道府県：{event.get('prefecture', '')}\n"
            f"会場：{event.get('venue', '')}\n"
            f"ジャンル：{event.get('genre', '')}"
        )
        message = anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    "以下のイベント情報から、検索に役立つキーワードを5〜8個生成してください。"
                    "JSON配列のみ返してください。説明不要。\n\n" + text
                ),
            }],
        )
        raw = message.content[0].text.strip()
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start != -1 and end > 0:
            return json.loads(raw[start:end])
    except Exception as e:
        print(f"  [WARN] キーワード生成失敗: {e}")
    return None


# ---------------------------------------------------------------
# イベントマニア
# ---------------------------------------------------------------

EVENTMANIA_SKIP_GENRES = ["ゴルフ", "花火", "お祭り", "フリーマーケット", "温泉", "キャンプ"]


def _parse_eventmania_date(text: str):
    """「2026/03/21 (土) ～ 2026/03/22 (日)」などを (start_date, end_date) に変換"""
    parts = re.split(r'[～〜]', text)

    def extract(s):
        m = re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})', s.strip())
        if m:
            return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
        return None

    start = extract(parts[0]) if parts else None
    end = extract(parts[1]) if len(parts) >= 2 else None
    return start, end


def _eventmania_to_category(genre: str | None) -> str:
    if not genre:
        return "unknown"
    if any(k in genre for k in ["クラシックカー", "旧車", "ドレスアップカー", "バイク", "その他車関係イベント"]):
        return "meeting"
    if any(k in genre for k in ["カーレース", "その他レース"]):
        return "track"
    return "unknown"


def crawl_eventmania(site_name: str, site_url: str) -> list:
    """イベントマニア専用クローラー: 今日〜1年後まで月別ループ"""
    today = datetime.now()
    one_year_later = today + timedelta(days=365)
    today_str = today.strftime("%Y-%m-%d")

    events = []
    cur = today.replace(day=1)

    while cur <= one_year_later:
        date_param = cur.strftime("%Y-%m")
        page_url = f"https://www.mach5.jp/eventmania/areaevent.php?date={date_param}&pref=null"

        try:
            res = requests.get(page_url, headers=HEADERS, timeout=15)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, "html.parser")
            infoboxes = soup.find_all("div", class_="infobox")
            print(f"  → {date_param}: {len(infoboxes)}件")

            for box in infoboxes:
                # カテゴリタグ（1つ目：ジャンル、2つ目：都道府県）
                cat_div = box.find("div", id="category")
                tags = cat_div.find_all("p", class_="tag") if cat_div else []
                genre = tags[0].get_text(strip=True) if len(tags) >= 1 else None
                pref_tag = tags[1].get_text(strip=True) if len(tags) >= 2 else None

                # 除外ジャンルスキップ
                all_tag_text = " ".join(t.get_text(strip=True) for t in tags)
                if any(skip in all_tag_text for skip in EVENTMANIA_SKIP_GENRES):
                    continue

                # タイトル + source_url
                title_div = box.find("div", class_="title")
                name = None
                event_source_url = page_url
                if title_div:
                    a_tag = title_div.find("a")
                    if a_tag:
                        name = a_tag.get_text(strip=True)
                        href = a_tag.get("href", "").strip()
                        if href and not href.startswith("#"):
                            if href.startswith("http"):
                                event_source_url = href
                            elif href.startswith("/"):
                                event_source_url = "https://www.mach5.jp" + href
                            else:
                                event_source_url = href
                    else:
                        name = title_div.get_text(strip=True)

                if not name:
                    continue

                # 日付
                date_div = box.find("div", class_="date")
                start_date = None
                end_date = None
                if date_div:
                    date_p = date_div.find("p")
                    if date_p:
                        start_date, end_date = _parse_eventmania_date(date_p.get_text(strip=True))

                if not start_date:
                    continue

                # 過去イベントスキップ
                if start_date < today_str:
                    continue

                # 会場名（fa-building アイコン行）
                venue = None
                text_div = box.find("div", class_="text")
                if text_div:
                    for elem in text_div.find_all(True):
                        if elem.find("i", class_=lambda c: c and "fa-building" in c):
                            a = elem.find("a")
                            if a:
                                venue = a.get_text(strip=True)
                            else:
                                for icon in elem.find_all("i"):
                                    icon.decompose()
                                venue = elem.get_text(strip=True) or None
                            break

                # 都道府県補完
                prefecture = pref_tag or guess_prefecture((name or "") + " " + (venue or ""))

                event = {
                    "name":           name,
                    "event_date":     start_date,
                    "event_date_end": end_date,
                    "prefecture":     prefecture,
                    "venue":          venue,
                    "genre":          genre,
                    "category":       _eventmania_to_category(genre),
                    "target_vehicle": guess_vehicle(name),
                    "source_url":     event_source_url,
                    "source_site":    site_name,
                    "source_site_url": site_url,
                }
                events.append(event)
                print(f"  ✓ {name} ({start_date})")

            time.sleep(1)

        except Exception as e:
            print(f"  [ERROR] イベントマニア {date_param}: {e}")
            time.sleep(1)

        # 翌月へ
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)

    # キーワード生成（AI）
    for event in events:
        event["keywords"] = generate_keywords(event)
        time.sleep(0.3)

    return events


def fetch_site(url, crawl_type):
    if crawl_type == "dupcar":
        return fetch_dupcar(url)
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
                "id, name, genre, target_vehicle, source_url, category, keywords"
            ).eq("event_date", event["event_date"]).eq(
                "name", event.get("name", "")
            ).execute()

            new_data = {
                "name":             event.get("name"),
                "event_date":       event.get("event_date"),
                "event_date_end":   event.get("event_date_end"),
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
                    old.get("category") != new_data["category"],
                    old.get("keywords") != new_data["keywords"],
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
            if crawl_type == "minkara":
                events = crawl_minkara(site_name, site_url)
                print(f"  → {len(events)}件のイベントを取得")
                saved, updated, skipped = save_events(events)
                print(f"  → 新規: {saved}件 / 更新: {updated}件 / スキップ: {skipped}件\n")
            elif crawl_type == "eventmania":
                events = crawl_eventmania(site_name, site_url)
                print(f"  → {len(events)}件のイベントを取得")
                saved, updated, skipped = save_events(events)
                print(f"  → 新規: {saved}件 / 更新: {updated}件 / スキップ: {skipped}件\n")
            else:
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
