import type { TableSvgRect } from '../../utils/floorplan/tableVariants';

export function RectSvg({
  rect,
  fill,
  id,
  stroke,
  strokeWidth,
}: {
  rect: TableSvgRect;
  fill: string;
  id: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <rect
      key={id}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      rx={rect.rx}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      transform={typeof rect.rotate === 'number' ? `rotate(${rect.rotate} ${rect.originX || 0} ${rect.originY || 0})` : undefined}
    />
  );
}
