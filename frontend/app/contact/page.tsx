'use client'

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  '掲載削除依頼',
  'イベント情報の追加依頼',
  '不具合報告',
  'その他',
]

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | ''>('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setResult('')
    setErrorMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message }),
      })
      const json = await res.json()
      if (json.success) {
        setResult('success')
        setName('')
        setEmail('')
        setMessage('')
      } else {
        setResult('error')
        setErrorMsg(json.error ?? '送信に失敗しました')
      }
    } catch {
      setResult('error')
      setErrorMsg('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">

      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-[var(--bg-header)]/90 backdrop-blur border-b border-[var(--border-card)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-baseline gap-0.5 hover:opacity-80 transition-opacity">
            <span className="text-xs font-bold text-[var(--text-main)]">2輪4輪</span>
            <span className="text-xs font-bold text-sky-400">offmap</span>
          </Link>
          <span className="text-[var(--text-sub)] text-xs">/</span>
          <span className="text-sm font-medium text-[var(--text-main)]">お問い合わせ</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-xl font-bold mb-1">お問い合わせ</h1>
        <p className="text-sm text-[var(--text-sub)] mb-8">
          掲載削除・イベント追加依頼・不具合報告などはこちらからどうぞ。
        </p>

        {result === 'success' ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-2xl">✅</p>
            <p className="text-base font-semibold">お問い合わせを受け付けました</p>
            <p className="text-sm text-[var(--text-sub)]">内容を確認のうえ、対応いたします。</p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm text-[var(--accent)] hover:underline"
            >
              トップページへ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* お名前 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                お名前 <span className="text-xs text-[var(--text-sub)]">（任意）</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：山田 太郎"
                className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2.5 text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                メールアドレス <span className="text-xs text-[var(--text-sub)]">（任意・返信希望の場合）</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例：example@email.com"
                className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2.5 text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            {/* カテゴリ */}
            <div>
              <label className="block text-sm font-medium mb-1.5">カテゴリ</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2.5 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* お問い合わせ内容 */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                お問い合わせ内容 <span className="text-red-400 text-xs">必須</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={`例）\nイベント名：〇〇ミーティング\n掲載されていますが、すでに終了したイベントです。削除をお願いします。`}
                className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-3 py-2.5 text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
              />
            </div>

            {result === 'error' && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={!message.trim() || submitting}
              className="w-full py-3 rounded-xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? '送信中...' : '送信する'}
            </button>

            <p className="text-xs text-[var(--text-sub)] text-center">
              返信が必要な場合はメールアドレスをご入力ください。<br />
              通常2〜3営業日以内に対応いたします。
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
