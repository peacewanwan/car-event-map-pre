import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// RESEND_TO_EMAIL: Resendアカウント登録時のメールアドレス（無料プランはこのアドレスのみ送信可）
// 独自ドメイン追加後は 24offmap@gmail.com に変更
const TO_EMAIL = process.env.RESEND_TO_EMAIL ?? '24offmap@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { name, email, category, message } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ success: false, error: 'お問い合わせ内容は必須です' }, { status: 400 })
    }

    const subject = `【お問い合わせ】${category ?? 'その他'} - 二輪四輪オフマップ`
    const text = [
      `お名前：${name || '（未入力）'}`,
      `メールアドレス：${email || '（未入力）'}`,
      `カテゴリ：${category ?? 'その他'}`,
      '',
      `【お問い合わせ内容】`,
      message,
    ].join('\n')

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: TO_EMAIL,
      subject,
      text,
    })

    if (result.error) {
      console.error('[contact] resend error:', result.error)
      return NextResponse.json(
        { success: false, error: result.error.message, detail: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: result.data?.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[contact] send error:', e)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
