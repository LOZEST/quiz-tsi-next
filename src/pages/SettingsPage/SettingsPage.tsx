import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Réglages"
        description="Les préférences seront ajoutées dans la PR8."
      />
      <Surface>
        <Disclosure label="Pourquoi cette section est-elle vide ?">
          Aucun réglage factice n’est proposé dans le socle.
        </Disclosure>
      </Surface>
    </>
  );
}
