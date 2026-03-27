'use client'

import { useEffect, useState } from 'react'
import { Calendar, Navigation2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ---------- Types ----------

export type SpotCardProps = {
  spot: {
    id: number
    name: string
    prefecture: string | null
    category: string | null
  }
  nowCount: number
  planCount: number
  isOpen: boolean
  onToggle: () => void
  isHighlighted?: boolean
  highlightHint?: string
}

type CheckinUser = {
  id: string
  nickname: string
  vehicle_type: string | null
  created_at: string
  expires_at: string
}

type PlanCheckin = {
  id: string
  nickname: string
  vehicle_type: string | null
  planned_at: string
  time_slot: string | null
}

// ---------- Constants ----------

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  '道の駅':    { text: 'text-lime-400',   bg: 'bg-lime-500/10' },
  'SA・PA':   { text: 'text-amber-400',  bg: 'bg-amber-500/10' },
  '展望台・峠': { text: 'text-orange-400', bg: 'bg-orange-500/10' },
  '駐車場':    { text: 'text-slate-400',  bg: 'bg-slate-500/10' },
}

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: '🌅 午前',
  afternoon: '☀️ 午後',
  evening: '🌆 夕方〜夜',
  flexible: '🌀 気分次第',
}

const TIME_SLOT_EMOJI: Record<string, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  flexible: '🌀',
}

const TIME_SLOT_TEXT: Record<string, string> = {
  morning: '午前',
  afternoon: '午後',
  evening: '夕方〜夜',
  flexible: '気分次第',
}

// ---------- Helpers ----------

function remainingTime(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'まもなく退出'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `あと${hours}時間${minutes > 0 ? `${minutes}分` : ''}`
  return `あと${minutes}分`
}

function formatCheckinTime(createdAt: string): string {
  const d = new Date(createdAt)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSelectedDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function generateCalendarMonths() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setMonth(end.getMonth() + 1)
  const months: { year: number; month: number; days: Date[] }[] = []
  const cur = new Date(today)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = cur.getMonth()
    const last = months[months.length - 1]
    if (!last || last.year !== y || last.month !== m) {
      months.push({ year: y, month: m, days: [new Date(cur)] })
    } else {
      last.days.push(new Date(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }
  return months
}

// ---------- SpotCard ----------

export default function SpotCard({ spot, nowCount, planCount, isOpen, onToggle, isHighlighted, highlightHint }: SpotCardProps) {
  const hasNow = nowCount >= 1
  const catColor = spot.category ? CATEGORY_COLORS[spot.category] : null

  // ---- checkin list ----
  const [checkins, setCheckins] = useState<CheckinUser[]>([])
  const [loadingCheckins, setLoadingCheckins] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // ---- checkin form ----
  const [nickname, setNickname] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ---- checkin localStorage ----
  const storageKey = `checkin_${spot.id}`
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(storageKey)
    if (!stored) return false
    try {
      const { expiresAt } = JSON.parse(stored)
      return new Date(expiresAt) > new Date()
    } catch {
      return false
    }
  })

  // ---- plan checkins ----
  const [planCheckins, setPlanCheckins] = useState<PlanCheckin[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [planRefreshKey, setPlanRefreshKey] = useState(0)

  // ---- plan form ----
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

  // ---- fetch checkins ----
  useEffect(() => {
    if (!isOpen) return
    async function load() {
      setLoadingCheckins(true)
      const supabase = createClient()
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('spot_checkins')
        .select('id, nickname, vehicle_type, created_at, expires_at')
        .eq('spot_id', spot.id)
        .eq('checkin_type', 'now')
        .is('left_at', null)
        .gt('expires_at', now)
        .order('created_at', { ascending: true })
      setCheckins(data || [])
      setLoadingCheckins(false)
    }
    load()
  }, [isOpen, refreshKey, spot.id])

  // ---- fetch plans ----
  useEffect(() => {
    if (!isOpen) return
    async function loadPlans() {
      const supabase = createClient()
      const now = new Date()
      const oneMonthLater = new Date()
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)
      const { data } = await supabase
        .from('spot_checkins')
        .select('id, nickname, vehicle_type, planned_at, time_slot')
        .eq('spot_id', spot.id)
        .eq('checkin_type', 'plan')
        .gte('planned_at', now.toISOString())
        .lte('planned_at', oneMonthLater.toISOString())
        .order('planned_at', { ascending: true })
      setPlanCheckins(data || [])
    }
    loadPlans()
  }, [isOpen, planRefreshKey, spot.id])

  // ---- checkin ----
  async function handleCheckin() {
    if (!nickname.trim() || submitting) return
    setSubmitting(true)
    const supabase = createClient()
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
      setNickname('')
      setVehicleType('')
      setRefreshKey((k) => k + 1)
    }
    setSubmitting(false)
  }

  // ---- checkout ----
  async function handleCheckout() {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return
    const supabase = createClient()
    const { id } = JSON.parse(stored)
    await supabase
      .from('spot_checkins')
      .update({ left_at: new Date().toISOString() })
      .eq('id', id)
    localStorage.removeItem(storageKey)
    setAlreadyCheckedIn(false)
    setRefreshKey((k) => k + 1)
  }

  // ---- plan ----
  async function handlePlan() {
    if (!planNickname.trim() || !planDate || !selectedTimeSlot || submitting) return
    setSubmitting(true)
    const supabase = createClient()
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
      setPlanRefreshKey((k) => k + 1)
    }
    setSubmitting(false)
  }

  // ---- cancel plan ----
  async function handleCancelPlan() {
    const stored = localStorage.getItem(planStorageKey)
    if (!stored) return
    const supabase = createClient()
    const { id } = JSON.parse(stored)
    await supabase.from('spot_checkins').delete().eq('id', id)
    localStorage.removeItem(planStorageKey)
    setAlreadyPlanned(false)
    setPlanRefreshKey((k) => k + 1)
  }

  // ---------- render ----------

  return (
    <div
      className={[
        'rounded-2xl overflow-hidden transition-colors cursor-pointer',
        isHighlighted
          ? 'ring-1 ring-emerald-400/60 bg-emerald-950/20 border border-emerald-500/40'
          : hasNow
            ? 'bg-[var(--bg-card)] border border-l-2 border-emerald-500/40 border-l-emerald-500'
            : 'bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-slate-500',
      ].join(' ')}
    >
      {/* ハイライトヒント */}
      {isHighlighted && highlightHint && (
        <div className="px-4 pt-2.5 pb-0">
          <p className="text-xs text-emerald-400/80">🔍 {highlightHint}</p>
        </div>
      )}

      {/* カードヘッダー */}
      <div
        className="w-full text-left px-4 py-3 cursor-pointer"
        onClick={onToggle}
      >
        {/* 1行目：スポット名 + 都道府県 + ナビ */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-[var(--text-main)] text-sm leading-snug">
            {spot.name}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {spot.prefecture && (
              <span className="text-xs text-[var(--text-sub)]">
                {spot.prefecture}
              </span>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--text-sub)] hover:text-emerald-400 transition-colors"
              title="Googleマップで開く"
            >
              <Navigation2 size={14} />
            </a>
          </div>
        </div>

        {/* 2行目：カテゴリバッジ */}
        {spot.category && catColor && (
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded-md font-medium mb-2 ${catColor.text} ${catColor.bg}`}
          >
            {spot.category}
          </span>
        )}

        {/* 3行目：カウント */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-sub)] flex items-center gap-1.5">
            🔴 今{nowCount}人
            {hasNow && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </span>
          <span className="text-xs text-[var(--text-sub)]">📅 今月{planCount}人</span>
        </div>
      </div>

      {/* ===== アコーディオン展開エリア ===== */}
      {isOpen && (
        <div className="border-t border-[var(--border-card)] bg-[var(--bg-filter)] px-4 py-4 space-y-4">

          {/* 今いるナウセクション */}
          <section>
            <p className="text-xs text-[var(--text-sub)] font-medium tracking-wider mb-3">
              今いるナウ
            </p>

            {/* チェックイン中ユーザー一覧 */}
            {loadingCheckins ? (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-[var(--border-card)] border-t-emerald-400 rounded-full animate-spin" />
              </div>
            ) : checkins.length === 0 ? (
              <p className="text-xs text-[var(--text-sub)] mb-4">まだ誰もいません</p>
            ) : (
              <ul className="space-y-1 mb-4">
                {checkins.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-sub)] shrink-0 text-sm">
                      👤
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-main)] font-medium">{c.nickname}</p>
                      <p className="text-xs text-[var(--text-sub)]">
                        {c.vehicle_type && <span>{c.vehicle_type}　</span>}
                        {formatCheckinTime(c.created_at)} チェックイン（{remainingTime(c.expires_at)}）
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-[var(--border-card)] pt-4 space-y-3">
              {alreadyCheckedIn ? (
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 rounded-xl border border-[var(--border-card)] text-[var(--text-sub)] text-sm hover:bg-[var(--bg-input)] transition-colors"
                >
                  退出する
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="ニックネーム"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      placeholder="車種（任意）"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleCheckin}
                    disabled={!nickname.trim() || submitting}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '登録中...' : 'ここにいるナウ 登録する'}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* ===== 行く予定セクション ===== */}
          <section className="border-t border-[var(--border-card)] pt-4">
            <p className="text-xs text-[var(--text-sub)] font-medium tracking-wider mb-3">
              行く予定
            </p>

            {/* カレンダー */}
            {(() => {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const todayStr = today.toISOString().split('T')[0]
              const plannedDates = new Set(planCheckins.map((c) => c.planned_at.split('T')[0]))
              const calendarMonths = generateCalendarMonths()

              return calendarMonths.map(({ year, month, days }) => {
                const firstDow = days[0].getDay()
                return (
                  <div key={`${year}-${month}`} className="mb-4">
                    <p className="text-xs text-[var(--text-sub)] font-medium mb-2">
                      {month + 1}月
                    </p>
                    <div className="grid grid-cols-7 text-center">
                      {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                        <div key={d} className="text-xs text-slate-600 py-1">{d}</div>
                      ))}
                      {Array.from({ length: firstDow }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {days.map((day) => {
                        const dateStr = day.toISOString().split('T')[0]
                        const hasPlan = plannedDates.has(dateStr)
                        const isToday = dateStr === todayStr
                        const isSelected = selectedDate === dateStr

                        return (
                          <button
                            key={dateStr}
                            onClick={() => hasPlan ? setSelectedDate(isSelected ? null : dateStr) : undefined}
                            disabled={!hasPlan}
                            className={[
                              'py-1 text-xs relative leading-6',
                              isToday ? 'ring-1 ring-slate-600 rounded' : '',
                              isSelected
                                ? 'bg-emerald-500/30 rounded text-emerald-300 font-bold'
                                : hasPlan
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold cursor-pointer hover:bg-emerald-500/30 rounded'
                                  : 'text-slate-500 cursor-default',
                            ].filter(Boolean).join(' ')}
                          >
                            {day.getDate()}
                            {hasPlan && (
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}

            {/* 選択日の予定者 */}
            {selectedDate && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[var(--text-sub)]">{formatSelectedDate(selectedDate)} の予定</p>
                {planCheckins
                  .filter((c) => c.planned_at.startsWith(selectedDate))
                  .map((c) => (
                    <div key={c.id} className="flex items-center gap-2 py-1">
                      <span className="w-6 h-6 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-sub)] text-xs shrink-0">
                        📅
                      </span>
                      <div>
                        <p className="text-sm text-[var(--text-main)]">{c.nickname}</p>
                        <p className="text-xs text-[var(--text-sub)]">
                          {c.vehicle_type && `${c.vehicle_type} · `}
                          {c.time_slot ? TIME_SLOT_LABEL[c.time_slot] : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                {planCheckins.filter((c) => c.planned_at.startsWith(selectedDate)).length === 0 && (
                  <p className="text-xs text-[var(--text-sub)] py-2">この日の予定はまだありません</p>
                )}
              </div>
            )}

            {/* 行く予定フォーム */}
            <div className="border-t border-[var(--border-card)] mt-4 pt-4 space-y-3">
              {alreadyPlanned ? (
                <button
                  onClick={handleCancelPlan}
                  className="w-full py-3 rounded-xl border border-[var(--border-card)] text-[var(--text-sub)] text-sm hover:bg-[var(--bg-input)] transition-colors"
                >
                  予定をキャンセル
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={planNickname}
                      onChange={(e) => setPlanNickname(e.target.value)}
                      placeholder="ニックネーム"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={planVehicle}
                      onChange={(e) => setPlanVehicle(e.target.value)}
                      placeholder="車種（任意）"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="relative w-44">
                    <Calendar
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] pointer-events-none"
                    />
                    <input
                      type="date"
                      value={planDate}
                      onChange={(e) => setPlanDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-main)] text-sm rounded-lg pl-8 pr-3 py-2 focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['morning', 'afternoon', 'evening', 'flexible'] as const).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTimeSlot(selectedTimeSlot === slot ? null : slot)}
                        className={[
                          'flex flex-col items-center py-2 rounded-lg border text-base transition-colors',
                          selectedTimeSlot === slot
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-400'
                            : 'border-[var(--border-card)] text-[var(--text-sub)] hover:border-slate-500',
                        ].join(' ')}
                      >
                        {TIME_SLOT_EMOJI[slot]}
                        {selectedTimeSlot === slot && (
                          <span className="text-[9px] mt-0.5 text-emerald-400 leading-none">
                            {TIME_SLOT_TEXT[slot]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handlePlan}
                    disabled={!planNickname.trim() || !planDate || !selectedTimeSlot || submitting}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '登録中...' : 'ここに行く 登録する'}
                  </button>
                </>
              )}
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
