

## Mobile-optimering: sammanfattning och plan

Jag har granskat alla berörda filer (`Landing.tsx`, `Library.tsx`, `Editor.tsx` + editor-komponenter, `UseCaseLayout.tsx`). Här är planen, uppdelad i logiska steg.

---

### Steg 1 — Landningssidan: fixa radbrytningar mitt i meningar

**Problem:** På mobil bryts meningar olämpligt eftersom `flex-wrap` på listor wrappar mellan ord.

**Fix i `src/pages/Landing.tsx`:**
1. **"Gratis att testa · Inget kreditkort · Igång på under en minut"** (hero + bottom CTA): byt `<ul>` med separata `<li>` till en enda rad med `whitespace-nowrap` per item, eller använd en stack på mobil (vertikal lista) → horisontell på sm+. Bäst: `flex-col sm:flex-row` så varje påstående får egen rad på mobil.
2. **"Inga hinder. Bara att köra."** (kicker/subtitel): lägg `whitespace-nowrap` eller använd `<br className="sm:hidden" />` mellan meningarna så de hamnar på varsin rad på mobil istället för att brytas mitt i.
3. **"Allt du undrar — kort förklarat."** (FAQ-rubrik): samma princip — `<br className="sm:hidden" />` efter "undrar —" eller gör `text-balance`/justera `max-w` så hela meningen håller ihop.

---

### Steg 2 — Biblioteket (mobilvy): omordna actions + kortlayout

**Fix i `src/pages/Library.tsx`:**
1. **Actions-rad på mobil**: "+ Nytt manus" till vänster (i linje med sökrutan), "Importera" direkt till höger. Behåll desktop som idag.
2. **Manuskorten — flytta checkrutan**: 
   - Idag: checkrutan ligger uppe till vänster och stjäl yta från titel.
   - Nytt: placera checkrutan **under "..."-menyn** (höger sida, nere). Då kan titel/metadata pusha hela vägen ut till vänster och få mer plats.

---

### Steg 3 — Editor mobil: ny tvåradig navbar

**Fix i `src/pages/Editor.tsx` (topbar-sektionen):**

Bygg en mobil-only topbar med två rader:
- **Rad 1:** `← Bibliotek` · Manustitel · Antal kort · SaveIndicator
- **Rad 2:** Måltid-ikon · Vy-inställningar · Deltagare · `+ Nytt kort` · `Starta` · Hjälp

Desktop-topbaren behålls som idag (en rad). Använd `md:hidden` / `hidden md:flex` för att växla.

---

### Steg 4 — Editor mobil: ta bort lågprioriterat

**I editor-topbaren och bubble menus:**
1. Dölj **skriv ut-ikonen** på mobil (`hidden md:inline-flex`)
2. Dölj **Hitta & ersätt** på mobil
3. Dölj manus-typ-texten ("talare"/"moderator") på mobil

---

### Steg 5 — Städa upp kort-menyn på mobil

**Fil: `src/components/editor/CardMoreMenu.tsx` + ev. `ManusCardV2.tsx`:**

Baserat på bilagan (kort med "Kort 01/10", TALARE-chip, ord-räkning, tid-chips, "...") — rensa, gruppera och förstora touch-targets på mobil. Konsekvent ikon-storlek och spacing.

---

### Steg 6 — Mindre manustext på mobil i kort

**Fil: `src/components/editor/CardBlockView.tsx` (eller där `.ProseMirror` text-storlek sätts):**

Halvera font-size för manustexten i korten på mobil. T.ex. om `text-[18px]` idag → `text-[14px] md:text-[18px]`. Påverkar bara editor-kortens innehåll, inte rubriker eller chips.

---

### Steg 7 — Hamburgermeny för Landing + Bibliotek

**Filer:** `src/pages/Landing.tsx`, `src/pages/Library.tsx`, `src/components/landing/UseCaseLayout.tsx`.

På mobil (`md:hidden`): ersätt nav-knapparna med en hamburger-ikon som öppnar en `Sheet` (höger-sida) med samma länkar/CTAs. Desktop oförändrat. **OBS: gäller ej editor-toppbaren** (den får sin egen tvåradiga layout i Steg 3).

---

### Steg 8 (separat tråd) — Helskärm horisontellt

Du sa själv: detta är steg 2 efter att vi sett över ovan. **Inkluderas inte nu.** Återkommer som separat plan när du flaggar.

---

### Filer som ändras (sammanfattning)

| Fil | Ändring |
|---|---|
| `src/pages/Landing.tsx` | Radbrytningar (Steg 1), hamburger (Steg 7) |
| `src/components/landing/UseCaseLayout.tsx` | Hamburger (Steg 7) |
| `src/pages/Library.tsx` | Actions-ordning (Steg 2), kortlayout (Steg 2), hamburger (Steg 7) |
| `src/pages/Editor.tsx` | Ny mobil-topbar (Steg 3), gömma print/find (Steg 4) |
| `src/components/editor/CardMoreMenu.tsx` | Städa kort-meny (Steg 5) |
| `src/components/editor/ManusCardV2.tsx` / `CardBlockView.tsx` | Mindre brödtext på mobil (Steg 6), ev. dölja typ-text (Steg 4) |

---

### Genomförandeordning

Jag föreslår att vi kör i den ordning stegen står (1 → 7). Varje steg är en självständig commit så du kan verifiera mobilt allt eftersom. Vill du att jag kör **alla 7 stegen i en runda**, eller **steg för steg med verifiering emellan**?

