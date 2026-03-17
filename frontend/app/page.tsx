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

type Filters = {
  vehicle: string;
  prefecture: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = { vehicle: "", prefecture: "", dateFrom: "", dateTo: "" };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
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
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [prefectures, setPrefectures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(10000);
      const loaded = data || [];
      setAllEvents(loaded);
      setEvents(loaded);

      const prefs = Array.from(
        new Set(loaded.map((e) => e.prefecture).filter(Boolean) as string[])
      ).sort();
      setPrefectures(prefs);

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    let result = allEvents;
    if (applied.vehicle) {
      const kw = applied.vehicle.toLowerCase();
      result = result.filter((e) =>
        e.target_vehicle?.toLowerCase().includes(kw)
      );
    }
    if (applied.prefecture) {
      result = result.filter((e) => e.prefecture === applied.prefecture);
    }
    if (applied.dateFrom) {
      result = result.filter((e) => e.event_date >= applied.dateFrom);
    }
    if (applied.dateTo) {
      result = result.filter((e) => e.event_date <= applied.dateTo);
    }
    setEvents(result);
  }, [applied, allEvents]);

  function handleSearch() {
    setApplied({ ...form });
  }

  function handleReset() {
    setForm(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  const isFiltered =
    applied.vehicle || applied.prefecture || applied.dateFrom || applied.dateTo;

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
            {loading ? "読込中..." : `${events.length}件${isFiltered ? "（絞込中）" : ""}`}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* フィルターフォーム */}
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4 space-y-3">
          {/* 車種 */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">車種</label>
            <input
              type="text"
              placeholder="例：スカイライン、旧車"
              value={form.vehicle}
              onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
          </div>

          {/* エリア */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">エリア</label>
            <select
              value={form.prefecture}
              onChange={(e) => setForm((f) => ({ ...f, prefecture: e.target.value }))}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
            >
              <option value="">すべて</option>
              {prefectures.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 日付範囲 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">開始日</label>
              <input
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">終了日</label>
              <input
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSearch}
              className="flex-1 bg-zinc-900 text-white text-sm font-medium rounded-lg py-2 hover:bg-zinc-700 transition-colors"
            >
              検索
            </button>
            <button
              onClick={handleReset}
              className="px-4 text-sm text-zinc-500 border border-zinc-200 rounded-lg py-2 hover:bg-zinc-50 transition-colors"
            >
              リセット
            </button>
          </div>
        </div>

        {/* リスト */}
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
                    {event.target_vehicle && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        {event.target_vehicle}
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
