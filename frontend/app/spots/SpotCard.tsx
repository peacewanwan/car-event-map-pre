'use client'

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

// ---------- Constants ----------

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  '道の駅':    { text: 'text-lime-400',   bg: 'bg-lime-500/10' },
  'SA・PA':   { text: 'text-amber-400',  bg: 'bg-amber-500/10' },
  '展望台・峠': { text: 'text-orange-400', bg: 'bg-orange-500/10' },
  '駐車場':    { text: 'text-slate-400',  bg: 'bg-slate-500/10' },
}

// ---------- SpotCard ----------

export default function SpotCard({ spot, nowCount, planCount, isOpen, onToggle }: SpotCardProps) {
  const hasNow = nowCount >= 1
  const catColor = spot.category ? CATEGORY_COLORS[spot.category] : null

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

      {/* アコーディオン展開エリア（枠のみ） */}
      {isOpen && (
        <div className="border-t border-slate-800 px-4 py-4">
          <p className="text-slate-500 text-sm text-center py-4">
            チェックイン機能は次のステップで実装
          </p>
        </div>
      )}
    </div>
  )
}
