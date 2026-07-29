import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { mainNavigation } from '@app/routes';
import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
import { IconButton } from '@design-system/components/IconButton/IconButton';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { SkipLink } from '@design-system/components/SkipLink/SkipLink';
import styles from './AppShell.module.css';
import { useAuth } from '@app/providers/AuthProvider';
import { userRoleLabels } from '@domain/auth/UserRole';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state.session;

  return (
    <div className={styles.shell}>
      <SkipLink />
      <header className={styles.topbar}>
        <IconButton
          ref={menuButtonRef}
          label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </IconButton>
        <span className={styles.brand}>Quiz TSI</span>
      </header>
      {state.offline ? (
        <div className={styles.offlineBanner} role="status">
          Hors connexion — les données locales validées restent accessibles. Le
          rôle est informatif et les opérations sensibles sont désactivées.
        </div>
      ) : null}

      <OverlayDrawer
        open={menuOpen}
        title="Menu"
        triggerRef={menuButtonRef}
        onClose={() => setMenuOpen(false)}
      >
        <Disclosure label="À propos de cette version">
          Le socle technique est prêt. Les parcours et réglages interactifs
          arriveront dans les prochaines PR.
        </Disclosure>
        <nav id="main-navigation" aria-label="Navigation principale">
          <ul className={styles.navigation}>
            {mainNavigation.map((destination) => (
              <li key={destination.to}>
                <NavLink
                  to={destination.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    isActive ? styles.activeLink : styles.link
                  }
                >
                  {destination.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {user.role !== 'user' ? (
          <nav aria-label="Navigation secondaire">
            <NavLink
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              Administration
            </NavLink>
          </nav>
        ) : null}
        <NavLink
          className={styles.accountCard!}
          to="/account"
          onClick={() => setMenuOpen(false)}
        >
          <span className={styles.accountIdentity}>
            {user.displayName || user.email}
          </span>
          <span className={styles.accountRole}>
            {userRoleLabels[user.role]}
          </span>
          <span className={styles.accountAction}>Voir le compte</span>
        </NavLink>
      </OverlayDrawer>

      <main
        id="main-content"
        className={styles.main}
        tabIndex={-1}
        key={location.pathname}
      >
        <Outlet />
      </main>
    </div>
  );
}
