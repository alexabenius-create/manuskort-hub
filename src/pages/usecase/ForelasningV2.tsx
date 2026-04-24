import { UseCaseLayoutV2 } from "@/components/landing/UseCaseLayoutV2";
import { getUseCase } from "@/lib/useCases";

export default function ForelasningV2() {
  const useCase = getUseCase("forelasning")!;
  return <UseCaseLayoutV2 useCase={useCase} />;
}
