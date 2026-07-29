import { useRef, useState, type FormEvent } from 'react';
import { authErrorMessages } from '@domain/auth/AuthError';
import { Button } from '@design-system/components/Button/Button';
import { useAuth } from '@app/providers/AuthProvider';
import styles from './LoginForm.module.css';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const auth = useAuth();
  const { state } = auth;
  const [validationError, setValidationError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
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
    const email = typeof emailValue === 'string' ? emailValue.trim() : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    if (!email) {
      setValidationError('Saisis ton adresse email.');
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setValidationError('Saisis ton mot de passe.');
      passwordRef.current?.focus();
      return;
    }
    setValidationError('');
    const authenticated = await auth.signIn(email, password);
    if (authenticated) {
      onSuccess();
    } else {
      passwordRef.current?.focus();
      if (passwordRef.current) passwordRef.current.value = '';
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className={styles.field}>
        <label htmlFor="login-email">Email</label>
        <input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={error ? 'login-error' : undefined}
          disabled={busy}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Mot de passe</label>
        <input
          ref={passwordRef}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={error ? 'login-error' : undefined}
          disabled={busy}
        />
      </div>
      {error ? (
        <p
          id="login-error"
          className={styles.error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" busy={busy}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
