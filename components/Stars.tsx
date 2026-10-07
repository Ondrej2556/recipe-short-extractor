export default function Stars({
  value,
  onChange,
  className = "text-lg",
}: {
  value: number | null;
  onChange?: (n: number | null) => void;
  className?: string;
}) {
  return (
    <div className={`flex ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const color = value && n <= value ? "text-amber-400" : "text-gray-300";
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`${color} transition hover:text-amber-400`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={color}>
            ★
          </span>
        );
      })}
    </div>
  );
}