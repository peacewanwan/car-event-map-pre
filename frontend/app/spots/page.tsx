'use client'

import { useEffect, useState, useCallback } from 'react'
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { createClient } from '@/lib/supabase/client'

type Spot = {
  id: number
  name: string
  category: string | null
  prefecture: string | null
  lat: number
  lng: number
}

type Checkin = {
  id: string
  spot_id: number
  nickname: string
  vehicle_type: string
  checkin_type: 'now' | 'plan'
  created_at: string
  left_at: string | null
  expires_at: string | null
  planned_at: string | null
}

type SpotWithCounts = Spot & {
  nowCount: number
  planCount: number
}


function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatMonthDay(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------- MapGeolocator ----------

function MapGeolocator({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (map && target) {
      map.panTo(target)
      map.setZoom(11)
    }
  }, [map, target])
  return null
}

// ---------- SpotCard ----------

function SpotCard({ spot, openSpotId }: { spot: SpotWithCounts; openSpotId: number | null }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (openSpotId === spot.id) setOpen(true)
  }, [openSpotId, spot.id])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ナウ登録フォーム
  const [showNowForm, setShowNowForm] = useState(false)
  const [nowNickname, setNowNickname] = useState('')
  const [nowVehicle, setNowVehicle] = useState('')
  const [submittingNow, setSubmittingNow] = useState(false)

  // 予定登録フォーム
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planNickname, setPlanNickname] = useState('')
  const [planVehicle, setPlanVehicle] = useState('')
  const [planDateTime, setPlanDateTime] = useState('')
  const [submittingPlan, setSubmittingPlan] = useState(false)

  // カレンダー選択日
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // localStorage
  const [myCheckinId, setMyCheckinId] = useState<string | null>(null)
  const [myPlanId, setMyPlanId] = useState<string | null>(null)

  useEffect(() => {
    setMyCheckinId(localStorage.getItem(`checkin_${spot.id}`))
    setMyPlanId(localStorage.getItem(`plan_${spot.id}`))
  }, [spot.id])

  const loadCheckins = useCallback(async () => {
    setLoadingDetail(true)
    const supabase = createClient()
    const now = new Date()
    const oneMonthLater = new Date(now)
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

    const { data } = await supabase
      .from('spot_checkins')
      .select('*')
      .eq('spot_id', spot.id)
      .or(
        `checkin_type.eq.now,and(checkin_type.eq.plan,planned_at.gte.${now.toISOString()},planned_at.lte.${oneMonthLater.toISOString()})`
      )
      .order('created_at', { ascending: false })

    setCheckins(data || [])
    setLoadingDetail(false)
  }, [spot.id])

  useEffect(() => {
    if (open) loadCheckins()
  }, [open, loadCheckins])

  const now = new Date()
  const oneMonthLater = new Date(now)
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

  const nowCheckins = checkins.filter(
    (c) =>
      c.checkin_type === 'now' &&
      !c.left_at &&
      c.expires_at &&
      new Date(c.expires_at) > now
  )

  const planCheckins = checkins.filter((c) => {
    if (c.checkin_type !== 'plan' || !c.planned_at) return false
    const planned = new Date(c.planned_at)
    return planned >= now && planned <= oneMonthLater
  })

  // localStorage の expires_at 無効化チェック
  useEffect(() => {
    if (myCheckinId && checkins.length > 0) {
      const c = checkins.find((c) => c.id === myCheckinId)
      if (c?.expires_at && new Date(c.expires_at) <= now) {
        localStorage.removeItem(`checkin_${spot.id}`)
        setMyCheckinId(null)
      }
    }
  }, [checkins, myCheckinId, spot.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // カレンダー生成（今日〜+1ヶ月）
  const calendarDays: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const calEnd = new Date(today)
  calEnd.setMonth(calEnd.getMonth() + 1)
  const cur = new Date(today)
  while (cur <= calEnd) {
    calendarDays.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  const planDays = new Set(planCheckins.map((c) => c.planned_at!.split('T')[0]))
  const selectedDayPlans = selectedDay
    ? planCheckins.filter((c) => c.planned_at?.startsWith(selectedDay))
    : []

  // ナウ チェックイン
  async function handleNowCheckin() {
    if (!nowNickname.trim()) return
    setSubmittingNow(true)
    const supabase = createClient()
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('spot_checkins')
      .insert({
        spot_id: spot.id,
        nickname: nowNickname.trim(),
        vehicle_type: nowVehicle,
        checkin_type: 'now',
        expires_at: expiresAt,
      })
      .select()
      .single()
    if (!error && data) {
      localStorage.setItem(`checkin_${spot.id}`, data.id)
      setMyCheckinId(data.id)
      setShowNowForm(false)
      setNowNickname('')
      loadCheckins()
    }
    setSubmittingNow(false)
  }

  async function handleLeave() {
    if (!myCheckinId) return
    const supabase = createClient()
    await supabase
      .from('spot_checkins')
      .update({ left_at: new Date().toISOString() })
      .eq('id', myCheckinId)
    localStorage.removeItem(`checkin_${spot.id}`)
    setMyCheckinId(null)
    loadCheckins()
  }

  // 予定 チェックイン
  async function handlePlanCheckin() {
    if (!planNickname.trim() || !planDateTime) return
    setSubmittingPlan(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('spot_checkins')
      .insert({
        spot_id: spot.id,
        nickname: planNickname.trim(),
        vehicle_type: planVehicle,
        checkin_type: 'plan',
        planned_at: new Date(planDateTime).toISOString(),
      })
      .select()
      .single()
    if (!error && data) {
      localStorage.setItem(`plan_${spot.id}`, data.id)
      setMyPlanId(data.id)
      setShowPlanForm(false)
      setPlanNickname('')
      setPlanDateTime('')
      loadCheckins()
    }
    setSubmittingPlan(false)
  }

  async function handleCancelPlan() {
    if (!myPlanId) return
    const supabase = createClient()
    await supabase.from('spot_checkins').delete().eq('id', myPlanId)
    localStorage.removeItem(`plan_${spot.id}`)
    setMyPlanId(null)
    loadCheckins()
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200">
      {/* カードヘッダー（クリックでアコーディオン） */}
      <button
        className="w-full text-left px-4 py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-semibold text-zinc-900">{spot.name}</p>
          <span className="text-zinc-400 text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {spot.prefecture && (
            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
              {spot.prefecture}
            </span>
          )}
          {spot.category && (
            <span className="text-xs px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded">
              {spot.category}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-medium">
            🔴 今{spot.nowCount}人
          </span>
          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
            📅 今月{spot.planCount}人
          </span>
        </div>
      </button>

      {/* アコーディオン展開エリア */}
      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 space-y-5">
          {loadingDetail ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ===== 今いるナウ ===== */}
              <section>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">今いるナウ</h3>
                {nowCheckins.length === 0 ? (
                  <p className="text-xs text-zinc-400 mb-2">現在チェックイン中の人はいません</p>
                ) : (
                  <ul className="space-y-1 mb-3">
                    {nowCheckins.map((c) => (
                      <li key={c.id} className="text-xs flex gap-2 text-zinc-700">
                        <span className="font-medium">{c.nickname}</span>
                        <span className="text-zinc-400">{c.vehicle_type}</span>
                        <span className="text-zinc-400">{formatTime(c.created_at)}〜</span>
                      </li>
                    ))}
                  </ul>
                )}

                {myCheckinId ? (
                  <button
                    onClick={handleLeave}
                    className="text-xs px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    退出する
                  </button>
                ) : showNowForm ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="ニックネーム"
                      value={nowNickname}
                      onChange={(e) => setNowNickname(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                    <input
                      type="text"
                      placeholder="車種（例：ロードスター）"
                      value={nowVehicle}
                      onChange={(e) => setNowVehicle(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleNowCheckin}
                        disabled={submittingNow || !nowNickname.trim()}
                        className="flex-1 text-sm bg-red-500 text-white rounded-lg py-1.5 hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        チェックイン（3時間）
                      </button>
                      <button
                        onClick={() => setShowNowForm(false)}
                        className="text-sm px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNowForm(true)}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    ここにいるナウ
                  </button>
                )}
              </section>

              {/* ===== 行く予定 ===== */}
              <section>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">行く予定</h3>

                {/* カレンダー */}
                <div className="mb-2">
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                      <div key={d} className="text-center text-xs text-zinc-400 py-0.5">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {/* 1日目の曜日オフセット */}
                    {Array.from({ length: today.getDay() }).map((_, i) => (
                      <div key={`offset-${i}`} />
                    ))}
                    {calendarDays.map((day) => {
                      const hasPlan = planDays.has(day)
                      const isSelected = selectedDay === day
                      return (
                        <button
                          key={day}
                          disabled={!hasPlan}
                          onClick={() => setSelectedDay(isSelected ? null : day)}
                          className={`text-xs rounded py-1 text-center transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : hasPlan
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'text-zinc-400'
                          }`}
                        >
                          {new Date(day).getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 選択日の予定者 */}
                {selectedDay && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">
                      {new Date(selectedDay).getMonth() + 1}/{new Date(selectedDay).getDate()} の予定
                    </p>
                    {selectedDayPlans.length === 0 ? (
                      <p className="text-xs text-blue-400">予定者なし</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {selectedDayPlans.map((c) => (
                          <li key={c.id} className="text-xs text-blue-800 flex gap-2">
                            <span className="font-medium">{c.nickname}</span>
                            <span>{c.vehicle_type}</span>
                            {c.planned_at && <span>{formatMonthDay(c.planned_at)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {myPlanId ? (
                  <button
                    onClick={handleCancelPlan}
                    className="text-xs px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    予定をキャンセル
                  </button>
                ) : showPlanForm ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="ニックネーム"
                      value={planNickname}
                      onChange={(e) => setPlanNickname(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                    <input
                      type="text"
                      placeholder="車種（例：ロードスター）"
                      value={planVehicle}
                      onChange={(e) => setPlanVehicle(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                    <input
                      type="datetime-local"
                      value={planDateTime}
                      onChange={(e) => setPlanDateTime(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handlePlanCheckin}
                        disabled={submittingPlan || !planNickname.trim() || !planDateTime}
                        className="flex-1 text-sm bg-blue-500 text-white rounded-lg py-1.5 hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        予定を登録
                      </button>
                      <button
                        onClick={() => setShowPlanForm(false)}
                        className="text-sm px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPlanForm(true)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    ここに行く
                  </button>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- メインページ ----------

export default function SpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [countsMap, setCountsMap] = useState<Map<number, { now: number; plan: number }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedPref, setSelectedPref] = useState('')
  const [freeword, setFreeword] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [tab, setTab] = useState<'list' | 'map'>('list')
  const [activeMapSpot, setActiveMapSpot] = useState<SpotWithCounts | null>(null)
  const [openSpotId, setOpenSpotId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [geoTarget, setGeoTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  // 地図ポップアップ用チェックイン state
  const [mapPopupCheckins, setMapPopupCheckins] = useState<Checkin[]>([])
  const [mapPopupLoading, setMapPopupLoading] = useState(false)
  const [mapShowNowForm, setMapShowNowForm] = useState(false)
  const [mapNowNickname, setMapNowNickname] = useState('')
  const [mapNowVehicle, setMapNowVehicle] = useState('')
  const [mapSubmittingNow, setMapSubmittingNow] = useState(false)
  const [mapMyCheckinId, setMapMyCheckinId] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  const loadMapPopupCheckins = useCallback(async (spotId: number) => {
    setMapPopupLoading(true)
    const supabase = createClient()
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('spot_checkins')
      .select('*')
      .eq('spot_id', spotId)
      .eq('checkin_type', 'now')
      .is('left_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
    setMapPopupCheckins(data || [])
    setMapPopupLoading(false)
  }, [])

  useEffect(() => {
    if (activeMapSpot) {
      setMapMyCheckinId(localStorage.getItem(`checkin_${activeMapSpot.id}`))
      setMapShowNowForm(false)
      setMapNowNickname('')
      setMapNowVehicle('')
      loadMapPopupCheckins(activeMapSpot.id)
    } else {
      setMapPopupCheckins([])
    }
  }, [activeMapSpot, loadMapPopupCheckins])

  async function handleMapNowCheckin() {
    if (!activeMapSpot || !mapNowNickname.trim()) return
    setMapSubmittingNow(true)
    const supabase = createClient()
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('spot_checkins')
      .insert({
        spot_id: activeMapSpot.id,
        nickname: mapNowNickname.trim(),
        vehicle_type: mapNowVehicle,
        checkin_type: 'now',
        expires_at: expiresAt,
      })
      .select()
      .single()
    if (!error && data) {
      localStorage.setItem(`checkin_${activeMapSpot.id}`, data.id)
      setMapMyCheckinId(data.id)
      setMapShowNowForm(false)
      setMapNowNickname('')
      setMapNowVehicle('')
      loadMapPopupCheckins(activeMapSpot.id)
    }
    setMapSubmittingNow(false)
  }

  async function handleMapLeave() {
    if (!activeMapSpot || !mapMyCheckinId) return
    const supabase = createClient()
    await supabase
      .from('spot_checkins')
      .update({ left_at: new Date().toISOString() })
      .eq('id', mapMyCheckinId)
    localStorage.removeItem(`checkin_${activeMapSpot.id}`)
    setMapMyCheckinId(null)
    loadMapPopupCheckins(activeMapSpot.id)
  }

  function handleNowButtonFromMap(spot: SpotWithCounts) {
    setActiveMapSpot(null)
    setOpenSpotId(spot.id)
    setTab('list')
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      alert('位置情報を取得できませんでした')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoLoading(false)
      },
      () => {
        alert('位置情報を取得できませんでした')
        setGeoLoading(false)
      }
    )
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: spotsData }, { data: checkinsData }] = await Promise.all([
        supabase.from('spots').select('id, name, category, prefecture, lat, lng').order('name'),
        supabase
          .from('spot_checkins')
          .select('spot_id, checkin_type, left_at, expires_at, planned_at'),
      ])

      // バッジカウント集計
      const now = new Date()
      const oneMonthLater = new Date(now)
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

      const map = new Map<number, { now: number; plan: number }>()
      for (const c of checkinsData || []) {
        if (!map.has(c.spot_id)) map.set(c.spot_id, { now: 0, plan: 0 })
        const entry = map.get(c.spot_id)!
        if (
          c.checkin_type === 'now' &&
          !c.left_at &&
          c.expires_at &&
          new Date(c.expires_at) > now
        ) {
          entry.now++
        } else if (c.checkin_type === 'plan' && c.planned_at) {
          const planned = new Date(c.planned_at)
          if (planned >= now && planned <= oneMonthLater) entry.plan++
        }
      }

      setSpots(spotsData || [])
      setCountsMap(map)
      setLoading(false)
    }
    load()
  }, [])

  const prefectures = Array.from(
    new Set(spots.map((s) => s.prefecture).filter(Boolean) as string[])
  ).sort()

  const filtered = spots.filter((s) => {
    if (selectedPref && s.prefecture !== selectedPref) return false
    if (freeword.trim()) {
      return s.name.toLowerCase().includes(freeword.trim().toLowerCase())
    }
    return true
  })

  const spotsWithCounts: SpotWithCounts[] = filtered.map((s) => ({
    ...s,
    nowCount: countsMap.get(s.id)?.now ?? 0,
    planCount: countsMap.get(s.id)?.plan ?? 0,
  }))

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50">
      {/* 使い方モーダル */}
      {helpOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 px-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm mx-auto mt-32 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-800 mb-3">使い方</h2>
            <p className="text-sm text-zinc-700 font-medium mb-3">自然発生のオフ会を作ろう</p>
            <div className="space-y-3 text-sm text-zinc-600">
              <div>
                <p className="font-medium text-zinc-800">🔴 今いるナウ</p>
                <p>今いる場所をチェックイン。同じスポットにいる人が見えます。</p>
              </div>
              <div>
                <p className="font-medium text-zinc-800">📅 行く予定</p>
                <p>行く日を登録しておくと、同じ日に来る人と出会えます。</p>
              </div>
              <p className="text-zinc-400 text-xs">チェックインは3時間で自動終了。ニックネームのみで匿名利用できます。</p>
            </div>
            <button
              onClick={() => setHelpOpen(false)}
              className="mt-5 w-full text-sm bg-zinc-100 text-zinc-700 rounded-lg py-2 hover:bg-zinc-200 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ヘッダー・フィルター */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-base font-semibold text-zinc-800">オフ会メーカー</h1>
            <button
              onClick={() => setHelpOpen(true)}
              className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full hover:bg-zinc-200 transition-colors"
            >
              使い方
            </button>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed mb-2">
            今日はどこ行く？<br />
            誰かに会いに行く？<br />
            誰かが来てくれるのを待つ？<br />
            <span className="font-medium">今いる場所・行く予定を共有して仲間を増やそう</span>
          </p>

          {/* タブ */}
          <div className="flex gap-1 mb-2">
            {(['list', 'map'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  tab === t
                    ? 'bg-zinc-800 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {t === 'list' ? 'リスト' : '地図'}
              </button>
            ))}
          </div>

          {/* リストタブのみ検索フォーム表示 */}
          {tab === 'list' && (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={freeword}
                  onChange={(e) => setFreeword(e.target.value)}
                  placeholder="スポット名で検索"
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
                <select
                  value={selectedPref}
                  onChange={(e) => setSelectedPref(e.target.value)}
                  className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                >
                  <option value="">都道府県：すべて</option>
                  {prefectures.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                {loading ? '読込中...' : `${filtered.length}件`}
              </p>
            </>
          )}
        </div>
      </header>

      {/* リストタブ */}
      {tab === 'list' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            ) : spotsWithCounts.length === 0 ? (
              <p className="text-center text-zinc-400 py-20 text-sm">スポットが見つかりません</p>
            ) : (
              spotsWithCounts.map((spot) => <SpotCard key={spot.id} spot={spot} openSpotId={openSpotId} />)
            )}
          </div>
        </main>
      )}

      {/* 地図タブ */}
      {tab === 'map' && mounted && (
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* 都道府県フィルター overlay */}
              <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 20 }}>
                <select
                  value={selectedPref}
                  onChange={(e) => { setSelectedPref(e.target.value); setActiveMapSpot(null) }}
                  style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', border: 'none', padding: '6px 12px', fontSize: '14px', cursor: 'pointer' }}
                >
                  <option value="">都道府県：すべて</option>
                  {prefectures.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 現在地ボタン overlay */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 20 }}>
                <button
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', border: 'none', padding: '6px 12px', fontSize: '14px', cursor: 'pointer', opacity: geoLoading ? 0.5 : 1 }}
                >
                  {geoLoading ? '取得中...' : '現在地'}
                </button>
              </div>

              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={{ lat: 36.5, lng: 137.0 }}
                  defaultZoom={6}
                  style={{ width: '100%', height: '100%' }}
                  onClick={() => setActiveMapSpot(null)}
                >
                  <MapGeolocator target={geoTarget} />

                  {spotsWithCounts.map((spot) => (
                    <AdvancedMarker
                      key={spot.id}
                      position={{ lat: spot.lat, lng: spot.lng }}
                      onClick={() => setActiveMapSpot(spot)}
                    >
                      {spot.nowCount === 0 ? (
                        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22s14-12.667 14-22C28 6.268 21.732 0 14 0z" fill="#3B82F6"/>
                        </svg>
                      ) : (
                        <div style={{ position: 'relative', width: '36px', height: '44px' }}>
                          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 0C8.059 0 0 8.059 0 18c0 11.667 18 26 18 26s18-14.333 18-26C36 8.059 27.941 0 18 0z" fill="#EF4444"/>
                          </svg>
                          <span style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: '13px', fontWeight: 600 }}>
                            {spot.nowCount}
                          </span>
                        </div>
                      )}
                    </AdvancedMarker>
                  ))}
                </GoogleMap>
              </APIProvider>

              {/* カスタムポップアップ（React DOM内 → クリックイベント確実） */}
              {activeMapSpot && (
                <div
                  style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: '#fff', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', padding: '14px 16px', minWidth: '260px', maxWidth: '320px', maxHeight: '60vh', overflowY: 'auto' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <button
                      onClick={() => handleNowButtonFromMap(activeMapSpot)}
                      style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#111827', textAlign: 'left', flex: 1, textDecoration: 'underline', textDecorationColor: '#d1d5db' }}
                    >
                      {activeMapSpot.name}
                    </button>
                    <button onClick={() => setActiveMapSpot(null)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#9ca3af', marginLeft: '8px', padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                  {activeMapSpot.prefecture && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>{activeMapSpot.prefecture}</p>
                  )}
                  {activeMapSpot.category && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>{activeMapSpot.category}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '0' }}>
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>🔴 今{activeMapSpot.nowCount}人</span>
                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>📅 今月{activeMapSpot.planCount}人</span>
                  </div>

                  {/* 今いるナウセクション */}
                  <div style={{ marginTop: '10px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px', marginTop: 0 }}>今いるナウ</p>
                    {mapPopupLoading ? (
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>読込中...</p>
                    ) : mapPopupCheckins.length === 0 ? (
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>現在チェックイン中の人はいません</p>
                    ) : (
                      <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
                        {mapPopupCheckins.map((c) => (
                          <li key={c.id} style={{ fontSize: '11px', color: '#374151', display: 'flex', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 600 }}>{c.nickname}</span>
                            {c.vehicle_type && <span style={{ color: '#6b7280' }}>{c.vehicle_type}</span>}
                            <span style={{ color: '#9ca3af' }}>{formatTime(c.created_at)}〜</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {mapMyCheckinId ? (
                      <button
                        onClick={handleMapLeave}
                        style={{ fontSize: '11px', padding: '5px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        退出する
                      </button>
                    ) : mapShowNowForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="ニックネーム"
                          value={mapNowNickname}
                          onChange={(e) => setMapNowNickname(e.target.value)}
                          style={{ width: '100%', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '5px 8px', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="車種（例：ロードスター）"
                          value={mapNowVehicle}
                          onChange={(e) => setMapNowVehicle(e.target.value)}
                          style={{ width: '100%', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '5px 8px', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={handleMapNowCheckin}
                            disabled={mapSubmittingNow || !mapNowNickname.trim()}
                            style={{ flex: 1, fontSize: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 0', cursor: 'pointer', opacity: (mapSubmittingNow || !mapNowNickname.trim()) ? 0.5 : 1 }}
                          >
                            チェックイン（3時間）
                          </button>
                          <button
                            onClick={() => setMapShowNowForm(false)}
                            style={{ fontSize: '12px', padding: '5px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setMapShowNowForm(true)}
                        style={{ fontSize: '11px', padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ここにいるナウ
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
