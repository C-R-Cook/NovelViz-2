"use client"

import { useState, useEffect } from "react"

// ─── Palette registry ────────────────────────────────────────────────────────
// Keep this in sync with the data-theme values in themes.css.
// 'swatch' is a representative mid-tone from the palette for the UI button.

const PALETTES = [
  {
    id: "moonlight-silver",
    name: "Moonlight Silver",
    swatch: "#7BA7C9",
    bg: "#0C0D11",
    accent: "#7BA7C9",
  },
  {
    id: "candle-light",
    name: "Candle Light",
    swatch: "#C49A3C",
    bg: "#0D0A06",
    accent: "#C49A3C",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    swatch: "#3AACB8",
    bg: "#060D12",
    accent: "#3AACB8",
  },
  {
    id: "aged-parchment",
    name: "Aged Parchment",
    swatch: "#7B4F1E",
    bg: "#F5EDD8",
    accent: "#A0622A",
  },
  {
    id: "forest-dusk",
    name: "Forest at Dusk",
    swatch: "#5A9E72",
    bg: "#080E09",
    accent: "#5A9E72",
  },
]

const COOKIE_KEY = "novelviz_dev_palette"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

// ─── Component ───────────────────────────────────────────────────────────────
export function DevPaletteSwitcher() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string>("moonlight-silver")

  // Read from cookie on mount and apply to <html>
  useEffect(() => {
    const saved = getCookie(COOKIE_KEY) ?? "moonlight-silver"
    applyPalette(saved)
    setActive(saved)
  }, [])

  function applyPalette(id: string) {
    document.documentElement.setAttribute("data-theme", id)
    setCookie(COOKIE_KEY, id)
    setActive(id)
  }

  const activePalette = PALETTES.find((p) => p.id === active) ?? PALETTES[0]

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        fontFamily: "monospace",
      }}
    >
      {/* Expanded panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            background: "rgba(10,10,14,0.96)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "14px 16px",
            width: 210,
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.3)",
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Dev Palette
          </div>

          {PALETTES.map((p) => {
            const isActive = p.id === active
            return (
              <button
                key={p.id}
                onClick={() => applyPalette(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  background: isActive
                    ? `rgba(255,255,255,0.06)`
                    : "transparent",
                  border: isActive
                    ? `1px solid rgba(255,255,255,0.12)`
                    : "1px solid transparent",
                  borderRadius: 6,
                  padding: "7px 10px",
                  cursor: "pointer",
                  marginBottom: 4,
                  transition: "all 0.15s ease",
                }}
              >
                {/* Swatch dot */}
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: p.swatch,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 8px ${p.swatch}` : "none",
                    transition: "box-shadow 0.2s",
                  }}
                />
                {/* Mini bg preview strip */}
                <div
                  style={{
                    width: 20,
                    height: 12,
                    borderRadius: 3,
                    background: p.bg,
                    border: "1px solid rgba(255,255,255,0.15)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: isActive
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.5)",
                    letterSpacing: 0.3,
                    textAlign: "left",
                    flex: 1,
                  }}
                >
                  {p.name}
                </span>
                {isActive && (
                  <span style={{ fontSize: 10, color: p.swatch }}>✦</span>
                )}
              </button>
            )
          })}

          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.07)",
              fontSize: 9,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: 1,
              textAlign: "center",
            }}
          >
            DEV ONLY — NOT VISIBLE IN PROD
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Theme: ${activePalette.name}`}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `conic-gradient(
            ${PALETTES[0].swatch} 0deg 72deg,
            ${PALETTES[1].swatch} 72deg 144deg,
            ${PALETTES[2].swatch} 144deg 216deg,
            ${PALETTES[3].swatch} 216deg 288deg,
            ${PALETTES[4].swatch} 288deg 360deg
          )`,
          border: "2px solid rgba(255,255,255,0.2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          boxShadow: open
            ? "0 0 20px rgba(255,255,255,0.2)"
            : "0 4px 16px rgba(0,0,0,0.5)",
          transition: "all 0.2s ease",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        {/* Inner dot showing current accent */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: activePalette.bg,
            border: `2px solid ${activePalette.swatch}`,
            transition: "all 0.3s",
          }}
        />
      </button>
    </div>
  )
}
