import { GoogleGenAI, Type } from "@google/genai";

export type ExtractedRecipe = {
  complete: boolean;
  title: string;
  servings: number | null;
  time_minutes: number | null;
  ingredients: {
    name: string;
    amount?: string | null;
    unit?: string | null;
    group?: string | null;
  }[];
  steps: string[];
  tags: string[];
};

const schema = {
  type: Type.OBJECT,
  properties: {
    complete: { type: Type.BOOLEAN },
    title: { type: Type.STRING },
    servings: { type: Type.INTEGER, nullable: true },
    time_minutes: { type: Type.INTEGER, nullable: true },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING, nullable: true },
          unit: { type: Type.STRING, nullable: true },
          group: { type: Type.STRING, nullable: true },
        },
        required: ["name", "group"],
      },
    },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["complete", "title", "ingredients", "steps", "tags"],
};

const SYSTEM_PROMPT = `Jsi asistent, který z textu (popisek videa, komentáře pod videem) sestaví recept.
Pravidla:
- Výstup piš česky, i když je zdroj v jiném jazyce (přelož ho).
- Nic si nevymýšlej. Pokud množství suroviny není uvedeno, nech amount i unit prázdné (null).
- Jednotky převáděj na běžné české (g, ml, lžíce, lžička, ks).
- Kroky postupu piš stručně, jeden krok = jedna položka.
- "tags": 2 až 5 krátkých českých štítků malými písmeny. Popisují jídlo (hlavní surovina, druh jídla, kuchyně, rychlost), ne formu nebo vlastnosti receptu.
- "complete": true jen tehdy, pokud text obsahuje seznam surovin I postup. Jinak false.
- Pokud to vůbec není recept, vrať complete=false a prázdné seznamy.
- Text může obsahovat komentáře pod videem. Recept se často nachází v připnutém komentáři nebo v komentáři autora. Použij jen komentáře, které obsahují recept nebo jeho část, ostatní (reakce, otázky, reklamy) ignoruj.
- "time_minutes" vyplň jen tehdy, pokud je čas v textu uvedený. Neodhaduj ho.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CALL_TIMEOUT_MS = 45_000;

class TimeoutError extends Error {
  constructor(ms: number) {
    super(
      `AI (Gemini) neodpověděla do ${ms / 1000} s. Zkuste to prosím za chvíli znovu.`
    );
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(ms)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function isTemporary(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET|ETIMEDOUT/.test(
    msg
  );
}

export async function extractRecipe(text: string): Promise<ExtractedRecipe> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Chybí GEMINI_API_KEY v .env.local");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const models = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    process.env.GEMINI_FALLBACK_MODEL,
  ].filter((m): m is string => Boolean(m));

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: text,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.2,
            },
          }),
          CALL_TIMEOUT_MS
        );
        return JSON.parse(response.text ?? "{}") as ExtractedRecipe;
      } catch (e) {
        const timedOut = e instanceof TimeoutError;
        if (!lastError || isTemporary(e) || timedOut) lastError = e;
        if (timedOut) break; // stejný model už nezkoušíme, přejde se na záložní
        if (!isTemporary(e)) {
          // špatný název záložního modelu nemá shodit celý import
          if (model !== models[0]) break;
          throw e;
        }
        await sleep(2000 * (attempt + 1));
      }
    }
  }
  throw lastError;
}