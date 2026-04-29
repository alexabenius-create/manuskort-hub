// Popover för att redigera en översättningsnyckel.
// Visar svensk källtext, AI-översättning, och fält för manuell version.
// Spara → upsert till translation_overrides. Återställ till AI → delete.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n, { applyOverrides } from "./index";
import { refreshOverrides, getOverrideMeta, isManualOverride } from "./overrides";
// Importera båda källfilerna så vi kan visa svenska källan + den ursprungliga AI-versionen
// i popovern oavsett aktuellt språk.
import svResources from "./locales/sv.json";
import enResources from "./locales/en.json";

interface Props {
  translationKey: string;
  values?: Record<string, string | number>;
  onClose: () => void;
}

function lookupNested(obj: any, path: string): string {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return "";
  }
  return typeof cur === "string" ? cur : "";
}

export function TranslationEditPopover({ translationKey, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const sourceText = lookupNested(svResources, translationKey);
  const aiText = lookupNested(enResources, translationKey);
  const meta = getOverrideMeta(translationKey);
  const currentValue = i18n.getResource("en", "translation", translationKey) as string;
  const wasOverridden = isManualOverride(translationKey);

  const [draft, setDraft] = useState<string>(currentValue ?? aiText ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setDraft(currentValue ?? aiText ?? "");
  }, [currentValue, aiText]);

  const sourceChanged = wasOverridden && meta && meta.source_text_at_override !== sourceText;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("translation_overrides")
        .upsert(
          {
            key: translationKey,
            language: "en",
            source_text: sourceText,
            source_text_at_override: sourceText,
            value: draft,
            updated_by: user.id,
          },
          { onConflict: "key,language" },
        );
      if (error) throw error;
      // Applicera direkt så UI uppdateras innan realtime-eventet kommer
      applyOverrides("en", { [translationKey]: draft });
      refreshOverrides();
      toast({ title: t("translation_edit.saved") });
      onClose();
    } catch (e) {
      console.error(e);
      toast({
        title: t("translation_edit.save_error"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToAi = async () => {
    setResetting(true);
    try {
      const { error } = await supabase
        .from("translation_overrides")
        .delete()
        .eq("key", translationKey)
        .eq("language", "en");
      if (error) throw error;
      // Återgå direkt till AI-versionen lokalt
      applyOverrides("en", { [translationKey]: aiText });
      refreshOverrides();
      onClose();
    } catch (e) {
      console.error(e);
      toast({
        title: t("translation_edit.save_error"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("translation_edit.popover_title")}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-[10px]">{translationKey}</Badge>
            {wasOverridden && (
              <Badge className="bg-amber-400 text-zinc-900 hover:bg-amber-400">Manuellt låst</Badge>
            )}
            {sourceChanged && (
              <Badge variant="destructive">Källtexten har ändrats</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground">{t("translation_edit.source_label")}</Label>
            <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap">{sourceText || <em className="text-muted-foreground">(saknas)</em>}</div>
            {sourceChanged && meta && (
              <p className="text-xs text-amber-600 mt-1">
                Tidigare version: <span className="italic">{meta.source_text_at_override}</span>
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{t("translation_edit.ai_label")}</Label>
            <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap">{aiText || <em className="text-muted-foreground">(saknas)</em>}</div>
          </div>

          <div>
            <Label htmlFor="manual-translation" className="text-xs">{t("translation_edit.manual_label")}</Label>
            <Textarea
              id="manual-translation"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {wasOverridden && (
            <Button
              variant="outline"
              onClick={handleResetToAi}
              disabled={resetting || saving}
            >
              {t("translation_edit.reset_to_ai")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving || resetting}>
            {t("translation_edit.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || draft === aiText && !wasOverridden}>
            {saving ? "…" : t("translation_edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
