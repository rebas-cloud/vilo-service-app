// Table geometry calculations — size, rotation, snapping, collision bounds.

import type { Table, TableRotation } from '../../types';
import type { TableSeatPoint, TableSvgRect } from './tableVariants';
import { getTableVariantConfig } from './tableVariants';

// --- Editor Constants ---

export const EDITOR_GRID_SIZE = 16;
export const EDITOR_OBJECT_SNAP_SIZE = 4;
export const EDITOR_GRID_OFFSET = 0;
export const EDITOR_MIN_CANVAS_WIDTH = 640;
export const EDITOR_MIN_CANVAS_HEIGHT = 530;
export const ROTATION_SNAP_DEGREES = 45;
export const ROTATION_HANDLE_OFFSET = 22;
export const ROTATION_HANDLE_SIZE = 18;

// --- Size & Center ---

export function getTableSize(table: Pick<Table, 'variant' | 'shape' | 'seats'>): { w: number; h: number } {
  const variant = getTableVariantConfig(table);
  return { w: variant.bodyBounds.width, h: variant.bodyBounds.height };
}

export const getTableCenter = (table: Pick<Table, 'variant' | 'shape' | 'seats' | 'x' | 'y'>): TableSeatPoint => {
  const size = getTableSize(table);
  return {
    x: (table.x || 0) + size.w / 2,
    y: (table.y || 0) + size.h / 2,
  };
};

// --- Rotation ---

export const normalizeRotation = (angle: number): TableRotation => {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  return (normalized === 360 ? 0 : normalized) as TableRotation;
};

export const snapRotation = (angle: number): TableRotation =>
  normalizeRotation(Math.round(angle / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES);

export const getTableRotation = (table: Pick<Table, 'rotation'>): TableRotation =>
  normalizeRotation(table.rotation || 0);

// --- Bounds ---

export const getRotatedBodyBounds = (
  table: Pick<Table, 'variant' | 'shape' | 'seats' | 'x' | 'y' | 'rotation'>,
) => {
  const size = getTableSize(table);
  const center = getTableCenter(table);
  const rotation = (getTableRotation(table) * Math.PI) / 180;
  const halfWidth = size.w / 2;
  const halfHeight = size.h / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map(corner => ({
    x: center.x + corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation),
    y: center.y + corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation),
  }));
  const left = Math.min(...corners.map(c => c.x));
  const top = Math.min(...corners.map(c => c.y));
  const right = Math.max(...corners.map(c => c.x));
  const bottom = Math.max(...corners.map(c => c.y));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

export const getRotatedWrapperBounds = (
  wrapperLeft: number,
  wrapperTop: number,
  width: number,
  height: number,
  center: TableSeatPoint,
  rotation: TableRotation,
) => {
  const angle = (rotation * Math.PI) / 180;
  const corners = [
    { x: wrapperLeft, y: wrapperTop },
    { x: wrapperLeft + width, y: wrapperTop },
    { x: wrapperLeft + width, y: wrapperTop + height },
    { x: wrapperLeft, y: wrapperTop + height },
  ].map(corner => ({
    x: center.x + (corner.x - center.x) * Math.cos(angle) - (corner.y - center.y) * Math.sin(angle),
    y: center.y + (corner.x - center.x) * Math.sin(angle) + (corner.y - center.y) * Math.cos(angle),
  }));

  return {
    left: Math.min(...corners.map(c => c.x)),
    top: Math.min(...corners.map(c => c.y)),
    right: Math.max(...corners.map(c => c.x)),
    bottom: Math.max(...corners.map(c => c.y)),
  };
};

// --- Snapping ---

export const snapToGrid = (value: number) =>
  Math.round((value - EDITOR_GRID_OFFSET) / EDITOR_OBJECT_SNAP_SIZE) * EDITOR_OBJECT_SNAP_SIZE + EDITOR_GRID_OFFSET;

export const snapPointToGrid = (x: number, y: number) => ({
  x: snapToGrid(x),
  y: snapToGrid(y),
});

export const snapCanvasSize = (value: number): number =>
  Math.max(EDITOR_GRID_SIZE, Math.round(value / EDITOR_GRID_SIZE) * EDITOR_GRID_SIZE);

// --- Clamping ---

export const clampTableToBounds = (
  x: number,
  y: number,
  table: Pick<Table, 'variant' | 'shape' | 'seats' | 'rotation'>,
  stageWidth: number,
  stageHeight: number,
) => {
  let nextX = x;
  let nextY = y;
  const clampPadding = 24;
  const rightLimit = stageWidth - clampPadding;
  const bottomLimit = stageHeight - clampPadding;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const bounds = getRotatedBodyBounds({ ...table, x: nextX, y: nextY });
    if (bounds.left < clampPadding) nextX += clampPadding - bounds.left;
    if (bounds.top < clampPadding) nextY += clampPadding - bounds.top;
    if (bounds.right > rightLimit) nextX -= bounds.right - rightLimit;
    if (bounds.bottom > bottomLimit) nextY -= bounds.bottom - bottomLimit;
  }

  return { x: nextX, y: nextY };
};

export const setTableCenterAndRotation = (
  table: Pick<Table, 'variant' | 'shape' | 'seats'>,
  center: TableSeatPoint,
  rotation: number,
  stageWidth: number,
  stageHeight: number,
) => {
  const size = getTableSize(table);
  const snappedCenter = snapPointToGrid(center.x, center.y);
  const snappedRotation = snapRotation(rotation);
  const nextX = snappedCenter.x - size.w / 2;
  const nextY = snappedCenter.y - size.h / 2;
  const clamped = clampTableToBounds(nextX, nextY, { ...table, rotation: snappedRotation }, stageWidth, stageHeight);
  return { x: clamped.x, y: clamped.y, rotation: snappedRotation };
};

// --- SVG Helpers ---

export const scaleSvgRect = (rect: TableSvgRect, scaleFactor: number): TableSvgRect => ({
  ...rect,
  x: rect.x * scaleFactor,
  y: rect.y * scaleFactor,
  width: rect.width * scaleFactor,
  height: rect.height * scaleFactor,
  rx: rect.rx * scaleFactor,
  rotate: rect.rotate,
  originX: typeof rect.originX === 'number' ? rect.originX * scaleFactor : undefined,
  originY: typeof rect.originY === 'number' ? rect.originY * scaleFactor : undefined,
});

export const rotatePoint = (point: TableSeatPoint, angleDeg: number, origin: TableSeatPoint): TableSeatPoint => {
  const angle = (angleDeg * Math.PI) / 180;
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: origin.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
};

export const getRectCenter = (rect: TableSvgRect): TableSeatPoint => {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (typeof rect.rotate !== 'number' || typeof rect.originX !== 'number' || typeof rect.originY !== 'number') {
    return center;
  }
  return rotatePoint(center, rect.rotate, { x: rect.originX, y: rect.originY });
};
