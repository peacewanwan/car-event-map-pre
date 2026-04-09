'use client'

import { useEffect, useState } from 'react'
import { Calendar, Navigation2, Loader2 } from 'lucide-react'
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

type ActiveTab = 'imakoko' | 'ikukamo'

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

function formatPlanDate(plannedAt: string): string {
  const d = new Date(plannedAt)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ---------- SpotCard ----------

export default function SpotCard({ spot, nowCount, planCount, isOpen, onToggle, isHighlighted, highlightHint }: SpotCardProps) {
  const hasNow = nowCount >= 1
  const catColor = spot.category ? CATEGORY_COLORS[spot.category] : null

  // ---- tab ----
  const [activeTab, setActiveTab] = useState<ActiveTab>('imakoko')

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

  // ---- share ----
  const [copied, setCopied] = useState(false)

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

  // ---- share ----
  async function handleShare() {
    const text = `今${spot.name}にいます🚗 #二輪四輪オフ会メーカー #オフ会`
    const url = 'https://24offmap.jp/spots'
    const shareText = `${text}\n${url}`

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText })
      } catch {
        // キャンセル時は何もしない
      }
    } else {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ---------- render ----------

  return (
    <div
      className={[
        'rounded-2xl overflow-hidden transition-colors',
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
          <p className="text-xs text-emerald-400/80">
            <span aria-hidden="true">🔍</span> {highlightHint}
          </p>
        </div>
      )}

      {/* カードヘッダー */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 cursor-pointer"
        onClick={onToggle}
        aria-expanded={isOpen}
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
              aria-label={`${spot.name}をGoogleマップで開く`}
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
            <span aria-hidden="true">🔴</span> イマココ {nowCount}人
            {hasNow && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </span>
          <span className="text-xs text-[var(--text-sub)]">
            <span aria-hidden="true">📅</span> 行くカモ {planCount}人
          </span>
        </div>
      </button>

      {/* ===== アコーディオン展開エリア ===== */}
      {isOpen && (
        <div className="border-t border-[var(--border-card)] bg-[var(--bg-filter)]">

          {/* タブヘッダー */}
          <div role="tablist" className="flex border-b border-[var(--border-card)]">
            <button
              role="tab"
              id={`tab-imakoko-${spot.id}`}
              aria-selected={activeTab === 'imakoko'}
              aria-controls={`panel-imakoko-${spot.id}`}
              onClick={() => setActiveTab('imakoko')}
              className={[
                'flex-1 py-2.5 text-xs font-medium tracking-wider text-center transition-colors relative',
                activeTab === 'imakoko'
                  ? 'text-emerald-400'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">🔴</span>
                イマココ
                {nowCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    {nowCount}
                  </span>
                )}
              </span>
              {activeTab === 'imakoko' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </button>
            <button
              role="tab"
              id={`tab-ikukamo-${spot.id}`}
              aria-selected={activeTab === 'ikukamo'}
              aria-controls={`panel-ikukamo-${spot.id}`}
              onClick={() => setActiveTab('ikukamo')}
              className={[
                'flex-1 py-2.5 text-xs font-medium tracking-wider text-center transition-colors relative',
                activeTab === 'ikukamo'
                  ? 'text-emerald-400'
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">📅</span>
                行くカモ
                {planCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    {planCount}
                  </span>
                )}
              </span>
              {activeTab === 'ikukamo' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </button>
          </div>

          {/* ===== イマココ タブパネル ===== */}
          <div
            role="tabpanel"
            id={`panel-imakoko-${spot.id}`}
            aria-labelledby={`tab-imakoko-${spot.id}`}
            hidden={activeTab !== 'imakoko'}
            className="px-4 py-4 space-y-4"
          >
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
                      <span aria-hidden="true">👤</span>
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
                <div className="flex gap-2">
                  <button
                    onClick={handleCheckout}
                    className="flex-1 py-3 rounded-xl border border-[var(--border-card)] text-[var(--text-sub)] text-sm hover:bg-[var(--bg-input)] transition-colors active:scale-[0.98]"
                  >
                    退出する
                  </button>
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/20 transition-colors active:scale-[0.98]"
                  >
                    {copied ? 'コピーしました ✓' : '共有する'}
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`今${spot.name}にいます🚗 #二輪四輪オフ会メーカー #オフ会\nhttps://24offmap.jp/spots`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/20 transition-colors"
                    aria-label="Xでシェア"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>Xでシェア</span>
                  </a>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="ニックネーム"
                      aria-label="ニックネーム"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                    <input
                      type="text"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      placeholder="車種（任意）"
                      aria-label="車種（任意）"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleCheckin}
                    disabled={!nickname.trim() || submitting}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        登録中...
                      </span>
                    ) : (
                      'イマココ 登録する'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ===== 行くカモ タブパネル ===== */}
          <div
            role="tabpanel"
            id={`panel-ikukamo-${spot.id}`}
            aria-labelledby={`tab-ikukamo-${spot.id}`}
            hidden={activeTab !== 'ikukamo'}
            className="px-4 py-4 space-y-4"
          >
            {/* 今後の予定リスト */}
            <div>
              <p className="text-xs text-[var(--text-sub)] font-medium tracking-wider mb-3">
                今後の予定
              </p>
              {planCheckins.length === 0 ? (
                <p className="text-xs text-[var(--text-sub)]">まだ予定はありません</p>
              ) : (
                <ul className="space-y-1.5">
                  {planCheckins.map((c) => (
                    <li key={c.id} className="flex items-baseline gap-3 py-1">
                      <span className="text-sm font-medium text-emerald-400 min-w-[3rem] shrink-0">
                        {formatPlanDate(c.planned_at)}
                      </span>
                      <span className="text-sm text-[var(--text-main)]">{c.nickname}</span>
                      <span className="text-xs text-[var(--text-sub)]">
                        {c.vehicle_type && `${c.vehicle_type} · `}
                        {c.time_slot ? TIME_SLOT_LABEL[c.time_slot] : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 行くカモ フォーム */}
            <div className="border-t border-[var(--border-card)] pt-4 space-y-3">
              {alreadyPlanned ? (
                <button
                  onClick={handleCancelPlan}
                  className="w-full py-3 rounded-xl border border-[var(--border-card)] text-[var(--text-sub)] text-sm hover:bg-[var(--bg-input)] transition-colors active:scale-[0.98]"
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
                      aria-label="ニックネーム（行くカモ用）"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                    <input
                      type="text"
                      value={planVehicle}
                      onChange={(e) => setPlanVehicle(e.target.value)}
                      placeholder="車種（任意）"
                      aria-label="車種（行くカモ用・任意）"
                      className="w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-sm text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
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
                      aria-label="行く予定の日付"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-main)] text-sm rounded-lg pl-8 pr-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['morning', 'afternoon', 'evening', 'flexible'] as const).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTimeSlot(selectedTimeSlot === slot ? null : slot)}
                        aria-pressed={selectedTimeSlot === slot}
                        aria-label={TIME_SLOT_LABEL[slot]}
                        className={[
                          'flex flex-col items-center py-2 rounded-lg border text-base transition-colors',
                          selectedTimeSlot === slot
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-400'
                            : 'border-[var(--border-card)] text-[var(--text-sub)] hover:border-slate-500',
                        ].join(' ')}
                      >
                        <span aria-hidden="true">{TIME_SLOT_EMOJI[slot]}</span>
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
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        登録中...
                      </span>
                    ) : (
                      '行くカモ 登録する'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
