import { UseCaseLayout } from "@/components/landing/UseCaseLayout";
import { getUseCase } from "@/lib/useCases";

export default function ForelasningPage() {
  const useCase = getUseCase("forelasning")!;
  return <UseCaseLayout useCase={useCase} />;
}
