import { Undo2, Redo2 } from "lucide-react"

interface CanvasToolbarProps {
  onUndo?: () => void
  onRedo?: () => void
  onReset?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export default function UndoRedoToolbar({
  onUndo,
  onRedo,
  onReset,
  canUndo = false,
  canRedo = false,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2  rounded-lg">
      <button
        onClick={onUndo}
        color=""
        disabled={!canUndo}
        className="text-white p-2 hover:bg-neutral-700 h-[40px] flex items-center justify-center min-w-[40px] bg-neutral-800/50 rounded-lg"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="text-white p-2 hover:bg-neutral-700 h-[40px] flex items-center justify-center min-w-[40px] bg-neutral-800/50 rounded-lg"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <button
        onClick={onReset}
        className="text-white p-2 hover:bg-neutral-700 h-[40px] flex items-center justify-center min-w-[40px] bg-neutral-800/50 rounded-lg"
      >
        Reset
      </button>
    </div>
  )
}
