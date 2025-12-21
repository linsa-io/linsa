import { Copy, Plus, Trash } from "lucide-react"

type CanvasToolbarProps = {
  disabled?: boolean
  canDuplicate?: boolean
  canDelete?: boolean
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export const CanvasToolbar = ({
  disabled,
  canDuplicate = true,
  canDelete = true,
  onAdd,
  onDuplicate,
  onDelete,
}: CanvasToolbarProps) => {
  const buttonClass =
    "h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white flex items-center justify-center transition hover:border-white hover:text-white"

  return (
    <div className="pointer-events-auto flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/30 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur">
      <button
        type="button"
        aria-label="Add artboard"
        className={buttonClass}
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        aria-label="Duplicate artboard"
        className={buttonClass}
        disabled={disabled || !canDuplicate}
        onClick={onDuplicate}
      >
        <Copy size={16} />
      </button>
      <button
        type="button"
        aria-label="Delete artboard"
        className={buttonClass}
        disabled={disabled || !canDelete}
        onClick={onDelete}
      >
        <Trash size={16} />
      </button>
    </div>
  )
}
