import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogImage?: string;
}

const SITE_URL = "https://manuskort.se";
const DEFAULT_OG = "https://manuskort.se/og-image.png";

export function SEO({
  title,
  description,
  canonical,
  noindex,
  nofollow,
  jsonLd,
  ogImage = DEFAULT_OG,
}: SEOProps) {
  const fullCanonical = canonical
    ? canonical.startsWith("http")
      ? canonical
      : `${SITE_URL}${canonical.startsWith("/") ? "" : "/"}${canonical}`
    : undefined;

  const robots = [noindex ? "noindex" : "index", nofollow ? "nofollow" : "follow"].join(",");

  return (
    <Helmet>
      <html lang="sv-SE" />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}
      {fullCanonical && <link rel="alternate" hrefLang="sv-SE" href={fullCanonical} />}
      {fullCanonical && <link rel="alternate" hrefLang="x-default" href={fullCanonical} />}
      <meta name="robots" content={robots} />
      <meta property="og:locale" content="sv_SE" />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
