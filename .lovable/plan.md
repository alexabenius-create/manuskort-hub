

## Plan: Fixa bubble-meny + verklig auto-hide i presentationsläget

### Problem 1 — Bubble-menyn spränger mobilskärmen

**Fil:** `src/components/editor/FormatBubbleMenu.tsx`

På 390px-skärm: 6 verktygsikoner + separator + 4 panelist-pillar (varje upp till 140px) = långt över skärmens bredd.

**Åtgärd (mobil):**
1. Panelist-pillarna förkortas till **färgpunkt + initial** (t.ex. `[A]` i Annas gula, `[J]` i Johans blå) — ca 28px var i stället för 100–140px.
2. På mobil: panelist-pillarna går från max-width 140px → fast 28x28 rund knapp med initial.
3. `flex-wrap` tillåts om det ändå skulle bli för brett, så menyn bryter på två rader hellre än att klippas.
4. Tooltip/aria-label behåller fullt namn så funktionen är intakt.

### Problem 2 — Topbar/footer försvinner inte i praktiken

Roten av problemet, i prioritetsordning:

**A) iOS Safari URL-bar visas alltid** (skärmbilden visar exakt detta — `manuskort.se`-baren). Detta är inte vår topbar utan **Safari själv**. iOS Safari döljer URL-baren bara när sidan kan scrollas vertikalt och användaren scrollar nedåt. Vår presentation är `overflow-hidden` → Safari döljer aldrig sin chrome.

**B) Vår egen topbar/footer** har auto-hide (2s), men timern startar bara om vid `currentIndex`-byte eller meny-öppning. Den startar inte om vid touch (som visar och nollställer till 3s — bra). Logiken funkar, men användaren ser fortfarande Safari-baren och tror att det är vår.

### Föreslagna åtgärder

**Steg 1 — Knäcka iOS Safari URL-bar (A)**
Lägg in en *minimal scroll-trigger*: gör presentationsytan 1px högre än viewport så Safari känner att sidan är scrollbar, och scrolla 1px ned vid mount. Detta tvingar iOS att kollapsa URL-baren när presentation startar. Standard-trick på iOS-webbappar.

```tsx
useEffect(() => {
  if (!isMobile || menuOpen) return;
  // Trigga iOS URL-bar-kollaps
  window.scrollTo(0, 1);
  const t = setTimeout(() => window.scrollTo(0, 1), 100);
  return () => clearTimeout(t);
}, [isMobile, menuOpen]);
```

Plus: lägg till `min-height: calc(100dvh + 1px)` på root-elementet så Safari ser sidan som scrollbar.

**Steg 2 — Lägg till "Lägg till på hemskärmen"-tips i Rotate-overlayen**
För iPhone-användare: en kort textrad i `RotateDeviceOverlay` om att "Lägg till manuskort.se på hemskärmen för fullskärm utan Safari-chrome". PWA-läge är enda sättet att helt bli av med Safaris URL-bar på iOS.

**Steg 3 — Säkra vår egen auto-hide (B)**
- Garantera att tap *bara visar* topbar i 3s, sen göms igen — det funkar redan men dubbelkolla att `xTimerRef`-cleanup fungerar.
- Lägg till en återställning av timern vid `pointermove` också (för iPad med trackpad/Pencil), inte bara touchend.

**Steg 4 — Manifest-fil för PWA-stöd**
Lägg till `public/manifest.webmanifest` med `display: "standalone"` så att om användaren lägger till på hemskärmen körs appen utan Safari-chrome överhuvudtaget. Länka från `index.html`.

### Filer som ändras

| Fil | Ändring |
|---|---|
| `src/components/editor/FormatBubbleMenu.tsx` | Panelist-pillar → färg+initial på mobil, flex-wrap fallback |
| `src/pages/Presentation.tsx` | iOS scroll-trick + pointermove-återställning av auto-hide |
| `src/components/presentation/RotateDeviceOverlay.tsx` | iOS-tips om hemskärm |
| `public/manifest.webmanifest` (ny) | PWA-manifest för standalone-läge |
| `index.html` | Länka manifest + apple-mobile-web-app-meta |

### Genomförandeordning

Förslag: kör Steg 1 + 3 först (snabba quick wins som löser kärnproblemet), verifiera på iPhone, sen Steg 2 + 4 (PWA + tipset) som långsiktig lösning.

**Vill du köra alla 4 stegen direkt, eller dela upp 1+3 → verifiera → 2+4?**

