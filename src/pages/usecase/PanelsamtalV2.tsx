import { UseCaseLayoutV2 } from "@/components/landing/UseCaseLayoutV2";
import { getUseCase } from "@/lib/useCases";

export default function PanelsamtalV2() {
  const useCase = getUseCase("panelsamtal")!;
  return <UseCaseLayoutV2 useCase={useCase} />;
}
