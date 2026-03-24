import os
import requests
from dotenv import load_dotenv

load_dotenv('/Users/takeomba/car-event-map-pre/.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

spots = [
    {"name": "道の駅 足柄・金太郎のふるさと", "lat": 35.3089, "lng": 138.9488},
    {"name": "道の駅 どうし", "lat": 35.5343, "lng": 139.0468},
    {"name": "道の駅 山北", "lat": 35.3708, "lng": 139.0765},
    {"name": "富士山こどもの国 駐車場", "lat": 35.3656, "lng": 138.7630},
    {"name": "道の駅 なるさわ", "lat": 35.4558, "lng": 138.6287},
    {"name": "箱根ターンパイク 大観山展望台", "lat": 35.1847, "lng": 139.0484},
    {"name": "道の駅 ふじおやま", "lat": 35.3363, "lng": 138.9347},
    {"name": "道の駅 伊豆ゲートウェイ函南", "lat": 35.1076, "lng": 138.9689},
]

for spot in spots:
    res = requests.patch(
        f'{SUPABASE_URL}/rest/v1/spots?name=eq.{spot["name"]}',
        headers=headers,
        json={'lat': spot['lat'], 'lng': spot['lng']}
    )
    if res.status_code in (200, 204):
        print(f'✓ {spot["name"]}: {spot["lat"]}, {spot["lng"]}')
    else:
        print(f'✗ {spot["name"]}: {res.status_code} {res.text}')
