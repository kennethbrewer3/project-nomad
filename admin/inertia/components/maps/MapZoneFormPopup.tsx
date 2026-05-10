import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Popup } from 'react-map-gl/maplibre'
import { IconBorderStyle2, IconBucketDroplet } from '@tabler/icons-react'

import type { MapZone } from '~/hooks/useMapZones'

const MAX_ZONE_NOTES_LENGTH = 1000

const inputClass =
  'block w-full box-border rounded border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 leading-normal placeholder:text-gray-400 focus:outline-none focus:border-gray-500'

const ZONE_COLORS = [
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Purple', hex: '#9333ea' },
]

type MapZoneFormPopupProps = {
  zone: MapZone
  longitude: number
  latitude: number
  onSave: (values: {
    id: number
    name: string
    notes: string
    strokeColor: string
    fillColor: string | null
    fillOpacity: number
    visible: boolean
  }) => Promise<void> | void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onMouseEnter?: () => void
}

export default function MapZoneFormPopup({
  zone,
  longitude,
  latitude,
  onSave,
  onCancel,
  onDirtyChange,
  onMouseEnter,
}: MapZoneFormPopupProps) {
  const [name, setName] = useState(zone.name)
  const [notes, setNotes] = useState(zone.notes ?? '')
  const [strokeColor, setStrokeColor] = useState(zone.strokeColor)
  const [fillColor, setFillColor] = useState(zone.fillColor ?? zone.strokeColor)
  const [fillOpacity, setFillOpacity] = useState(zone.fillOpacity)
  const [isSaving, setIsSaving] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const strokeColorInputRef = useRef<HTMLInputElement | null>(null)
  const fillColorInputRef = useRef<HTMLInputElement | null>(null)

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useLayoutEffect(() => {
    resizeTextarea()
  }, [resizeTextarea])

  useLayoutEffect(() => {
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [])

  const isDirty =
    name !== zone.name ||
    notes !== (zone.notes ?? '') ||
    strokeColor !== zone.strokeColor ||
    fillColor !== (zone.fillColor ?? zone.strokeColor) ||
    fillOpacity !== zone.fillOpacity

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const handleSave = async () => {
    if (!name.trim() || isSaving) return

    try {
      setIsSaving(true)

      await onSave({
        id: zone.id,
        name: name.trim(),
        notes: notes.trim(),
        strokeColor,
        fillColor: zone.zoneType === 'line' ? null : fillColor,
        fillOpacity,
        visible: zone.visible,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      offset={[0, -12] as [number, number]}
      onClose={onCancel}
      closeOnClick={false}
      closeButton={false}
    >
      <div
        className="w-[460px] max-w-full box-border p-1"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
      >
        <input
          ref={nameInputRef}
          autoFocus
          type="text"
          placeholder="Name this zone"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
          className={inputClass}
        />

        <textarea
          ref={textareaRef}
          placeholder="Add notes (optional)"
          value={notes}
          rows={2}
          maxLength={MAX_ZONE_NOTES_LENGTH}
          onChange={(e) => {
            setNotes(e.target.value)
            requestAnimationFrame(resizeTextarea)
          }}
          className={`mt-1 min-h-[64px] max-h-[240px] resize-none overflow-y-auto themed-scrollbar ${inputClass}`}
        />

        <div className="mt-1 text-[11px] text-gray-400">
          {notes.length}/{MAX_ZONE_NOTES_LENGTH}
        </div>

        <div className="mt-1.5 flex gap-1 items-center">
          {ZONE_COLORS.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => {
                setStrokeColor(color.hex)
                if (zone.zoneType !== 'line') setFillColor(color.hex)
              }}
              title={color.label}
              className="rounded-full p-0.5 transition-transform"
              style={{
                outline: strokeColor === color.hex ? `2px solid ${color.hex}` : '2px solid transparent',
                outlineOffset: '1px',
              }}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.hex }} />
            </button>
          ))}

          <button
            type="button"
            title="Choose custom stroke color"
            aria-label="Choose custom stroke color"
            onClick={() => strokeColorInputRef.current?.click()}
            className="rounded-full p-0.5 transition-transform"
            style={{ outline: '2px solid transparent', outlineOffset: '1px' }}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border-default"
              style={{ backgroundColor: strokeColor }}
            >
              <IconBorderStyle2 size={16} stroke={2} className="text-white" />
            </span>
          </button>

          {zone.zoneType !== 'line' && (
            <button
              type="button"
              title="Choose custom fill color"
              aria-label="Choose custom fill color"
              onClick={() => fillColorInputRef.current?.click()}
              className="rounded-full p-0.5 transition-transform"
              style={{ outline: '2px solid transparent', outlineOffset: '1px' }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border-default"
                style={{ backgroundColor: fillColor }}
              >
                <IconBucketDroplet size={16} stroke={2} className="text-white" />
              </span>
            </button>
          )}

          <input
            ref={strokeColorInputRef}
            type="color"
            value={strokeColor}
            onChange={(e) => {
              setStrokeColor(e.target.value)
              if (zone.zoneType !== 'line') setFillColor(e.target.value)
            }}
            className="sr-only"
            aria-label="Choose custom stroke color"
          />

          <input
            ref={fillColorInputRef}
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="sr-only"
            aria-label="Choose custom fill color"
          />
        </div>

        <div className="mt-1.5">
          {zone.zoneType !== 'line' && (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span>Fill opacity</span>
              <span className="w-8 text-right">{Math.round(fillOpacity * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={fillOpacity}
                onChange={(e) => setFillOpacity(Number(e.target.value))}
                className="block w-48"
              />
            </label>
          )}
        </div>

        <div className="mt-1.5 flex gap-1.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs bg-[#424420] text-white rounded px-2.5 py-1 hover:bg-[#525530] disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="text-xs bg-[#424420] text-white rounded px-2.5 py-1 hover:bg-[#525530] disabled:opacity-40 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Popup>
  )
}
