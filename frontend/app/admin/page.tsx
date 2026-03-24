"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "carmap2026";

type TopItem = { value: string; count: number };
type SourceCount = { source_site: string; count: number };
type CrawlLog = {
  id: number;
  executed_at: string;
  site_name: string;
  new_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  // ダッシュボードデータ
  const [topFreewords, setTopFreewords] = useState<TopItem[]>([]);
  const [topVehicles, setTopVehicles] = useState<TopItem[]>([]);
  const [topPrefectures, setTopPrefectures] = useState<TopItem[]>([]);
  const [sourceCounts, setSourceCounts] = useState<SourceCount[]>([]);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("admin_authed") === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLoadingData(true);
    Promise.all([
      loadTopItems("freeword"),
      loadTopItems("vehicle"),
      loadTopItems("prefecture"),
      loadSourceCounts(),
      loadCrawlLogs(),
    ]).finally(() => setLoadingData(false));
  }, [authed]);

  async function loadTopItems(column: string): Promise<TopItem[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("search_logs")
      .select(column)
      .not(column, "is", null)
      .gte("searched_at", since);
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const row of data) {
      const v = (row as unknown as Record<string, string>)[column];
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    }
    const items = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    if (column === "freeword") setTopFreewords(items);
    if (column === "vehicle")  setTopVehicles(items);
    if (column === "prefecture") setTopPrefectures(items);
    return items;
  }

  async function loadSourceCounts() {
    const { data } = await supabase
      .from("events")
      .select("source_site")
      .not("source_site", "is", null);
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data) {
      const s = row.source_site as string;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    const items = Object.entries(counts)
      .map(([source_site, count]) => ({ source_site, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    setSourceCounts(items);
  }

  async function loadCrawlLogs() {
    const { data } = await supabase
      .from("crawl_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(20);
    setCrawlLogs(data || []);
  }

  function handleLogin() {
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_authed", "1");
      setAuthed(true);
    } else {
      setError("パスワードが違います");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-zinc-200 px-8 py-8 w-80 space-y-4">
          <h1 className="text-lg font-semibold text-zinc-800">管理者ログイン</h1>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="パスワード"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white text-sm font-medium rounded-lg py-2 hover:bg-blue-700"
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  const maxSourceCount = sourceCounts[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-800">管理者ダッシュボード</h1>
      </header>

      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
        </div>
      ) : (
        <main className="max-w-4xl mx-auto px-6 py-6 space-y-8">

          {/* 検索ログ集計 */}
          <section>
            <h2 className="text-base font-semibold text-zinc-700 mb-3">検索ログ集計（過去7日）</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TopTable title="フリーワード TOP10" items={topFreewords} />
              <TopTable title="車種フィルタ TOP10" items={topVehicles} />
              <TopTable title="エリアフィルタ TOP10" items={topPrefectures} />
            </div>
          </section>

          {/* ソース別イベント件数 */}
          <section>
            <h2 className="text-base font-semibold text-zinc-700 mb-3">ソース別イベント件数</h2>
            <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4 space-y-2">
              {sourceCounts.map((s) => (
                <div key={s.source_site} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600 w-40 flex-shrink-0 truncate">{s.source_site}</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-400 h-3 rounded-full"
                      style={{ width: `${Math.round((s.count / maxSourceCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-10 text-right flex-shrink-0">{s.count}件</span>
                </div>
              ))}
              {sourceCounts.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-4">データなし</p>
              )}
            </div>
          </section>

          {/* クロールログ */}
          <section>
            <h2 className="text-base font-semibold text-zinc-700 mb-3">クロールログ（直近20件）</h2>
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">実行日時</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">サイト名</th>
                    <th className="px-3 py-2 text-right text-zinc-500 font-medium">新規</th>
                    <th className="px-3 py-2 text-right text-zinc-500 font-medium">更新</th>
                    <th className="px-3 py-2 text-right text-zinc-500 font-medium">スキップ</th>
                    <th className="px-3 py-2 text-center text-zinc-500 font-medium">エラー</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {crawlLogs.map((log) => (
                    <tr key={log.id} className={log.error_message ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                        {new Date(log.executed_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{log.site_name}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{log.new_count}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{log.updated_count}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{log.skipped_count}</td>
                      <td className="px-3 py-2 text-center">
                        {log.error_message ? (
                          <span className="text-red-500" title={log.error_message}>✕</span>
                        ) : (
                          <span className="text-green-500">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {crawlLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">データなし</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}

function TopTable({ title, items }: { title: string; items: TopItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
      <h3 className="text-xs font-semibold text-zinc-500 mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2">データなし</p>
      ) : (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li key={item.value} className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400 w-4">{i + 1}.</span>
              <span className="text-xs text-zinc-700 flex-1 truncate">{item.value}</span>
              <span className="text-xs text-zinc-400">{item.count}回</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
