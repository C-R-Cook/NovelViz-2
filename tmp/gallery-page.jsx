import { useState, useEffect, useRef } from "react";

// ── Placeholder data ──────────────────────────────────────────────────────────
const LIBRARY_IMAGES = [
  { id: 1, bookTitle: "Dracula", author: "Bram Stoker", chapter: 7, user: "nightreader_42", likes: 234, isLocked: false, isOwn: true, img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=750&fit=crop", prompt: "Count Dracula descending the castle stairs" },
  { id: 2, bookTitle: "Jane Eyre", author: "Charlotte Brontë", chapter: 14, user: "thornfield_fan", likes: 189, isLocked: false, isOwn: false, img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=750&fit=crop", prompt: "Thornfield Hall shrouded in mist" },
  { id: 3, bookTitle: "Frankenstein", author: "Mary Shelley", chapter: 12, user: "gothic_lit_fan", likes: 312, isLocked: true, isOwn: false, img: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&h=750&fit=crop", prompt: "The creature silhouetted in lightning" },
  { id: 4, bookTitle: "Dracula", author: "Bram Stoker", chapter: 3, user: "mina_reader", likes: 97, isLocked: false, isOwn: false, img: "https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=600&h=750&fit=crop", prompt: "Mina writing in her journal by candlelight" },
];

const FEATURED_IMAGES = [
  { id: 5, bookTitle: "Alice in Wonderland", author: "Lewis Carroll", chapter: 4, user: "wonderstruck", likes: 445, isLocked: false, img: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&h=750&fit=crop", prompt: "Alice falling through the rabbit hole" },
  { id: 6, bookTitle: "Moby Dick", author: "Herman Melville", chapter: 9, user: "deep_sea_reader", likes: 156, isLocked: false, img: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=600&h=750&fit=crop", prompt: "The white whale breaching at dawn" },
  { id: 7, bookTitle: "Pride & Prejudice", author: "Jane Austen", chapter: 5, user: "elizabethan_reader", likes: 389, isLocked: false, img: "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=600&h=750&fit=crop", prompt: "Pemberley estate seen from the hill" },
  { id: 8, bookTitle: "Dorian Gray", author: "Oscar Wilde", chapter: 3, user: "aesthete_88", likes: 201, isLocked: false, img: "https://images.unsplash.com/photo-1509644851169-2acc08aa25b5?w=600&h=750&fit=crop", prompt: "The portrait glowing in the locked room" },
  { id: 9, bookTitle: "Dracula", author: "Bram Stoker", chapter: 11, user: "castle_watcher", likes: 178, isLocked: false, img: "https://images.unsplash.com/photo-1520637836993-5e85a2e1bd6c?w=600&h=750&fit=crop", prompt: "Wolves howling outside the castle gates" },
];

// ── Particle canvas ───────────────────────────────────────────────────────────
function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.5 + 0.1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x = (p.x + p.vx + canvas.width) % canvas.width;
        p.y = (p.y + p.vy + canvas.height) % canvas.height;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,140,100,${p.a * 0.35})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// ── Lock overlay ──────────────────────────────────────────────────────────────
function LockOverlay({ chapter }) {
  return (
    <div style={{
      position: "absolute", inset: 0, backdropFilter: "blur(16px)",
      background: "rgba(10,8,6,0.55)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <div style={{ fontSize: 22, opacity: 0.7 }}>🔒</div>
      <div style={{
        fontFamily: "monospace", fontSize: 9, letterSpacing: 2,
        color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
      }}>Chapter {chapter}</div>
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ image, size = "normal", delay = 0, showLockIcon = true }) {
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), delay); return () => clearTimeout(t); }, [delay]);

  const isSmall = size === "small";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: isSmall ? 6 : 8,
        overflow: "hidden",
        cursor: "pointer",
        aspectRatio: "3/4",
        opacity: mounted ? 1 : 0,
        transform: mounted
          ? hovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)"
          : "translateY(24px) scale(0.96)",
        transition: mounted
          ? "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.1s, border-color 0.25s, box-shadow 0.35s"
          : `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
        border: hovered ? "1px solid rgba(180,140,100,0.45)" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: hovered ? "0 20px 50px rgba(0,0,0,0.65)" : "0 4px 16px rgba(0,0,0,0.35)",
      }}
    >
      <img src={image.img} alt={image.prompt}
        style={{ width: "100%", height: "100%", objectFit: "cover",
          transform: hovered ? "scale(1.07)" : "scale(1)", transition: "transform 0.6s ease" }}
      />

      {image.isLocked && showLockIcon && <LockOverlay chapter={image.chapter} />}

      {!image.isLocked && (
        <>
          {/* Gradient */}
          <div style={{
            position: "absolute", inset: 0,
            background: hovered
              ? "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)",
            transition: "all 0.4s ease",
          }} />

          {/* Own image indicator */}
          {image.isOwn && (
            <div style={{
              position: "absolute", top: 8, left: 8,
              background: "rgba(0,188,212,0.2)", border: "1px solid rgba(0,188,212,0.5)",
              borderRadius: 20, padding: "2px 8px",
              fontFamily: "monospace", fontSize: 8, letterSpacing: 1.5,
              color: "#00BCD4", textTransform: "uppercase",
            }}>Yours</div>
          )}

          {/* Bottom info */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: isSmall ? "10px 10px" : "14px 12px",
            transform: hovered ? "translateY(0)" : "translateY(4px)",
            opacity: hovered ? 1 : 0.75,
            transition: "all 0.3s ease",
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: 2, color: "rgba(180,140,100,0.8)", marginBottom: 3, textTransform: "uppercase" }}>
              {image.bookTitle}
            </div>
            {!isSmall && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "Georgia, serif", lineHeight: 1.3, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {image.prompt}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.35)" }}>@{image.user}</div>
              {!image.isOwn && (
                <button onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                    color: liked ? "#C41E3A" : "rgba(255,255,255,0.45)",
                    fontSize: 11, display: "flex", alignItems: "center", gap: 3,
                    transform: liked ? "scale(1.2)" : "scale(1)", transition: "all 0.2s",
                  }}>
                  {liked ? "♥" : "♡"}
                  <span style={{ fontSize: 9 }}>{image.likes + (liked ? 1 : 0)}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{label}</div>
        {sub && <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2, color: "rgba(180,140,100,0.45)", marginTop: 3, textTransform: "uppercase" }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(180,140,100,0.2), transparent)" }} />
      {right && <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(180,140,100,0.4)", letterSpacing: 1 }}>{right}</div>}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "48px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(180,140,100,0.1)" }} />
      <div style={{ fontSize: 14, color: "rgba(180,140,100,0.25)" }}>✦</div>
      <div style={{ flex: 1, height: 1, background: "rgba(180,140,100,0.1)" }} />
    </div>
  );
}

// ── Spoiler toggle pill ───────────────────────────────────────────────────────
function SpoilerPill({ enabled, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 8,
      background: enabled ? "rgba(180,140,100,0.1)" : "rgba(255,255,255,0.04)",
      border: enabled ? "1px solid rgba(180,140,100,0.35)" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20, padding: "6px 14px", cursor: "pointer",
      transition: "all 0.25s ease",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: enabled ? "#C49A3C" : "rgba(255,255,255,0.2)",
        boxShadow: enabled ? "0 0 8px rgba(196,154,60,0.6)" : "none",
        transition: "all 0.25s",
        flexShrink: 0,
      }} />
      <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
        color: enabled ? "rgba(180,140,100,0.9)" : "rgba(255,255,255,0.3)" }}>
        {enabled ? "Spoiler protection on" : "Spoiler protection off"}
      </span>
    </button>
  );
}

// ── Featured carousel (horizontal scroll) ────────────────────────────────────
function FeaturedCarousel({ images }) {
  const ref = useRef(null);
  const drag = useRef({ on: false, startX: 0, sl: 0 });
  return (
    <div
      ref={ref}
      onMouseDown={e => { drag.current = { on: true, startX: e.pageX - ref.current.offsetLeft, sl: ref.current.scrollLeft }; }}
      onMouseMove={e => { if (!drag.current.on) return; e.preventDefault(); ref.current.scrollLeft = drag.current.sl - (e.pageX - ref.current.offsetLeft - drag.current.startX) * 1.3; }}
      onMouseUp={() => { drag.current.on = false; }}
      onMouseLeave={() => { drag.current.on = false; }}
      style={{
        display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8,
        cursor: "grab", userSelect: "none",
        scrollbarWidth: "none",
      }}
    >
      {images.map((img, i) => (
        <div key={img.id} style={{ flex: "0 0 auto", width: 180 }}>
          <ImageCard image={img} delay={i * 60} />
        </div>
      ))}
    </div>
  );
}

// ── Main gallery page ─────────────────────────────────────────────────────────
export default function GalleryPage() {
  const [spoilerOn, setSpoilerOn] = useState(true);
  const [headerIn, setHeaderIn] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'yours'

  useEffect(() => { setTimeout(() => setHeaderIn(true), 80); }, []);

  const visibleLibrary = spoilerOn
    ? LIBRARY_IMAGES
    : LIBRARY_IMAGES.map(img => ({ ...img, isLocked: false }));

  return (
    <div style={{ minHeight: "100vh", background: "#0A0806", color: "#fff", fontFamily: "Georgia, serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Fixed ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 55% 30% at 50% 0%, rgba(160,100,20,0.10), transparent 70%)" }} />

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,8,6,0.88)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(180,140,100,0.10)",
        padding: "0 40px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: 3, color: "rgba(180,140,100,0.85)" }}>NOVELVIZ</span>
        <div style={{ display: "flex", gap: 28, fontFamily: "monospace", fontSize: 10, letterSpacing: 2 }}>
          {["DISCOVER", "MY LIBRARY", "GALLERY", "DASHBOARD"].map(n => (
            <span key={n} style={{ color: n === "GALLERY" ? "rgba(180,140,100,0.9)" : "rgba(255,255,255,0.35)", cursor: "pointer",
              borderBottom: n === "GALLERY" ? "1px solid rgba(180,140,100,0.5)" : "none", paddingBottom: 2 }}>{n}</span>
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(180,140,100,0.2)",
          border: "1px solid rgba(180,140,100,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", fontSize: 11, color: "rgba(180,140,100,0.8)" }}>DA</div>
      </nav>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 40px 80px" }}>

        {/* Page header */}
        <div style={{ padding: "52px 0 36px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{
              fontFamily: "monospace", fontSize: 10, letterSpacing: 4, color: "rgba(180,140,100,0.5)",
              marginBottom: 10, textTransform: "uppercase",
              opacity: headerIn ? 1 : 0, transform: headerIn ? "none" : "translateY(10px)",
              transition: "all 0.7s ease",
            }}>Reader Community</div>
            <h1 style={{
              fontSize: "clamp(36px, 5vw, 58px)", fontFamily: "Georgia, serif", fontWeight: "normal",
              margin: "0 0 10px", lineHeight: 1.1,
              background: "linear-gradient(135deg, #fff 0%, rgba(180,140,100,0.9) 60%, #fff 100%)",
              backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              animation: "shimmer 7s linear infinite",
              opacity: headerIn ? 1 : 0, transform: headerIn ? "none" : "translateY(16px)",
              transition: "all 0.9s ease 0.1s",
            }}>Gallery</h1>
            <p style={{
              fontSize: 14, color: "rgba(255,255,255,0.38)", fontStyle: "italic", margin: 0,
              opacity: headerIn ? 1 : 0, transform: headerIn ? "none" : "translateY(12px)",
              transition: "all 0.9s ease 0.2s",
            }}>Images created by readers, chapter by chapter.</p>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <SpoilerPill enabled={spoilerOn} onToggle={() => setSpoilerOn(s => !s)} />
            <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: 1.5, color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
              ? what do the icons mean
            </div>
          </div>
        </div>

        {/* ── FROM YOUR LIBRARY ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionLabel label="From Your Library" sub="Images from books you're reading" right={`${visibleLibrary.length} images`} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {visibleLibrary.map((img, i) => (
              <ImageCard key={img.id} image={img} delay={i * 55} />
            ))}
          </div>
        </section>

        <Divider />

        {/* ── FEATURED ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionLabel label="Featured" sub="Beloved images from across the catalogue" right="← drag →" />
          <FeaturedCarousel images={FEATURED_IMAGES} />
        </section>

        <Divider />

        {/* ── BROWSE ALL ── */}
        <section>
          {/* Tab row */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28, borderBottom: "1px solid rgba(180,140,100,0.1)" }}>
            {[["all", "All Images"], ["yours", "Your Images"]].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "monospace", fontSize: 10, letterSpacing: 3,
                textTransform: "uppercase", paddingBottom: 12, paddingRight: 28,
                color: activeTab === id ? "rgba(180,140,100,0.9)" : "rgba(255,255,255,0.28)",
                borderBottom: activeTab === id ? "1px solid rgba(180,140,100,0.6)" : "1px solid transparent",
                marginBottom: -1,
                transition: "all 0.2s",
              }}>{label}</button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 1, paddingBottom: 12 }}>
              {[...LIBRARY_IMAGES, ...FEATURED_IMAGES].length} total
            </span>
          </div>

          {/* Masonry-style grid */}
          <div style={{ columns: "repeat(auto-fill, minmax(200px, 1fr))", columnGap: 12 }}>
            {[...FEATURED_IMAGES, ...LIBRARY_IMAGES]
              .filter(img => activeTab === "all" || img.isOwn)
              .map((img, i) => (
                <div key={img.id} style={{ breakInside: "avoid", marginBottom: 12 }}>
                  <ImageCard image={img} delay={i * 45} size="small" />
                </div>
              ))}
          </div>
        </section>

        {/* ── GUEST CTA BANNER ── */}
        <div style={{
          marginTop: 72,
          border: "1px solid rgba(180,140,100,0.18)",
          borderRadius: 10, overflow: "hidden",
          background: "linear-gradient(135deg, rgba(180,140,100,0.04), rgba(139,26,26,0.04))",
          padding: "48px 40px", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32,
        }}>
          <Particles />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 4, color: "rgba(180,140,100,0.5)", marginBottom: 12, textTransform: "uppercase" }}>
              Create your own
            </div>
            <div style={{ fontSize: 28, fontFamily: "Georgia, serif", marginBottom: 8, fontWeight: "normal" }}>
              Imagine your story.
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", fontStyle: "italic" }}>
              Generate images from the chapters you've read — spoilers never included.
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 10, flexShrink: 0 }}>
            <button style={{
              background: "rgba(180,140,100,0.9)", border: "none", color: "#0A0806",
              borderRadius: 4, padding: "11px 28px", fontFamily: "monospace",
              fontSize: 10, letterSpacing: 2, cursor: "pointer", fontWeight: "bold",
            }}>START READING →</button>
            <button style={{
              background: "transparent", border: "1px solid rgba(180,140,100,0.3)",
              color: "rgba(180,140,100,0.65)", borderRadius: 4, padding: "11px 20px",
              fontFamily: "monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer",
            }}>BROWSE BOOKS</button>
          </div>
        </div>
      </div>
    </div>
  );
}
