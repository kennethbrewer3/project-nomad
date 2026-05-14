import { useState } from 'react'

export type DrawMode =
  | 'marker'
  | 'circle'
  | 'ellipse'
  | 'rectangle_corner'
  | 'rectangle_center'
  | 'polygon'
  | 'line'
  | 'marker_distance'

type DrawTool = {
  mode: DrawMode
  label: string
  title: string
  icon: string
}

const DRAW_TOOLS: DrawTool[] = [
  { mode: 'marker', label: 'Pin', title: 'Drop map pins', icon: '📍' },
  { mode: 'circle', label: 'Circle', title: 'Draw circular zones with two clicks', icon: '○' },
  { mode: 'ellipse', label: 'Ellipse', title: 'Draw elliptical zones with two clicks', icon: '⬭' },
  { mode: 'rectangle_corner', label: 'Corner rectangle', title: 'Draw rectangles from corner to corner', icon: '▭' },
  { mode: 'rectangle_center', label: 'Center rectangle', title: 'Draw rectangles from center outward', icon: '▣' },
  { mode: 'polygon', label: 'Polygon', title: 'Draw straight polygon zones', icon: '⬠' },
  { mode: 'line', label: 'Line', title: 'Draw distance lines', icon: '╱' },
  { mode: 'marker_distance', label: 'Marker distance', title: 'Select two pins to draw a distance line', icon: '↔' },
]

type DrawToolsSelectorProps = {
  drawMode: DrawMode
  drawPointCount: number
  onModeChange: (mode: DrawMode) => void
  onFinishPolygon: () => void
  onClear: () => void
  onMouseEnter?: () => void
}

export default function DrawToolsSelector({
  drawMode,
  drawPointCount,
  onModeChange,
  onFinishPolygon,
  onClear,
  onMouseEnter,
}: DrawToolsSelectorProps) {
  const [open, setOpen] = useState(false)
  const selectedTool = DRAW_TOOLS.find((tool) => tool.mode === drawMode) ?? DRAW_TOOLS[0]
  const showPolygonFinish = drawMode === 'polygon'

  return (
    <div className="relative flex items-center gap-1" onMouseEnter={onMouseEnter}>
      <div className="relative">
        <button
          type="button"
          title={`Draw tool: ${selectedTool.title}`}
          aria-label={`Draw tool: ${selectedTool.label}`}
          onClick={() => setOpen((prev) => !prev)}
          className={`rounded border border-border-default p-2 transition-colors ${
            drawMode !== 'marker'
              ? 'bg-desert-green text-white'
              : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
          }`}
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center text-base leading-none">
            {selectedTool.icon}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-[60] grid w-24 grid-cols-2 gap-1 rounded-lg border border-border-subtle bg-surface-primary p-2 shadow-lg">
            {DRAW_TOOLS.map((tool) => (
              <button
                key={tool.mode}
                type="button"
                title={tool.title}
                aria-label={tool.label}
                onClick={() => {
                  onModeChange(tool.mode)
                  setOpen(false)
                }}
                className={`rounded border border-border-default p-2 text-text-secondary transition-colors ${
                  drawMode === tool.mode
                    ? 'bg-desert-green text-white'
                    : 'bg-surface-primary hover:bg-surface-secondary'
                }`}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center text-base leading-none">
                  {tool.icon}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showPolygonFinish && (
        <button
          type="button"
          onClick={onFinishPolygon}
          disabled={drawPointCount < 3}
          title="Finish polygon"
          aria-label="Finish polygon"
          className="rounded border border-border-default bg-desert-orange p-2 text-xs text-white disabled:opacity-40"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center leading-none">✓</span>
        </button>
      )}

      {drawPointCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          title="Clear current drawing"
          aria-label="Clear current drawing"
          className="rounded border border-border-default bg-surface-primary p-2 text-xs text-text-secondary hover:bg-surface-secondary"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center leading-none">×</span>
        </button>
      )}
    </div>
  )
}
