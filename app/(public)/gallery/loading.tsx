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
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          <SkeletonBar className="mb-2 h-3 w-32" />
          <SkeletonBar className="mb-3 h-10 w-56" />
          <SkeletonBar className="mb-8 h-5 w-80 max-w-full" />
          <div className="mb-6 flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBar key={i} className="h-8 w-20 shrink-0 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 2 }, (_, row) => (
            <div key={row} className="book-row mb-8">
              <div className="book-row-anchor">
                <SkeletonBar className="mx-auto aspect-[2/3] w-[60px]" />
                <SkeletonBar className="mt-2 h-3 w-full" />
                <SkeletonBar className="mt-1 h-2.5 w-4/5" />
              </div>
              <div className="book-row-strip">
                {Array.from({ length: 4 }, (_, i) => (
                  <SkeletonBar key={i} className="aspect-square w-[180px] min-w-[180px] shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
