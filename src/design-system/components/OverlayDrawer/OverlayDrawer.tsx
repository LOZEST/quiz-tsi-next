import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { IconButton } from '@design-system/components/IconButton/IconButton';
import { IconClose } from '@design-system/components/Icon/Icon';
import styles from './OverlayDrawer.module.css';

interface OverlayDrawerProps {
  open: boolean;
  title: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  onClose: () => void;
}

export function OverlayDrawer({
  open,
  title,
  triggerRef,
  children,
  onClose,
}: OverlayDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('qtsi-scroll-locked');
      dialog.querySelector<HTMLElement>('button, a')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.documentElement.classList.remove('qtsi-scroll-locked');
    };
  }, [open]);

  function closeAndRestoreFocus() {
    document.documentElement.classList.remove('qtsi-scroll-locked');
    onClose();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      closeAndRestoreFocus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closeAndRestoreFocus();
      }}
      onClick={handleBackdropClick}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Fermer le menu" onClick={closeAndRestoreFocus}>
            <IconClose />
          </IconButton>
        </header>
        {open ? children : null}
      </div>
    </dialog>
  );
}
