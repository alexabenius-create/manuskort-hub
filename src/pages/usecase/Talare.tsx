import { UseCaseLayout } from "@/components/landing/UseCaseLayout";
import { getUseCase } from "@/lib/useCases";

export default function TalarePage() {
  const useCase = getUseCase("talare")!;
  return <UseCaseLayout useCase={useCase} />;
}
