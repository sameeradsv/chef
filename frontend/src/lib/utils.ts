export function expiryBadge(days: number | null | undefined): {
  label: string;
  className: string;
} {
  if (days === null || days === undefined) {
    return { label: "No date", className: "bg-kitchen-border text-kitchen-muted" };
  }
  if (days < 0) {
    return { label: "Expired", className: "bg-kitchen-danger/20 text-kitchen-danger" };
  }
  if (days === 0) {
    return { label: "Today", className: "bg-kitchen-danger/20 text-kitchen-danger" };
  }
  if (days === 1) {
    return { label: "Tomorrow", className: "bg-kitchen-warn/20 text-kitchen-warn" };
  }
  if (days <= 3) {
    return { label: `${days}d left`, className: "bg-kitchen-warn/20 text-kitchen-warn" };
  }
  if (days <= 7) {
    return { label: `${days}d left`, className: "bg-kitchen-accent/15 text-kitchen-accent" };
  }
  return { label: `${days}d left`, className: "bg-kitchen-success/15 text-kitchen-success" };
}

export function formatCurrency(n: number): string {
  return `₹${Math.round(n)}`;
}

export function modeLabel(mode: string): string {
  switch (mode) {
    case "cook":
      return "Cook at home";
    case "order":
      return "Order delivery";
    case "eat_out":
      return "Eat out";
    default:
      return mode;
  }
}
