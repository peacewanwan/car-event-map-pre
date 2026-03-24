'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Spot = {
  id: number
  name: string
  category: string | null
  prefecture: string | null
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

function vehicleLabel(v: string) {
  if (v === 'car') return '車'
  if (v === 'bike') return 'バイク'
  if (v === 'both') return '車・バイク'
  return v
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatMonthDay(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------- SpotCard ----------

function SpotCard({ spot }: { spot: SpotWithCounts }) {
  const [open, setOpen] = useState(false)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ナウ登録フォーム
  const [showNowForm, setShowNowForm] = useState(false)
  const [nowNickname, setNowNickname] = useState('')
  const [nowVehicle, setNowVehicle] = useState('car')
  const [submittingNow, setSubmittingNow] = useState(false)

  // 予定登録フォーム
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planNickname, setPlanNickname] = useState('')
  const [planVehicle, setPlanVehicle] = useState('car')
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
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{spot.name}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
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
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full font-medium whitespace-nowrap">
            🔴 今{spot.nowCount}人
          </span>
          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium whitespace-nowrap">
            📅 今月{spot.planCount}人
          </span>
          <span className="text-zinc-400 text-xs">{open ? '▲' : '▼'}</span>
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
                        <span className="text-zinc-400">{vehicleLabel(c.vehicle_type)}</span>
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
                    <select
                      value={nowVehicle}
                      onChange={(e) => setNowVehicle(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                    >
                      <option value="car">車</option>
                      <option value="bike">バイク</option>
                      <option value="both">車・バイク</option>
                    </select>
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
                            <span>{vehicleLabel(c.vehicle_type)}</span>
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
                    <select
                      value={planVehicle}
                      onChange={(e) => setPlanVehicle(e.target.value)}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
                    >
                      <option value="car">車</option>
                      <option value="bike">バイク</option>
                      <option value="both">車・バイク</option>
                    </select>
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

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: spotsData }, { data: checkinsData }] = await Promise.all([
        supabase.from('spots').select('id, name, category, prefecture').order('name'),
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
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー・フィルター */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-4 pt-3 pb-2">
        <h1 className="text-base font-semibold text-zinc-800 mb-2">スポット</h1>
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
      </header>

      {/* スポットリスト */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          </div>
        ) : spotsWithCounts.length === 0 ? (
          <p className="text-center text-zinc-400 py-20 text-sm">スポットが見つかりません</p>
        ) : (
          spotsWithCounts.map((spot) => <SpotCard key={spot.id} spot={spot} />)
        )}
      </main>
    </div>
  )
}
