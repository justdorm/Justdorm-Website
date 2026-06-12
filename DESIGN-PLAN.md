# Justdorm.com — Interior Site Overhaul Plan

The homepage now has a real identity: a black void, the 3D J/D monogram with CMY split-color
overlap, film grain, Precious Sans, and glow-on-hover. The rest of the site predates it.
This plan extends that identity into a coherent design system — "a print shop that fell into
a rave" — and rebuilds every interior page on top of it.

**Core concept: CMY as wayfinding.** The homepage already implies it — Motion Design hovers
cyan, Creative Technology hovers magenta, and the About headshot glows yellow/amber. Make that
official: every section owns one ink. Cyan = Motion, Magenta = Creative Tech, Yellow = About.
Accent colors, hover glows, selection color, underlines, and scroll-reveal tints all key off
the section's ink. The site reads as one CMYK system instead of five unrelated pages.

---

## Phase 0 — Shared foundation (`site.css` + `site.js`)

The skeleton everything else hangs on. One stylesheet and one script shared by all interior
pages (homepage keeps its own scene files).

**Design tokens (CSS custom properties)**
- `--ink-c: #00ffff`, `--ink-m: #ff00ff`, `--ink-y: #ffe600`, `--paper: #fff`, `--void: #000`
- Each page sets `--accent` via a body class (`theme-cyan`, `theme-magenta`, `theme-yellow`)
- Fluid type scale with `clamp()`; formal roles for the Precious Sans cuts
  (BlackItalic = display, DemiBoldItalic = headings, Medium = body, LightItalic = captions/meta)

**Shared header**
- Keep the 3D JD logo canvas (it already supports `data-mode="header"`)
- Nav links get an active state in the section's ink + an animated underline
- Collapses to a clean stacked/hamburger layout under 480px (currently it just wraps)

**Shared footer (new — currently pages just end)**
- Email CTA ("Let's make something — justin@justdorm.com"), Instagram, and on case studies
  a prev/next project rail

**Motion system (the part that sells you as a motion designer)**
- Scroll reveals: IntersectionObserver + CSS — elements rise/fade in with stagger;
  headings get a slight chromatic-split that resolves as they settle (CMY misregistration
  snapping into register — on-brand "print" gag)
- Page transitions: View Transitions API cross-fade/slide between pages, with graceful
  fallback where unsupported
- Kill `* { transition: all 0.5s ease-out }` in styles.css — it makes layout changes smear
  and fights every animation; replace with scoped transitions
- `prefers-reduced-motion`: reveals become instant, grain pauses, transitions disabled
- Grain overlay stays (it's signature) but rendered as a small tiled canvas scaled up
  instead of a full-resolution buffer regenerated every frame — same look, ~95% less work

---

## Phase 1 — Motion Design page (cyan)

A film page that behaves like film, not an iframe dump.

- **Hero:** full-bleed reel with an oversized kinetic "MOTION DESIGN" title — outlined
  letterforms with a cyan split that drifts subtly on scroll
- **Click-to-play facades:** replace the 5 eager YouTube/Vimeo iframes with poster-frame
  cards (thumbnail + play glyph). The iframe is injected only on click. This is the single
  biggest performance win on the site — the page currently boots five players on load
- **Filmography grid:** alternating wide/narrow editorial layout instead of a centered
  single column; each card gets a caption strip (title · year · role) in the meta type style
- **Hover:** poster scales slightly, cyan glow blooms, title slides — the existing glow
  language, applied consistently
- **Lightbox option:** clicking a card can open the player in a full-viewport overlay so
  films are watched big, on black, like a screening

## Phase 2 — Creative Technology index (magenta)

From a thumbnail list to an editorial case-study showcase.

- **Numbered projects, print-style:** 01 — Spin X Shift … 05 — Rave Visuals, big index
  numerals in the display cut
- **Full-width alternating rows:** large still on one side, project name + one-line
  description + venue tag + "View case study →" on the other; rows alternate left/right
- **Hover:** still zooms ~4% with a magenta bloom; the arrow animates
- Fix the markup while we're in there (the list is currently nested inside a duplicated
  `.project-cont` and the grid has a stray `</div>`)

## Phase 3 — Case study template (all 5 subpages)

One unified, beautiful template; five pages inherit it.

- **Hero:** project title in display type, one-line subtitle, and a meta strip —
  Role / Tools / Venue / Year — in the caption style
- **Feature video** full-width below the hero
- **Narrative sections:** the current wall-of-text paragraphs get broken into titled
  sections (Concept → Build → Show night) with generous spacing and occasional pull quotes
- **"How it works" block:** the tech breakdowns (TouchDesigner, depth cameras, NDI, MIDI,
  StreamDiffusion…) styled distinctly — monospace-adjacent meta type on a faint panel —
  so the creative-technologist credibility is legible at a skim
- **Footer rail:** prev/next project with thumbnails, so visitors flow through the whole
  portfolio instead of dead-ending
- Per-page `<title>` + meta description + Open Graph tags (every page is currently
  "Justin Dormitzer Portfolio" with no description)

## Phase 4 — About page (yellow)

- **Two-column hero:** headshot (keep the warm glow — it's the yellow ink) beside the
  intro, broken into short readable paragraphs
- **"Shown at" strip:** SIGGRAPH · BitBasel · Sérum Light Festival · VIEW Conference ·
  Porsche Studio as a styled credentials row instead of buried prose
- **Contact CTA:** proper email button + Instagram, not underlined inline links
- **Artwork gallery:** CSS grid masonry (drop the Masonry/imagesLoaded CDNs), captions
  revealed on hover, click-to-enlarge lightbox, lazy-loaded images
- Replace the `hue-rotate` hover (it falsifies the art's colors) with a scale + caption
  reveal

## Phase 5 — Site-wide polish, performance, SEO

- **Images:** convert/compress to WebP with width/height attributes and `loading="lazy"` —
  `Census.png` is 12.3 MB, thumbnails run 1–2 MB each; target <200 KB per image
- **Dead weight:** remove `index copy.html`, the stray 660-byte `three.js`, per-page CDN
  scripts that aren't used (masonry/imagesloaded are loaded on every page, used on one);
  audit `imgs/` for unreferenced multi-MB files (8.4 MB flyer, 4.3 MB poster)
- **HTML validity:** stray `</div>`s, scripts placed after `</body>`, duplicated containers
- **URLs:** add no-space aliases for `Rave Visuals.html` / `Summer Explorations.html`
  (keep the old files as meta-refresh redirects so shared links don't break)
- **Accessibility:** real alt text, `:focus-visible` states in the accent ink, contrast
  check on meta text, reduced-motion support throughout
- **SEO/social:** unique titles ("Spin X Shift — Audio-Reactive Visuals at Porsche Studio
  | Justdorm"), descriptions, OG/Twitter cards with project stills

---

## Build order

| Step | Deliverable | Depends on |
|------|-------------|------------|
| 1 | `site.css` + `site.js` foundation, shared header/footer | — |
| 2 | Motion Design page | 1 |
| 3 | Creative Technology index | 1 |
| 4 | Case study template → applied to all 5 | 1, 3 |
| 5 | About page | 1 |
| 6 | Performance / SEO / accessibility pass | 2–5 |

No framework, no build step — the site stays hand-rolled static HTML/CSS/JS, which suits
it. Verify each phase in a local preview at desktop and mobile widths before moving on.
