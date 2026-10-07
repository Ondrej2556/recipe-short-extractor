"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { normalizeUrl } from "@/lib/utils";
import Thumb from "@/components/Thumb";
import Stars from "@/components/Stars";
import IngredientsEditor, {
  toEditGroups,
  fromEditGroups,
  type EditGroup,
} from "@/components/IngredientsEditor";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui";
import type { Recipe, Ingredient } from "@/lib/types";

const todayLocal = () => new Date().toLocaleDateString("sv-SE"); // RRRR-MM-DD
const labelCls = "flex flex-col gap-1 text-sm font-medium text-gray-700";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [editGroups, setEditGroups] = useState<EditGroup[]>([]);
  const [tagsText, setTagsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();
      if (error) setMessage({ text: error.message, ok: false });
      else setRecipe(data as Recipe);
      setLoading(false);
    }
    load();
  }, [id]);

  // ingredience seskupené podle "group" (pořadí podle prvního výskytu)
  const groups = useMemo(() => {
    const map = new Map<string, { ing: Ingredient; idx: number }[]>();
    recipe?.ingredients.forEach((ing, idx) => {
      const key = ing.group?.trim() || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ ing, idx });
    });
    return [...map.entries()];
  }, [recipe]);

  function flash(text: string, ok = true) {
    setMessage({ text, ok });
    if (ok) setTimeout(() => setMessage(null), 2000);
  }

  // okamžité uložení z režimu čtení (hodnocení, stav)
  async function quickSave(patch: Partial<Recipe>) {
    if (!recipe) return;
    const prev = recipe;
    setRecipe({ ...recipe, ...patch });
    const { error } = await supabase
      .from("recipes")
      .update(patch)
      .eq("id", recipe.id);
    if (error) {
      setRecipe(prev);
      flash(error.message, false);
    } else {
      flash("Uloženo ✓");
    }
  }

  function toggleChecked(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function startEdit() {
    if (!recipe) return;
    setDraft({ ...recipe });
    setEditGroups(toEditGroups(recipe.ingredients));
    setTagsText(recipe.tags.join(", "));
    setStepsText(recipe.steps.join("\n"));
    setEditing(true);
    setMessage(null);
  }

  function upd<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function saveEdit() {
    if (!draft) return;
    const ingredients = fromEditGroups(editGroups);
    const steps = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);

    const payload = {
      title: draft.title.trim() || "Bez názvu",
      thumbnail_url: draft.thumbnail_url?.trim() || null,
      servings: draft.servings,
      time_minutes: draft.time_minutes,
      ingredients,
      steps,
      tags,
      rating: draft.rating,
      status: draft.status,
      notes: draft.notes?.trim() || null,
      last_cooked_at: draft.last_cooked_at || null,
      is_complete: ingredients.length > 0 && steps.length > 0,
    };

    const { error } = await supabase
      .from("recipes")
      .update(payload)
      .eq("id", draft.id);
    if (error) {
      flash(error.message, false);
      return;
    }
    setRecipe({ ...draft, ...payload });
    setChecked(new Set());
    setEditing(false);
    flash("Uloženo ✓");
  }

  async function removeRecipe() {
    if (!recipe || !confirm("Opravdu smazat tento recept?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) flash(error.message, false);
    else router.push("/");
  }

  if (loading)
    return <main className="mx-auto max-w-5xl p-6 text-gray-500">Načítám…</main>;

  if (!recipe)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-3 text-gray-700">
          {message?.text ?? "Recept nenalezen."}
        </p>
        <Link href="/" className="text-emerald-700 underline">
          ← Zpět na seznam
        </Link>
      </main>
    );

  const banner = message && (
    <p
      className={`mt-4 rounded-xl p-3 text-sm ${
        message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      {message.text}
    </p>
  );

  /* ======================= REŽIM ÚPRAV ======================= */
  if (editing && draft) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Úprava receptu</h1>

        <div className="flex flex-col gap-5 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <label className={labelCls}>
            Název
            <input
              className={inputCls}
              value={draft.title}
              onChange={(e) => upd("title", e.target.value)}
            />
          </label>

          <label className={labelCls}>
            Odkaz na obrázek (volitelné)
            <input
              className={inputCls}
              placeholder="https://…"
              value={draft.thumbnail_url ?? ""}
              onChange={(e) => upd("thumbnail_url", e.target.value || null)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">
                Hodnocení
              </div>
              <Stars
                value={draft.rating}
                onChange={(n) => upd("rating", n)}
                className="text-3xl"
              />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">Stav</div>
              <div className="flex gap-2">
                {(["to_try", "tried"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      upd("status", s);
                      if (s === "tried" && !draft.last_cooked_at)
                        upd("last_cooked_at", todayLocal());
                    }}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      draft.status === s
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    {s === "tried" ? "Vyzkoušeno" : "Chci vyzkoušet"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              Čas (min)
              <input
                type="number"
                className={inputCls}
                value={draft.time_minutes ?? ""}
                onChange={(e) =>
                  upd("time_minutes", e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
            <label className={labelCls}>
              Porce
              <input
                type="number"
                className={inputCls}
                value={draft.servings ?? ""}
                onChange={(e) =>
                  upd("servings", e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
            <label className={labelCls}>
              Naposledy uvařeno
              <input
                type="date"
                className={inputCls}
                value={draft.last_cooked_at ?? ""}
                onChange={(e) => upd("last_cooked_at", e.target.value || null)}
              />
            </label>
          </div>

          <label className={labelCls}>
            Tagy (oddělené čárkou)
            <input
              className={inputCls}
              placeholder="kuřecí, rychlé, sladké"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </label>

          {/* Ingredience po částech */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Ingredience
            </h2>
            <IngredientsEditor groups={editGroups} onChange={setEditGroups} />
          </div>

          <label className={labelCls}>
            Postup (jeden krok na řádek)
            <textarea
              className={`${inputCls} h-44`}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </label>

          <label className={labelCls}>
            Poznámky
            <textarea
              className={`${inputCls} h-24`}
              placeholder="Např. příště méně soli"
              value={draft.notes ?? ""}
              onChange={(e) => upd("notes", e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-emerald-100 pt-5">
            <button onClick={saveEdit} className={btnPrimary}>
              Uložit
            </button>
            <button onClick={() => setEditing(false)} className={btnGhost}>
              Zrušit
            </button>
            <button
              onClick={removeRecipe}
              className="ml-auto rounded-xl border border-red-200 px-5 py-2.5 font-medium text-red-600 transition hover:bg-red-50"
            >
              Smazat recept
            </button>
          </div>
          {banner}
        </div>
      </main>
    );
  }

  /* ======================= REŽIM ČTENÍ ======================= */
  const tried = recipe.status === "tried";
  const meta = [
    recipe.time_minutes ? `⏱ ${recipe.time_minutes} min` : null,
    recipe.servings
      ? `🍽 ${recipe.servings} ${recipe.servings <= 4 ? "porce" : "porcí"}`
      : null,
    recipe.last_cooked_at
      ? `Naposledy uvařeno ${new Date(recipe.last_cooked_at).toLocaleDateString("cs-CZ")}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        ← Všechny recepty
      </Link>

      {/* Hlavička receptu */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm md:flex">
        <div className="relative h-56 md:h-auto md:w-80 md:shrink-0">
          <Thumb
            key={recipe.thumbnail_url ?? "none"}
            src={recipe.thumbnail_url}
            alt={recipe.title}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <div className="flex flex-1 flex-col gap-4 p-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {recipe.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Stars
                value={recipe.rating}
                onChange={(n) => quickSave({ rating: n })}
                className="text-2xl"
              />
              <span
                className={`rounded-full px-3 py-0.5 text-sm font-medium ${
                  tried
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {tried ? "Vyzkoušeno" : "Chci vyzkoušet"}
              </span>
            </div>
          </div>

          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                quickSave({ status: "tried", last_cooked_at: todayLocal() })
              }
              className={btnPrimary}
            >
              Uvařeno dnes ✓
            </button>
            <button onClick={startEdit} className={btnGhost}>
              Upravit
            </button>
            {recipe.source_url && (
              <a
                href={normalizeUrl(recipe.source_url) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={btnGhost}
              >
                Původní video ↗
              </a>
            )}
            {tried && (
              <button
                onClick={() => quickSave({ status: "to_try" })}
                className="text-sm text-gray-500 underline"
              >
                Vrátit mezi „chci vyzkoušet“
              </button>
            )}
          </div>
          {banner}
        </div>
      </section>

      {!recipe.is_complete && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          AI v popisku ani komentářích nenašla celý recept. Doplň ho podle videa
          (tlačítko Upravit).
        </p>
      )}

      {/* Ingredience + postup */}
      <div className="mt-8 grid gap-8 md:grid-cols-5">
        <section className="md:col-span-2">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Ingredience
          </h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-gray-500">
              Zatím žádné ingredience. Klikni na Upravit.
            </p>
          ) : (
            <div className="flex flex-col gap-5 rounded-2xl bg-emerald-50/60 p-4">
              {groups.map(([group, items]) => (
                <div key={group || "_"}>
                  {group && (
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-emerald-800">
                      {group}
                    </h3>
                  )}
                  <ul>
                    {items.map(({ ing, idx }) => (
                      <li key={idx}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white">
                          <input
                            type="checkbox"
                            checked={checked.has(idx)}
                            onChange={() => toggleChecked(idx)}
                            className="mt-1 h-4 w-4 accent-emerald-600"
                          />
                          <span
                            className={
                              checked.has(idx)
                                ? "text-gray-400 line-through"
                                : "text-gray-800"
                            }
                          >
                            {(ing.amount || ing.unit) && (
                              <b className="font-semibold">
                                {[ing.amount, ing.unit].filter(Boolean).join(" ")}{" "}
                              </b>
                            )}
                            {ing.name}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="md:col-span-3">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">Postup</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-sm text-gray-500">
              Zatím žádný postup. Klikni na Upravit.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-gray-800">{s}</p>
                </li>
              ))}
            </ol>
          )}

          {recipe.notes && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-emerald-900">
                Moje poznámky
              </h3>
              <p className="whitespace-pre-wrap text-gray-800">{recipe.notes}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}