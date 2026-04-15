// Pure SVG rendering utilities for table shapes.
// Extracted from FloorPlan.tsx — no state dependencies.

import type { TableVariant } from '../../types';
import {
  type TableSvgRect,
  TABLE_VARIANT_MAP, DEFAULT_TABLE_VARIANT,
  scaleSvgRect, getRectCenter,
} from '../../utils/floorplan';

export function buildTableSvg(variantId: TableVariant, scaleFactor = 1) {
  const variant = TABLE_VARIANT_MAP[variantId] || TABLE_VARIANT_MAP[DEFAULT_TABLE_VARIANT];
  const body = variant.body.kind === 'circle'
    ? {
        ...variant.body,
        cx: variant.body.cx * scaleFactor,
        cy: variant.body.cy * scaleFactor,
        r: variant.body.r * scaleFactor,
      }
    : scaleSvgRect(variant.body, scaleFactor);
  const seatRects = variant.seatRects.map(rect => scaleSvgRect(rect, scaleFactor));
  const seatAnchors = seatRects.map(rect => getRectCenter(rect));
  const bodyBounds = {
    x: variant.bodyBounds.x * scaleFactor,
    y: variant.bodyBounds.y * scaleFactor,
    width: variant.bodyBounds.width * scaleFactor,
    height: variant.bodyBounds.height * scaleFactor,
  };

  return {
    variant,
    svgW: variant.viewBoxWidth * scaleFactor,
    svgH: variant.viewBoxHeight * scaleFactor,
    body,
    bodyBounds,
    seatRects,
    seatAnchors,
  };
}

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

export function renderRectSvg(rect: TableSvgRect, fill: string, key: string, stroke?: string, strokeWidth?: number) {
  return (
    <rect
      key={key}
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
