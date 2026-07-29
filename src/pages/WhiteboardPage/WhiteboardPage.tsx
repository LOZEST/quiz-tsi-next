import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';

export function WhiteboardPage() {
  return (
    <>
      <PageHeader
        title="Tableau blanc"
        description="Le moteur d’écriture et les questions seront ajoutés dans les PR3 et PR4."
      />
      <Surface>
        Cette page vérifie uniquement le shell. Aucun faux Canvas n’est affiché.
      </Surface>
    </>
  );
}
