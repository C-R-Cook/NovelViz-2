import "./gallery-redesign.css";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color-mix(in_srgb,var(--border-subtle)_70%,var(--bg-hover))] ${className ?? ""}`}
    />
  );
}

export default function GalleryLoading() {
  return (
    <div className="gallery-root text-text-primary" aria-busy="true" aria-label="Loading gallery">
      <div className="gallery-root-inner">
        <SkeletonBar className="mb-6 h-10 w-40" />
        <SkeletonBar className="mb-8 h-5 w-72 max-w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <SkeletonBar key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
