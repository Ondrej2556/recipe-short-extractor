import Link from "next/link";
import Thumb from "./Thumb";
import Stars from "./Stars";
import type { Recipe } from "@/lib/types";

export default function RecipeCard({ r }: { r: Recipe }) {
  const tried = r.status === "tried";
  return (
    <Link
      href={`/recipe/${r.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Thumb
          key={r.thumbnail_url ?? "none"}
          src={r.thumbnail_url}
          alt={r.title}
          className="h-full w-full transition duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm ${
            tried ? "bg-emerald-600 text-white" : "bg-white/90 text-gray-700"
          }`}
        >
          {tried ? "Vyzkoušeno" : "Chci vyzkoušet"}
        </span>
        {!r.is_complete && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 shadow-sm">
            Neúplný
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-gray-900">
          {r.title}
        </h3>
        <div className="flex items-center justify-between text-sm text-gray-500">
          {r.rating ? (
            <Stars value={r.rating} />
          ) : (
            <span className="text-gray-400">Bez hodnocení</span>
          )}
          {r.time_minutes ? <span>{r.time_minutes} min</span> : null}
        </div>
        {r.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {r.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}