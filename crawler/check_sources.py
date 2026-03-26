"""
check_sources.py - クロール候補サイトの事前チェックスクリプト
- HTTPステータス確認
- robots.txt確認
- イベント関連ワードの有無確認
"""

import csv
import time
import requests
from urllib.parse import urljoin, urlparse

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CarEventMapBot/1.0)"}
TIMEOUT = 10

EVENT_WORDS = ["イベント", "event", "meeting", "ミーティング", "オフ会", "schedule", "開催"]

SOURCES = [
    ("ジムニークラブ金沢",           "http://jimny-kanazawa.com/event.html"),
    ("S2000 Owners Club Japan",      "http://www.s2oc.com/"),
    ("S2000 Owners Club Japan (別)", "http://www.s2000.jp/"),
    ("NSX Owners Club Japan",        "https://www.nsx-ownersclub.jp/"),
    ("Evolution Meeting",            "http://evo-meeting.com/"),
    ("Porsche Japan イベント",        "https://www.porsche.com/japan/jp/events/"),
    ("Ferrari Owners Club Japan",    "https://www.ferrariownersclub.jp/"),
    ("ABARTH DAY（公式）",           "https://www.abarth.jp/event/"),
    ("Abarth Club Japan",            "https://www.abarthclubjapan.com/"),
    ("Alfa Romeo Day",               "http://alfaday.com/"),
    ("Fiat Festa",                   "https://fiatfesta.jp/"),
    ("VW Freaks",                    "https://vwfreaks.jp/"),
    ("Audi Team Japan",              "https://auditeam.jp/"),
    ("Caterham Owners Club Japan",   "https://caterham.jp/"),
    ("Lotus Owners Club Japan",      "https://locj.jp/"),
    ("Vespa Club Japan",             "http://vespaclubjapan.com/"),
    ("Stancenation Japan",           "https://stancenation-japan.com/"),
    ("Lowrider Japan",               "https://lowrider-japan.com/"),
    ("Harley Owners Group Japan",    "https://www.hogjapan.com/"),
    ("十国峠カブミーティング",        "https://10goku-cub.com/"),
    ("カブ千里（公式ブログ）",        "https://cubsenri.exblog.jp/"),
    ("Cub Meeting",                  "https://cubmeeting.jp/"),
    ("Rebel Owners Meeting",         "https://rebel-meeting.com/"),
    ("CB Fan Meeting",               "https://cbfanmeeting.com/"),
    ("HIACE Style Meeting",          "https://hiace-style.net/"),
    ("ハイエース Style",             "https://hiace-style.com/"),
    ("Morning Mission",              "https://morningmission.tokyo/"),
    ("おはよう関西",                  "https://ohakansai.com/"),
    ("Cafe door",                    "http://cafe-door.net/"),
    ("九州カーイベントカレンダー",    "https://kyushu-car-event.com/"),
    ("Car Event Japan",              "https://careventjapan.com/"),
    ("Subaru Drive Day",             "https://www.subarudrive.com/"),
    ("Tipo Weekend Meeting",         "https://super-battle.com/"),
    ("ジムニークラブ金沢 (再掲)",    "http://jimny-kanazawa.com/event.html"),
    ("おはよう四国",                  "https://minkara.carview.co.jp/group/ohashiku/"),
    ("おはよう岡山（おはきび）",      "https://minkara.carview.co.jp/group/ohakibi/"),
    ("奥多摩湖BEATミーティング",      "https://minkara.carview.co.jp/group/km6Mc5C/"),
]

OUTPUT_CSV = "crawler/check_sources_result.csv"


def check_robots(base_url: str) -> bool:
    """robots.txtをチェックし、全体Disallowがなければ True を返す"""
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        res = requests.get(robots_url, headers=HEADERS, timeout=TIMEOUT)
        if res.status_code != 200:
            return True  # robots.txt なし → OK
        text = res.text.lower()
        # 行全体が "disallow: /" の場合のみ NG（部分一致・/* は除外）
        for line in text.splitlines():
            if line.strip() == "disallow: /":
                return False
        return True
    except Exception:
        return True  # 取得失敗 → OK扱い


def check_site(site_name: str, url: str) -> dict:
    print(f"  チェック中: {site_name} ({url})")

    result = {
        "site_name":      site_name,
        "url":            url,
        "status_code":    None,
        "robots_ok":      None,
        "has_event_word": None,
        "judgment":       "NG",
    }

    # 1. HTTPステータス
    try:
        res = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        result["status_code"] = res.status_code
    except requests.exceptions.Timeout:
        result["status_code"] = "TIMEOUT"
        print(f"    → TIMEOUT")
        return result
    except Exception as e:
        result["status_code"] = f"ERROR"
        print(f"    → ERROR: {e}")
        return result

    if result["status_code"] != 200:
        print(f"    → HTTP {result['status_code']}")
        return result

    # 2. robots.txt
    robots_ok = check_robots(url)
    result["robots_ok"] = robots_ok

    # 3. イベント関連ワード
    try:
        body = res.text.lower()
        has_event_word = any(w.lower() in body for w in EVENT_WORDS)
        result["has_event_word"] = has_event_word
    except Exception:
        result["has_event_word"] = False

    # judgment
    if result["status_code"] == 200 and robots_ok and result["has_event_word"]:
        result["judgment"] = "OK"
    elif result["status_code"] == 200:
        result["judgment"] = "WARN"
    else:
        result["judgment"] = "NG"

    print(f"    → {result['judgment']}  status={result['status_code']}  robots_ok={robots_ok}  event_word={result['has_event_word']}")
    return result


def main():
    print("=== check_sources.py 開始 ===\n")
    results = []

    for site_name, url in SOURCES:
        r = check_site(site_name, url)
        results.append(r)
        time.sleep(1)

    # CSV保存
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["site_name", "url", "status_code", "robots_ok", "has_event_word", "judgment"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n=== 結果 ({OUTPUT_CSV}) ===")
    print(f"{'judgment':<6}  {'status':<8}  {'robots':<7}  {'event':<6}  {'site_name'}")
    print("-" * 80)
    for r in results:
        print(
            f"{r['judgment']:<6}  "
            f"{str(r['status_code']):<8}  "
            f"{str(r['robots_ok']):<7}  "
            f"{str(r['has_event_word']):<6}  "
            f"{r['site_name']}"
        )

    ok   = sum(1 for r in results if r["judgment"] == "OK")
    warn = sum(1 for r in results if r["judgment"] == "WARN")
    ng   = sum(1 for r in results if r["judgment"] == "NG")
    print(f"\n合計: OK={ok}件 / WARN={warn}件 / NG={ng}件")
    print(f"CSV: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
