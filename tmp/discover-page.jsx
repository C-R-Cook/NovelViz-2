import { useState, useEffect, useRef, useCallback } from "react";

const BOOKS = [
  { id: 1, title: "Dracula", author: "Bram Stoker", genre: "Gothic Horror", readers: 1240, color: "#8B1A1A", accent: "#C41E3A", img: "https://covers.openlibrary.org/b/id/8231432-L.jpg" },
  { id: 2, title: "Frankenstein", author: "Mary Shelley", genre: "Gothic", readers: 980, color: "#1A2E1A", accent: "#2E7D32", img: "https://covers.openlibrary.org/b/id/10527843-L.jpg" },
  { id: 3, title: "The Picture of Dorian Gray", author: "Oscar Wilde", genre: "Literary Fiction", readers: 870, color: "#1A1A2E", accent: "#6A0DAD", img: "https://covers.openlibrary.org/b/id/8945565-L.jpg" },
  { id: 4, title: "Pride and Prejudice", author: "Jane Austen", genre: "Romance", readers: 2100, color: "#2E1A1A", accent: "#C47A1E", img: "https://covers.openlibrary.org/b/id/8739161-L.jpg" },
  { id: 5, title: "Moby Dick", author: "Herman Melville", genre: "Adventure", readers: 640, color: "#0A1A2E", accent: "#1565C0", img: "https://covers.openlibrary.org/b/id/9342812-L.jpg" },
  { id: 6, title: "Jane Eyre", author: "Charlotte Brontë", genre: "Gothic Romance", readers: 1560, color: "#2E1A2E", accent: "#880E4F", img: "https://covers.openlibrary.org/b/id/8739648-L.jpg" },
];

const IMAGES = [
  { id: 1, bookId: 1, bookTitle: "Dracula", user: "nightreader_42", chapter: 7, prompt: "Count Dracula in the moonlit library", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=500&fit=crop", likes: 234 },
  { id: 2, bookId: 3, bookTitle: "Dorian Gray", user: "aesthete_88", chapter: 3, prompt: "The portrait in a golden frame", img: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=500&fit=crop", likes: 187 },
  { id: 3, bookId: 2, bookTitle: "Frankenstein", user: "gothic_lit_fan", chapter: 12, prompt: "The creature in a storm", img: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=500&fit=crop", likes: 312 },
  { id: 4, bookId: 4, bookTitle: "Pride & Prejudice", user: "elizabethan_reader", chapter: 5, prompt: "Pemberley estate at dusk", img: "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=400&h=500&fit=crop", likes: 445 },
  { id: 5, bookId: 5, bookTitle: "Moby Dick", user: "deep_sea_reader", chapter: 9, prompt: "The white whale breaching", img: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&h=500&fit=crop", likes: 156 },
  { id: 6, bookId: 6, bookTitle: "Jane Eyre", user: "thornfield_fan", chapter: 18, prompt: "Thornfield Hall in fog", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=500&fit=crop", likes: 289 },
];

// ─── Particle field ──────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,140,100,${p.a * 0.4})`;
        ctx.fill();
      });
      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(180,140,100,${(1 - dist / 100) * 0.08})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// ─── Book card ───────────────────────────────────────────────────────────────
function BookCard({ book, index, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        flex: "0 0 auto",
        width: isActive ? 200 : 140,
        height: isActive ? 280 : 210,
        cursor: "pointer",
        transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: hovered && !isActive ? "translateY(-8px) rotate(-1deg)" : isActive ? "translateY(-16px) scale(1.05)" : `rotate(${index % 2 === 0 ? -1.5 : 1.5}deg)`,
        zIndex: isActive ? 10 : hovered ? 5 : 1,
        filter: isActive ? "drop-shadow(0 20px 40px rgba(0,0,0,0.8))" : "drop-shadow(0 8px 16px rgba(0,0,0,0.5))",
      }}
    >
      <div style={{
        width: "100%", height: "100%", borderRadius: 4, overflow: "hidden",
        border: isActive ? "2px solid rgba(180,140,100,0.6)" : "1px solid rgba(255,255,255,0.05)",
      }}>
        <img src={book.img} alt={book.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s ease",
            transform: hovered || isActive ? "scale(1.08)" : "scale(1)" }}
          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
        />
        <div style={{
          display: "none", position: "absolute", inset: 0, background: book.color,
          alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 16, textAlign: "center"
        }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{book.genre.toUpperCase()}</div>
          <div style={{ fontSize: 16, fontFamily: "'Georgia', serif", color: "#fff", lineHeight: 1.3 }}>{book.title}</div>
        </div>
        <div style={{
          position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 60%)",
          opacity: hovered || isActive ? 1 : 0.7, transition: "opacity 0.3s",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 10px",
          transform: hovered || isActive ? "translateY(0)" : "translateY(4px)",
          transition: "transform 0.3s ease", opacity: hovered || isActive ? 1 : 0.6,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: book.accent, marginBottom: 3, fontFamily: "monospace" }}>{book.genre.toUpperCase()}</div>
          <div style={{ fontSize: 13, fontFamily: "'Georgia', serif", color: "#fff", lineHeight: 1.2, fontWeight: "bold" }}>{book.title}</div>
        </div>
      </div>
      {isActive && (
        <div style={{
          position: "absolute", top: -8, right: -8, width: 20, height: 20,
          background: book.accent, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "#fff", fontWeight: "bold",
          boxShadow: `0 0 12px ${book.accent}`,
          animation: "pulse 2s infinite",
        }}>✦</div>
      )}
    </div>
  );
}

// ─── Image card (masonry) ────────────────────────────────────────────────────
function ImageCard({ image, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [liked, setLiked] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", borderRadius: 8, overflow: "hidden", cursor: "pointer",
        aspectRatio: "4/5",
        transform: mounted ? "translateY(0) scale(1)" : "translateY(40px) scale(0.95)",
        opacity: mounted ? 1 : 0,
        transition: `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
        border: hovered ? "1px solid rgba(180,140,100,0.4)" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: hovered ? "0 20px 60px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <img src={image.img} alt={image.prompt}
        style={{ width: "100%", height: "100%", objectFit: "cover",
          transform: hovered ? "scale(1.08)" : "scale(1)", transition: "transform 0.6s ease" }} />
      <div style={{
        position: "absolute", inset: 0,
        background: hovered
          ? "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)"
          : "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%)",
        transition: "all 0.4s ease",
      }} />
      
      {/* Top badge */}
      <div style={{
        position: "absolute", top: 10, left: 10,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: "3px 10px",
        fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.6)",
        fontFamily: "monospace",
        transform: hovered ? "translateY(0)" : "translateY(-4px)",
        opacity: hovered ? 1 : 0.7,
        transition: "all 0.3s ease",
      }}>CH. {image.chapter}</div>

      {/* Bottom info */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 12px",
        transform: hovered ? "translateY(0)" : "translateY(6px)",
        opacity: hovered ? 1 : 0.8,
        transition: "all 0.3s ease",
      }}>
        <div style={{ fontSize: 11, color: "rgba(180,140,100,0.9)", letterSpacing: 1, marginBottom: 3, fontFamily: "monospace" }}>
          {image.bookTitle.toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Georgia', serif", lineHeight: 1.3, marginBottom: 8 }}>
          {image.prompt}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>@{image.user}</div>
          <button
            onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              color: liked ? "#C41E3A" : "rgba(255,255,255,0.5)",
              fontSize: 12, transition: "all 0.2s",
              transform: liked ? "scale(1.2)" : "scale(1)",
            }}
          >
            {liked ? "♥" : "♡"} <span style={{ fontSize: 10 }}>{image.likes + (liked ? 1 : 0)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scrolling marquee ───────────────────────────────────────────────────────
function Marquee({ items }) {
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", padding: "12px 0",
      borderTop: "1px solid rgba(180,140,100,0.15)", borderBottom: "1px solid rgba(180,140,100,0.15)" }}>
      <div style={{ display: "inline-block", animation: "marquee 30s linear infinite" }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{ display: "inline-block", marginRight: 48, fontSize: 11,
            letterSpacing: 3, color: "rgba(180,140,100,0.5)", fontFamily: "monospace" }}>
            {item.toUpperCase()} <span style={{ color: "rgba(180,140,100,0.2)", marginLeft: 48 }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DiscoverPage() {
  const [activeBook, setActiveBook] = useState(0);
  const [filterGenre, setFilterGenre] = useState("All");
  const [headerVisible, setHeaderVisible] = useState(false);
  const carouselRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => { setTimeout(() => setHeaderVisible(true), 100); }, []);

  // Drag-to-scroll
  const onMouseDown = e => {
    dragRef.current = { dragging: true, startX: e.pageX - carouselRef.current.offsetLeft, scrollLeft: carouselRef.current.scrollLeft };
  };
  const onMouseMove = e => {
    if (!dragRef.current.dragging) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    carouselRef.current.scrollLeft = dragRef.current.scrollLeft - (x - dragRef.current.startX) * 1.5;
  };
  const onMouseUp = () => { dragRef.current.dragging = false; };

  const genres = ["All", ...new Set(BOOKS.map(b => b.genre))];
  const filteredImages = filterGenre === "All" ? IMAGES : IMAGES.filter(i => {
    const book = BOOKS.find(b => b.id === i.bookId);
    return book?.genre === filterGenre;
  });

  const activeBookData = BOOKS[activeBook];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0806",
      color: "#fff",
      fontFamily: "'Georgia', serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        ::-webkit-scrollbar { height: 2px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(180,140,100,0.3); border-radius: 2px; }
      `}</style>

      {/* Background glow that follows active book */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(ellipse 60% 40% at 50% 20%, ${activeBookData.color}40 0%, transparent 70%)`,
        transition: "background 1s ease",
      }} />

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,8,6,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(180,140,100,0.12)",
        padding: "0 32px", display: "flex", alignItems: "center", height: 60,
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: `conic-gradient(${activeBookData.accent}, #B8860B, ${activeBookData.accent})`,
            transition: "background 0.8s",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12,
          }}>📖</div>
          <span style={{ fontSize: 16, letterSpacing: 3, fontFamily: "monospace", color: "rgba(180,140,100,0.9)" }}>NOVELVIZ</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
          {["DISCOVER", "LIBRARY", "GALLERY"].map(item => (
            <span key={item} style={{
              cursor: "pointer", transition: "color 0.2s",
              color: item === "DISCOVER" ? "rgba(180,140,100,0.9)" : "rgba(255,255,255,0.4)",
              borderBottom: item === "DISCOVER" ? `1px solid rgba(180,140,100,0.6)` : "none",
              paddingBottom: 2,
            }}>{item}</span>
          ))}
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* Hero */}
        <div style={{ padding: "64px 40px 32px", textAlign: "center" }}>
          <div style={{
            fontSize: 11, letterSpacing: 4, color: "rgba(180,140,100,0.6)",
            fontFamily: "monospace", marginBottom: 16,
            opacity: headerVisible ? 1 : 0, transform: headerVisible ? "none" : "translateY(10px)",
            transition: "all 0.8s ease",
          }}>AI COMPANION FOR READERS</div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 72px)", fontFamily: "'Georgia', serif",
            fontWeight: "normal", lineHeight: 1.1,
            background: "linear-gradient(135deg, #fff 0%, rgba(180,140,100,0.9) 50%, #fff 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "shimmer 6s linear infinite",
            margin: "0 0 16px",
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "none" : "translateY(20px)",
            transition: "all 1s ease 0.2s",
          }}>
            Every Chapter, Alive.
          </h1>
          <p style={{
            fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto 40px",
            lineHeight: 1.7, fontStyle: "italic",
            opacity: headerVisible ? 1 : 0, transform: headerVisible ? "none" : "translateY(20px)",
            transition: "all 1s ease 0.4s",
          }}>
            AI that knows only what you've read — no spoilers, ever.
          </p>
        </div>

        {/* Marquee */}
        <Marquee items={["Spoiler-free Q&A", "Chapter-gated images", "Public domain library", "Community gallery", "Reading progress tracking"]} />

        {/* Book carousel */}
        <div style={{ padding: "48px 0 32px" }}>
          <div style={{ padding: "0 40px", marginBottom: 24, display: "flex", alignItems: "baseline", gap: 12 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 4, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", margin: 0 }}>FEATURED TITLES</h2>
            <div style={{ height: 1, flex: 1, background: "linear-gradient(to right, rgba(180,140,100,0.3), transparent)" }} />
            <span style={{ fontSize: 11, color: "rgba(180,140,100,0.4)", fontFamily: "monospace" }}>DRAG TO EXPLORE →</span>
          </div>
          <div
            ref={carouselRef}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            style={{
              display: "flex", gap: 24, padding: "24px 60px 40px",
              overflowX: "auto", scrollBehavior: "smooth",
              cursor: dragRef.current?.dragging ? "grabbing" : "grab",
              alignItems: "flex-end",
              userSelect: "none",
            }}
          >
            {BOOKS.map((book, i) => (
              <BookCard key={book.id} book={book} index={i} isActive={activeBook === i} onClick={() => setActiveBook(i)} />
            ))}
          </div>

          {/* Active book info */}
          <div style={{
            padding: "0 40px 32px", display: "flex", alignItems: "center", gap: 32,
            animation: "fadeInUp 0.4s ease",
            key: activeBook,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: activeBookData.accent, fontFamily: "monospace", marginBottom: 6 }}>
                {activeBookData.genre.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontFamily: "'Georgia', serif", marginBottom: 4 }}>{activeBookData.title}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>by {activeBookData.author}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontFamily: "monospace", color: activeBookData.accent }}>{activeBookData.readers.toLocaleString()}</div>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>READERS</div>
              </div>
              <button style={{
                background: `linear-gradient(135deg, ${activeBookData.accent}20, ${activeBookData.accent}40)`,
                border: `1px solid ${activeBookData.accent}60`,
                color: activeBookData.accent, borderRadius: 4,
                padding: "10px 24px", fontSize: 12, letterSpacing: 2,
                fontFamily: "monospace", cursor: "pointer",
                transition: "all 0.3s",
              }}>ADD TO LIBRARY →</button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 40px 32px" }}>
          <div style={{ height: 1, flex: 1, background: "rgba(180,140,100,0.12)" }} />
          <div style={{ fontSize: 18, color: "rgba(180,140,100,0.3)" }}>✦</div>
          <div style={{ height: 1, flex: 1, background: "rgba(180,140,100,0.12)" }} />
        </div>

        {/* Community gallery */}
        <div style={{ padding: "0 40px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 4, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", margin: 0 }}>COMMUNITY VISIONS</h2>
            <div style={{ height: 1, flex: 1, background: "linear-gradient(to right, rgba(180,140,100,0.3), transparent)" }} />
            {/* Genre filters */}
            <div style={{ display: "flex", gap: 8 }}>
              {genres.slice(0, 4).map(g => (
                <button key={g} onClick={() => setFilterGenre(g)} style={{
                  background: filterGenre === g ? "rgba(180,140,100,0.2)" : "transparent",
                  border: filterGenre === g ? "1px solid rgba(180,140,100,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20, padding: "4px 14px",
                  fontSize: 10, letterSpacing: 2, fontFamily: "monospace",
                  color: filterGenre === g ? "rgba(180,140,100,0.9)" : "rgba(255,255,255,0.3)",
                  cursor: "pointer", transition: "all 0.2s",
                }}>{g.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Masonry-style grid */}
          <div style={{
            columns: "repeat(auto-fill, minmax(200px, 1fr))",
            columnGap: 16, gap: 16,
          }}>
            {filteredImages.map((img, i) => (
              <div key={img.id} style={{ breakInside: "avoid", marginBottom: 16 }}>
                <ImageCard image={img} delay={i * 80} />
              </div>
            ))}
          </div>

          {/* Load more */}
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button style={{
              background: "transparent",
              border: "1px solid rgba(180,140,100,0.3)",
              color: "rgba(180,140,100,0.7)",
              borderRadius: 4, padding: "12px 40px",
              fontSize: 11, letterSpacing: 3, fontFamily: "monospace", cursor: "pointer",
              transition: "all 0.3s",
            }}>EXPLORE ALL IMAGES</button>
          </div>
        </div>

        {/* CTA banner */}
        <div style={{
          margin: "0 40px 80px",
          border: "1px solid rgba(180,140,100,0.2)",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(180,140,100,0.05) 0%, rgba(139,26,26,0.05) 100%)",
          padding: "48px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", overflow: "hidden",
        }}>
          <ParticleField />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(180,140,100,0.6)", fontFamily: "monospace", marginBottom: 12 }}>BEGIN YOUR JOURNEY</div>
            <div style={{ fontSize: 32, fontFamily: "'Georgia', serif", marginBottom: 8 }}>Read without fear.</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Your AI companion respects every page you haven't turned yet.</div>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12 }}>
            <button style={{
              background: "rgba(180,140,100,0.9)", border: "none", color: "#0A0806",
              borderRadius: 4, padding: "12px 32px", fontSize: 12, letterSpacing: 2,
              fontFamily: "monospace", cursor: "pointer", fontWeight: "bold",
            }}>JOIN FREE →</button>
            <button style={{
              background: "transparent", border: "1px solid rgba(180,140,100,0.3)",
              color: "rgba(180,140,100,0.7)", borderRadius: 4, padding: "12px 24px",
              fontSize: 12, letterSpacing: 2, fontFamily: "monospace", cursor: "pointer",
            }}>BROWSE BOOKS</button>
          </div>
        </div>
      </div>
    </div>
  );
}
