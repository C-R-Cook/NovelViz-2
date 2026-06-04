# NovelViz — Palette Contrast Recommendations
**Ambient light readability — June 2026**

---

## Context

Both active palettes — Moonlight Silver and Candle Light — use very dark near-black backgrounds with low-luminance text tokens. Under controlled indoor lighting this reads as atmospheric and intentional. Under bright ambient light (daylight, overhead office lighting, coffee shop windows) the contrast ratio drops below comfortable reading thresholds, particularly for secondary and muted text layers.

Problem areas visible in screenshots:

- Search bar placeholder text (`#6b6355` muted on `#0c0a06` base) — estimated contrast ratio ~2.8:1, well below the WCAG AA target of 4.5:1 for normal text
- "FEATURED TITLES" section label — monospace, 10px, muted colour — becomes nearly invisible in bright rooms
- Dashboard sidebar secondary text and navigation labels — low contrast against the dark sidebar surface

---

## Guiding Principles

These recommendations aim to improve readability without altering the aesthetic character of either palette. The approach is additive luminance lifting — backgrounds move up slightly from near-black, and text tokens move up toward brighter values, while hue and warmth are preserved.

- Background tokens lifted by 5–10 lightness points (HSL). Still dark, still moody — just not near-zero black.
- Primary text targets minimum 7:1 contrast (WCAG AAA). Secondary text targets 4.5:1. Muted/label text targets 3:1 minimum.
- Accent colours adjusted minimally — hue unchanged, saturation preserved, luminance raised only where needed.
- Border tokens lifted so they remain perceptible against the raised background values.
- No changes to animation, spacing, typography scale, or component layout.

---

## Moonlight Silver — Proposed Token Changes

Moonlight Silver uses a cool blue-grey accent (`#7BA7C9`) on a very dark desaturated background. The proposed changes raise the background stack slightly and improve text legibility while keeping the cool, night-sky character.

| Token | Current | Proposed | Rationale |
|---|---|---|---|
| `--bg-base` | `#0a0a0f` | `#12121a` | Lifted slightly — less pure black |
| `--bg-surface` | `#111118` | `#1a1a24` | More visible surface separation |
| `--bg-elevated` | `#18181f` | `#222230` | Elevated cards now distinct |
| `--text-primary` | `#e8e4d9` | `#f2efe8` | Brighter warm white — more punch |
| `--text-secondary` | `#a89f8c` | `#c4b99a` | Secondary text lifted ~20% luminance |
| `--text-muted` | `#6b6355` | `#8a7d6a` | Muted labels now readable in ambient light |
| `--accent` | `#7BA7C9` | `#8fb8d8` | Accent slightly brighter — stays cool blue |
| `--accent-dim` | `#4a6d8a` | `#5a7f9e` | Dim accent lifted to remain visible |
| `--border-subtle` | `#1e1e28` | `#2a2a3a` | Subtle border now perceptible on dark bg |
| `--border-default` | `#2d2d3d` | `#3c3c52` | Default border clearer separation |
| `--highlight` | `#9dc4e0` | `#aed2ec` | Highlight kept cool, slightly lifted |

> **Implementation note:** In `globals.css`, update the `[data-theme="moonlight-silver"]` block only. No component changes required — all components already reference tokens via `var(--token-name)`.

---

## Candle Light — Proposed Token Changes

Candle Light uses a warm gold accent (`#C49A3C`) on a very dark warm-brown background. The current `--bg-base` (`#0c0a06`) is essentially black, causing the muted and secondary text tokens to disappear in bright ambient light. The proposed changes warm the backgrounds to a visible dark brown and lift text tokens proportionally.

| Token | Current | Proposed | Rationale |
|---|---|---|---|
| `--bg-base` | `#0c0a06` | `#141208` | Lifted from near-black to very dark brown |
| `--bg-surface` | `#14110a` | `#1e1a0e` | Surface now distinguishable in bright rooms |
| `--bg-elevated` | `#1c1810` | `#282215` | Elevated panels clearly distinct |
| `--text-primary` | `#e8dcc8` | `#f5edda` | Warm cream lifted for reading comfort |
| `--text-secondary` | `#a8926a` | `#c4aa7e` | Gold-toned secondary more legible |
| `--text-muted` | `#6b5a3a` | `#8a7248` | Muted text — was nearly invisible outdoors |
| `--accent` | `#C49A3C` | `#d4aa4a` | Gold accent slightly brighter, stays warm |
| `--accent-dim` | `#7a5e22` | `#9a7830` | Dim accent was lost in dark surface |
| `--border-subtle` | `#1e1a0f` | `#2c2618` | Subtle borders visible against dark bg |
| `--border-default` | `#2e2818` | `#3e3622` | Default border clear without harshness |
| `--highlight` | `#d4aa50` | `#e0ba5e` | Highlight warm gold — slightly elevated |

> **Implementation note:** The `--text-muted` change from `#6b5a3a` to `#8a7248` is the highest-impact single change — this token is used on all eyebrow labels, placeholder text, and section dividers, which are the most problematic elements in the screenshots.

---

## Tokens Not Changing

The following tokens are either already at adequate contrast levels or are structural/non-text tokens where luminance adjustment would alter the aesthetic meaningfully:

- `--accent-glow`, `--glow-color` — ambient glow overlays; luminance changes here affect the page-level mood too broadly
- `--badge-bg`, `--badge-text` — small UI elements already at adequate contrast
- `--shelf-shadow` — decorative only, no readability impact
- `--text-on-accent` — white on accent already passes AAA on both palettes
- All four remaining palettes (Deep Ocean, Aged Parchment, Forest at Dusk, Antiquarian) — not in active use; review separately when needed

---

## Implementation

### 1. Update globals.css

Locate the two palette blocks and apply the hex value changes from the tables above. No other files need editing.

**Cursor prompt:**

```
In app/globals.css, update the CSS custom property values for
[data-theme="moonlight-silver"] and [data-theme="candle-light"]
using the hex values in the contrast reference document. Do not
change any other palette blocks, component files, or token names.
```

### 2. Verify in browser

- Open the dev server in both palettes via the palette switcher
- Check: discover page hero, search bar placeholder, "FEATURED TITLES" label, dashboard sidebar nav text
- Use browser DevTools accessibility checker to confirm contrast ratios on the updated muted text

### 3. Commit

```
chore: improve contrast ratios on Moonlight Silver and Candle Light palettes for ambient light readability
```

---

*Prepared for Chris — NovelViz dev session, June 2026*
