
Bra. Då bygger jag SEO-fas 1 mot `manuskort.se`.

## Vad jag gör

### 1. `index.html`
- `<html lang="sv">` (är `en` nu)
- Canonical → `https://manuskort.se/`
- OG/Twitter URL → `.se`
- Behåll nuvarande OG-image (r2.dev) tills vi har en stabil i `public/`

### 2. Per-route meta via `react-helmet-async`
- Installera paketet
- Wrap `App` i `<HelmetProvider>` i `src/main.tsx`
- Ny `src/components/SEO.tsx` (props: title, description, canonical, noindex)

### 3. Sidspecifika meta-taggar
- **Landing** (`/`): unik title + desc + JSON-LD `SoftwareApplication` + `Organization`
- **Pricing** (`/priser`): "Priser – Manuskort" + desc om planer
- **Auth** (`/auth`): `noindex` (login bör inte rankas)
- **Library, Editor, Presentation, Settings, Import, Admin**: `noindex,nofollow` (auth-skyddade)

### 4. Tekniska filer
- `public/sitemap.xml` med `https://manuskort.se/` och `/priser`
- `public/robots.txt`: lägg till `Sitemap: https://manuskort.se/sitemap.xml`

## Vad DU gör efter publish
1. Klicka **Update** i Publish-dialogen
2. **Google Search Console** → lägg till property `manuskort.se` → verifiera (säg till om du får en HTML-meta-kod, jag lägger in den)
3. Skicka in `https://manuskort.se/sitemap.xml`
4. **URL Inspection → Request Indexing** för `/` och `/priser`
5. **Bing Webmaster Tools** → importera från Search Console

## Senare (egen fas)
- Stabil `public/og-image.png` (1200×630)
- Blogg-sektion för långsiktig organisk ranking

Säg "kör" så bygger jag.
