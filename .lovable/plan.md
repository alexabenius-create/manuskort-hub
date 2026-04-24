## Fix: Grå scrollbar i presentationsläget

**Fil:** `src/components/presentation/PresentationCard.tsx` (rad 218)

**Ändring:** `overflow-y-auto` → `overflow-hidden`

**Motivering:** Auto-fit-logiken krymper texten tills den ryms i containern, och vid extrem overflow finns redan en mask-fade-effekt (`overflowAtMin`). Native scrollbaren är därför redundant och syns som ett grått fält i vissa viewports.