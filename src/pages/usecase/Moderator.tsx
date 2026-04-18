import { UseCaseLayout } from "@/components/landing/UseCaseLayout";
import { getUseCase } from "@/lib/useCases";

export default function ModeratorPage() {
  const useCase = getUseCase("moderator")!;
  return <UseCaseLayout useCase={useCase} />;
}
