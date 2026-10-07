import { NextResponse } from "next/server";
import {
  getMeta,
  getComments,
  commentsToText,
  explainYtdlpError,
} from "@/lib/ytdlp";
import { extractRecipe, type ExtractedRecipe } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { normalizeUrl } from "@/lib/utils";
import { parseHttpUrl } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const t0 = Date.now();
const lap = (s: string) =>
  console.log(`[import] ${s}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const body = await req.json();
    const url = parseHttpUrl(String(body.url ?? ""));
    if (!url) {
      return NextResponse.json(
        { error: "Zkontrolujte odkaz: nevypadá jako platná webová adresa." },
        { status: 400 },
      );
    }

    let meta;
    try {
      meta = await getMeta(url);
    } catch (e) {
      // plný výpis zůstane v terminálu pro ladění, uživatel dostane srozumitelnou větu
      console.error(
        "[import] yt-dlp selhal:",
        (e as { stderr?: string }).stderr ?? e,
      );
      const { message, status } = explainYtdlpError(e);
      return NextResponse.json({ error: message }, { status });
    }

    const baseText = `Název videa: ${meta.title}\n\nPopisek:\n${meta.description}`;
    let recipe: ExtractedRecipe | null = null;
    let usedComments = false;

    // 1) popisek
    if (meta.description.trim().length > 40) {
      recipe = await extractRecipe(baseText);
    }

    // 2) komentáře (jen když popisek nestačil)
    if (!recipe || !recipe.complete) {
      let block = "";
      try {
        block = commentsToText(await getComments(url));
      } catch {
        // platforma komentáře nepodporuje nebo je blokuje, pokračujeme dál
      }
      if (block) {
        const withComments = await extractRecipe(
          `${baseText}\n\nKomentáře pod videem:\n${block}`,
        );
        if (withComments.complete || !recipe) {
          recipe = withComments;
          usedComments = withComments.complete;
        }
      }
    }

    // 3) nic nepomohlo: uložíme prázdný koncept s odkazem
    const final: ExtractedRecipe = recipe ?? {
      complete: false,
      title: meta.title,
      servings: null,
      time_minutes: null,
      ingredients: [],
      steps: [],
      tags: [],
    };

    console.log("[import]", {
      platform: meta.platform,
      usedComments,
      complete: final.complete,
    });

    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: final.title || meta.title || "Bez názvu",
        source_url: url,
        platform: meta.platform,
        thumbnail_url: meta.thumbnail,
        servings: final.servings,
        time_minutes: final.time_minutes,
        ingredients: final.ingredients,
        steps: final.steps,
        tags: final.tags,
        is_complete: final.complete,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({
      id: data.id,
      complete: final.complete,
      usedComments,
    });
  } catch (e) {
    console.error("[import] chyba:", e);
  const message = e instanceof Error ? e.message : "Neznámá chyba";
  return NextResponse.json({ error: message }, { status: 500 });
  }
}
