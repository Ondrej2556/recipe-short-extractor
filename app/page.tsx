"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeUrl, normalizeText, parseHttpUrl } from "@/lib/utils";
import RecipeCard from "@/components/RecipeCard";
import { inputCls, selectCls, btnPrimary, btnGhost } from "@/components/ui";
import { parseBackup, restoreRecipes } from "@/lib/backup";
import type { Recipe } from "@/lib/types";

const PAGE_SIZE = 20;
const MAX_TAGS = 10;

type StatusFilter = "all" | "to_try" | "tried";
type SortKey = "newest" | "rating" | "cooked" | "name";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

export default function Home() {
  const router = useRouter();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagCounts, setTagCounts] = useState<[string, number][]>([]);

  // přidání / import
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // filtry
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [minRating, setMinRating] = useState(0);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");

  //Export / restore
  const [restoring, setRestoring] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      let q = supabase.from("recipes").select("*", { count: "exact" });

      if (status !== "all") q = q.eq("status", status);
      if (minRating > 0) q = q.gte("rating", minRating);
      if (activeTags.length) q = q.contains("tags", activeTags);

      const words = normalizeText(debouncedQuery).split(/\s+/).filter(Boolean);
      for (const w of words) q = q.ilike("search_text", `%${escapeLike(w)}%`);

      switch (sort) {
        case "rating":
          q = q
            .order("rating", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          break;
        case "cooked":
          q = q
            .order("last_cooked_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          break;
        case "name":
          q = q
            .order("title", { ascending: true })
            .order("created_at", { ascending: false });
          break;
        default:
          q = q.order("created_at", { ascending: false });
      }

      const { data, error, count } = await q.range(
        offset,
        offset + PAGE_SIZE - 1,
      );

      if (id !== requestId.current) return;

      if (error) {
        setError(error.message);
      } else {
        setError(null);
        setTotal(count ?? 0);
        const rows = data as Recipe[];
        setRecipes((prev) =>
          offset === 0
            ? rows
            : [
                ...prev,
                ...rows.filter((r) => !prev.some((p) => p.id === r.id)),
              ],
        );
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [debouncedQuery, status, minRating, activeTags, sort],
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const loadTags = useCallback(async () => {
    const { data } = await supabase.from("recipes").select("tags");
    const counts = new Map<string, number>();
    (data ?? []).forEach((r: { tags: string[] }) =>
      r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
    );
    setTagCounts(
      [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs"),
      ),
    );
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const topTags = tagCounts.slice(0, MAX_TAGS).map(([t]) => t);
  const visibleTags = [
    ...topTags,
    ...activeTags.filter((t) => !topTags.includes(t)),
  ];

  async function onRestoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // umožní vybrat stejný soubor znovu
    if (!file) return;
    setError(null);
    try {
      const rows = parseBackup(await file.text());
      if (
        !confirm(
          `Obnovit ${rows.length} receptů ze zálohy?\n\nRecepty se stejným ID se přepíšou verzí ze zálohy. Ostatní recepty zůstanou beze změny.`,
        )
      )
        return;
      setRestoring(`Obnovuji 0 / ${rows.length}…`);
      await restoreRecipes(rows, (done, total) =>
        setRestoring(`Obnovuji ${done} / ${total}…`),
      );
      await fetchPage(0);
      await loadTags();
      alert(`Obnoveno ${rows.length} receptů.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Obnova selhala");
    } finally {
      setRestoring(null);
    }
  }

  async function addRecipe() {
    if (!title.trim()) return;
    if (!parseHttpUrl(url)) {
      setError("Zkontrolujte odkaz: nevypadá jako platná webová adresa.");
      return;
    }
    const { error } = await supabase
      .from("recipes")
      .insert({ title: title.trim(), source_url: normalizeUrl(url) });
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setUrl("");
    setShowManual(false);
    fetchPage(0);
    loadTags();
  }

  async function importRecipe() {
    if (!url.trim() || importing) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import selhal");
      setUrl("");
      router.push(`/recipe/${data.id}`);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Spojení se serverem se přerušilo. Zkontrolujte, že běží npm run dev, a zkuste to znovu."
          : e instanceof Error
            ? e.message
            : "Import selhal",
      );
    } finally {
      setImporting(false);
    }
  }

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function resetFilters() {
    setQuery("");
    setDebouncedQuery("");
    setStatus("all");
    setMinRating(0);
    setActiveTags([]);
    setSort("newest");
  }

  const filtersActive =
    query || status !== "all" || minRating > 0 || activeTags.length > 0;
  const hasMore = recipes.length < total;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Hlavička */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-sm">
          🥗
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Moje kuchařka
        </h1>
        <div className="ml-auto flex gap-2">
          <a href="/api/export" className={`${btnGhost} px-4! py-2! text-sm`}>
            Stáhnout zálohu
          </a>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={!!restoring}
            className={`${btnGhost} px-4! py-2! text-sm`}
          >
            {restoring ?? "Obnovit ze zálohy"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={onRestoreFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Přidání */}
      <section className="mb-8 rounded-2xl bg-emerald-50 p-5">
        <h2 className="mb-3 font-semibold text-emerald-900">Přidat recept</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Vlož odkaz na video (YouTube, TikTok, Instagram…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && importRecipe()}
          />
          <button
            onClick={importRecipe}
            disabled={importing || !url.trim()}
            className={btnPrimary}
          >
            {importing ? "Importuji…" : "Importovat"}
          </button>
        </div>
        {importing && (
          <p className="mt-2 text-sm text-emerald-800">
            AI čte popisek a komentáře, může to chvíli trvat.
          </p>
        )}

        <button
          onClick={() => setShowManual((v) => !v)}
          className="mt-3 text-sm text-emerald-700 underline"
        >
          {showManual ? "Skrýt ruční přidání" : "Nebo přidat ručně bez importu"}
        </button>

        {showManual && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Název receptu (odkaz se vezme z pole výše)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRecipe()}
            />
            <button
              onClick={addRecipe}
              disabled={!title.trim()}
              className={btnGhost}
            >
              Uložit
            </button>
          </div>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Hledání a filtry */}
      <section className="mb-6 flex flex-col gap-3">
        <input
          className={inputCls}
          placeholder="🔍  Hledat v názvu, surovinách, tagech a poznámkách…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <select
            className={selectCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">Všechny stavy</option>
            <option value="to_try">Chci vyzkoušet</option>
            <option value="tried">Vyzkoušeno</option>
          </select>

          <select
            className={selectCls}
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
          >
            <option value={0}>Jakékoli hodnocení</option>
            <option value={3}>★ 3 a víc</option>
            <option value={4}>★ 4 a víc</option>
            <option value={5}>★ 5</option>
          </select>

          <select
            className={selectCls}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Nejnovější</option>
            <option value="rating">Nejlépe hodnocené</option>
            <option value="cooked">Naposledy uvařené</option>
            <option value="name">Podle abecedy</option>
          </select>
        </div>

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  activeTags.includes(tag)
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {loading ? "Načítám…" : `Zobrazeno ${recipes.length} z ${total}`}
          </span>
          {filtersActive && (
            <button
              onClick={resetFilters}
              className="font-medium text-emerald-700 underline"
            >
              Zrušit filtry
            </button>
          )}
        </div>
      </section>

      {/* Dlaždice */}
      {loading && recipes.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-4/5 animate-pulse rounded-2xl bg-emerald-50"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          {filtersActive
            ? "Žádný recept neodpovídá filtrům."
            : "Zatím tu nic není. Vlož první odkaz nahoře."}
        </p>
      ) : (
        <>
          <div
            className={`grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
              loading ? "opacity-50" : ""
            }`}
          >
            {recipes.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => fetchPage(recipes.length)}
                disabled={loadingMore}
                className={btnGhost}
              >
                {loadingMore
                  ? "Načítám…"
                  : `Načíst další (zbývá ${total - recipes.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
