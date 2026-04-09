"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HelpCircle } from "lucide-react";

// ---------- Types ----------

type Event = {
  id: number;
  name: string;
  event_date: string;
  event_date_end: string | null;
  prefecture: string | null;
  venue: string | null;
  genre: string | null;
  category: string | null;
  target_vehicle: string | null;
  source_url: string | null;
  source_site: string | null;
  source_site_url: string | null;
  recurring_id: number | null;
  keywords: string[] | null;
};

type RecurringEvent = {
  id: number;
  name: string;
  organizer: string | null;
  frequency: string | null;
  day_of_week: string | null;
  time_of_day: string | null;
  prefecture: string | null;
  venue: string | null;
  target_vehicle: string | null;
  source_url: string | null;
};

// ---------- Constants ----------

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "meeting", label: "オフ会・ミーティング" },
  { value: "track",   label: "走行会" },
  { value: "show",    label: "展示・ショー" },
  { value: "touring", label: "ツーリング" },
  { value: "regular", label: "定例MTG" },
];

const CATEGORY_TOGGLE: { value: string; label: string }[] = [
  { value: "",        label: "すべて" },
  { value: "meeting", label: "オフ会" },
  { value: "track",   label: "走行会" },
  { value: "show",    label: "展示" },
  { value: "touring", label: "ツーリング" },
  { value: "regular", label: "定例" },
];

const CATEGORY_BAR: Record<string, string> = {
  meeting: "bg-purple-500",
  track:   "bg-red-500",
  show:    "bg-yellow-500",
  touring: "bg-teal-500",
  regular: "bg-slate-500",
};

const CATEGORY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  meeting: { bg: "bg-purple-500/15 lg:bg-purple-500/20", text: "text-purple-300 lg:text-purple-700", border: "border-purple-500/30" },
  track:   { bg: "bg-red-500/15 lg:bg-red-500/20",       text: "text-red-300 lg:text-red-700",       border: "border-red-500/30" },
  show:    { bg: "bg-yellow-500/15 lg:bg-yellow-500/20", text: "text-yellow-300 lg:text-yellow-700", border: "border-yellow-500/30" },
  touring: { bg: "bg-teal-500/15 lg:bg-teal-500/20",     text: "text-teal-300 lg:text-teal-700",     border: "border-teal-500/30" },
  regular: { bg: "bg-slate-500/15 lg:bg-slate-500/20",   text: "text-slate-300 lg:text-slate-700",   border: "border-slate-500/30" },
};

// ---------- Helpers ----------

function categoryLabel(cat: string | null): string {
  return CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? "";
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

function formatDateRange(startStr: string, endStr: string | null): string {
  if (!endStr) return formatShortDate(startStr);
  return `${formatShortDate(startStr)}〜${formatShortDate(endStr)}`;
}

function daysBadge(dateStr: string): { label: string; classes: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: "今日", classes: "bg-orange-500 text-white" };
  if (diff === 1) return { label: "明日", classes: "bg-amber-400 text-amber-950 font-semibold" };
  if (diff <= 7)  return { label: `あと${diff}日`, classes: "bg-sky-500/20 text-sky-300 lg:text-sky-700 border border-sky-500/30" };
  return null;
}

function formatFrequency(freq: string | null): string {
  if (freq === "weekly")    return "毎週";
  if (freq === "monthly")   return "毎月";
  if (freq === "irregular") return "不定期";
  return freq ?? "";
}

// ---------- EventCard ----------

function EventCard({ event }: { event: Event }) {
  const bar   = event.category ? CATEGORY_BAR[event.category]   : null;
  const badge = event.category ? CATEGORY_BADGE[event.category] : null;
  const db    = daysBadge(event.event_date);
  const navUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue || event.name)}`;

  return (
    <li className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-card)] overflow-hidden">
      {/* カテゴリカラーバー */}
      {bar && <div className={`h-0.5 w-full ${bar}`} />}

      <div className="px-4 py-3">
        {/* 日付・バッジ行 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <span className="text-[var(--accent)] text-sm font-semibold">{formatDateRange(event.event_date, event.event_date_end)}</span>
          {db && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${db.classes}`}>
              {db.label}
            </span>
          )}
          {badge && event.category && event.category !== "unknown" && (
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
              {categoryLabel(event.category)}
            </span>
          )}
          {event.recurring_id && (
            <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 lg:text-emerald-700 font-medium">
              定期開催
            </span>
          )}
        </div>

        {/* イベント名 */}
        <p className="text-white lg:text-slate-900 font-bold text-base leading-snug mb-2">{event.name}</p>

        {/* 場所・車種 */}
        <div className="space-y-0.5 mb-2 text-sm text-[var(--text-sub)]">
          {(event.prefecture || event.venue) && (
            <p>📍 {[event.prefecture, event.venue].filter(Boolean).join(" · ")}</p>
          )}
          {event.target_vehicle && (
            <p>🚗 {event.target_vehicle}</p>
          )}
        </div>

        {/* キーワードタグ */}
        {event.keywords && event.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {event.keywords.slice(0, 3).map((kw, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-sub)]">
                #{kw}
              </span>
            ))}
          </div>
        )}

        {/* ボタン行 */}
        <div className="flex items-center gap-2">
          {event.source_url ? (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-medium bg-sky-600/20 text-sky-300 lg:text-sky-700 border border-sky-600/30 rounded-lg py-1.5 hover:bg-sky-600/30 transition-colors"
            >
              {event.source_url === event.source_site_url ? "情報元を見る" : "詳細を見る"}
            </a>
          ) : (
            <span className="flex-1" />
          )}
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg-card)] transition-colors flex-shrink-0"
          >
            🗺️ ナビ
          </a>
        </div>

        {/* 情報元 */}
        {event.source_site && (
          <p className="text-xs text-slate-600 mt-2">
            情報元：
            {event.source_site_url ? (
              <a
                href={event.source_site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-400 underline underline-offset-2"
              >
                {event.source_site}
              </a>
            ) : (
              event.source_site
            )}
          </p>
        )}
      </div>
    </li>
  );
}

// ---------- RecurringCard ----------

function RecurringCard({ ev }: { ev: RecurringEvent }) {
  return (
    <li className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-card)] border-l-2 border-l-sky-500 px-4 py-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white lg:text-slate-900 font-semibold text-sm leading-snug">{ev.name}</p>
        {ev.frequency && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 lg:text-sky-700 border border-sky-500/30 font-medium flex-shrink-0">
            {formatFrequency(ev.frequency)}
          </span>
        )}
      </div>

      <div className="space-y-0.5 mb-3 text-sm text-[var(--text-sub)]">
        {(ev.prefecture || ev.venue) && (
          <p>📍 {[ev.prefecture, ev.venue].filter(Boolean).join(" · ")}</p>
        )}
        {(ev.day_of_week || ev.time_of_day) && (
          <p>📅 {[ev.day_of_week, ev.time_of_day].filter(Boolean).join("　")}</p>
        )}
        {ev.target_vehicle && (
          <p>🚗 {ev.target_vehicle}</p>
        )}
      </div>

      {ev.source_url && (
        <a
          href={ev.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:text-sky-300 transition-colors"
        >
          詳細・次回開催日を確認 →
        </a>
      )}
    </li>
  );
}

// ---------- Main Page ----------

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"events" | "recurring">("events");

  // データ
  const [allEvents, setAllEvents]         = useState<Event[]>([]);
  const [loading, setLoading]             = useState(true);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [lastUpdated, setLastUpdated]     = useState<string | null>(null);
  const [displayCount, setDisplayCount]   = useState(30);

  // 動的セレクトオプション
  const [vehicles, setVehicles]       = useState<string[]>([]);
  const [prefectures, setPrefectures] = useState<string[]>([]);

  // フィルター
  const [filterOpen, setFilterOpen] = useState(false);
  const [freeword, setFreeword]     = useState("");
  const [vehicle, setVehicle]       = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [category, setCategory]     = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  // 投稿モーダル
  const [modalOpen, setModalOpen]       = useState(false);
  const [submitText, setSubmitText]     = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [submitResult, setSubmitResult] = useState<"" | "success" | "error">("");
  const [submitError, setSubmitError]   = useState("");

  // エントリモーダル
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // useRef（将来用 / ログタイマー）
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- データ取得 ----------

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    async function load() {
      const [{ data: eventsData }, { data: recurringData }, { data: logData }] = await Promise.all([
        supabase.from("events").select("*").gte("event_date", today).order("event_date", { ascending: true }),
        supabase.from("recurring_events").select("*").order("name"),
        supabase.from("crawl_logs").select("executed_at").order("executed_at", { ascending: false }).limit(1),
      ]);

      const loaded = eventsData || [];
      setAllEvents(loaded);

      const prefs = Array.from(
        new Set(loaded.map((e) => e.prefecture).filter(Boolean) as string[])
      ).sort();
      setPrefectures(prefs);

      const vehs = Array.from(
        new Set(loaded.map((e) => e.target_vehicle?.trim()).filter(Boolean) as string[])
      ).sort();
      setVehicles(vehs);

      setLoading(false);
      setRecurringEvents(recurringData || []);
      setRecurringLoading(false);

      if (logData && logData.length > 0) {
        const jst = new Date(new Date(logData[0].executed_at).getTime() + 9 * 60 * 60 * 1000);
        setLastUpdated(
          `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, "0")}/${String(jst.getUTCDate()).padStart(2, "0")} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")} JST`
        );
      }
    }
    load();
  }, []);

  // ---------- フィルタロジック ----------

  const filteredEvents = allEvents.filter((e) => {
    if (freeword) {
      const q = freeword.toLowerCase();
      const hit =
        e.name?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q) ||
        e.prefecture?.toLowerCase().includes(q) ||
        e.keywords?.some((k) => k.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (vehicle    && e.target_vehicle !== vehicle)    return false;
    if (prefecture && e.prefecture     !== prefecture) return false;
    if (category   && e.category       !== category)   return false;
    if (dateFrom   && e.event_date < dateFrom)         return false;
    if (dateTo     && e.event_date > dateTo)           return false;
    return true;
  });

  const isFiltered = !!(freeword || vehicle || prefecture || category || dateFrom || dateTo);

  // フィルター変更時に表示件数リセット
  useEffect(() => {
    setDisplayCount(30);
  }, [freeword, vehicle, prefecture, category, dateFrom, dateTo]);

  // ---------- 検索ログ（debounce 500ms） ----------

  useEffect(() => {
    if (logTimerRef.current) clearTimeout(logTimerRef.current);
    if (!isFiltered) return;
    logTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        await supabase.from("search_logs").insert({
          freeword:     freeword.trim() || null,
          vehicle:      vehicle      || null,
          prefecture:   prefecture   || null,
          category:     category     || null,
          date_from:    dateFrom     || null,
          date_to:      dateTo       || null,
          result_count: filteredEvents.length,
        });
      } catch {
        // ignore log errors
      }
    }, 500);
    return () => { if (logTimerRef.current) clearTimeout(logTimerRef.current); };
  }, [freeword, vehicle, prefecture, category, dateFrom, dateTo, filteredEvents.length, isFiltered]);

  // ---------- ハンドラ ----------

  function handleReset() {
    setFreeword("");
    setVehicle("");
    setPrefecture("");
    setCategory("");
    setDateFrom("");
    setDateTo("");
    setDisplayCount(30);
  }

  async function handleSubmit() {
    if (!submitText.trim()) return;
    setSubmitting(true);
    setSubmitResult("");
    setSubmitError("");
    try {
      const res = await fetch("/api/submit-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submitText }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitResult("success");
        setSubmitText("");
        setTimeout(() => { setModalOpen(false); setSubmitResult(""); }, 2000);
      } else {
        setSubmitResult("error");
        setSubmitError(json.message ?? "登録できませんでした");
      }
    } catch {
      setSubmitResult("error");
      setSubmitError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- JSX ----------

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-white lg:text-slate-900">

      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-30 bg-[var(--bg-header)]/80 backdrop-blur border-b border-[var(--border-card)]">
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base font-bold text-white lg:text-slate-900 tracking-tight flex-shrink-0">
            2輪4輪 offmap
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setModalOpen(true); setSubmitResult(""); setSubmitError(""); }}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500 hover:bg-emerald-500/10 lg:bg-emerald-50 lg:text-emerald-700 lg:border-emerald-200 lg:hover:bg-emerald-100 transition-colors flex-shrink-0"
            >
              イベント投稿
            </button>
            <a href="/faq" className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0" title="よくある質問">
              <HelpCircle size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ===== ヒーロー ===== */}
      <section className="relative overflow-hidden px-4 py-10 text-center">
        {/* グロー背景 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 bg-sky-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            2輪4輪 <span className="text-[var(--accent)]">offmap</span>
          </h1>
          <p className="text-[var(--text-sub)] text-sm mb-5">オフ会・イベントが すぐ見つかる。</p>

          <div className="flex flex-col items-center gap-1 text-sm text-slate-500 mb-6">
            <span>✓ 全国のイベントを自動収集</span>
            <span>✓ SNS登録不要</span>
            <span>✓ 無料</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setEntryModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 lg:bg-emerald-50 lg:text-emerald-700 lg:border-emerald-200 lg:hover:bg-emerald-100 transition-colors"
            >
              今いる場所を共有する
            </button>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                filterOpen
                  ? "bg-sky-600/30 text-sky-300 lg:text-sky-700 border-sky-500/50 lg:bg-sky-100 lg:border-sky-400"
                  : "bg-sky-600/10 text-sky-400 lg:text-sky-700 border-sky-600/30 hover:bg-sky-600/20 lg:bg-sky-50 lg:border-sky-200 lg:hover:bg-sky-100"
              }`}
            >
              🔽 条件からイベントを探す
            </button>
          </div>

          {lastUpdated && (
            <p className="text-xs text-slate-600 mt-3">最終更新：{lastUpdated}</p>
          )}
        </div>
      </section>

      {/* ===== フィルターパネル ===== */}
      <div className={!filterOpen ? "hidden lg:block" : ""}>
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 pb-4">
          <div className="bg-[var(--bg-filter)] border border-[var(--border-card)] rounded-xl p-4 space-y-3">

            {/* フリーワード */}
            <input
              type="text"
              value={freeword}
              onChange={(e) => setFreeword(e.target.value)}
              placeholder="キーワードで検索（例：ロードスター、筑波、走行会）"
              className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-white lg:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />

            {/* 車種・エリア */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-white lg:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">車種：すべて</option>
                {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-white lg:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="">エリア：すべて</option>
                {prefectures.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* カテゴリトグル */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_TOGGLE.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategory(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    category === opt.value
                      ? "bg-sky-500/20 text-sky-300 lg:text-sky-700 border-sky-500/40"
                      : "bg-[var(--bg-input)] text-[var(--text-sub)] border-[var(--border-card)] hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 日付範囲 */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-white lg:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-white lg:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            <button
              onClick={handleReset}
              className="w-full text-sm text-[var(--text-sub)] border border-[var(--border-card)] rounded-lg py-2 hover:bg-[var(--bg-input)] transition-colors"
            >
              条件をリセット
            </button>
          </div>
        </div>
      </div>

      {/* ===== タブ（sticky） ===== */}
      <div className="sticky top-12 z-20 bg-[var(--bg-header)]/90 backdrop-blur border-b border-[var(--border-card)]">
        <div className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 flex">
          {(["events", "recurring"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
                tab === t ? "text-[var(--accent)]" : "text-slate-500 hover:text-slate-300 lg:hover:text-slate-700"
              }`}
            >
              {t === "events" ? "イベント一覧" : "定期開催"}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ===== メインコンテンツ ===== */}
      <main className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 py-4">

        {/* 件数 + 解除ボタン */}
        {tab === "events" && !loading && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[var(--text-sub)]">
              {isFiltered
                ? `${filteredEvents.length}件 / 全${allEvents.length}件`
                : `${filteredEvents.length}件のイベント`}
            </p>
            {isFiltered && (
              <button
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                ✕ 絞り込みを解除
              </button>
            )}
          </div>
        )}

        {/* ----- イベント一覧タブ ----- */}
        {tab === "events" && (
          <>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-5 h-5 border-2 border-slate-700 border-t-[var(--accent)] rounded-full animate-spin" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center text-slate-500 py-20 text-sm">イベント情報がありません</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {filteredEvents.slice(0, displayCount).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </ul>
            )}

            {!loading && filteredEvents.length > displayCount && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 30)}
                  className="text-sm text-[var(--text-sub)] border border-[var(--border-card)] rounded-lg px-6 py-2.5 hover:bg-[var(--bg-card)] transition-colors"
                >
                  もっと読み込む（残り{filteredEvents.length - displayCount}件）
                </button>
              </div>
            )}

            {/* オフ会メーカー導線バナー */}
            {!loading && filteredEvents.length > 0 && (
              <div className="mt-6">
                <a
                  href="/spots"
                  className="block rounded-xl border border-emerald-500/30 bg-emerald-950/20 lg:bg-emerald-50 px-5 py-4 hover:bg-emerald-950/30 lg:hover:bg-emerald-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">📍</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-400 lg:text-emerald-700 mb-0.5">
                        オフ会メーカー
                      </p>
                      <p className="text-xs text-slate-400 lg:text-slate-600">
                        近くのスポットを探して、今いる場所を共有しよう
                      </p>
                    </div>
                    <span className="text-emerald-400/60 lg:text-emerald-600/60 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                      →
                    </span>
                  </div>
                </a>
              </div>
            )}
          </>
        )}

        {/* ----- 定期開催タブ ----- */}
        {tab === "recurring" && (
          <>
            {recurringLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-5 h-5 border-2 border-slate-700 border-t-[var(--accent)] rounded-full animate-spin" />
              </div>
            ) : recurringEvents.length === 0 ? (
              <p className="text-center text-slate-500 py-20 text-sm">定期開催イベントがありません</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {recurringEvents.map((ev) => <RecurringCard key={ev.id} ev={ev} />)}
              </ul>
            )}
          </>
        )}

      </main>

      {/* ===== エントリモーダル ===== */}
      {entryModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => { setEntryModalOpen(false); setGeoLoading(false); }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border-card)] rounded-t-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white lg:text-slate-900">どこから探す？</h2>
              <button
                onClick={() => { setEntryModalOpen(false); setGeoLoading(false); }}
                className="text-slate-400 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-emerald-400">今いる場所でオフ会になるかも？</p>

            <button
              onClick={() => {
                if (!navigator.geolocation) {
                  router.push('/spots');
                  return;
                }
                setGeoLoading(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setGeoLoading(false);
                    router.push(`/spots?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
                  },
                  () => {
                    setGeoLoading(false);
                    router.push('/spots');
                  },
                  { timeout: 10000 }
                );
              }}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {geoLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  取得中...
                </>
              ) : '📍 現在地周辺のスポットを見る'}
            </button>

            <button
              onClick={() => router.push('/spots')}
              className="w-full py-3 rounded-xl border border-slate-600/50 text-slate-400 text-sm hover:bg-slate-800/30 transition-colors"
            >
              🗾 全国のスポットを見る
            </button>

            <button
              onClick={() => { setEntryModalOpen(false); setGeoLoading(false); }}
              className="w-full text-sm text-[var(--text-sub)] py-2 hover:text-[var(--text-main)] transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ===== 投稿モーダル（ボトムシート） ===== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => { setModalOpen(false); setSubmitText(""); setSubmitResult(""); }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border-card)] rounded-t-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white lg:text-slate-900">イベントを投稿する</h2>
              <button
                onClick={() => { setModalOpen(false); setSubmitText(""); setSubmitResult(""); }}
                className="text-slate-400 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-[var(--text-sub)]">
              SNSの告知文やイベント情報をそのままコピペするだけでOKです。AIが自動解析して登録します。
            </p>

            {submitResult === "success" ? (
              <p className="text-center text-emerald-400 font-medium py-6">✅ 投稿を受け付けました</p>
            ) : (
              <>
                <textarea
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  rows={6}
                  placeholder={`例）\n【ロードスターミーティング】\n日時：4月20日（日）10:00〜\n場所：道の駅 富士川楽座（静岡県富士市）\n対象：ロードスター全型式\n参加費：無料・事前申込不要`}
                  className="w-full text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-white lg:text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
                />
                {submitResult === "error" && (
                  <p className="text-sm text-red-400">{submitError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalOpen(false); setSubmitText(""); setSubmitResult(""); }}
                    className="flex-1 text-sm text-[var(--text-sub)] border border-[var(--border-card)] rounded-lg py-2.5 hover:bg-[var(--bg-input)] transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !submitText.trim()}
                    className="flex-1 text-sm bg-sky-600 text-white font-medium rounded-lg py-2.5 hover:bg-sky-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting && (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    送信する
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== フッター ===== */}
      <footer className="max-w-2xl lg:max-w-screen-xl mx-auto px-4 py-8 text-center space-y-1">
        <p className="text-sm font-semibold text-slate-500">2輪4輪 offmap</p>
        <p className="text-xs text-slate-600">© 2026 24offmap.jp · 情報の正確性は保証しません</p>
        <div className="flex justify-center gap-4">
          <a
            href="/contact"
            className="text-xs text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
          >
            掲載削除・修正依頼
          </a>
          <a
            href="/contact"
            className="text-xs text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
          >
            お問い合わせ
          </a>
        </div>
      </footer>

    </div>
  );
}
