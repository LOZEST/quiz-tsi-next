import {
  createShape,
  shapePrimitives,
  type ShapePrimitive,
  type WhiteboardPaletteShapeKind,
  type WhiteboardShapeStyle,
} from '@domain/whiteboard/WhiteboardShape';

const previewStyle: WhiteboardShapeStyle = {
  color: 'currentColor',
  width: 2,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
};

function Primitive({ primitive }: { primitive: ShapePrimitive }) {
  const opacity =
    primitive.role === 'faint'
      ? 0.24
      : primitive.role === 'secondary'
        ? 0.58
        : 1;
  const common = {
    opacity,
    strokeWidth: 2 * (primitive.widthScale ?? 1),
    vectorEffect: 'non-scaling-stroke' as const,
  };
  if (primitive.kind === 'text') {
    const textAnchor =
      primitive.align === 'center'
        ? 'middle'
        : primitive.align === 'end'
          ? 'end'
          : 'start';
    return (
      <text
        x={primitive.position.x}
        y={primitive.position.y}
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize={primitive.fontSize}
        stroke="none"
        textAnchor={textAnchor}
        dominantBaseline="middle"
        opacity={opacity}
      >
        {primitive.value}
      </text>
    );
  }
  if (primitive.kind === 'line')
    return (
      <line
        x1={primitive.from.x}
        y1={primitive.from.y}
        x2={primitive.to.x}
        y2={primitive.to.y}
        {...common}
      />
    );
  if (primitive.kind === 'ellipse')
    return (
      <ellipse
        cx={primitive.center.x}
        cy={primitive.center.y}
        rx={primitive.radiusX}
        ry={primitive.radiusY}
        fill={primitive.filled ? 'currentColor' : 'none'}
        {...common}
      />
    );
  const points = primitive.points.map(({ x, y }) => `${x},${y}`).join(' ');
  return primitive.closed ? (
    <polygon points={points} fill="none" {...common} />
  ) : (
    <polyline points={points} fill="none" {...common} />
  );
}

export function WhiteboardShapePreview({
  kind,
}: {
  kind: WhiteboardPaletteShapeKind;
}) {
  const square = kind === 'trigonometric-circle';
  const width = square ? 240 : 320;
  const height = square ? 240 : 200;
  const shape = createShape(
    `preview-${kind}`,
    kind,
    { x: 0, y: 0 },
    { x: width, y: height },
    previewStyle,
  );
  return (
    <svg
      viewBox={`0 0 ${shape.geometry.width} ${shape.geometry.height}`}
      role="img"
      aria-label="Aperçu graphique"
      data-testid="shape-preview"
      preserveAspectRatio="xMidYMid meet"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shapePrimitives(shape).map((primitive, index) => (
          <Primitive key={`${primitive.kind}-${index}`} primitive={primitive} />
        ))}
      </g>
    </svg>
  );
}
