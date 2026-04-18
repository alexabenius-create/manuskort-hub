import { useImportStore } from "@/lib/import/importStore";
import { Label } from "@/components/ui/label";

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
      <div>
        <h3 className="font-display text-[16px] font-semibold">Talare upptäckta</h3>
        <p className="text-[13px] text-muted-foreground">
          Vi hittade {speakers.length} talare i dokumentet. Välj hur de ska hanteras.
        </p>
      </div>
      <div className="space-y-2">
        {speakers.map((s) => (
          <div
            key={s.detectedName}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-2"
          >
            <div
              className="h-7 w-7 rounded-full shrink-0"
              style={{ backgroundColor: s.color || "#F5D76E" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium truncate">{s.detectedName}</p>
            </div>
            <select
              value={s.action === "existing" ? `e:${s.existingPanelistId}` : s.action}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "new") updateSpeaker(s.detectedName, { action: "new", existingPanelistId: undefined });
                else if (v === "ignore") updateSpeaker(s.detectedName, { action: "ignore", existingPanelistId: undefined });
                else if (v.startsWith("e:")) updateSpeaker(s.detectedName, { action: "existing", existingPanelistId: v.slice(2) });
              }}
              className="h-9 rounded-lg bg-background border border-border text-[13px] px-3"
            >
              <option value="new">Skapa som ny deltagare</option>
              {existing.map((p) => (
                <option key={p.id} value={`e:${p.id}`}>
                  Koppla till {p.name || "(namnlös)"}
                </option>
              ))}
              <option value="ignore">Ignorera</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
