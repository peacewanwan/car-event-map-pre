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
      <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* ロゴ */}
        <Link href="/" className="text-base font-bold tracking-tight flex-shrink-0 flex items-baseline gap-1 hover:opacity-80 transition-opacity">
          <span className="text-[var(--text-main)]">2輪4輪</span>
          <span className={isSpots ? 'text-emerald-400' : 'text-[var(--accent)]'}>offmap</span>
        </Link>

        {/* ページ切り替えタブ（sm以上） */}
        <nav className="hidden sm:flex items-center gap-1 bg-[var(--bg-input)] rounded-lg p-0.5">
          <Link
            href="/"
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              !isSpots
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
                : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
            }`}
          >
            イベント
          </Link>
          <Link
            href="/spots"
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              isSpots
                ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
                : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
            }`}
          >
            オフ会メーカー
          </Link>
        </nav>

        {/* 右側アクション */}
        <div className="flex items-center gap-2">
          {onSubmitEvent && (
            <button
              onClick={onSubmitEvent}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500 hover:bg-emerald-500/10 lg:bg-emerald-50 lg:text-emerald-700 lg:border-emerald-200 lg:hover:bg-emerald-100 transition-colors flex-shrink-0"
            >
              イベント投稿
            </button>
          )}
          <a
            href="/faq"
            className="text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors flex-shrink-0"
            title="よくある質問"
          >
            <HelpCircle size={18} />
          </a>
        </div>
      </div>
    </header>
  )
}
