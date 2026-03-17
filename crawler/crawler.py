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
- source_url: イベントの詳細ページURL（テキスト中にあれば。なければnull）
- target_vehicle: 対象車種・メーカー・ジャンル。以下の優先順位で抽出すること：
  1. イベント名や説明文に車種・メーカー名が含まれていればそのまま抽出（例：「ALFA Romeo Meeting」→「アルファロメオ」）
  2. ジャンルから推測できる場合は記載（例：「旧車」「ドレスアップ全般」「軽自動車」）
  3. 全く手がかりがない場合のみnull
  ※10文字以内で簡潔に。車種名・ジャンル名のみ。複数車種がある場合は最も代表的な1つ＋「等」で記載。
  例：旧車全般、軽自動車、アルファロメオ等、ドレスアップ等

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
    """汎用：テキストのみ取得"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        # apparent_encodingは誤検出が多いため、BS4にrawバイトを渡してmeta charsetから自動検出させる
        soup = BeautifulSoup(res.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return (text or "")[:4000], []
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

        if prefetched_events:
            url_map = {e["name"]: e["source_url"] for e in prefetched_events}
            for event in events:
                name = event.get("name", "")
                matched_url = url_map.get(name)
                if not matched_url:
                    for pname, purl in url_map.items():
                        if name in pname or pname in name:
                            matched_url = purl
                            break
                if matched_url:
                    event["source_url"] = matched_url

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

        text, prefetched = fetch_site(site_url, crawl_type)
        if not text:
            print(f"  → テキスト取得失敗、スキップ\n")
            continue

        if prefetched:
            print(f"  → {len(prefetched)}件のリンクを事前取得")

        events = normalize(text, site_name, site_url, prefetched)
        print(f"  → {len(events)}件のイベントを抽出")

        saved, updated, skipped = save_events(events)
        print(f"  → 新規: {saved}件 / 更新: {updated}件 / スキップ: {skipped}件\n")

        total_saved += saved
        total_updated += updated
        total_skipped += skipped

        time.sleep(1)

    print(f"=== 完了 ===")
    print(f"合計 新規: {total_saved}件 / 更新: {total_updated}件 / スキップ: {total_skipped}件")

if __name__ == "__main__":
    main()
