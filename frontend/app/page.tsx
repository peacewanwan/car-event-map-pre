"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Event = {
  id: number;
  name: string;
  event_date: string;
  prefecture: string | null;
  venue: string | null;
  genre: string | null;
  target_vehicle: string | null;
  source_url: string | null;
  source_site: string | null;
  source_site_url: string | null;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

function genreColor(genre: string | null): string {
  switch (genre) {
    case "ドレスアップ": return "bg-amber-100 text-amber-800";
    case "旧車":         return "bg-stone-100 text-stone-700";
    case "ミーティング": return "bg-blue-100 text-blue-800";
    case "オフ会":       return "bg-green-100 text-green-800";
    case "走行会":       return "bg-red-100 text-red-800";
    default:             return "bg-gray-100 text-gray-600";
  }
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", today)
        .order("event_date", { ascending: true });
      setEvents(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* ヘッダー */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Car Event MAP
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">全国の車イベント情報</p>
          </div>
          <span className="text-xs text-zinc-400">
            {loading ? "読込中..." : `${events.length}件`}
          </span>
        </div>
      </header>

      {/* リスト */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-zinc-400 py-20 text-sm">
            イベント情報がありません
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="bg-white rounded-xl border border-zinc-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">

                  {/* 左：イベント情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 leading-snug truncate">
                      {event.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatDate(event.event_date)}
                      {event.prefecture && ` · ${event.prefecture}`}
                    </p>
                    {event.venue && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        {event.venue}
                      </p>
                    )}
                    {event.target_vehicle && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        対象：{event.target_vehicle}
                      </p>
                    )}
                    {/* 情報ソース */}
                    {event.source_site && (
                      <p className="text-xs text-zinc-300 mt-1.5">
                        情報元：
                        {event.source_site_url ? (
                          <a
                            href={event.source_site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-400 underline underline-offset-2"
                          >
                            {event.source_site}
                          </a>
                        ) : (
                          event.source_site
                        )}
                      </p>
                    )}
                  </div>

                  {/* 右：バッジ＋リンク */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {event.genre && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${genreColor(event.genre)}`}>
                        {event.genre}
                      </span>
                    )}
                    {event.source_url && (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        詳細 →
                      </a>
                    )}
                  </div>

                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* フッター */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-zinc-300">自動更新 · Car Event MAP</p>
      </footer>

    </div>
  );
}
