'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { APIProvider } from '@vis.gl/react-google-maps'
import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import SpotCard from './SpotCard'
import MapView from './MapView'

// ---------- Types ----------

type Spot = {
  id: number
  name: string
  category: string | null
  prefecture: string | null
  lat: number
  lng: number
  description: string | null
  region: string | null
}

// ---------- Helpers ----------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------- SpotsPage ----------

function SpotsPageInner() {
  const searchParams = useSearchParams()
  const initLat = searchParams.get('lat')
  const initLng = searchParams.get('lng')

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

  // ---- リスト→地図連携 ----
  const [selectedSpotId, setSelectedSpotId] = useState<number | null>(null)

  // ---- filter state ----
  const [prefFilter, setPrefFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [nowOnly, setNowOnly] = useState(false)
  const [planOnly, setPlanOnly] = useState(false)

  // ---- unified search state ----
  const [highlightedSpotIds, setHighlightedSpotIds] = useState<Set<number>>(new Set())
  const [highlightHintMap, setHighlightHintMap] = useState<Record<number, string>>({})
  const [checkinMatchedSpotIds, setCheckinMatchedSpotIds] = useState<Set<number>>(new Set())

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

  // ---- unified search: checkin lookup ----
  useEffect(() => {
    if (!nameFilter.trim()) {
      setHighlightedSpotIds(new Set())
      setHighlightHintMap({})
      setCheckinMatchedSpotIds(new Set())
      return
    }

    async function searchCheckins() {
      const supabase = createClient()
      const q = nameFilter.toLowerCase()
      const now = new Date().toISOString()
      const today = new Date().toISOString().split('T')[0]
      const in14Days = new Date()
      in14Days.setDate(in14Days.getDate() + 14)
      const in14DaysStr = in14Days.toISOString()

      const { data: matchingCheckins } = await supabase
        .from('spot_checkins')
        .select('spot_id, nickname, vehicle_type, checkin_type, expires_at, left_at, planned_at')
        .or(`nickname.ilike.%${nameFilter}%,vehicle_type.ilike.%${nameFilter}%`)

      const newHighlightIds = new Set<number>()
      const newHintMap: Record<number, string> = {}
      const newCheckinMatchedIds = new Set<number>()

      if (matchingCheckins) {
        for (const c of matchingCheckins) {
          let valid = false
          if (c.checkin_type === 'now' && !c.left_at && c.expires_at > now) {
            valid = true
          } else if (c.checkin_type === 'plan' && c.planned_at) {
            const planDate = c.planned_at.split('T')[0]
            if (planDate >= today && c.planned_at <= in14DaysStr) {
              valid = true
            }
          }

          if (valid) {
            newCheckinMatchedIds.add(c.spot_id)
            const hint =
              c.nickname?.toLowerCase().includes(q)
                ? `${c.nickname}さんが登録中`
                : `${c.vehicle_type}で登録中`
            if (!newHintMap[c.spot_id]) {
              newHintMap[c.spot_id] = hint
            }
          }
        }
      }

      setCheckinMatchedSpotIds(newCheckinMatchedIds)
      setHighlightHintMap(newHintMap)
    }

    searchCheckins()
  }, [nameFilter])

  // ---- derived ----
  const prefectures = Array.from(
    new Set(spots.map((s) => s.prefecture).filter(Boolean) as string[])
  ).sort()

  const filteredSpots = spots.filter((s) => {
    if (initLat && initLng) {
      const dist = haversineKm(parseFloat(initLat), parseFloat(initLng), s.lat, s.lng)
      if (dist > 50) return false
    }
    if (prefFilter && s.prefecture !== prefFilter) return false
    if (nowOnly && (nowCountMap[s.id] || 0) === 0) return false
    if (planOnly && (planCountMap[s.id] || 0) === 0) return false
    if (nameFilter) {
      const q = nameFilter.toLowerCase()
      const matchesName = s.name?.toLowerCase().includes(q)
      const matchesCheckin = checkinMatchedSpotIds.has(s.id)
      if (!matchesName && !matchesCheckin) return false
    }
    return true
  })

  // spots highlighted only via checkin match (not name match)
  useEffect(() => {
    if (!nameFilter.trim()) {
      setHighlightedSpotIds(new Set())
      return
    }
    const q = nameFilter.toLowerCase()
    const ids = new Set<number>()
    for (const spotId of checkinMatchedSpotIds) {
      const spot = spots.find((s) => s.id === spotId)
      if (spot && !spot.name?.toLowerCase().includes(q)) {
        ids.add(spotId)
      }
    }
    setHighlightedSpotIds(ids)
  }, [checkinMatchedSpotIds, nameFilter, spots])

  // ---------- JSX ----------

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">

      {/* ===== 使い方モーダル ===== */}
      {howToOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
          onClick={() => setHowToOpen(false)}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-emerald-400">オフ会メーカーとは？</h2>
            <p className="text-sm text-[var(--text-sub)]">
              今いる場所・行く予定を共有して<br />
              仲間を増やすためのページです。
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">🔴 今いるナウ</p>
                <p className="text-xs text-[var(--text-sub)] mt-1">
                  今その駐車場・スポットにいる人を表示<br />
                  「ここにいるナウ」で自分も登録できる
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">📅 行く予定</p>
                <p className="text-xs text-[var(--text-sub)] mt-1">
                  カレンダーで予定日をタップすると<br />
                  その日に行く予定の人が見られる
                </p>
              </div>
              <div className="border-t border-[var(--border-card)] pt-3 space-y-1">
                <p className="text-xs text-slate-500">✓ ニックネームのみ・登録不要</p>
                <p className="text-xs text-slate-500">✓ 3時間で自動チェックアウト</p>
              </div>
            </div>
            <button
              onClick={() => setHowToOpen(false)}
              className="w-full text-sm bg-[var(--bg-input)] text-[var(--text-sub)] rounded-xl py-2.5 hover:opacity-80 transition-colors border border-[var(--border-card)]"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ===== ヘッダー（sticky） ===== */}
      <header className="sticky top-0 z-30 bg-[var(--bg-header)]/90 backdrop-blur border-b border-[var(--border-card)]">
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="flex items-baseline gap-0.5 hover:opacity-80 transition-opacity">
            <span className="text-xs font-bold text-[var(--text-sub)]">2輪4輪</span>
            <span className="text-sm font-black text-emerald-400">オフ会メーカー</span>
          </Link>
          <div className="flex justify-end items-center gap-3">
            <button
              onClick={() => setHowToOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/20 transition-colors"
            >
              使い方
            </button>
            <a href="/faq" className="text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors" title="よくある質問">
              <HelpCircle size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ===== サブテキスト（モバイルのみ） ===== */}
      <div className="lg:hidden bg-gradient-to-b from-emerald-950/20 to-transparent px-4 py-6 text-center">
        <p className="text-base font-bold text-emerald-400 mb-2">今いる場所で オフ会になるかも？</p>
        <p className="text-sm text-slate-400 leading-relaxed">
          今日はどこ行く？<br />
          誰かに会いに行く？誰かが来てくれるのを待つ？<br />
          <span className="text-slate-500">今いる場所・行く予定を共有して仲間を増やそう</span>
        </p>
      </div>

      {/* ===== タブ（モバイルのみ・sticky） ===== */}
      <div className="sticky top-[57px] z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 lg:hidden">
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

      {/* ===== メインコンテンツ（lg: 2カラム） ===== */}
      <div className="lg:flex lg:h-[calc(100vh-57px)]">

        {/* ── 左カラム: リスト ── */}
        <div className={`lg:w-2/5 lg:h-full lg:overflow-y-auto lg:border-r lg:border-[var(--border-card)] ${activeTab !== 'list' ? 'hidden lg:block' : ''}`}>
          <div className="max-w-2xl mx-auto lg:max-w-none">

            {/* フィルタ */}
            <div className="px-4 pt-3 pb-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={prefFilter}
                  onChange={(e) => setPrefFilter(e.target.value)}
                  className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition-colors"
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
                  placeholder="スポット名 / ハンドル名 / 車種"
                  className="flex-1 text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setNowOnly((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    nowOnly
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40'
                      : 'bg-[var(--bg-input)] text-[var(--text-sub)] border-[var(--border-card)] hover:border-slate-500'
                  }`}
                >
                  🔴 今いる人あり
                </button>
                <button
                  onClick={() => setPlanOnly((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    planOnly
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40'
                      : 'bg-[var(--bg-input)] text-[var(--text-sub)] border-[var(--border-card)] hover:border-slate-500'
                  }`}
                >
                  📅 行く予定の人あり
                </button>
                <p className="text-xs text-slate-600">
                  {loading ? '読込中...' : `${filteredSpots.length}件`}
                </p>
              </div>
            </div>

            {/* スポット一覧 */}
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-5 h-5 border-2 border-[var(--border-card)] border-t-emerald-400 rounded-full animate-spin" />
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
                    onToggle={() => {
                      const newId = openSpotId === spot.id ? null : spot.id
                      setOpenSpotId(newId)
                      if (newId !== null) setSelectedSpotId(newId)
                    }}
                    isHighlighted={highlightedSpotIds.has(spot.id)}
                    highlightHint={highlightHintMap[spot.id]}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── 右カラム: 地図 ── */}
        <div className={`lg:flex-1 lg:h-full ${activeTab !== 'map' ? 'hidden lg:block' : 'h-[calc(100vh-120px)]'}`}>
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
            <MapView
              spots={filteredSpots}
              nowCountMap={nowCountMap}
              focusSpotId={selectedSpotId ?? undefined}
              onSpotSelect={(spotId) => {
                setActiveTab('list')
                setOpenSpotId(spotId)
              }}
            />
          </APIProvider>
        </div>

      </div>
    </div>
  )
}

export default function SpotsPage() {
  return (
    <Suspense fallback={null}>
      <SpotsPageInner />
    </Suspense>
  )
}
