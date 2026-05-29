"use client";

import { useEffect, useRef, useState } from "react";
import "./image-generation-loader.css";

const INFINITY_PATH =
  "M25,30 C25,12 45,12 60,30 C75,48 95,48 95,30 C95,12 75,12 60,30 C45,48 25,48 25,30";

const VIEW_W = 120;
const VIEW_H = 60;
const LOOP_MS = 3500;
const TRAIL_LINGER_MS = 1750;
const TRAIL_ARC_FRACTION = 0.4;
const PATH_SAMPLES = 180;
const MAX_PARTICLES = 24;
const PARTICLE_LIFE_MS = 2200;
const PARTICLE_SPAWN_MS = 85;
const PARTICLE_GRAVITY = 28;
const PARTICLE_DRAG = 0.985;
const DIM_BASE_OPACITY = 0.14;

/** Landing hero title palette (landing-redesign.css .landing-hero-title) */
const LANDING_BRONZE = { r: 180, g: 140, b: 100 };
const LANDING_GOLD = { r: 220, g: 190, b: 140 };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function wrapDistanceBehind(headLen: number, sampleLen: number, total: number): number {
  const d = headLen - sampleLen;
  return d >= 0 ? d : d + total;
}

type Props = {
  className?: string;
  label?: string;
  ariaLabel?: string;
};

export function ImageGenerationLoader({
  className,
  label = "Creating magic...",
  ariaLabel = "Generating image",
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const symbolRef = useRef<HTMLDivElement>(null);
  const emitterRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const progressRef = useRef(0);
  const lastLitRef = useRef<Float32Array | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastParticleSpawnRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) return;

    const path = pathRef.current;
    const canvas = canvasRef.current;
    const symbol = symbolRef.current;
    if (!path || !canvas || !symbol) return;

    const totalLen = path.getTotalLength();
    if (totalLen <= 0) return;

    lastLitRef.current = new Float32Array(PATH_SAMPLES).fill(0);
    particlesRef.current = [];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = symbol.clientWidth || VIEW_W;
    const cssH = symbol.clientHeight || VIEW_H;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scaleX = cssW / VIEW_W;
    const scaleY = cssH / VIEW_H;
    const toCanvas = (x: number, y: number) => ({
      x: x * scaleX,
      y: y * scaleY,
    });

    const cream: [number, number, number] = [237, 224, 200];
    const bronze: [number, number, number] = [
      LANDING_BRONZE.r,
      LANDING_BRONZE.g,
      LANDING_BRONZE.b,
    ];
    const gold: [number, number, number] = [
      LANDING_GOLD.r,
      LANDING_GOLD.g,
      LANDING_GOLD.b,
    ];

    const trailArcLen = totalLen * TRAIL_ARC_FRACTION;
    const samplePoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= PATH_SAMPLES; i++) {
      const len = (i / PATH_SAMPLES) * totalLen;
      const p = path.getPointAtLength(len);
      const mapped = toCanvas(p.x, p.y);
      samplePoints.push({ x: mapped.x, y: mapped.y });
    }

    const sampleBehind = (len: number, delta: number) => {
      const behind = len - delta;
      return path.getPointAtLength(behind >= 0 ? behind : behind + totalLen);
    };

    const spawnParticle = (headX: number, headY: number, headLen: number, now: number) => {
      const pBehind = sampleBehind(headLen, Math.max(1.5, totalLen * 0.006));
      const fx = headX - pBehind.x;
      const fy = headY - pBehind.y;
      const flen = Math.hypot(fx, fy) || 1;
      const backAngle = Math.atan2(-fy / flen, -fx / flen);
      const spread = Math.PI * 0.72;
      const angle = backAngle + (Math.random() - 0.5) * spread;
      const speed = 10 + Math.random() * 16;

      particlesRef.current.push({
        x: headX + (Math.random() - 0.5) * 1.5,
        y: headY + (Math.random() - 0.5) * 1.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: now,
      });

      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
      }
    };

    const stepParticles = (dtMs: number, now: number) => {
      const dt = dtMs / 1000;
      const alive: Particle[] = [];

      for (const p of particlesRef.current) {
        const age = now - p.born;
        if (age >= PARTICLE_LIFE_MS) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += PARTICLE_GRAVITY * dt;
        p.vx *= PARTICLE_DRAG;
        p.vy *= PARTICLE_DRAG;
        alive.push(p);
      }

      particlesRef.current = alive;
    };

    const renderParticles = (now: number) => {
      const particles = particlesRef.current;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const el = particleRefs.current[i];
        if (!el) continue;

        const p = particles[i];
        if (!p) {
          el.style.opacity = "0";
          continue;
        }

        const age = now - p.born;
        const life = clamp01(1 - age / PARTICLE_LIFE_MS);
        const scale = 0.2 + life * 0.55;

        el.style.left = `${(p.x / VIEW_W) * 100}%`;
        el.style.top = `${(p.y / VIEW_H) * 100}%`;
        el.style.opacity = String(0.15 + life * 0.7);
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };

    let rafId = 0;
    let lastTs = performance.now();

    const drawTrail = (now: number, headLen: number) => {
      const lastLit = lastLitRef.current;
      if (!lastLit) return;

      const headIdx = Math.floor((headLen / totalLen) * PATH_SAMPLES) % PATH_SAMPLES;
      const spread = Math.max(3, Math.ceil((trailArcLen / totalLen) * PATH_SAMPLES));
      for (let k = -spread; k <= spread; k++) {
        const idx = (headIdx + k + PATH_SAMPLES) % PATH_SAMPLES;
        lastLit[idx] = now;
      }

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.25 * Math.min(scaleX, scaleY);

      for (let i = 0; i < PATH_SAMPLES; i++) {
        const p0 = samplePoints[i];
        const p1 = samplePoints[i + 1];
        const midLen = ((i + 0.5) / PATH_SAMPLES) * totalLen;
        const behind = wrapDistanceBehind(headLen, midLen, totalLen);

        const spatial =
          behind <= trailArcLen ? 1 - behind / trailArcLen : 0;
        const age = now - lastLit[i];
        const temporal =
          age < TRAIL_LINGER_MS ? 1 - age / TRAIL_LINGER_MS : 0;
        const combined = spatial * temporal;
        if (combined < 0.02) continue;

        const opacity = Math.max(
          DIM_BASE_OPACITY,
          combined * (0.35 + spatial * 0.65),
        );
        const tColor = spatial;
        const r = Math.round(lerp(bronze[0], cream[0], tColor * 0.85));
        const g = Math.round(lerp(bronze[1], cream[1], tColor * 0.85));
        const b = Math.round(lerp(bronze[2], cream[2], tColor * 0.85));
        const r2 = Math.round(lerp(r, gold[0], tColor * 0.4));
        const g2 = Math.round(lerp(g, gold[1], tColor * 0.4));
        const b2 = Math.round(lerp(b, gold[2], tColor * 0.4));

        ctx.strokeStyle = `rgba(${r2},${g2},${b2},${opacity})`;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    };

    const updateDom = (
      headX: number,
      headY: number,
      headLen: number,
      dtMs: number,
      now: number,
    ) => {
      if (now - lastParticleSpawnRef.current >= PARTICLE_SPAWN_MS) {
        lastParticleSpawnRef.current = now;
        spawnParticle(headX, headY, headLen, now);
      }

      stepParticles(dtMs, now);

      const emitter = emitterRef.current;
      if (emitter) {
        emitter.style.left = `${(headX / VIEW_W) * 100}%`;
        emitter.style.top = `${(headY / VIEW_H) * 100}%`;
      }

      renderParticles(now);
    };

    const tick = (ts: number) => {
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;
      progressRef.current = (progressRef.current + dt / LOOP_MS) % 1;

      const headLen = progressRef.current * totalLen;
      const head = path.getPointAtLength(headLen);
      const now = performance.now();

      drawTrail(now, headLen);
      updateDom(head.x, head.y, headLen, dt, now);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion]);

  const rootClass = className
    ? `image-generation-loader ${className}`
    : "image-generation-loader";

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div
        ref={symbolRef}
        className={`image-generation-loader__symbol${reducedMotion ? " image-generation-loader__symbol--static" : ""}`}
      >
        <svg
          className="image-generation-loader__svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-hidden
        >
          <path
            ref={pathRef}
            className="image-generation-loader__path-base"
            d={INFINITY_PATH}
          />
        </svg>
        {!reducedMotion ? (
          <>
            <canvas
              ref={canvasRef}
              className="image-generation-loader__canvas"
              aria-hidden
            />
            <div className="image-generation-loader__overlay" aria-hidden>
              <div
                ref={emitterRef}
                className="image-generation-loader__emitter image-generation-loader__shine"
              />
              {Array.from({ length: MAX_PARTICLES }, (_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    particleRefs.current[i] = el;
                  }}
                  className="image-generation-loader__particle image-generation-loader__shine"
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className="image-generation-loader__caption">{label}</p>
    </div>
  );
}
