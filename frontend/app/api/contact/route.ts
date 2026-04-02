import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: '24offmap@gmail.com',
      subject,
      text,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[contact] send error:', e)
    return NextResponse.json({ success: false, error: '送信に失敗しました' }, { status: 500 })
  }
}
