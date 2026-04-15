// Table variant definitions — SVG geometry for all table shapes used in the floor plan editor.

import type { Table, TablePlacementType, TableShape, TableVariant } from '../../types';

// --- SVG Primitive Types ---

export type TableSeatPoint = { x: number; y: number };

export type TableSvgRect = {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  rotate?: number;
  originX?: number;
  originY?: number;
};

export type TableSvgCircle = {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
};

export type TableVariantDefinition = {
  id: TableVariant;
  label: string;
  shape: TableShape;
  viewBoxWidth: number;
  viewBoxHeight: number;
  bodyBounds: { x: number; y: number; width: number; height: number };
  body: TableSvgRect | TableSvgCircle;
  seatRects: TableSvgRect[];
  seats: number;
  defaultMinPartySize: number;
  defaultMaxPartySize: number;
  palette?: boolean;
};

// --- Variant Definitions ---

export const TABLE_VARIANTS: TableVariantDefinition[] = [
  {
    id: 'round-2',
    label: 'Rund 2',
    shape: 'round',
    viewBoxWidth: 40,
    viewBoxHeight: 50,
    bodyBounds: { x: 0, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 20, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 10, y: 0, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 10, y: 33, width: 20, height: 17, rx: 4 },
    ],
    seats: 2,
    defaultMinPartySize: 1,
    defaultMaxPartySize: 2,
  },
  {
    id: 'rect-2-v-narrow',
    label: 'Hoch 2 schmal',
    shape: 'rect_v',
    viewBoxWidth: 30,
    viewBoxHeight: 50,
    bodyBounds: { x: 0, y: 5, width: 30, height: 40 },
    body: { kind: 'rect', x: 0, y: 5, width: 30, height: 40, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 5, y: 0, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 5, y: 33, width: 20, height: 17, rx: 4 },
    ],
    seats: 2,
    defaultMinPartySize: 1,
    defaultMaxPartySize: 2,
  },
  {
    id: 'rect-2-v-wide',
    label: 'Hoch 2 breit',
    shape: 'rect_v',
    viewBoxWidth: 40,
    viewBoxHeight: 50,
    bodyBounds: { x: 0, y: 5, width: 40, height: 40 },
    body: { kind: 'rect', x: 0, y: 5, width: 40, height: 40, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 10, y: 0, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 10, y: 33, width: 20, height: 17, rx: 4 },
    ],
    seats: 2,
    defaultMinPartySize: 1,
    defaultMaxPartySize: 2,
  },
  {
    id: 'round-2-alt',
    label: 'Rund 1',
    shape: 'round',
    viewBoxWidth: 40,
    viewBoxHeight: 45,
    bodyBounds: { x: 0, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 20, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 10, y: 0, width: 20, height: 17, rx: 4 },
    ],
    seats: 1,
    defaultMinPartySize: 1,
    defaultMaxPartySize: 1,
  },
  {
    id: 'square-4',
    shape: 'square',
    label: 'Quadrat 4',
    viewBoxWidth: 40,
    viewBoxHeight: 40,
    bodyBounds: { x: 0, y: 5, width: 40, height: 30 },
    body: { kind: 'rect', x: 0, y: 5, width: 40, height: 30, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 2, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 20 },
      { kind: 'rect', x: 21, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 20 },
      { kind: 'rect', x: 2, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 40 },
      { kind: 'rect', x: 21, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 40 },
    ],
    seats: 4,
    defaultMinPartySize: 2,
    defaultMaxPartySize: 4,
  },
  {
    id: 'square-4-wide',
    label: 'Quadrat 4 breit',
    shape: 'square',
    viewBoxWidth: 50,
    viewBoxHeight: 50,
    bodyBounds: { x: 5, y: 5, width: 40, height: 40 },
    body: { kind: 'rect', x: 5, y: 5, width: 40, height: 40, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 15, y: 33, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 17, y: 14, width: 20, height: 17, rx: 4, rotate: 90, originX: 17, originY: 14 },
      { kind: 'rect', x: 15, y: 0, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 50, y: 14, width: 20, height: 17, rx: 4, rotate: 90, originX: 50, originY: 14 },
    ],
    seats: 4,
    defaultMinPartySize: 2,
    defaultMaxPartySize: 4,
  },
  {
    id: 'round-4',
    label: 'Rund 4',
    shape: 'round',
    viewBoxWidth: 50,
    viewBoxHeight: 50,
    bodyBounds: { x: 5, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 25, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 15, y: 0, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 50, y: 15, width: 20, height: 17, rx: 4, rotate: 90, originX: 50, originY: 15 },
      { kind: 'rect', x: 15, y: 33, width: 20, height: 17, rx: 4 },
      { kind: 'rect', x: 17, y: 15, width: 20, height: 17, rx: 4, rotate: 90, originX: 17, originY: 15 },
    ],
    seats: 4,
    defaultMinPartySize: 2,
    defaultMaxPartySize: 4,
  },
  {
    id: 'rect-6-h',
    label: 'Rechteck 6',
    shape: 'rect',
    viewBoxWidth: 59,
    viewBoxHeight: 50,
    bodyBounds: { x: 0, y: 5, width: 59, height: 40 },
    body: { kind: 'rect', x: 0, y: 5, width: 59, height: 40, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 2, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 20 },
      { kind: 'rect', x: 21, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 20 },
      { kind: 'rect', x: 40, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 20 },
      { kind: 'rect', x: 2, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 50 },
      { kind: 'rect', x: 21, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 50 },
      { kind: 'rect', x: 40, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 50 },
    ],
    seats: 6,
    defaultMinPartySize: 3,
    defaultMaxPartySize: 6,
  },
  {
    id: 'rect-8-h',
    label: 'Rechteck 8',
    shape: 'rect',
    viewBoxWidth: 78,
    viewBoxHeight: 50,
    bodyBounds: { x: 0, y: 5, width: 78, height: 40 },
    body: { kind: 'rect', x: 0, y: 5, width: 78, height: 40, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 2, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 20 },
      { kind: 'rect', x: 21, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 20 },
      { kind: 'rect', x: 40, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 20 },
      { kind: 'rect', x: 59, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 59, originY: 20 },
      { kind: 'rect', x: 2, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 50 },
      { kind: 'rect', x: 21, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 50 },
      { kind: 'rect', x: 40, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 50 },
      { kind: 'rect', x: 59, y: 50, width: 20, height: 17, rx: 4, rotate: -90, originX: 59, originY: 50 },
    ],
    seats: 8,
    defaultMinPartySize: 4,
    defaultMaxPartySize: 8,
  },
  {
    id: 'round-6',
    label: 'Rund 6',
    shape: 'round',
    viewBoxWidth: 44,
    viewBoxHeight: 50,
    bodyBounds: { x: 1.9203, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 21.9203, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 15.9203, y: 0, width: 12, height: 17, rx: 4 },
      { kind: 'rect', x: 15.9203, y: 33, width: 12, height: 17, rx: 4 },
      { kind: 'rect', x: 43.8406, y: 38.435, width: 12, height: 17, rx: 4, rotate: 135, originX: 43.8406, originY: 38.435 },
      { kind: 'rect', x: 20.5061, y: 15.1005, width: 12, height: 17, rx: 4, rotate: 135, originX: 20.5061, originY: 15.1005 },
      { kind: 'rect', x: 8.48528, y: 46.8406, width: 12, height: 17, rx: 4, rotate: -135, originX: 8.48528, originY: 46.8406 },
      { kind: 'rect', x: 31.8198, y: 23.5061, width: 12, height: 17, rx: 4, rotate: -135, originX: 31.8198, originY: 23.5061 },
    ],
    seats: 6,
    defaultMinPartySize: 3,
    defaultMaxPartySize: 6,
  },
  {
    id: 'round-8',
    label: 'Rund 8',
    shape: 'round',
    viewBoxWidth: 50,
    viewBoxHeight: 50,
    bodyBounds: { x: 5, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 25, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 19, y: 0, width: 12, height: 17, rx: 4 },
      { kind: 'rect', x: 19, y: 33, width: 12, height: 17, rx: 4 },
      { kind: 'rect', x: 50, y: 19, width: 12, height: 17, rx: 4, rotate: 90, originX: 50, originY: 19 },
      { kind: 'rect', x: 17, y: 19, width: 12, height: 17, rx: 4, rotate: 90, originX: 17, originY: 19 },
      { kind: 'rect', x: 46.9203, y: 38.435, width: 12, height: 17, rx: 4, rotate: 135, originX: 46.9203, originY: 38.435 },
      { kind: 'rect', x: 23.5858, y: 15.1005, width: 12, height: 17, rx: 4, rotate: 135, originX: 23.5858, originY: 15.1005 },
      { kind: 'rect', x: 11.565, y: 46.8406, width: 12, height: 17, rx: 4, rotate: -135, originX: 11.565, originY: 46.8406 },
      { kind: 'rect', x: 34.8995, y: 23.5061, width: 12, height: 17, rx: 4, rotate: -135, originX: 34.8995, originY: 23.5061 },
    ],
    seats: 8,
    defaultMinPartySize: 4,
    defaultMaxPartySize: 8,
  },
  {
    id: 'barstool-1',
    label: 'Barhocker',
    shape: 'barstool',
    viewBoxWidth: 24,
    viewBoxHeight: 24,
    bodyBounds: { x: 0, y: 0, width: 24, height: 24 },
    body: { kind: 'circle', cx: 12, cy: 12, r: 12 },
    seatRects: [],
    seats: 1,
    defaultMinPartySize: 1,
    defaultMaxPartySize: 1,
  },
  {
    id: 'rect-10-h',
    label: 'Rechteck 10',
    shape: 'rect',
    viewBoxWidth: 98,
    viewBoxHeight: 40,
    bodyBounds: { x: 0, y: 5, width: 98, height: 30 },
    body: { kind: 'rect', x: 0, y: 5, width: 98, height: 30, rx: 3 },
    seatRects: [
      { kind: 'rect', x: 2, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 20 },
      { kind: 'rect', x: 21, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 20 },
      { kind: 'rect', x: 40, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 20 },
      { kind: 'rect', x: 59, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 59, originY: 20 },
      { kind: 'rect', x: 78, y: 20, width: 20, height: 17, rx: 4, rotate: -90, originX: 78, originY: 20 },
      { kind: 'rect', x: 2, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 2, originY: 40 },
      { kind: 'rect', x: 21, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 21, originY: 40 },
      { kind: 'rect', x: 40, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 40, originY: 40 },
      { kind: 'rect', x: 59, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 59, originY: 40 },
      { kind: 'rect', x: 78, y: 40, width: 20, height: 17, rx: 4, rotate: -90, originX: 78, originY: 40 },
    ],
    seats: 10,
    defaultMinPartySize: 4,
    defaultMaxPartySize: 10,
  },
  {
    id: 'round-10',
    label: 'Rund 10',
    shape: 'round',
    viewBoxWidth: 51,
    viewBoxHeight: 50,
    bodyBounds: { x: 4.8503, y: 5, width: 40, height: 40 },
    body: { kind: 'circle', cx: 24.8503, cy: 25, r: 20 },
    seatRects: [
      { kind: 'rect', x: 20.8503, y: 0, width: 8, height: 17, rx: 4 },
      { kind: 'rect', x: 20.8503, y: 33, width: 8, height: 17, rx: 4 },
      { kind: 'rect', x: 49.7007, y: 29.8435, width: 8, height: 17, rx: 4, rotate: 110.119, originX: 49.7007, originY: 29.8435 },
      { kind: 'rect', x: 18.7144, y: 18.4923, width: 8, height: 17, rx: 4, rotate: 110.119, originX: 18.7144, originY: 18.4923 },
      { kind: 'rect', x: 43.1687, y: 42.4767, width: 8, height: 17, rx: 4, rotate: 142.743, originX: 43.1687, originY: 42.4767 },
      { kind: 'rect', x: 23.191, y: 16.211, width: 8, height: 17, rx: 4, rotate: 142.743, originX: 23.191, originY: 16.211 },
      { kind: 'rect', x: 12.7738, y: 46.7583, width: 8, height: 17, rx: 4, rotate: -142.421, originX: 12.7738, originY: 46.7583 },
      { kind: 'rect', x: 32.8993, y: 20.6055, width: 8, height: 17, rx: 4, rotate: -142.421, originX: 32.8993, originY: 20.6055 },
      { kind: 'rect', x: 2.95346, y: 36.3004, width: 8, height: 17, rx: 4, rotate: -108.675, originX: 2.95346, originY: 36.3004 },
      { kind: 'rect', x: 34.2161, y: 25.7339, width: 8, height: 17, rx: 4, rotate: -108.675, originX: 34.2161, originY: 25.7339 },
    ],
    seats: 10,
    defaultMinPartySize: 4,
    defaultMaxPartySize: 10,
  },
  {
    id: 'diamond-4',
    label: 'Diamant',
    shape: 'diamond',
    viewBoxWidth: 62,
    viewBoxHeight: 62,
    bodyBounds: { x: 0, y: 0, width: 62, height: 62 },
    body: { kind: 'rect', x: 0, y: 0, width: 62, height: 62, rx: 0, rotate: 45, originX: 31, originY: 31 },
    seatRects: [],
    seats: 4,
    defaultMinPartySize: 2,
    defaultMaxPartySize: 4,
    palette: false,
  },
];

// --- Lookup Maps ---

export const TABLE_VARIANT_MAP: Record<TableVariant, TableVariantDefinition> = Object.fromEntries(
  TABLE_VARIANTS.map(variant => [variant.id, variant]),
) as Record<TableVariant, TableVariantDefinition>;

export const EDITOR_TABLE_VARIANTS = TABLE_VARIANTS.filter(variant => variant.palette !== false);

export const DEFAULT_TABLE_VARIANT: TableVariant = 'square-4';
export const BAR_SEAT_VARIANT: TableVariant = 'barstool-1';

// --- Inference Helpers ---

export const inferTableVariant = (table: Pick<Table, 'variant' | 'shape' | 'seats'>): TableVariant => {
  if (table.variant && TABLE_VARIANT_MAP[table.variant]) return table.variant;
  const shape = table.shape || 'rect';
  const seats = table.seats || 4;

  if (shape === 'barstool') return 'barstool-1';
  if (shape === 'diamond') return 'diamond-4';
  if (shape === 'round') {
    if (seats <= 2) return 'round-2';
    if (seats <= 4) return 'round-4';
    if (seats <= 6) return 'round-6';
    if (seats <= 8) return 'round-8';
    return 'round-10';
  }
  if (shape === 'rect_v') return 'rect-2-v-wide';
  if (shape === 'square') return 'square-4';
  if (seats <= 6) return 'rect-6-h';
  if (seats <= 8) return 'rect-8-h';
  return 'rect-10-h';
};

export const inferPlacementType = (
  table: Pick<Table, 'placementType' | 'variant' | 'shape' | 'seats'>,
): TablePlacementType => {
  if (table.placementType) return table.placementType;
  const variant = inferTableVariant(table);
  return variant === BAR_SEAT_VARIANT || table.shape === 'barstool' ? 'bar_seat' : 'table';
};

export const getTableVariantConfig = (table: Pick<Table, 'variant' | 'shape' | 'seats'>): TableVariantDefinition =>
  TABLE_VARIANT_MAP[inferTableVariant(table)] || TABLE_VARIANT_MAP[DEFAULT_TABLE_VARIANT];

export const getTableLabelNumber = (table: Pick<Table, 'name'>): string =>
  table.name.replace(/^(Tisch|Barplatz|Bar-Sitz|Bar|[A-Za-z])\s*/i, '').trim() || table.name;

export const getTableKindLabel = (
  table: Pick<Table, 'placementType' | 'variant' | 'shape' | 'seats'>,
): string => inferPlacementType(table) === 'bar_seat' ? 'Bar-Sitz' : 'Tisch';

export const getTableDisplayLabel = (
  table: Pick<Table, 'name' | 'placementType' | 'variant' | 'shape' | 'seats'>,
): string => inferPlacementType(table) === 'bar_seat' ? `Barplatz ${getTableLabelNumber(table)}` : table.name;
