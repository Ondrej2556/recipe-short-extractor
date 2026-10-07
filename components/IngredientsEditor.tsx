"use client";

import type { Ingredient } from "@/lib/types";

export type EditRow = { amount: string; unit: string; name: string };
export type EditGroup = { key: number; name: string; rows: EditRow[] };

const emptyRow = (): EditRow => ({ amount: "", unit: "", name: "" });

export function toEditGroups(ings: Ingredient[]): EditGroup[] {
  const map = new Map<string, EditRow[]>();
  ings.forEach((i) => {
    const k = i.group?.trim() || "";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push({
      amount: i.amount ?? "",
      unit: i.unit ?? "",
      name: i.name,
    });
  });
  const result = [...map.entries()].map(([name, rows], idx) => ({
    key: idx + 1,
    name,
    rows,
  }));
  return result.length ? result : [{ key: 1, name: "", rows: [emptyRow()] }];
}

export function fromEditGroups(groups: EditGroup[]): Ingredient[] {
  return groups.flatMap((g) =>
    g.rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        amount: r.amount.trim() || null,
        unit: r.unit.trim() || null,
        group: g.name.trim() || null,
      }))
  );
}

const cell =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

export default function IngredientsEditor({
  groups,
  onChange,
}: {
  groups: EditGroup[];
  onChange: (groups: EditGroup[]) => void;
}) {
  function patchGroup(gi: number, patch: Partial<EditGroup>) {
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }

  function patchRow(gi: number, ri: number, patch: Partial<EditRow>) {
    onChange(
      groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              rows: g.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)),
            }
          : g
      )
    );
  }

  function addRow(gi: number) {
    patchGroup(gi, { rows: [...groups[gi].rows, emptyRow()] });
  }

  function removeRow(gi: number, ri: number) {
    patchGroup(gi, { rows: groups[gi].rows.filter((_, j) => j !== ri) });
  }

  function removeGroup(gi: number) {
    const g = groups[gi];
    const hasContent = g.rows.some((r) => r.name.trim());
    if (hasContent && !confirm("Smazat celou část včetně surovin?")) return;
    onChange(groups.filter((_, i) => i !== gi));
  }

  function addGroup() {
    const key = Math.max(0, ...groups.map((g) => g.key)) + 1;
    onChange([...groups, { key, name: "", rows: [emptyRow()] }]);
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, gi) => (
        <div key={g.key} className="rounded-2xl bg-emerald-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <input
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-emerald-900 outline-none placeholder:font-normal placeholder:text-gray-400 hover:border-emerald-200 focus:border-emerald-500 focus:bg-white"
              placeholder="Název části (např. Omáčka), nebo nech prázdné"
              value={g.name}
              onChange={(e) => patchGroup(gi, { name: e.target.value })}
            />
            {groups.length > 1 && (
              <button
                onClick={() => removeGroup(gi)}
                className="shrink-0 text-sm text-red-500 hover:text-red-700"
              >
                Smazat část
              </button>
            )}
          </div>

          <div className="grid grid-cols-[5rem_6rem_1fr_2rem] gap-x-2 gap-y-2">
            <span className="px-1 text-xs text-gray-500">Množství</span>
            <span className="px-1 text-xs text-gray-500">Jednotka</span>
            <span className="px-1 text-xs text-gray-500">Surovina</span>
            <span />

            {g.rows.map((r, ri) => (
              <div key={ri} className="contents">
                <input
                  className={cell}
                  placeholder="1"
                  value={r.amount}
                  onChange={(e) => patchRow(gi, ri, { amount: e.target.value })}
                />
                <input
                  className={cell}
                  placeholder="lžíce"
                  value={r.unit}
                  onChange={(e) => patchRow(gi, ri, { unit: e.target.value })}
                />
                <input
                  className={cell}
                  placeholder="olivový olej"
                  value={r.name}
                  onChange={(e) => patchRow(gi, ri, { name: e.target.value })}
                />
                <button
                  onClick={() => removeRow(gi, ri)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Odebrat surovinu"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => addRow(gi)}
            className="mt-3 text-sm font-medium text-emerald-700 underline"
          >
            + Přidat surovinu
          </button>
        </div>
      ))}

      <button
        onClick={addGroup}
        className="self-start rounded-xl border border-dashed border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
      >
        + Přidat další část receptu
      </button>
    </div>
  );
}