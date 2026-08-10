import {
  WHITEBOARD_SHAPE_KINDS,
  type WhiteboardShape,
} from './WhiteboardShape';

export const WHITEBOARD_SCENE_VERSION = 2;

export interface WhiteboardPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface WhiteboardStroke {
  kind: 'stroke';
  id: string;
  tool: 'pen';
  points: WhiteboardPoint[];
  width: number;
  color: string;
  createdAt: string;
}

export type WhiteboardObject = WhiteboardStroke | WhiteboardShape;

export interface WhiteboardScene {
  schemaVersion: 2;
  sceneId: string;
  questionInstanceId: string;
  logicalWidth: number;
  logicalHeight: number;
  objects: WhiteboardObject[];
  updatedAt: string;
}

export interface WhiteboardQuarantine {
  index: number;
  reason: string;
  value: unknown;
}

export interface WhiteboardRestoreResult {
  scene: WhiteboardScene;
  quarantine: WhiteboardQuarantine[];
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isPoint(value: unknown): value is WhiteboardPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return (
    finite(point.x) &&
    finite(point.y) &&
    finite(point.pressure) &&
    point.pressure >= 0 &&
    point.pressure <= 1 &&
    finite(point.tiltX) &&
    finite(point.tiltY) &&
    finite(point.timestamp)
  );
}

function restoreObject(value: unknown): WhiteboardObject | null {
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  if (
    object.kind === 'stroke' &&
    typeof object.id === 'string' &&
    object.tool === 'pen' &&
    Array.isArray(object.points) &&
    object.points.length > 0 &&
    object.points.every(isPoint) &&
    finite(object.width) &&
    object.width > 0 &&
    typeof object.color === 'string' &&
    typeof object.createdAt === 'string'
  ) {
    return object as unknown as WhiteboardStroke;
  }
  if (
    object.kind === 'shape' &&
    typeof object.id === 'string' &&
    WHITEBOARD_SHAPE_KINDS.includes(object.shapeKind as never) &&
    object.style &&
    typeof object.style === 'object' &&
    object.geometry &&
    typeof object.geometry === 'object'
  ) {
    const style = object.style as Record<string, unknown>;
    const geometry = object.geometry as Record<string, unknown>;
    const properties = geometry.properties;
    const allowedStyle = Object.keys(style).every((key) =>
      ['color', 'width', 'opacity', 'lineCap', 'lineJoin'].includes(key),
    );
    const validProperties =
      properties !== null &&
      typeof properties === 'object' &&
      !Array.isArray(properties) &&
      Object.keys(properties).length === 0;
    const fixedRotation = [
      'circle',
      'axes',
      'coordinate-system',
      'trigonometric-circle',
    ].includes(object.shapeKind as string);
    if (
      allowedStyle &&
      typeof style.color === 'string' &&
      finite(style.width) &&
      style.width > 0 &&
      finite(style.opacity) &&
      style.opacity >= 0 &&
      style.opacity <= 1 &&
      (style.lineCap === 'round' || style.lineCap === 'square') &&
      ['round', 'bevel', 'miter'].includes(style.lineJoin as string) &&
      geometry.schemaVersion === 1 &&
      finite(geometry.x) &&
      finite(geometry.y) &&
      finite(geometry.width) &&
      geometry.width > 0 &&
      finite(geometry.height) &&
      geometry.height > 0 &&
      (fixedRotation
        ? geometry.rotation === null
        : finite(geometry.rotation)) &&
      validProperties &&
      (!['square', 'circle', 'trigonometric-circle'].includes(
        object.shapeKind as string,
      ) ||
        geometry.width === geometry.height)
    ) {
      return object as unknown as WhiteboardShape;
    }
  }
  return null;
}

export function restoreWhiteboardScene(
  value: unknown,
  fallbackSceneId = 'default',
): WhiteboardRestoreResult {
  const source =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const rawObjects = Array.isArray(source.objects) ? source.objects : [];
  const quarantine: WhiteboardQuarantine[] = [];
  const objects = rawObjects.flatMap((object, index) => {
    const restored = restoreObject(object);
    if (restored) return [restored];
    quarantine.push({
      index,
      reason: 'Objet de tableau invalide.',
      value: object,
    });
    return [];
  });
  const now = new Date().toISOString();
  return {
    scene: {
      schemaVersion: WHITEBOARD_SCENE_VERSION,
      sceneId:
        typeof source.sceneId === 'string' ? source.sceneId : fallbackSceneId,
      questionInstanceId:
        typeof source.questionInstanceId === 'string'
          ? source.questionInstanceId
          : 'whiteboard',
      logicalWidth:
        finite(source.logicalWidth) && source.logicalWidth > 0
          ? source.logicalWidth
          : 1024,
      logicalHeight:
        finite(source.logicalHeight) && source.logicalHeight > 0
          ? source.logicalHeight
          : 768,
      objects,
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
    },
    quarantine,
  };
}
