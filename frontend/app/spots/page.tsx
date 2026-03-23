'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { createClient } from '@/lib/supabase/client'
import type { Spot } from './MapView'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-zinc-100">
      <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
    </div>
  ),
})

const AREAS: { label: string; prefectures: string[] }[] = [
  { label: '北海道',     prefectures: ['北海道'] },
  { label: '東北',       prefectures: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { label: '関東',       prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { label: '中部',       prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'] },
  { label: '関西',       prefectures: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { label: '中国',       prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { label: '四国',       prefectures: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { label: '九州・沖縄', prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
]

export default function SpotsPage() {
  const [allSpots, setAllSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedPref, setSelectedPref] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('spots').select('*')
      setAllSpots(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const prefecturesInArea = AREAS.find((a) => a.label === selectedArea)?.prefectures ?? []

  const filtered = allSpots.filter((s) => {
    if (selectedPref) return s.prefecture === selectedPref
    if (selectedArea) return prefecturesInArea.includes(s.prefecture ?? '')
    return true
  })

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex-shrink-0">
        <h1 className="text-base font-semibold text-zinc-800">スポットマップ</h1>
      </header>

      {/* フィルター */}
      <div className="bg-white border-b border-zinc-100 px-4 py-2 flex gap-2 flex-shrink-0">
        <select
          value={selectedArea}
          onChange={(e) => { setSelectedArea(e.target.value); setSelectedPref('') }}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
        >
          <option value="">エリア：すべて</option>
          {AREAS.map((a) => (
            <option key={a.label} value={a.label}>{a.label}</option>
          ))}
        </select>

        <select
          value={selectedPref}
          onChange={(e) => setSelectedPref(e.target.value)}
          disabled={!selectedArea}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white disabled:opacity-40"
        >
          <option value="">都道府県：すべて</option>
          {prefecturesInArea.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <span className="text-xs text-zinc-400 self-center ml-auto">
          {loading ? '読込中...' : `${filtered.length}件`}
        </span>
      </div>

      {/* 地図 */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          </div>
        ) : (
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
            <MapView spots={filtered} />
          </APIProvider>
        )}
      </div>
    </div>
  )
}
