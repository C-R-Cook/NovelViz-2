from pathlib import Path

FILES = [
    Path("app/(public)/gallery/gallery-client.tsx"),
    Path("app/(public)/gallery/gallery-book-client.tsx"),
]

for path in FILES:
    s = path.read_text(encoding="utf-8")

    s = s.replace("max-w-[800px] flex-col", "max-w-5xl flex-col")

    old_wrap = '<motion className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-col overflow-hidden sm:pt-1">'
    old_wrap = old_wrap.replace("<motion", "<div")
    new_wrap = '<div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-row overflow-hidden sm:pt-1">'
    if old_wrap not in s:
        raise SystemExit(f"wrap not found in {path}")
    s = s.replace(old_wrap, new_wrap, 1)

    # After first image block closing `</div>\n              </motion>\n\n              <motion className="min-h-0 flex-1 overflow-y-auto`
    old_mid = """              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
                <div className="space-y-3">"""

    new_mid = """              </motion>

                <motion className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
                  <motion className="space-y-3">"""
    new_mid = new_mid.replace("<motion", "<div").replace("</motion>", "</div>")

    if old_mid not in s:
        raise SystemExit(f"mid not found in {path}")
    s = s.replace(old_mid, new_mid, 1)

    # Before GalleryImageComments: close left column, open aside
    old_comments = """                  {!modalLocked ? (
                    <GalleryImageComments"""
    new_comments = """                </motion>
              </motion>

              {!modalLocked ? (
                <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-surface/40">
                  <GalleryImageComments
                      layout="sidebar"
                      className="h-full min-h-0\""""
    new_comments = new_comments.replace("<motion", "<motion>").replace("<motion>", "<div").replace("</motion>", "</div>")

    if old_comments not in s:
        raise SystemExit(f"comments marker not found in {path}")
    s = s.replace(old_comments, new_comments, 1)

    # After GalleryImageComments closing: close aside and row (was closing inner divs)
    old_end = """                    />
                  ) : null}
                </div>
              </motion>
            </motion>
          </motion>"""
    old_end = old_end.replace("<motion", "<motion>").replace("<motion>", "<div").replace("</motion>", "</div>")

    new_end = """                    />
                </aside>
              ) : null}
            </motion>
          </motion>"""
    new_end = new_end.replace("<motion", "<motion>").replace("<motion>", "<div").replace("</motion>", "</motion>")

    if old_end not in s:
        raise SystemExit(f"end not found in {path}")
    s = s.replace(old_end, new_end, 1)

    # Wrap image column: insert after flex-row open
    row_open = '<div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-row overflow-hidden sm:pt-1">'
    img_col_open = """<div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-row overflow-hidden sm:pt-1">
              <div className={`flex min-h-0 min-w-0 flex-col ${"""
    # simpler: insert after row open
    insert = """<div className="flex min-h-0 max-h-[90vh] w-full flex-1 flex-row overflow-hidden sm:pt-1">
              <div className="flex min-h-0 min-w-0 flex-[2] flex-col border-r border-border">"""
    if insert in s:
        pass
    else:
        s = s.replace(
            row_open,
            row_open + '\n              <div className="flex min-h-0 min-w-0 flex-[2] flex-col border-r border-border">',
            1,
        )

    # Image section: change from flex-shrink-0 full width to flex-1 in column
    s = s.replace(
        'className="relative flex h-[min(55vh,calc(90vh-12rem))] max-h-[55vh] w-full flex-shrink-0 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4"',
        'className="relative flex min-h-[200px] flex-1 bg-bg-base px-4 pt-12 sm:px-6 sm:pt-4"',
        1,
    )

    path.write_text(s, encoding="utf-8")
    print("patched", path)
