import "./discover-redesign.css";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color-mix(in_srgb,var(--border-subtle)_70%,var(--bg-hover))] ${className ?? ""}`}
    />
  );
}

export default function DiscoverLoading() {
  return (
    <div className="discover-root min-h-screen pb-20 pt-6 sm:pt-10" aria-busy="true" aria-label="Loading discover">
      <div className="discover-root-inner mx-auto max-w-7xl px-4 sm:px-6">
        <SkeletonBar className="mb-4 h-10 w-56" />
        <SkeletonBar className="mb-8 h-5 w-80 max-w-full" />
        <div className="mb-10 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBar key={i} className="h-64 w-44 shrink-0" />
          ))}
        </div>
        <SkeletonBar className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonBar key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
