import { UseCaseLayoutV2 } from "@/components/landing/UseCaseLayoutV2";
import { getUseCase } from "@/lib/useCases";

export default function ModeratorV2() {
  const useCase = getUseCase("moderator")!;
  return <UseCaseLayoutV2 useCase={useCase} />;
}
