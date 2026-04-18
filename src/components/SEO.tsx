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
const DEFAULT_OG = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f2656173-9968-4162-84ce-f134ab9818a1/id-preview-38e7a4e0--cd4ac673-0ac9-4b3d-b57f-a97abc72e096.lovable.app-1776526036968.png";

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
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}
      <meta name="robots" content={robots} />
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
