'use client'

import { useEffect, useState } from 'react'
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
}

type CheckinUser = {
  id: string
  nickname: string
  vehicle_type: string | null
  created_at: string
  expires_at: string
}

// ---------- Constants ----------

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  '道の駅':    { text: 'text-lime-400',   bg: 'bg-lime-500/10' },
  'SA・PA':   { text: 'text-amber-400',  bg: 'bg-amber-500/10' },
  '展望台・峠': { text: 'text-orange-400', bg: 'bg-orange-500/10' },
  '駐車場':    { text: 'text-slate-400',  bg: 'bg-slate-500/10' },
}

// ---------- Helper ----------

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

// ---------- SpotCard ----------

export default function SpotCard({ spot, nowCount, planCount, isOpen, onToggle }: SpotCardProps) {
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

  // ---- localStorage ----
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

  // ---- fetch checkins（isOpen または refreshKey 変化で実行） ----
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

  // ---------- render ----------

  return (
    <div
      className={[
        'rounded-2xl overflow-hidden transition-colors cursor-pointer',
        'bg-slate-900/80',
        hasNow
          ? 'border border-l-2 border-emerald-500/40 border-l-emerald-500'
          : 'border border-slate-800 hover:border-slate-600',
      ].join(' ')}
    >
      {/* カードヘッダー */}
      <button
        className="w-full text-left px-4 py-3"
        onClick={onToggle}
      >
        {/* 1行目：スポット名 + 都道府県 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-white text-sm leading-snug">
            {spot.name}
          </p>
          {spot.prefecture && (
            <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
              {spot.prefecture}
            </span>
          )}
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
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            🔴 今{nowCount}人
            {hasNow && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </span>
          <span className="text-xs text-slate-500">📅 今月{planCount}人</span>
        </div>
      </button>

      {/* ===== アコーディオン展開エリア ===== */}
      {isOpen && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">

          {/* 今いるナウセクション */}
          <section>
            <p className="text-xs text-slate-500 font-medium tracking-wider mb-3">
              今いるナウ
            </p>

            {/* チェックイン中ユーザー一覧 */}
            {loadingCheckins ? (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            ) : checkins.length === 0 ? (
              <p className="text-xs text-slate-600 mb-4">まだ誰もいません</p>
            ) : (
              <ul className="space-y-1 mb-4">
                {checkins.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-2">
                    {/* アバターアイコン */}
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 text-sm">
                      👤
                    </div>
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{c.nickname}</p>
                      <p className="text-xs text-slate-500">
                        {c.vehicle_type && <span>{c.vehicle_type}　</span>}
                        {formatCheckinTime(c.created_at)} チェックイン（{remainingTime(c.expires_at)}）
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-slate-800 pt-4 space-y-3">
              {alreadyCheckedIn ? (
                /* 退出ボタン */
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
                >
                  退出する
                </button>
              ) : (
                /* チェックイン入力フォーム */
                <>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="ニックネーム"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="車種（任意）"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
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

          {/* TODO: Step4 - 行く予定セクション */}

        </div>
      )}
    </div>
  )
}
