import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { EmptyState } from '@design-system/components/EmptyState/EmptyState';

export function QuestionsPage() {
  return (
    <>
      <PageHeader
        title="Banque de questions"
        description="La banque et l’éditeur seront ajoutés dans la PR7."
      />
      <EmptyState
        title="Aucune banque pour le moment"
        message="Les questions réelles seront ajoutées dans leur PR responsable."
      />
    </>
  );
}
