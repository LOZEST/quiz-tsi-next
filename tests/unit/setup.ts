import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
}

if (!HTMLDialogElement.prototype.close) {
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
}
