// Undo / redo logic extracted
export function useCanvasHistory(diamondCanvasRef, canvasHeaderRef, refreshColorStatistics) {
  function updateUndoRedoButtonState() {
    const dc = diamondCanvasRef.value
    const header = canvasHeaderRef.value
    if (!dc || !header) return
    const canUndo = dc._cmdStack && dc._cmdStack.undoStack.length > 0
    const canRedo = dc._cmdStack && dc._cmdStack.redoStack.length > 0
    // 使用可选链避免方法不存在时报错
    if (typeof header.updateUndoRedoState === 'function') {
      header.updateUndoRedoState(canUndo, canRedo)
    } else {
      console.warn('[useCanvasHistory] header.updateUndoRedoState not available yet')
    }
  }
  function handleUndo() {
    const dc = diamondCanvasRef.value
    if (dc && dc.undo) {
      dc.undo()
      refreshColorStatistics && refreshColorStatistics()
      updateUndoRedoButtonState()
    }
  }
  function handleRedo() {
    const dc = diamondCanvasRef.value
    if (dc && dc.redo) {
      dc.redo()
      refreshColorStatistics && refreshColorStatistics()
      updateUndoRedoButtonState()
    }
  }
  return { handleUndo, handleRedo, updateUndoRedoButtonState }
}
