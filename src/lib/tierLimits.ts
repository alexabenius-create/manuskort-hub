export type Tier = "free" | "pro" | "admin";

/** Hård gräns för AI-förbättringar per månad för Pro-användare. */
export const AI_MONTHLY_LIMIT_PRO = 200;

export const LIMITS = {
  free: {
    manuscripts: 2,
    cardsPerManuscript: 15,
    panelistsPerManuscript: 5,
    docxImport: false,
  },
  pro: {
    manuscripts: Infinity,
    cardsPerManuscript: Infinity,
    panelistsPerManuscript: Infinity,
    docxImport: true,
  },
  admin: {
    manuscripts: Infinity,
    cardsPerManuscript: Infinity,
    panelistsPerManuscript: Infinity,
    docxImport: true,
  },
} as const;

export const TIER_LABEL: Record<Tier, string> = {
  free: "Gratis",
  pro: "PRO",
  admin: "Admin",
};

export function isUnlimited(n: number) {
  return !Number.isFinite(n);
}
