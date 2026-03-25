'use client'

import { useState, useEffect } from 'react'
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { createClient } from '@/lib/supabase/client'
import { LocateFixed, Calendar } from 'lucide-react'

const supabase = createClient()

export type Spot = {
  id: number
  name: string
  lat: number
  lng: number
  category: string | null
  description: string | null
  prefecture: string | null
  region: string | null
}

type Props = {
  spots: Spot[]
  nowCountMap: Record<number, number>
  onSpotSelect?: (spotId: number) => void
}

const PREF_LOCATIONS: Record<string, { lat: number; lng: number; zoom: number }> = {
  "北海道": { lat: 43.064615, lng: 141.346807, zoom: 7 },
  "青森県": { lat: 40.824308, lng: 140.740593, zoom: 9 },
  "岩手県": { lat: 39.703619, lng: 141.152684, zoom: 9 },
  "宮城県": { lat: 38.268837, lng: 140.872395, zoom: 9 },
  "秋田県": { lat: 39.718614, lng: 140.102364, zoom: 9 },
  "山形県": { lat: 38.240436, lng: 140.363592, zoom: 9 },
  "福島県": { lat: 37.750299, lng: 140.467521, zoom: 9 },
  "茨城県": { lat: 36.341811, lng: 140.446793, zoom: 9 },
  "栃木県": { lat: 36.565725, lng: 139.883565, zoom: 9 },
  "群馬県": { lat: 36.390668, lng: 139.060406, zoom: 9 },
  "埼玉県": { lat: 35.857428, lng: 139.648933, zoom: 9 },
  "千葉県": { lat: 35.605058, lng: 140.123308, zoom: 9 },
  "東京都": { lat: 35.689487, lng: 139.691711, zoom: 10 },
  "神奈川県": { lat: 35.447507, lng: 139.642345, zoom: 10 },
  "新潟県": { lat: 37.902552, lng: 139.023095, zoom: 9 },
  "山梨県": { lat: 35.664158, lng: 138.568449, zoom: 9 },
  "長野県": { lat: 36.651299, lng: 138.180956, zoom: 8 },
  "静岡県": { lat: 34.976986, lng: 138.383084, zoom: 9 },
  "愛知県": { lat: 35.180188, lng: 136.906565, zoom: 9 },
  "三重県": { lat: 34.730283, lng: 136.508588, zoom: 9 },
  "滋賀県": { lat: 35.004531, lng: 135.868591, zoom: 9 },
  "大阪府": { lat: 34.686297, lng: 135.519661, zoom: 10 },
  "兵庫県": { lat: 34.691269, lng: 135.183071, zoom: 9 },
  "広島県": { lat: 34.396601, lng: 132.459595, zoom: 9 },
  "福岡県": { lat: 33.606785, lng: 130.418314, zoom: 9 },
  "熊本県": { lat: 32.789828, lng: 130.741667, zoom: 9 },
}

const JAPAN_DEFAULT = { lat: 36.5, lng: 137.0, zoom: 6 }

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: '🌅 午前',
  afternoon: '☀️ 午後',
  evening: '🌆 夕方〜夜',
  flexible: '🌀 気分次第',
}

function BluePin() {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#3B82F6"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
    </svg>
  )
}

function RedPin({ count }: { count: number }) {
  return (
    <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.059 0 0 8.059 0 18c0 11.667 18 26 18 26S36 29.667 36 18C36 8.059 27.941 0 18 0z" fill="#EF4444"/>
      <circle cx="18" cy="18" r="10" fill="white" fillOpacity="0.2"/>
      <text x="18" y="23" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{count}</text>
    </svg>
  )
}

// ---------- Now チェックインセクション ----------

function PopupCheckinSection({ spot }: { spot: Spot }) {
  const storageKey = `checkin_${spot.id}`
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(storageKey)
    if (!stored) return false
    const { expiresAt } = JSON.parse(stored)
    return new Date(expiresAt) > new Date()
  })
  const [nickname, setNickname] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCheckin() {
    if (!nickname.trim() || submitting) return
    setSubmitting(true)
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('spot_checkins')
      .insert({
        spot_id: spot.id,
        nickname: nickname.trim(),
        checkin_type: 'now',
        vehicle_type: vehicleType.trim() || null,
        expires_at: expiresAt,
      })
      .select()
      .single()
    if (!error && data) {
      localStorage.setItem(storageKey, JSON.stringify({ id: data.id, expiresAt }))
      setAlreadyCheckedIn(true)
    }
    setSubmitting(false)
  }

  async function handleCheckout() {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return
    const { id } = JSON.parse(stored)
    await supabase
      .from('spot_checkins')
      .update({ left_at: new Date().toISOString() })
      .eq('id', id)
    localStorage.removeItem(storageKey)
    setAlreadyCheckedIn(false)
  }

  return (
    <div>
      <p className="text-xs text-slate-500 font-medium tracking-wider mb-2">今いるナウ</p>
      {alreadyCheckedIn ? (
        <button
          onClick={handleCheckout}
          className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
        >
          退出する
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="ニックネーム"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="車種（任意）"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleCheckin}
            disabled={!nickname.trim() || submitting}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-emerald-400 transition-colors"
          >
            {submitting ? '登録中...' : 'ここにいるナウ 登録する'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- 行く予定セクション ----------

function PopupPlanSection({ spot }: { spot: Spot }) {
  const planStorageKey = `plan_${spot.id}`
  const [alreadyPlanned, setAlreadyPlanned] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(`plan_${spot.id}`)
    if (!stored) return false
    try {
      const { plannedAt } = JSON.parse(stored)
      return new Date(plannedAt + 'T23:59:59+09:00') > new Date()
    } catch {
      return false
    }
  })
  const [planNickname, setPlanNickname] = useState('')
  const [planVehicle, setPlanVehicle] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handlePlan() {
    if (!planNickname.trim() || !planDate || !selectedTimeSlot || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('spot_checkins')
      .insert({
        spot_id: spot.id,
        nickname: planNickname.trim(),
        checkin_type: 'plan',
        vehicle_type: planVehicle.trim() || null,
        planned_at: `${planDate}T00:00:00+09:00`,
        time_slot: selectedTimeSlot,
        comment: null,
      })
      .select()
      .single()
    if (!error && data) {
      localStorage.setItem(planStorageKey, JSON.stringify({ id: data.id, plannedAt: planDate }))
      setAlreadyPlanned(true)
      setPlanNickname('')
      setPlanVehicle('')
      setPlanDate('')
      setSelectedTimeSlot(null)
    }
    setSubmitting(false)
  }

  async function handleCancelPlan() {
    const stored = localStorage.getItem(planStorageKey)
    if (!stored) return
    const { id } = JSON.parse(stored)
    await supabase.from('spot_checkins').delete().eq('id', id)
    localStorage.removeItem(planStorageKey)
    setAlreadyPlanned(false)
  }

  return (
    <div>
      <p className="text-xs text-slate-500 font-medium tracking-wider mb-2">行く予定</p>
      {alreadyPlanned ? (
        <button
          onClick={handleCancelPlan}
          className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
        >
          予定をキャンセル
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="ニックネーム"
            value={planNickname}
            onChange={(e) => setPlanNickname(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="車種（任意）"
            value={planVehicle}
            onChange={(e) => setPlanVehicle(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <div className="relative w-44">
            <Calendar
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-8 pr-3 py-2 focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['morning', 'afternoon', 'evening', 'flexible'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTimeSlot(selectedTimeSlot === slot ? null : slot)}
                className={
                  selectedTimeSlot === slot
                    ? 'border border-emerald-500 text-emerald-400 bg-emerald-950/30 rounded-lg px-3 py-2 text-sm'
                    : 'border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm hover:border-slate-600'
                }
              >
                {TIME_SLOT_LABEL[slot]}
              </button>
            ))}
          </div>
          <button
            onClick={handlePlan}
            disabled={!planNickname.trim() || !planDate || !selectedTimeSlot || submitting}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-emerald-400 transition-colors"
          >
            {submitting ? '登録中...' : 'ここに行く 登録する'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- useMap() を使うためだけの子コンポーネント ----------

function MapInner({ onMapReady }: { onMapReady: (map: google.maps.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    if (map) onMapReady(map)
  }, [map, onMapReady])
  return null
}

// ---------- タブ ----------

type PopupTab = 'now' | 'plan'

// ---------- MapView ----------

export default function MapView({ spots, nowCountMap, onSpotSelect }: Props) {
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  const [activeTab, setActiveTab] = useState<PopupTab>('now')
  const [prefFilter, setPrefFilter] = useState('')
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)

  const prefOptions = Array.from(
    new Set(spots.map((s) => s.prefecture).filter(Boolean) as string[])
  ).sort()

  function handlePrefChange(pref: string) {
    setPrefFilter(pref)
    if (!mapInstance) return
    const loc = pref ? PREF_LOCATIONS[pref] : JAPAN_DEFAULT
    if (loc) {
      mapInstance.panTo({ lat: loc.lat, lng: loc.lng })
      mapInstance.setZoom(loc.zoom ?? 9)
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation || !mapInstance) return
    navigator.geolocation.getCurrentPosition((pos) => {
      mapInstance.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      mapInstance.setZoom(11)
    })
  }

  function handleMarkerClick(spot: Spot) {
    setActiveSpot(spot)
    setActiveTab('now')
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 地図本体 */}
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: JAPAN_DEFAULT.lat, lng: JAPAN_DEFAULT.lng }}
        defaultZoom={JAPAN_DEFAULT.zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <MapInner onMapReady={setMapInstance} />

        {/* マーカー */}
        {spots.map((spot) => (
          <AdvancedMarker
            key={spot.id}
            position={{ lat: spot.lat, lng: spot.lng }}
            onClick={() => handleMarkerClick(spot)}
          >
            {(nowCountMap[spot.id] ?? 0) >= 1 ? (
              <RedPin count={nowCountMap[spot.id]} />
            ) : (
              <BluePin />
            )}
          </AdvancedMarker>
        ))}
      </Map>

      {/* 右上オーバーレイ：都道府県フィルタ＋現在地ボタン */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <select
          value={prefFilter}
          onChange={(e) => handlePrefChange(e.target.value)}
          className="bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg px-2 py-2 shadow-lg focus:border-emerald-500 focus:outline-none"
        >
          <option value="">都道府県</option>
          {prefOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={handleGeolocate}
          className="bg-slate-900 border border-slate-600 text-slate-200 hover:border-emerald-500 hover:text-emerald-400 rounded-lg p-2 shadow-lg transition-colors"
          title="現在地に移動"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      {/* 画面下部固定ポップアップ（中央寄せ・max-w-sm） */}
      {activeSpot && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto">
          {/* ヘッダー */}
          <div className="flex items-start justify-between p-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100">{activeSpot.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeSpot.prefecture} · {activeSpot.category}
              </p>
            </div>
            <button
              onClick={() => setActiveSpot(null)}
              className="text-slate-500 hover:text-slate-300 p-1 ml-2 shrink-0"
            >
              ✕
            </button>
          </div>

          {/* カウント表示 */}
          <div className="flex gap-3 px-4 py-2 border-b border-slate-800">
            <span className="text-sm text-slate-300">
              🔴 今{nowCountMap[activeSpot.id] || 0}人
              {(nowCountMap[activeSpot.id] || 0) >= 1 && (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </span>
          </div>

          {/* タブ */}
          <div className="flex border-b border-slate-800">
            {(['now', 'plan'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium relative transition-colors ${
                  activeTab === tab ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'now' ? '🔴 今いるナウ' : '📅 行く予定'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* タブコンテンツ */}
          <div className="p-4">
            {activeTab === 'now' ? (
              <PopupCheckinSection spot={activeSpot} />
            ) : (
              <PopupPlanSection spot={activeSpot} />
            )}
          </div>

          {/* リストリンク */}
          {onSpotSelect && (
            <div className="px-4 pb-4">
              <button
                onClick={() => { onSpotSelect(activeSpot.id); setActiveSpot(null) }}
                className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-600 transition-colors"
              >
                リストで詳細を見る
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
