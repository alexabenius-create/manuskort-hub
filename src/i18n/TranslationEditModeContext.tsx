// Edit-mode-context: är admin i översättningsläge eller inte?
// Persisteras i sessionStorage så det överlever sidbyten men inte browser-omstart.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface Ctx {
  editMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (v: boolean) => void;
}

const TranslationEditModeContext = createContext<Ctx | undefined>(undefined);

const KEY = "manuskort-translation-edit-mode";

export function TranslationEditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(KEY) === "1";
  });

  useEffect(() => {
    if (editMode) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  }, [editMode]);

  const toggleEditMode = () => setEditModeState((v) => !v);
  const setEditMode = (v: boolean) => setEditModeState(v);

  return (
    <TranslationEditModeContext.Provider value={{ editMode, toggleEditMode, setEditMode }}>
      {children}
    </TranslationEditModeContext.Provider>
  );
}

export function useTranslationEditMode() {
  const ctx = useContext(TranslationEditModeContext);
  if (!ctx) {
    // Tillåt utanför provider — då är edit-mode bara av.
    return { editMode: false, toggleEditMode: () => {}, setEditMode: () => {} };
  }
  return ctx;
}
