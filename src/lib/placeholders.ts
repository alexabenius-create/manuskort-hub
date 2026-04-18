// Roll-baserade placeholders för Tiptap-editorn (från dummy-HTML).
export const placeholders: Record<"moderator" | "speaker", string[]> = {
  moderator: [
    "Välkommen. I dag ska vi prata om…",
    "Min första fråga går till…",
    "Du nämnde nyss att… kan du utveckla?",
    "Vi öppnar för frågor från publiken…",
    "Tack så mycket. Nu lämnar jag över till…",
    "Tack till panelen och tack till er som lyssnat…",
  ],
  speaker: [
    "Tack för att jag får vara här i dag…",
    "Det viktigaste jag vill att ni tar med er är…",
    "Låt mig ge ett konkret exempel…",
    "Det jag vill be er göra är…",
    "Tack för att ni lyssnat.",
  ],
};

export function placeholderFor(role: "moderator" | "speaker", index: number): string {
  const list = placeholders[role];
  return list[index % list.length];
}
