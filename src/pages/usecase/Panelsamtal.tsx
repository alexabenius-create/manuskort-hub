import { UseCaseLayout } from "@/components/landing/UseCaseLayout";
import { getUseCase } from "@/lib/useCases";

export default function PanelsamtalPage() {
  const useCase = getUseCase("panelsamtal")!;
  return <UseCaseLayout useCase={useCase} />;
}
