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
      className={`transition-all duration-200 ${className}`}
      style={{
        borderRadius: "var(--radius-card)",
        padding: "16px 20px",
        border: highlight
          ? "1px solid rgb(var(--kitchen-accent) / 0.45)"
          : "1px solid var(--kitchen-line)",
        background: highlight
          ? "rgb(var(--kitchen-accent) / 0.06)"
          : "rgb(var(--kitchen-card))",
        boxShadow: highlight ? "0 0 20px rgb(var(--kitchen-accent) / 0.1)" : "none",
      }}
    >
      {children}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div
      className="loading-shimmer"
      style={{ height: 80, borderRadius: "var(--radius-card)", border: "1px solid var(--kitchen-line)" }}
    />
  );
}
