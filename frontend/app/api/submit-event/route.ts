import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

const PROMPT = `
以下のイベント告知テキストから情報を抽出してJSONのみ返してください。
説明文やMarkdownコードブロックは不要です。

抽出する項目：
- name: イベント名
- event_date: 開催日（YYYY-MM-DD形式。年が省略されている場合は今年または来年の直近の日付を使用）
- prefecture: 都道府県（例：静岡県、東京都）
- venue: 会場名
- category: 以下から1つ選択
  - meeting: オフ会・ミーティング・集まって見せ合う系
  - track: 走行会・サーキット・峠での走行体験
  - regular: 毎週・毎月など定期開催系
  - show: 展示・ショー・カーショー系
  - touring: ツーリング・一緒に走る系
  - unknown: 判断材料不足
- target_vehicle: 対象車種（10文字以内）。以下の正規化リストから最も近いものを選択：
  旧車・クラシック / 86/BRZ / BMW/MINI / GRヤリス / ドリフト車 /
  ドレスアップ / 商用車 / ロードスター / コペン / 痛車 /
  キャンピングカー / GT-R / マツダ / 軽自動車 / アルファロメオ
  リストにない場合は10文字以内で記載。
- source_url: イベントのURLがあれば記載（なければnull）
- keywords: 検索に役立つキーワード配列（5〜10個）

テキスト：
{text}
`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ success: false, message: "テキストが空です" });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: PROMPT.replace("{text}", text) }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start === -1 || end <= 0) {
      return NextResponse.json({ success: false, message: "解析に失敗しました" });
    }

    const parsed = JSON.parse(raw.slice(start, end));

    if (!parsed.event_date || !parsed.prefecture) {
      return NextResponse.json({
        success: false,
        message: "開催日またはエリアが特定できませんでした。テキストに日付と場所を含めてください。",
      });
    }

    if (parsed.target_vehicle && parsed.target_vehicle.length > 10) {
      parsed.target_vehicle = parsed.target_vehicle.slice(0, 10);
    }

    await supabase.from("events").insert({
      name:           parsed.name,
      event_date:     parsed.event_date,
      prefecture:     parsed.prefecture,
      venue:          parsed.venue ?? null,
      category:       parsed.category ?? "unknown",
      target_vehicle: parsed.target_vehicle ?? null,
      source_url:     parsed.source_url ?? null,
      keywords:       parsed.keywords ?? null,
      source_site:    "ユーザー投稿",
      source_site_url: null,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "サーバーエラーが発生しました" });
  }
}
