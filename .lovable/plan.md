
# Manuskort — Steg 1: Fundament (slutgiltig plan)

Allt är inarbetat. Implementerar enligt nedan när du växlar till default mode.

## Designreferens (från dummy-HTML)
- Tokens: `#F7F5F0` bg, `#FFFFFF` surface, `#F1EFE8` surface-2, `#1A1917` text, `#6B6A65` muted, `#A8A7A2` faint, cues `#D85A30`/`#BA7517`/`#0F6E56`, border 0.5px @ 10–18% svart, radius 10px
- Fraunces (serif, manustext + titel) + DM Mono (metadata, knappar, tider, kortnummer)
- Toppbar: sticky, blur, segmenterade ctrl-grupper med uppercase mono-label
- Kort: header (kortnr · roll-select · titel · drag-handtag) → ts-row (Start/Slut/duration-chip) → body (Tiptap + note-col 200px) → cue-footer (3 fält med färgade prickar)
- fadeUp 8px-animation, sz-sm/md/lg styr font-size i manustextan

## Tillägg från sista meddelandet
1. **Flush-skydd**: `beforeunload` + `pagehide` + `visibilitychange (hidden)` itererar global `pendingFlushes`-Map och kör synkron sparning via `sendBeacon` (fetch `keepalive` som fallback)
2. **Placeholders**: använder `placeholders`-objektet från dummyn ordagrant per roll (Moderator: Introduktion/Fråga till panelen/Följdfråga/Publikfråga/Överlämning/Avslutning · Talare: Öppningsanförande/Kärnbudskap/Exempel/Uppmaning/Avslutande ord)

## Bygger i denna ordning
1. **Designsystem** — tokens i `index.css` + `tailwind.config.ts`, Fraunces/DM Mono via `<link>` i `index.html`, ljust/mörkt läge, fadeUp-keyframe
2. **Lovable Cloud + Auth** — magisk länk + e-post/lösenord på `/auth`, `persistSession` + auto-refresh (30 dagar), varningstext om molnlagring vid registrering, skyddad route-wrapper
3. **DB + RLS** — `manuscripts` & `cards` enligt spec, RLS-policies per `auth.uid()`, `updated_at`-trigger, index på `(manuscript_id, position)`
4. **Bibliotek `/`** — lista, sök (titel+tags), filter (läge/tagg), "+ Nytt manus"-dialog (Moderator/Talare + titel), radmeny: Duplicera/Byt namn/Radera
5. **Redigeringsläge `/manus/:id`** — toppbar enligt dummy + spar-indikator (Sparar…/Sparat/fel m. retry), kort med Tiptap (fet/kursiv/under/markering/paus `/`), dnd-kit (bulk-position-save), kortmeny ⋯ (dela/slå ihop/flytta mening/panik-genvägar), ord-/tidsräkning (140 wpm), över-tröskel-markering
6. **Autospar** — `useAutosave(card)`-hook, 800 ms debounce **per kort**, diff mot snapshot, ett UPDATE per kort. Manus-metadata egen 800 ms-debounce. Flush-skydd registrerar varje pending sparning globalt.

## Skippas i steg 1 (kommer i steg 2)
Import (PDF/DOCX), visningsläge, Wake Lock, utskrifts-CSS, PDF-export, PWA, IndexedDB-cache, röst-teleprompter.
