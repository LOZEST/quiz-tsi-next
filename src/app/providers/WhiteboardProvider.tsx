/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { WhiteboardShapeKind } from '@domain/whiteboard/WhiteboardShape';

export type WhiteboardActiveTool = 'pen' | 'eraser' | 'select' | 'shape';

export interface WhiteboardUiState {
  activeTool: WhiteboardActiveTool;
  shapeKind: WhiteboardShapeKind;
  penWidth: number;
  gridEnabled: boolean;
  magicShapesEnabled: boolean;
  handedness: 'left' | 'right';
  setActiveTool: (value: WhiteboardActiveTool) => void;
  setShapeKind: (value: WhiteboardShapeKind) => void;
  setPenWidth: (value: number) => void;
  setGridEnabled: (value: boolean) => void;
  setMagicShapesEnabled: (value: boolean) => void;
  setHandedness: (value: 'left' | 'right') => void;
  undo: () => void;
  redo: () => void;
  bindHistory: (actions: { undo(): void; redo(): void } | null) => void;
  hasDraft: boolean;
  clearDraft: () => void;
  bindDraft: (actions: { hasDraft(): boolean; clear(): void } | null) => void;
}

const WhiteboardContext = createContext<WhiteboardUiState | null>(null);

export function WhiteboardProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<WhiteboardActiveTool>('pen');
  const [shapeKind, setShapeKind] = useState<WhiteboardShapeKind>(
    'grid-coordinate-system',
  );
  const [penWidth, setPenWidth] = useState(3);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [magicShapesEnabled, setMagicShapesEnabled] = useState(true);
  const [handedness, setHandedness] = useState<'left' | 'right'>('right');
  const [history, setHistory] = useState<{
    undo(): void;
    redo(): void;
  } | null>(null);
  const [draft, setDraft] = useState<{
    hasDraft(): boolean;
    clear(): void;
  } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const bindHistory = useCallback(
    (actions: { undo(): void; redo(): void } | null) => setHistory(actions),
    [],
  );
  const bindDraft = useCallback(
    (actions: { hasDraft(): boolean; clear(): void } | null) => {
      setDraft(actions);
      setHasDraft(actions?.hasDraft() ?? false);
    },
    [],
  );
  const value = useMemo(
    () => ({
      activeTool,
      shapeKind,
      penWidth,
      gridEnabled,
      magicShapesEnabled,
      handedness,
      setActiveTool,
      setShapeKind,
      setPenWidth,
      setGridEnabled,
      setMagicShapesEnabled,
      setHandedness,
      undo: () => history?.undo(),
      redo: () => history?.redo(),
      bindHistory,
      hasDraft,
      clearDraft: () => {
        draft?.clear();
        setHasDraft(false);
      },
      bindDraft,
    }),
    [
      activeTool,
      bindDraft,
      bindHistory,
      draft,
      gridEnabled,
      magicShapesEnabled,
      handedness,
      hasDraft,
      history,
      penWidth,
      shapeKind,
    ],
  );
  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export function useWhiteboard(): WhiteboardUiState {
  const value = useContext(WhiteboardContext);
  if (!value) throw new Error('WhiteboardProvider is missing.');
  return value;
}
