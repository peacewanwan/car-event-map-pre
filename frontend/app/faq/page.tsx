'use client'

import { useState } from 'react'
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
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">

      {/* コンテンツ */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle size={20} className="text-emerald-400" />
          <h1 className="text-lg font-bold text-[var(--text-main)]">よくある質問</h1>
        </div>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl overflow-hidden"
            >
              <button
                className="w-full text-left px-4 py-4 flex items-center justify-between gap-2"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-sm font-medium text-[var(--text-main)]">{item.q}</span>
                {openIndex === i ? (
                  <ChevronUp size={16} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 border-t border-[var(--border-card)] pt-3">
                  <p className="text-sm text-[var(--text-sub)] leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

    </div>
  )
}
