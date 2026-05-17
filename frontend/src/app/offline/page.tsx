import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <p className="text-4xl mb-4" aria-hidden>
        🍳
      </p>
      <h1 className="font-display text-2xl text-kitchen-text mb-2">
        You&apos;re offline
      </h1>
      <p className="text-kitchen-muted mb-8">
        Chef needs a connection for pantry and decision data. Reconnect, then try
        again.
      </p>
      <Link
        href="/"
        className="inline-block px-4 py-2 rounded-lg bg-kitchen-accent/15 text-kitchen-accent hover:bg-kitchen-accent/25 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
