import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { mainNavigation } from '@app/routes';
import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
import { IconButton } from '@design-system/components/IconButton/IconButton';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { SkipLink } from '@design-system/components/SkipLink/SkipLink';
import { LogoMark } from '@design-system/components/Logo/Logo';
import {
  IconAdmin,
  IconBank,
  IconMenu,
  IconProgress,
  IconSettings,
  IconWhiteboard,
  type IconProps,
} from '@design-system/components/Icon/Icon';
import styles from './AppShell.module.css';
import { useAuth } from '@app/providers/AuthProvider';
import { userRoleLabels } from '@domain/auth/UserRole';
import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import type { ReactNode } from 'react';

const navIcons: Record<string, (props: IconProps) => ReactNode> = {
  '/whiteboard': IconWhiteboard,
  '/progress': IconProgress,
  '/questions': IconBank,
  '/settings': IconSettings,
};

function WhiteboardDrawerSettings() {
  const settings = useWhiteboard();
  return (
    <div className={styles.drawerSettings}>
      <label>
        Épaisseur du stylo
        <input
          aria-label="Épaisseur du stylo"
          type="range"
          min="1"
          max="12"
          value={settings.penWidth}
          onChange={(event) => settings.setPenWidth(Number(event.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.gridEnabled}
          onChange={(event) => settings.setGridEnabled(event.target.checked)}
        />
        Afficher la grille
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.magicShapesEnabled}
          onChange={(event) =>
            settings.setMagicShapesEnabled(event.target.checked)
          }
        />
        Formes magiques
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.scribbleEraseEnabled}
          onChange={(event) =>
            settings.setScribbleEraseEnabled(event.target.checked)
          }
        />
        Effacer en griffonnant
      </label>
      <fieldset>
        <legend>Mode de gomme</legend>
        <label>
          <input
            type="radio"
            name="whiteboard-eraser-mode"
            checked={settings.eraserMode === 'object'}
            onChange={() => settings.setEraserMode('object')}
          />
          Objet
        </label>
        <label>
          <input
            type="radio"
            name="whiteboard-eraser-mode"
            checked={settings.eraserMode === 'pixel'}
            onChange={() => settings.setEraserMode('pixel')}
          />
          Pixel
        </label>
      </fieldset>
      <fieldset>
        <legend>Main d’écriture</legend>
        <label>
          <input
            type="radio"
            name="whiteboard-handedness"
            checked={settings.handedness === 'right'}
            onChange={() => settings.setHandedness('right')}
          />
          Droitier
        </label>
        <label>
          <input
            type="radio"
            name="whiteboard-handedness"
            checked={settings.handedness === 'left'}
            onChange={() => settings.setHandedness('left')}
          />
          Gaucher
        </label>
      </fieldset>
      <p>
        Outil actif :{' '}
        {settings.activeTool === 'pen'
          ? 'Stylo'
          : settings.activeTool === 'eraser'
            ? 'Gomme'
            : settings.activeTool === 'select'
              ? 'Sélection'
              : 'Formes'}
      </p>
    </div>
  );
}

export function AppShell({
  whiteboardOptions,
}: {
  whiteboardOptions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state.session;

  const isWhiteboard = location.pathname === '/whiteboard';

  function renderNavLinks(onLinkClick: () => void) {
    return (
      <>
        <nav aria-label="Navigation principale">
          <ul className={styles.navigation}>
            {mainNavigation.map((destination) => {
              const NavIcon = navIcons[destination.to];
              return (
                <li key={destination.to}>
                  <NavLink
                    to={destination.to}
                    onClick={onLinkClick}
                    className={({ isActive }) =>
                      isActive ? styles.activeLink : styles.link
                    }
                  >
                    {NavIcon ? <NavIcon className={styles.navIcon} /> : null}
                    <span>{destination.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        {user.role !== 'user' ? (
          <nav
            aria-label="Navigation secondaire"
            className={styles.secondaryNav}
          >
            <ul className={styles.navigation}>
              <li>
                <NavLink
                  to="/admin"
                  onClick={onLinkClick}
                  className={({ isActive }) =>
                    isActive ? styles.activeLink : styles.link
                  }
                >
                  <IconAdmin className={styles.navIcon} />
                  <span>Administration</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        ) : null}
        <NavLink
          className={styles.accountCard!}
          to="/account"
          onClick={onLinkClick}
        >
          <span className={styles.accountIdentity}>
            {user.displayName || user.email}
          </span>
          <span className={styles.accountRole}>
            {userRoleLabels[user.role]}
          </span>
          <span className={styles.accountAction}>Voir le compte</span>
        </NavLink>
      </>
    );
  }

  return (
    <div
      className={`${styles.shell} ${
        isWhiteboard ? `${styles.whiteboardShell} qtsi-whiteboard-shell` : ''
      }`}
    >
      <SkipLink />
      <header className={styles.topbar}>
        <IconButton
          ref={menuButtonRef}
          label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(true)}
        >
          <IconMenu />
        </IconButton>
        <NavLink to="/progress" className={styles.brand!}>
          <LogoMark size={26} />
          <span>Prépa Math</span>
        </NavLink>
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
        {isWhiteboard ? (
          <>
            <Disclosure label="Options du parcours">
              {whiteboardOptions}
            </Disclosure>
            <Disclosure label="Réglages Apple Pencil">
              <WhiteboardDrawerSettings />
            </Disclosure>
          </>
        ) : (
          <Disclosure label="À propos de cette version">
            Authentification et espace utilisateur actifs.
          </Disclosure>
        )}
        <div id="main-navigation">
          {renderNavLinks(() => setMenuOpen(false))}
        </div>
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
