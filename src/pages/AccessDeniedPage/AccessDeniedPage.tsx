import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@design-system/components/ErrorState/ErrorState';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  return (
    <ErrorState
      title="Accès refusé"
      message="Ton rôle ne permet pas d’ouvrir l’espace d’administration."
      actionLabel="Revenir au tableau blanc"
      onAction={() => {
        void navigate('/whiteboard');
      }}
    />
  );
}
