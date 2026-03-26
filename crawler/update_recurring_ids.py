"""
update_recurring_ids.py - おはよう新潟・おはくまのrecurring_id設定
"""
import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

# recurring_events IDを確認
result = supabase.table("recurring_events").select("id, name").execute()
print("=== recurring_events ===")
for r in result.data:
    print(f"  id={r['id']}  name={r['name']}")

# 対象IDを取得
niigata_id = None
kumamoto_id = None
for r in result.data:
    if "新潟" in r["name"]:
        niigata_id = r["id"]
    if "おはくま" in r["name"]:
        kumamoto_id = r["id"]

print(f"\n新潟 recurring_id: {niigata_id}")
print(f"おはくま recurring_id: {kumamoto_id}")

# おはよう新潟 更新
if niigata_id:
    res = supabase.table("events").update({"recurring_id": niigata_id}).like(
        "name", "%おはよう新潟%"
    ).is_("recurring_id", "null").execute()
    print(f"\nおはよう新潟: {len(res.data)}件更新")
else:
    print("\nおはよう新潟: recurring_events に該当レコードなし")

# おはくま 更新
if kumamoto_id:
    res = supabase.table("events").update({"recurring_id": kumamoto_id}).like(
        "name", "%おはくま%"
    ).is_("recurring_id", "null").execute()
    print(f"おはくま: {len(res.data)}件更新")
else:
    print("おはくま: recurring_events に該当レコードなし")
