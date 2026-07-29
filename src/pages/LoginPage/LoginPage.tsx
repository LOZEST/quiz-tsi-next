import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';

export function LoginPage() {
  return (
    <main className="qtsi-login" id="main-content">
      <div>
        <p className="qtsi-wordmark">Quiz TSI</p>
        <Surface>
          <PageHeader
            title="Connexion"
            description="L’authentification sera ajoutée dans la PR2."
          />
        </Surface>
      </div>
    </main>
  );
}
