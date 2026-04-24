import { UseCaseLayoutV2 } from "@/components/landing/UseCaseLayoutV2";
import { getUseCase } from "@/lib/useCases";

export default function TalareV2() {
  const useCase = getUseCase("talare")!;
  return <UseCaseLayoutV2 useCase={useCase} />;
}
