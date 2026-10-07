"use client";

import { useState } from "react";

export default function TestPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult("");
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setResult(JSON.stringify(await res.json(), null, 2));
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Test Gemini</h1>
      <textarea
        className="mb-2 h-48 w-full rounded border p-2"
        placeholder="Vlož popisek videa nebo text receptu (klidně anglicky)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={run}
        disabled={busy || !text.trim()}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Zpracovávám…" : "Vytáhnout recept"}
      </button>
      <pre className="mt-4 overflow-auto rounded bg-gray-100 p-3 text-sm">
        {result}
      </pre>
    </main>
  );
}