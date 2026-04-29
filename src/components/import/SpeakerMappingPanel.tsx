import { useTranslation } from "react-i18next";
import { useImportStore } from "@/lib/import/importStore";
import { Users } from "lucide-react";

interface ExistingPanelist {
  id: string;
  name: string;
  color: string;
}

interface Props {
  existing: ExistingPanelist[];
}

export function SpeakerMappingPanel({ existing }: Props) {
  const { speakers, updateSpeaker } = useImportStore();

  if (speakers.length === 0) return null;

  return (
    <div className="bg-surface rounded-2xl shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-tight">
            {speakers.length} talare upptäckta
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Justera namn eller välj vad som ska hända med varje
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {speakers.map((s) => (
          <div
            key={s.tempId}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-2"
          >
            <div
              className="h-7 w-7 rounded-full shrink-0"
              style={{ backgroundColor: s.color || "#F5D76E" }}
              aria-hidden
            />
            <input
              type="text"
              value={s.detectedName}
              onChange={(e) =>
                updateSpeaker(s.tempId, { detectedName: e.target.value })
              }
              className="flex-1 min-w-0 bg-transparent text-[14px] font-medium outline-none focus:ring-1 focus:ring-accent-blue rounded px-1 py-0.5"
              aria-label="Talarens namn"
            />
            <select
              value={s.action === "existing" ? `e:${s.existingPanelistId}` : s.action}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "new")
                  updateSpeaker(s.tempId, {
                    action: "new",
                    existingPanelistId: undefined,
                  });
                else if (v === "ignore")
                  updateSpeaker(s.tempId, {
                    action: "ignore",
                    existingPanelistId: undefined,
                  });
                else if (v.startsWith("e:"))
                  updateSpeaker(s.tempId, {
                    action: "existing",
                    existingPanelistId: v.slice(2),
                  });
              }}
              className="h-9 rounded-lg bg-background border border-border text-[13px] px-3"
            >
              <option value="new">Skapa som ny deltagare</option>
              {existing.map((p) => (
                <option key={p.id} value={`e:${p.id}`}>
                  Koppla till {p.name || "(namnlös)"}
                </option>
              ))}
              <option value="ignore">Ignorera (inte en talare)</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
