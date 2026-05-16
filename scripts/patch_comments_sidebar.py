from pathlib import Path

p = Path("components/gallery/gallery-image-comments.tsx")
s = p.read_text(encoding="utf-8")

header_old = """      <div className="gallery-section-label-row">
        <div className="gallery-section-label-text">
          <span className="gallery-section-label" id={headingId}>
            Comments
          </span>
        </div>
        <motion className="gallery-section-label-line" aria-hidden />
      </motion>

      <motion className="mt-4 space-y-3">"""

header_new = """      {sidebar ? (
        <div className="shrink-0 border-b border-border-subtle pb-2">
          <h3 id={headingId} className="text-sm font-semibold text-text-primary">
            Comments
          </h3>
        </motion>
      ) : (
        <motion className="gallery-section-label-row">
          <motion className="gallery-section-label-text">
            <span className="gallery-section-label" id={headingId}>
              Comments
            </span>
          </motion>
          <motion className="gallery-section-label-line" aria-hidden />
        </motion>
      )}

      <motion className={sidebar ? "flex min-h-0 flex-1 flex-col gap-2 pt-2" : "mt-4 space-y-3"}>"""

# normalize accidental motion tags in this script file
for pair in [("<motion ", "<motion "), ("</motion>", "</motion>")]:
    pass
header_old = header_old.replace("</motion>", "</div>").replace("<motion ", "<div ")
header_new = header_new.replace("</motion>", "</div>").replace("<motion ", "<div ")

if header_old not in s:
    raise SystemExit("header block not found")
s = s.replace(header_old, header_new)

s = s.replace(
    '<ul className="max-h-64 space-y-4 overflow-y-auto pr-1">',
    '<ul className={sidebar ? "min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" : "max-h-64 space-y-4 overflow-y-auto pr-1"}>',
)

s = s.replace(
    '      <div className="mt-5">',
    '      <div className={sidebar ? "shrink-0 border-t border-border-subtle pt-3" : "mt-5"}>',
)

p.write_text(s, encoding="utf-8")
print("ok")
