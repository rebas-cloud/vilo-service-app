// Custom hook for FloorPlan editor state and operations.
// Encapsulates: layout undo/redo, table placement, variant selection,
// combination editor, canvas sizing, and drag/drop.

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Table, TableCombination, TableVariant } from '../types';
import {
  type PersistedEditorCanvasSizes,
  TABLE_VARIANT_MAP, DEFAULT_TABLE_VARIANT, BAR_SEAT_VARIANT,
  getTableRotation,
  getTableSize, snapPointToGrid, clampTableToBounds, snapCanvasSize,
  EDITOR_MIN_CANVAS_WIDTH, EDITOR_MIN_CANVAS_HEIGHT,
  FLOORPLAN_EDITOR_CANVAS_STORAGE_KEY,
  loadPersistedEditorCanvasSizes,
} from '../utils/floorplan';

interface UseFloorPlanEditorParams {
  tables: Table[];
  tableCombinations: TableCombination[];
  zones: { id: string; name: string }[];
  activeZone: string;
  saveTableUpdate: (tables: Table[]) => void;
  saveCombinationUpdate: (combos: TableCombination[]) => void;
}

export function useFloorPlanEditor({
  tables,
  tableCombinations,
  activeZone,
  saveTableUpdate,
  saveCombinationUpdate,
}: UseFloorPlanEditorParams) {
  // --- Editor Mode ---
  const [editorMode, setEditorMode] = useState<'layout' | 'combos'>('layout');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [editorTool, setEditorTool] = useState<'select' | 'move'>('move');
  const [placementVariant, setPlacementVariant] = useState<TableVariant | null>(null);
  const [draggedVariant, setDraggedVariant] = useState<TableVariant | null>(null);
  const [newTableVariant, setNewTableVariant] = useState<TableVariant>(DEFAULT_TABLE_VARIANT);
  const [editorNameDraft, setEditorNameDraft] = useState('');

  // --- Undo/Redo ---
  const [layoutUndoStack, setLayoutUndoStack] = useState<Table[][]>([]);
  const [layoutRedoStack, setLayoutRedoStack] = useState<Table[][]>([]);

  // --- Combination Editor ---
  const [comboDraftTableIds, setComboDraftTableIds] = useState<string[]>([]);
  const [focusedCombinationId, setFocusedCombinationId] = useState<string | null>(null);
  const [focusedCombinationTableId, setFocusedCombinationTableId] = useState<string | null>(null);
  const [comboError, setComboError] = useState('');
  const [comboSaveFeedback, setComboSaveFeedback] = useState<'idle' | 'saved'>('idle');

  // --- Canvas Sizing ---
  const [editorCanvasSizeByZone, setEditorCanvasSizeByZone] = useState<PersistedEditorCanvasSizes>(
    loadPersistedEditorCanvasSizes(),
  );
  const editorFrameRef = useRef<HTMLDivElement>(null);
  const editorStageRef = useRef<HTMLDivElement>(null);

  // --- Computed ---
  const zoneTables = useMemo(() => tables.filter(t => t.zone === activeZone), [tables, activeZone]);
  const zoneCombinations = useMemo(
    () => tableCombinations.filter(c => c.zoneId === activeZone),
    [tableCombinations, activeZone],
  );
  const selectedEditorTable = useMemo(
    () => selectedTable ? tables.find(t => t.id === selectedTable) : undefined,
    [selectedTable, tables],
  );

  // --- Canvas Size ---
  const editorMinimumCanvasSize = useMemo(() => {
    let maxRight = 0;
    let maxBottom = 0;
    for (const table of zoneTables) {
      const size = getTableSize(table);
      const right = (table.x || 0) + size.w + 32;
      const bottom = (table.y || 0) + size.h + 32;
      if (right > maxRight) maxRight = right;
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return {
      width: snapCanvasSize(Math.max(EDITOR_MIN_CANVAS_WIDTH, maxRight)),
      height: snapCanvasSize(Math.max(EDITOR_MIN_CANVAS_HEIGHT, maxBottom)),
    };
  }, [zoneTables]);

  const clampEditorCanvasSize = useCallback((next: { width: number; height: number }) => ({
    width: Math.max(editorMinimumCanvasSize.width, snapCanvasSize(next.width)),
    height: Math.max(editorMinimumCanvasSize.height, snapCanvasSize(next.height)),
  }), [editorMinimumCanvasSize]);

  const editorCanvasSize = useMemo(() => {
    const stored = editorCanvasSizeByZone[activeZone];
    if (stored) {
      return clampEditorCanvasSize(stored);
    }
    return {
      width: Math.max(EDITOR_MIN_CANVAS_WIDTH, editorMinimumCanvasSize.width),
      height: Math.max(EDITOR_MIN_CANVAS_HEIGHT, editorMinimumCanvasSize.height),
    };
  }, [activeZone, editorCanvasSizeByZone, editorMinimumCanvasSize, clampEditorCanvasSize]);

  // --- Layout Operations ---
  const commitLayoutUpdate = useCallback((updatedTables: Table[], previousTables: Table[] = tables) => {
    setLayoutUndoStack(prev => [...prev, previousTables]);
    setLayoutRedoStack([]);
    saveTableUpdate(updatedTables);
  }, [saveTableUpdate, tables]);

  const handleUndoLayout = useCallback(() => {
    setLayoutUndoStack(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setLayoutRedoStack(redoPrev => [...redoPrev, tables]);
      saveTableUpdate(previous);
      return prev.slice(0, -1);
    });
  }, [saveTableUpdate, tables]);

  const handleRedoLayout = useCallback(() => {
    setLayoutRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setLayoutUndoStack(undoPrev => [...undoPrev, tables]);
      saveTableUpdate(next);
      return prev.slice(0, -1);
    });
  }, [saveTableUpdate, tables]);

  const updateTableField = useCallback((tableId: string, field: keyof Table, value: Table[keyof Table]) => {
    const previousTables = tables;
    const updatedTables = tables.map(table => (
      table.id === tableId ? { ...table, [field]: value } : table
    ));
    commitLayoutUpdate(updatedTables, previousTables);
  }, [commitLayoutUpdate, tables]);

  const duplicateSelectedTable = useCallback(() => {
    if (!selectedTable) return;
    const table = tables.find(entry => entry.id === selectedTable);
    if (!table) return;
    const duplicated: Table = {
      ...table,
      id: 'table-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      x: (table.x || 0) + 48,
      y: (table.y || 0) + 48,
      rotation: getTableRotation(table),
      status: 'free',
      sessionId: undefined,
      name: `${table.name} Kopie`,
    };
    commitLayoutUpdate([...tables, duplicated], tables);
    setSelectedTable(duplicated.id);
  }, [commitLayoutUpdate, selectedTable, tables]);

  const handleDeleteTable = useCallback(() => {
    if (!selectedTable) return;
    commitLayoutUpdate(tables.filter(t => t.id !== selectedTable), tables);
    setSelectedTable(null);
  }, [commitLayoutUpdate, selectedTable, tables]);

  const handleChangeVariant = useCallback((variantId: TableVariant) => {
    if (!selectedTable) return;
    const variant = TABLE_VARIANT_MAP[variantId];
    if (!variant) return;
    const updatedTables = tables.map(table =>
      table.id === selectedTable
        ? {
            ...table,
            variant: variant.id,
            shape: variant.shape,
            seats: variant.seats,
            minPartySize: variant.defaultMinPartySize,
            maxPartySize: variant.defaultMaxPartySize,
            placementType: variant.id === BAR_SEAT_VARIANT ? 'bar_seat' as const : 'table' as const,
          }
        : table
    );
    commitLayoutUpdate(updatedTables, tables);
  }, [commitLayoutUpdate, selectedTable, tables]);

  const handleCommitEditorName = useCallback(() => {
    if (!selectedEditorTable || !editorNameDraft.trim()) return;
    if (editorNameDraft.trim() === selectedEditorTable.name) return;
    updateTableField(selectedEditorTable.id, 'name', editorNameDraft.trim());
  }, [selectedEditorTable, editorNameDraft, updateTableField]);

  // --- Table Placement ---
  const handleAddTable = useCallback((clientX: number, clientY: number, variantId: TableVariant) => {
    const stageEl = editorStageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const variant = TABLE_VARIANT_MAP[variantId] || TABLE_VARIANT_MAP[DEFAULT_TABLE_VARIANT];
    const size = { w: variant.bodyBounds.width, h: variant.bodyBounds.height };
    const rawX = (clientX - rect.left) / (rect.width / editorCanvasSize.width) - size.w / 2;
    const rawY = (clientY - rect.top) / (rect.height / editorCanvasSize.height) - size.h / 2;
    const snapped = snapPointToGrid(rawX, rawY);
    const clamped = clampTableToBounds(snapped.x, snapped.y, { variant: variantId, shape: variant.shape, seats: variant.seats, rotation: 0 }, editorCanvasSize.width, editorCanvasSize.height);

    const existingCount = tables.filter(t => t.zone === activeZone).length;
    const kindLabel = variant.id === BAR_SEAT_VARIANT ? 'Barplatz' : 'Tisch';
    const newTable: Table = {
      id: 'table-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: `${kindLabel} ${existingCount + 1}`,
      zone: activeZone,
      status: 'free',
      x: clamped.x,
      y: clamped.y,
      rotation: 0,
      variant: variant.id,
      shape: variant.shape,
      seats: variant.seats,
      minPartySize: variant.defaultMinPartySize,
      maxPartySize: variant.defaultMaxPartySize,
      placementType: variant.id === BAR_SEAT_VARIANT ? 'bar_seat' : 'table',
    };
    commitLayoutUpdate([...tables, newTable], tables);
    setSelectedTable(newTable.id);
    setEditorNameDraft(newTable.name);
  }, [tables, activeZone, editorCanvasSize, commitLayoutUpdate]);

  // --- Canvas Interactions ---
  const handleEditorCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (placementVariant) {
      handleAddTable(e.clientX, e.clientY, placementVariant);
    }
  }, [placementVariant, handleAddTable]);

  const handleEditorCanvasDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-vilo-table-variant')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleEditorCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const variantId = e.dataTransfer.getData('application/x-vilo-table-variant') as TableVariant;
    if (!variantId) return;
    e.preventDefault();
    handleAddTable(e.clientX, e.clientY, variantId);
    setDraggedVariant(null);
  }, [handleAddTable]);

  // --- Resize ---
  const resizeRef = useRef<{
    zoneId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    minWidth: number;
    minHeight: number;
  } | null>(null);

  const startEditorResize = useCallback((clientX: number, clientY: number) => {
    resizeRef.current = {
      zoneId: activeZone,
      startX: clientX,
      startY: clientY,
      startWidth: editorCanvasSize.width,
      startHeight: editorCanvasSize.height,
      minWidth: editorMinimumCanvasSize.width,
      minHeight: editorMinimumCanvasSize.height,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      const nextWidth = snapCanvasSize(Math.max(resizeRef.current.minWidth, resizeRef.current.startWidth + dx));
      const nextHeight = snapCanvasSize(Math.max(resizeRef.current.minHeight, resizeRef.current.startHeight + dy));
      setEditorCanvasSizeByZone(prev => {
        const next = { ...prev, [resizeRef.current!.zoneId]: { width: nextWidth, height: nextHeight } };
        try {
          window.localStorage.setItem(FLOORPLAN_EDITOR_CANVAS_STORAGE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [activeZone, editorCanvasSize, editorMinimumCanvasSize]);

  // --- Combination Operations ---
  const saveCombinationDraft = useCallback(() => {
    if (comboDraftTableIds.length < 2) {
      setComboError('Mindestens 2 Tische auswählen');
      return;
    }
    const comboId = 'combo-' + Date.now();
    const totalSeats = comboDraftTableIds.reduce((sum, id) => {
      const t = tables.find(table => table.id === id);
      return sum + (t?.seats || 4);
    }, 0);
    const newCombo: TableCombination = {
      id: comboId,
      zoneId: activeZone,
      name: `Kombi ${zoneCombinations.length + 1}`,
      tableIds: comboDraftTableIds,
      minPartySize: Math.max(2, Math.floor(totalSeats * 0.5)),
      maxPartySize: totalSeats,
    };
    saveCombinationUpdate([...tableCombinations, newCombo]);
    setComboDraftTableIds([]);
    setComboError('');
    setComboSaveFeedback('saved');
    setTimeout(() => setComboSaveFeedback('idle'), 2000);
    setFocusedCombinationId(comboId);
  }, [comboDraftTableIds, tables, activeZone, zoneCombinations, tableCombinations, saveCombinationUpdate]);

  const updateCombinationField = useCallback((comboId: string, field: string, value: unknown) => {
    saveCombinationUpdate(
      tableCombinations.map(c =>
        c.id === comboId ? { ...c, [field]: value } : c
      ),
    );
  }, [tableCombinations, saveCombinationUpdate]);

  const deleteCombination = useCallback((comboId: string) => {
    saveCombinationUpdate(tableCombinations.filter(c => c.id !== comboId));
    if (focusedCombinationId === comboId) {
      setFocusedCombinationId(null);
      setFocusedCombinationTableId(null);
    }
  }, [tableCombinations, saveCombinationUpdate, focusedCombinationId]);

  // --- Selected table name sync ---
  useEffect(() => {
    if (selectedEditorTable) {
      setEditorNameDraft(selectedEditorTable.name);
    }
  }, [selectedEditorTable?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Editor mode
    editorMode, setEditorMode,
    selectedTable, setSelectedTable,
    editorTool, setEditorTool,
    placementVariant, setPlacementVariant,
    draggedVariant, setDraggedVariant,
    newTableVariant, setNewTableVariant,
    editorNameDraft, setEditorNameDraft,
    selectedEditorTable,

    // Undo/Redo
    layoutUndoStack, layoutRedoStack,
    handleUndoLayout, handleRedoLayout,
    commitLayoutUpdate,

    // Table operations
    updateTableField,
    duplicateSelectedTable,
    handleDeleteTable,
    handleChangeVariant,
    handleCommitEditorName,

    // Canvas
    editorFrameRef, editorStageRef,
    editorCanvasSize, editorMinimumCanvasSize,
    handleEditorCanvasClick,
    handleEditorCanvasDragOver,
    handleEditorCanvasDrop,
    startEditorResize,

    // Combinations
    comboDraftTableIds, setComboDraftTableIds,
    focusedCombinationId, setFocusedCombinationId,
    focusedCombinationTableId, setFocusedCombinationTableId,
    comboError, setComboError,
    comboSaveFeedback,
    saveCombinationDraft,
    updateCombinationField,
    deleteCombination,

    // Computed
    zoneTables, zoneCombinations,
  };
}
