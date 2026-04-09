'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

export default function Header({
  onSubmitEvent,
}: {
  onSubmitEvent?: () => void
}) {
  const pathname = usePathname()
  const isSpots = pathname.startsWith('/spots')

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-header)]/80 backdrop-blur border-b border-[var(--border-card)]">
      <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
        {/* ロゴ */}
        <Link href="/" className="text-sm font-bold tracking-tight flex-shrink-0 flex items-baseline gap-0.5 hover:opacity-80 transition-opacity">
          <span className="text-[var(--text-main)]">2輪4輪</span>
          <span className={isSpots ? 'text-emerald-400' : 'text-[var(--accent)]'}>offmap</span>
        </Link>

        {/* ページ切り替えタブ */}
        <nav className="flex items-center gap-0.5 bg-[var(--bg-input)] rounded-lg p-0.5">
          <Link
            href="/"
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
              !isSpots
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
            }`}
          >
            イベント
          </Link>
          <Link
            href="/spots"
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
              isSpots
                ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
                : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
            }`}
          >
            スポット
          </Link>
        </nav>

        {/* 右側アクション */}
        <div className="flex items-center gap-1.5">
          {onSubmitEvent && (
            <button
              onClick={onSubmitEvent}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500 hover:bg-emerald-500/10 lg:bg-emerald-50 lg:text-emerald-700 lg:border-emerald-200 lg:hover:bg-emerald-100 transition-colors flex-shrink-0"
            >
              イベント投稿
            </button>
          )}
          <a
            href="/faq"
            className="text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors flex-shrink-0"
            title="よくある質問"
          >
            <HelpCircle size={16} />
          </a>
        </div>
      </div>
    </header>
  )
}
