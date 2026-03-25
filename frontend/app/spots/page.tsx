'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import SpotCard from './SpotCard'

// ---------- Types ----------

type Spot = {
  id: number
  name: string
  category: string | null
  prefecture: string | null
  lat: number
  lng: number
}

// ---------- SpotsPage ----------

export default function SpotsPage() {
  // ---- data ----
  const [spots, setSpots] = useState<Spot[]>([])
  const [nowCountMap, setNowCountMap] = useState<Record<number, number>>({})
  const [planCountMap, setPlanCountMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // ---- accordion ----
  const [openSpotId, setOpenSpotId] = useState<number | null>(null)

  // ---- UI state ----
  const [howToOpen, setHowToOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')

  // ---- filter state ----
  const [prefFilter, setPrefFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [nowOnly, setNowOnly] = useState(false)

  // ---- data fetch（初回 + 30秒ごと自動更新） ----
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const now = new Date().toISOString()

      const oneMonthLater = new Date()
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

      const [{ data: spotsData }, { data: nowCheckins }, { data: planCheckins }] = await Promise.all([
        supabase.from('spots').select('*').order('prefecture'),
        supabase
          .from('spot_checkins')
          .select('spot_id')
          .eq('checkin_type', 'now')
          .is('left_at', null)
          .gt('expires_at', now),
        supabase
          .from('spot_checkins')
          .select('spot_id')
          .eq('checkin_type', 'plan')
          .gte('planned_at', now)
          .lte('planned_at', oneMonthLater.toISOString()),
      ])

      const nowMap: Record<number, number> = {}
      nowCheckins?.forEach((c) => {
        nowMap[c.spot_id] = (nowMap[c.spot_id] || 0) + 1
      })

      const planMap: Record<number, number> = {}
      planCheckins?.forEach((c) => {
        planMap[c.spot_id] = (planMap[c.spot_id] || 0) + 1
      })

      setSpots(spotsData || [])
      setNowCountMap(nowMap)
      setPlanCountMap(planMap)
      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // ---- derived ----
  const prefectures = Array.from(
    new Set(spots.map((s) => s.prefecture).filter(Boolean) as string[])
  ).sort()

  const filteredSpots = spots.filter((s) => {
    if (prefFilter && s.prefecture !== prefFilter) return false
    if (nameFilter) {
      const q = nameFilter.toLowerCase()
      if (!s.name?.toLowerCase().includes(q)) return false
    }
    if (nowOnly && (nowCountMap[s.id] || 0) === 0) return false
    return true
  })

  // ---------- JSX ----------

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ===== 使い方モーダル ===== */}
      {howToOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
          onClick={() => setHowToOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-emerald-400">オフ会メーカーとは？</h2>
            <p className="text-sm text-slate-400">
              今いる場所・行く予定を共有して<br />
              仲間を増やすためのページです。
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">🔴 今いるナウ</p>
                <p className="text-xs text-slate-400 mt-1">
                  今その駐車場・スポットにいる人を表示<br />
                  「ここにいるナウ」で自分も登録できる
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">📅 行く予定</p>
                <p className="text-xs text-slate-400 mt-1">
                  カレンダーで予定日をタップすると<br />
                  その日に行く予定の人が見られる
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3 space-y-1">
                <p className="text-xs text-slate-500">✓ ニックネームのみ・登録不要</p>
                <p className="text-xs text-slate-500">✓ 3時間で自動チェックアウト</p>
              </div>
            </div>
            <button
              onClick={() => setHowToOpen(false)}
              className="w-full text-sm bg-slate-800 text-slate-300 rounded-xl py-2.5 hover:bg-slate-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ===== ヘッダー（sticky） ===== */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← offmap
          </Link>
          <p className="text-center text-sm font-bold text-emerald-400">
            オフ会メーカー
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setHowToOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/20 transition-colors"
            >
              使い方
            </button>
          </div>
        </div>
      </header>

      {/* ===== サブテキスト ===== */}
      <div className="bg-gradient-to-b from-emerald-950/20 to-transparent px-4 py-6 text-center">
        <p className="text-sm text-slate-400 leading-relaxed">
          今日はどこ行く？<br />
          誰かに会いに行く？誰かが来てくれるのを待つ？<br />
          <span className="text-slate-500">今いる場所・行く予定を共有して仲間を増やそう</span>
        </p>
      </div>

      {/* ===== タブ（sticky） ===== */}
      <div className="sticky top-[57px] z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 flex">
          {(['list', 'map'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
                activeTab === t
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'list' ? 'リスト' : '地図'}
              {activeTab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ===== リストタブ ===== */}
      {activeTab === 'list' && (
        <div className="max-w-2xl mx-auto">

          {/* フィルタ */}
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="flex gap-2">
              <select
                value={prefFilter}
                onChange={(e) => setPrefFilter(e.target.value)}
                className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="">都道府県：すべて</option>
                {prefectures.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="スポット名で検索"
                className="flex-1 text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNowOnly((v) => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  nowOnly
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                🔴 今いる人あり
              </button>
              <p className="text-xs text-slate-600">
                {loading ? '読込中...' : `${filteredSpots.length}件`}
              </p>
            </div>
          </div>

          {/* スポット一覧（プレースホルダー） */}
          <div className="px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            ) : filteredSpots.length === 0 ? (
              <p className="text-center text-slate-500 py-16 text-sm">
                スポットが見つかりません
              </p>
            ) : (
              filteredSpots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  nowCount={nowCountMap[spot.id] || 0}
                  planCount={planCountMap[spot.id] || 0}
                  isOpen={openSpotId === spot.id}
                  onToggle={() => setOpenSpotId(openSpotId === spot.id ? null : spot.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ===== 地図タブ ===== */}
      {activeTab === 'map' && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">
          地図は次のステップで実装
        </div>
      )}

    </div>
  )
}
