import { useRef, useState, type FormEvent } from 'react';
import { authErrorMessages } from '@domain/auth/AuthError';
import { Button } from '@design-system/components/Button/Button';
import { useAuth } from '@app/providers/AuthProvider';
import styles from './RegisterForm.module.css';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const auth = useAuth();
  const { state } = auth;
  const [validationError, setValidationError] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const busy = state.status === 'authenticating';
  const asyncError =
    state.status === 'unauthenticated' && state.error
      ? authErrorMessages[state.error.code]
      : '';
  const error = validationError || asyncError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emailValue = data.get('email');
    const passwordValue = data.get('password');
    const confirmPasswordValue = data.get('confirm-password');
    const email = typeof emailValue === 'string' ? emailValue.trim() : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    const confirmPassword =
      typeof confirmPasswordValue === 'string' ? confirmPasswordValue : '';
    if (!email) {
      setValidationError('Saisis ton adresse email.');
      emailRef.current?.focus();
      return;
    }
    if (password.length < 6) {
      setValidationError(
        'Ton mot de passe doit contenir au moins 6 caractères.',
      );
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      confirmPasswordRef.current?.focus();
      return;
    }
    setValidationError('');
    setConfirmationRequired(false);
    const outcome = await auth.signUp(email, password);
    if (outcome === 'signed-in') {
      onSuccess();
    } else if (outcome === 'confirmation-required') {
      setConfirmationRequired(true);
    } else {
      passwordRef.current?.focus();
      if (passwordRef.current) passwordRef.current.value = '';
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = '';
    }
  }

  if (confirmationRequired) {
    return (
      <p className={styles.success} role="status">
        Ton compte a été créé. Vérifie ta boîte email pour confirmer ton adresse
        avant de te connecter.
      </p>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className={styles.field}>
        <label htmlFor="register-email">Email</label>
        <input
          ref={emailRef}
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={error ? 'register-error' : undefined}
          disabled={busy}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="register-password">Mot de passe</label>
        <input
          ref={passwordRef}
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-describedby={error ? 'register-error' : undefined}
          disabled={busy}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="register-confirm-password">
          Confirme le mot de passe
        </label>
        <input
          ref={confirmPasswordRef}
          id="register-confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-describedby={error ? 'register-error' : undefined}
          disabled={busy}
        />
      </div>
      {error ? (
        <p
          id="register-error"
          className={styles.error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" busy={busy}>
        {busy ? 'Création…' : 'Créer mon compte'}
      </Button>
    </form>
  );
}
