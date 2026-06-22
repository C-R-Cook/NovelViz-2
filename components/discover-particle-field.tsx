"use client";

import { useEffect, useRef } from "react";

type DiscoverParticleFieldProps = {
  count?: number;
  opacity?: number;
  linkDistance?: number;
  className?: string;
};

/** Read the computed value of a CSS custom property from the document root. */
function readCssVar(name: string): string {
  if (typeof document === "undefined") return "rgb(180,140,100)";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "rgb(180,140,100)";
}

/** Ambient particle + link lines (discover / landing). Respects reduced motion via parent hiding. */
export function DiscoverParticleField({
  count = 60,
  opacity = 0.4,
  linkDistance = 100,
  className,
}: DiscoverParticleFieldProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;

    // Read accent colour from the theme token so the particles adapt to theme switches.
    let accentHex = readCssVar("--accent");

    // Watch for theme changes and update the colour.
    const observer = new MutationObserver(() => {
      accentHex = readCssVar("--accent");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      const prevW = canvas.width;
      const prevH = canvas.height;

      canvas.width = w;
      canvas.height = h;

      if (prevW > 0 && prevH > 0 && (prevW !== w || prevH !== h)) {
        const scaleX = w / prevW;
        const scaleY = h / prevH;
        for (const p of pts) {
          p.x *= scaleX;
          p.y *= scaleY;
        }
      }
    };

    const pts = Array.from({ length: count }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
    }));

    const seedParticles = () => {
      for (const p of pts) {
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
      }
    };

    resize();
    seedParticles();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        // Use CSS color-mix or just set globalAlpha for opacity over the theme accent.
        ctx.globalAlpha = p.a * opacity;
        ctx.fillStyle = accentHex;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDistance) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.globalAlpha = (1 - dist / linkDistance) * 0.08 * opacity;
            ctx.strokeStyle = accentHex;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [count, linkDistance, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
      aria-hidden
    />
  );
}
