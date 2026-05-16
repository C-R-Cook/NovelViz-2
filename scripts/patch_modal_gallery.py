from pathlib import Path

def patch(path: Path) -> None:
    s = path.read_text(encoding="utf-8")
    d = "div"

    s = s.replace("max-w-[800px] flex-col", "max-w-5xl flex-col", 1)

    a = (
        '            <div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-col overflow-hidden sm:pt-1">\n'
        '              <motion className="relative flex h-[min(55vh,calc(90vh-12rem))] max-h-[55vh] w-full flex-shrink-0 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">'
    ).replace("motion", d)

    b = (
        '            <div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-row overflow-hidden sm:pt-1">\n'
        '              <motion className={`flex min-h-0 min-w-0 flex-col ${modalLocked ? "w-full" : "flex-[2] border-r border-border"}`}">\n'
        '              <motion className="relative flex min-h-[200px] flex-1 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4">'
    ).replace("motion", d)

    if a not in s:
        raise SystemExit(f"block A not in {path}")
    s = s.replace(a, b, 1)

    c = (
        '              </div>\n\n              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6">\n'
        '                <div className="space-y-3">'
    )
    e = (
        f'              </{d}>\n\n                <{d} className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-5">\n'
        f'                  <{d} className="space-y-3">'
    )
    if c not in s:
        raise SystemExit(f"block C not in {path}")
    s = s.replace(c, e, 1)

    f_marker = "                  {!modalLocked ? (\n                    <GalleryImageComments"
    g = (
        f"                </{d}>\n              </{d}>\n\n              {{!modalLocked ? (\n"
        f'                <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-surface/40">\n'
        f"                  <GalleryImageComments\n"
        f'                      layout="sidebar"\n'
        f'                      className="h-full min-h-0"'
    )
    if f_marker not in s:
        raise SystemExit(f"marker F not in {path}")
    s = s.replace(f_marker, g, 1)

    h = (
        "                    />\n                  ) : null}\n                </div>\n              </motion>\n            </motion>\n          </motion>"
    ).replace("motion", d)
    i = (
        "                    />\n                </aside>\n              ) : null}\n            </"
        + d
        + ">\n          </"
        + d
        + ">"
    )
    if h not in s:
        raise SystemExit(f"block H not in {path}")
    s = s.replace(h, i, 1)

    s = s.replace(
        'sizes="(max-width: 800px) 100vw, 800px"',
        'sizes="(max-width: 1024px) 66vw, 640px"',
    )

    path.write_text(s, encoding="utf-8")
    print("ok", path)


for rel in ("app/(public)/gallery/gallery-client.tsx", "app/(public)/gallery/gallery-book-client.tsx"):
    patch(Path(rel))
