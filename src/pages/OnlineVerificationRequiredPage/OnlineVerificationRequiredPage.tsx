import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@design-system/components/ErrorState/ErrorState';

export function OnlineVerificationRequiredPage() {
  const navigate = useNavigate();
  return (
    <ErrorState
      title="Vérification en ligne requise"
      message="Les permissions d’administration doivent être vérifiées en ligne. Reconnecte-toi à Internet avant d’accéder à cet espace."
      actionLabel="Revenir au tableau blanc"
      onAction={() => {
        void navigate('/whiteboard');
      }}
    />
  );
}
