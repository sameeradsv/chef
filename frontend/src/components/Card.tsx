export function Card({
  children,
  className = "",
  highlight = false,
}: {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-200 card-hover ${
        highlight
          ? "border-kitchen-accent/50 bg-kitchen-accent/5"
          : "border-kitchen-border bg-kitchen-card"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="rounded-xl border border-kitchen-border bg-kitchen-card p-5 animate-pulse">
      <div className="h-4 bg-kitchen-border rounded w-1/3 mb-3" />
      <div className="h-3 bg-kitchen-border rounded w-2/3 mb-2" />
      <div className="h-3 bg-kitchen-border rounded w-1/2" />
    </div>
  );
}
