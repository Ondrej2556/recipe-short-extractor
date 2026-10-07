import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

export function parseBackup(text: string): Row[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Soubor není platný JSON.");
  }

  const list = Array.isArray(data)
    ? data
    : (data as { recipes?: unknown } | null)?.recipes;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("V souboru nejsou žádné recepty.");
  }

  return list.map((raw, i) => {
    const r = (raw ?? {}) as Row;
    if (typeof r.title !== "string" || !r.title.trim()) {
      throw new Error(`Recept č. ${i + 1} nemá název, soubor nevypadá jako záloha.`);
    }
    const rating = num(r.rating);
    return {
      id: str(r.id) ?? crypto.randomUUID(),
      title: r.title.trim(),
      source_url: str(r.source_url),
      platform: str(r.platform),
      thumbnail_url: str(r.thumbnail_url),
      servings: num(r.servings),
      time_minutes: num(r.time_minutes),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
      tags: Array.isArray(r.tags) ? r.tags : [],
      rating: rating && rating >= 1 && rating <= 5 ? rating : null,
      status: r.status === "tried" ? "tried" : "to_try",
      notes: str(r.notes),
      last_cooked_at: str(r.last_cooked_at),
      is_complete: r.is_complete !== false,
      created_at: str(r.created_at) ?? new Date().toISOString(),
    };
  });
}

export async function restoreRecipes(
  rows: Row[],
  onProgress?: (done: number, total: number) => void
) {
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from("recipes")
      .upsert(batch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    onProgress?.(Math.min(i + 100, rows.length), rows.length);
  }
}