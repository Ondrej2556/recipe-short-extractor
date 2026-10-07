import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) return new Response(error.message, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // search_text se plní automaticky triggerem, do zálohy ho nedáváme
  const recipes = rows.map((r) => {
    const copy = { ...r };
    delete copy.search_text;
    return copy;
  });

  const date = new Date().toLocaleDateString("sv-SE");
  return new Response(
    JSON.stringify(
      { exported_at: new Date().toISOString(), count: recipes.length, recipes },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="kucharka-zaloha-${date}.json"`,
      },
    }
  );
}