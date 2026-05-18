import fs from "fs";

const path = "app/(reader)/(app)/library/library-client.tsx";
let c = fs.readFileSync(path, "utf8");

c = c.replace(
  `  const [activeBookId, setActiveBookId] = useState(defaultActiveBookId);
  const [shelfSticky, setShelfSticky] = useState(false);
  const [headerIn, setHeaderIn] = useState(false);
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("visible");
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);`,
  `  const [activeBookId, setActiveBookId] = useState(defaultActiveBookId);
  const [readingPinned, setReadingPinned] = useState(false);
  const [readingChromeHeight, setReadingChromeHeight] = useState(0);
  const [headerIn, setHeaderIn] = useState(false);
  const [panelPhase, setPanelPhase] = useState<PanelPhase>("visible");
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);`,
);

const activeOld = `                <motionless
                  className={\`library-shelf-stack \${shelfSticky ? "library-shelf-stack--sticky" : ""}\`}
                  style={{ top: NAV_OFFSET_PX }}
                >
                  <section className="library-stack-section" aria-label="Currently reading">
                    <LibrarySectionHead title="Currently reading" />
                    <div className="library-reading-wrap library-reading-split">
                    <div className="library-reading-col-book">
                      <LibraryActiveBookBar
                        book={activeBook}
                        chapters={chapterProgress.chapters}
                        progress={{
                          selectedChapterId: chapterProgress.selectedChapterId,
                          selectChapter: chapterProgress.selectChapter,
                          saving: chapterProgress.saving,
                          message: chapterProgress.message,
                          chapterNumber: chapterProgress.chapterNumber,
                          progressPercent: chapterProgress.progressPercent,
                          total: chapterProgress.total,
                        }}
                      />
                    </div>
                    <div className="library-reading-col-ai">{ai}</div>
                  </div>
                  </section>
                  <section className="library-stack-section" aria-label="My book shelf">
                    <LibrarySectionHead title="My Book Shelf" />
                    <div className="library-shelf-wrap">
                    <LibraryShelf
                      books={books}
                      activeBookId={activeBookId}
                      onSelectBook={selectBook}
                      reducedMotion={reducedMotion}
                      finePointer={finePointer}
                    />
                  </div>
                  </section>
                </div>`.replace(/<motionless/g, "<motionless").replace(/<\/motionless>/g, "</motionless>");

const activeOldDiv = activeOld.replace(/<motionless/g, "<div").replace(/<\/motionless>/g, "</div>");

const activeNew = `                <div className="library-scroll-sections">
                  <LibraryCollapsibleSection
                    title="Currently reading"
                    stickyTop={NAV_OFFSET_PX}
                    aria-label="Currently reading"
                    reducedMotion={reducedMotion}
                    onPinnedChange={handleReadingPinned}
                    onChromeHeightChange={handleReadingChromeHeight}
                  >
                    <div className="library-reading-wrap library-reading-split">
                      <div className="library-reading-col-book">
                        <LibraryActiveBookBar
                          book={activeBook}
                          chapters={chapterProgress.chapters}
                          progress={{
                            selectedChapterId: chapterProgress.selectedChapterId,
                            selectChapter: chapterProgress.selectChapter,
                            saving: chapterProgress.saving,
                            message: chapterProgress.message,
                            chapterNumber: chapterProgress.chapterNumber,
                            progressPercent: chapterProgress.progressPercent,
                            total: chapterProgress.total,
                          }}
                        />
                      </div>
                      <motionless className="library-reading-col-ai">{ai}</motionless>
                    </motionless>
                  </LibraryCollapsibleSection>
                  <LibraryCollapsibleSection
                    title="My Book Shelf"
                    stickyTop={shelfStickyTop}
                    aria-label="My book shelf"
                    reducedMotion={reducedMotion}
                  >
                    <motionless className="library-shelf-wrap">
                      <LibraryShelf
                        books={books}
                        activeBookId={activeBookId}
                        onSelectBook={selectBook}
                        reducedMotion={reducedMotion}
                        finePointer={finePointer}
                      />
                    </motionless>
                  </LibraryCollapsibleSection>
                </motionless>`.replace(/<motionless/g, "<div").replace(/<\/motionless>/g, "</div>");

if (!c.includes(activeOldDiv)) {
  console.error("active block not found");
  process.exit(1);
}
c = c.replace(activeOldDiv, activeNew);

const elseOld = `          <motionless
            className={\`library-shelf-stack \${shelfSticky ? "library-shelf-stack--sticky" : ""}\`}
            style={{ top: NAV_OFFSET_PX }}
          >
            <section className="library-stack-section" aria-label="My book shelf">
              <LibrarySectionHead title="My Book Shelf" />
              <div className="library-shelf-wrap">
                <LibraryShelf
                  books={books}
                  activeBookId={activeBookId}
                  onSelectBook={selectBook}
                  reducedMotion={reducedMotion}
                  finePointer={finePointer}
                />
              </div>
            </section>
          </motionless>`.replace(/<motionless/g, "<div");

const elseNew = `          <div className="library-scroll-sections">
            <LibraryCollapsibleSection
              title="My Book Shelf"
              stickyTop={NAV_OFFSET_PX}
              aria-label="My book shelf"
              reducedMotion={reducedMotion}
            >
              <div className="library-shelf-wrap">
                <LibraryShelf
                  books={books}
                  activeBookId={activeBookId}
                  onSelectBook={selectBook}
                  reducedMotion={reducedMotion}
                  finePointer={finePointer}
                />
              </div>
            </LibraryCollapsibleSection>
          </div>`;

if (!c.includes(elseOld)) {
  console.error("else block not found");
  process.exit(1);
}
c = c.replace(elseOld, elseNew);

c = c.replace(/useRef,\s*/g, "");

fs.writeFileSync(path, c);
console.log("patched");
