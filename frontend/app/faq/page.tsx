'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'このサービスは何ですか？',
    a: '全国の車・バイクのオフ会・ミーティング情報をWebから自動収集して掲載しています。無料・ログイン不要でご利用いただけます。',
  },
  {
    q: 'オフ会メーカーとは何ですか？',
    a: '大黒PAや箱根、道の駅などのスポットに「今いるナウ」や「行く予定」を登録して、仲間を見つけるツールです。ハンドル名と車種だけで気軽に使えます。登録した「今いるナウ」は3時間で自動的に消えます。',
  },
  {
    q: 'ハンドル名は本名でないといけませんか？',
    a: 'いいえ、自由なハンドル名でOKです。アカウント登録も不要です。',
  },
]

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← offmap
          </Link>
          <p className="text-center text-sm font-bold text-white">よくある質問</p>
          <div />
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle size={20} className="text-emerald-400" />
          <h1 className="text-lg font-bold text-white">よくある質問</h1>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
            >
              <button
                className="w-full text-left px-4 py-4 flex items-center justify-between gap-2"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-sm font-medium text-white">{item.q}</span>
                {openIndex === i ? (
                  <ChevronUp size={16} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                  <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

    </div>
  )
}
