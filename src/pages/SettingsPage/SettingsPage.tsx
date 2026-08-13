import { useEffect, useRef, useState } from 'react';
import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Button } from '@design-system/components/Button/Button';
import { useTheme, type ThemePreference } from '@app/providers/ThemeProvider';
import { useWhiteboard } from '@app/providers/WhiteboardProvider';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { useOnlineStatus } from '@shared/useOnlineStatus';
import { validateQuestion } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';

const themeOptions: readonly Readonly<{
  value: ThemePreference;
  label: string;
}>[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Surface>
      <h2>Apparence</h2>
      <fieldset>
        <legend>Thème</legend>
        {themeOptions.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="theme"
              checked={theme === option.value}
              onChange={() => setTheme(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </Surface>
  );
}

function PencilSection() {
  const settings = useWhiteboard();
  return (
    <Disclosure label="Apple Pencil">
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
            name="settings-eraser-mode"
            checked={settings.eraserMode === 'object'}
            onChange={() => settings.setEraserMode('object')}
          />
          Objet
        </label>
        <label>
          <input
            type="radio"
            name="settings-eraser-mode"
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
            name="settings-handedness"
            checked={settings.handedness === 'right'}
            onChange={() => settings.setHandedness('right')}
          />
          Droitier
        </label>
        <label>
          <input
            type="radio"
            name="settings-handedness"
            checked={settings.handedness === 'left'}
            onChange={() => settings.setHandedness('left')}
          />
          Gaucher
        </label>
      </fieldset>
    </Disclosure>
  );
}

function useWorkspaceSnapshot() {
  const { state } = useAuth();
  const services = useAppServices();
  const [snapshot, setSnapshot] = useState<QuestionWorkspaceSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const userId =
    state.status === 'authenticated' ? state.session.user.id : null;
  const load = () => {
    if (!userId) return;
    services.questionWorkspaceRepository
      .load(userId)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  };
  useEffect(load, [userId, services.questionWorkspaceRepository]);
  const reload = () => {
    if (!userId) return;
    setLoading(true);
    services.questionWorkspaceRepository
      .load(userId)
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
      .finally(() => setLoading(false));
  };
  return { snapshot, loading, reload };
}

function LocalDataSection() {
  const { snapshot } = useWorkspaceSnapshot();
  return (
    <Disclosure label="Données locales">
      {snapshot ? (
        <dl>
          <dt>Questions enregistrées localement</dt>
          <dd>{snapshot.questions.length}</dd>
          <dt>Cours personnels</dt>
          <dd>{snapshot.courses.length}</dd>
          <dt>Chapitres personnels</dt>
          <dd>{snapshot.chapters.length}</dd>
          <dt>Notions personnelles</dt>
          <dd>{snapshot.notions.length}</dd>
        </dl>
      ) : (
        <p>Chargement des données locales…</p>
      )}
    </Disclosure>
  );
}

function SyncSection() {
  const { snapshot, loading, reload } = useWorkspaceSnapshot();
  const online = useOnlineStatus();
  return (
    <Disclosure label="Synchronisation">
      <p role="status">{online ? 'En ligne' : 'Hors connexion'}</p>
      {snapshot ? (
        <>
          <p>{snapshot.pendingOperationCount} opération(s) en attente.</p>
          {snapshot.conflicts.length ? (
            <ul aria-label="Conflits de synchronisation">
              {snapshot.conflicts.map((conflict) => (
                <li key={conflict.id}>
                  Conflit sur la question {conflict.entityId} détecté le{' '}
                  {new Date(conflict.detectedAt).toLocaleString('fr-FR')}.
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun conflit en attente.</p>
          )}
        </>
      ) : null}
      <Button variant="secondary" busy={loading} onClick={reload}>
        Actualiser
      </Button>
    </Disclosure>
  );
}

function BackupSection() {
  const { snapshot } = useWorkspaceSnapshot();
  const { state } = useAuth();
  const services = useAppServices();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const userId =
    state.status === 'authenticated' ? state.session.user.id : null;

  const exportBackup = () => {
    if (!snapshot) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      questions: snapshot.questions,
      courses: snapshot.courses,
      chapters: snapshot.chapters,
      notions: snapshot.notions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz-tsi-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Sauvegarde téléchargée.');
  };

  const importBackup = async (file: File) => {
    if (!userId) return;
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        questions?: unknown[];
      };
      const candidates = Array.isArray(parsed.questions)
        ? parsed.questions
        : [];
      let imported = 0;
      let rejected = 0;
      for (const candidate of candidates) {
        const result = validateQuestion(candidate);
        if (!result.ok) {
          rejected += 1;
          continue;
        }
        await services.questionWorkspaceRepository.saveQuestion(
          userId,
          result.value,
          'update',
          `import:${result.value.id}:${result.value.version}:${Date.now()}`,
        );
        imported += 1;
      }
      setMessage(
        rejected
          ? `${imported} question(s) restaurée(s), ${rejected} rejetée(s) car invalide(s).`
          : `${imported} question(s) restaurée(s).`,
      );
    } catch {
      setMessage('Le fichier de sauvegarde est invalide.');
    }
  };

  return (
    <Disclosure label="Sauvegardes">
      <Button variant="secondary" onClick={exportBackup} disabled={!snapshot}>
        Exporter mes données
      </Button>
      <label>
        Restaurer une sauvegarde
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.target.value = '';
          }}
        />
      </label>
      {message ? <p role="status">{message}</p> : null}
    </Disclosure>
  );
}

function OfflineSection() {
  const online = useOnlineStatus();
  return (
    <Disclosure label="Hors connexion">
      <p role="status">
        {online
          ? 'Connexion active. Les modifications se synchronisent normalement.'
          : 'Hors connexion. Les données locales validées restent accessibles ; les modifications se synchroniseront au retour du réseau.'}
      </p>
    </Disclosure>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Réglages"
        description="Apparence, Apple Pencil, données locales, synchronisation, sauvegardes et hors connexion."
      />
      <AppearanceSection />
      <Surface>
        <PencilSection />
        <LocalDataSection />
        <SyncSection />
        <BackupSection />
        <OfflineSection />
      </Surface>
    </>
  );
}
