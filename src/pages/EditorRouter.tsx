// TODO: Radera denna fil senast 2026-05-03.
// v1/v2 är utfasade — v3 är enda aktiva editorn sedan 2026-04-19.
// Routern används inte längre — /manus/:id renderar EditorV3 direkt i App.tsx.
// Filen ligger kvar som referens under sunset-perioden.
/**
 * EditorRouter — wrapper på /manus/:id som väljer EditorV1 eller EditorV3
 * baserat på användarens DB-preferens (profiles.editor_preference).
 *
 * Explicita routes /manus/:id/v1 och /manus/:id/v3 förbigår denna wrapper
 * och renderar respektive version direkt — useful för support/felsökning.
 */
import { lazy, Suspense } from "react";
import { useEditorPreference, resolveEditorVersion } from "@/hooks/useEditorPreference";

const EditorV1 = lazy(() => import("./Editor"));
const EditorV3 = lazy(() => import("./EditorV3"));

const Fallback = () => <div className="min-h-screen bg-background" aria-hidden="true" />;

export default function EditorRouter() {
  const { preference, loading, emergencyForceV1 } = useEditorPreference();

  if (loading) return <Fallback />;

  const version = resolveEditorVersion(preference, emergencyForceV1);

  return (
    <Suspense fallback={<Fallback />}>
      {version === "v3" ? <EditorV3 /> : <EditorV1 />}
    </Suspense>
  );
}
