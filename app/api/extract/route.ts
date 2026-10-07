import { NextResponse } from "next/server";
import { extractRecipe } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Chybí text" }, { status: 400 });
    }
    const recipe = await extractRecipe(text);
    return NextResponse.json(recipe);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}