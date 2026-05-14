import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Popup } from 'react-map-gl/maplibre'
import { IconBorderStyle2, IconBucketDroplet } from '@tabler/icons-react'

import type { MapZone } from '~/hooks/useMapZones'
import type { LatLng, MapZoneGeometry } from '../../../types/maps'

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
    geometry: MapZoneGeometry
    navigationTime: string | null
    navigationDirection: string | null
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
  const [geometry, setGeometry] = useState<MapZoneGeometry>(zone.geometry)
  const [navigationTime, setNavigationTime] = useState(zone.navigationTime ?? '')
  const [navigationDirection, setNavigationDirection] = useState(zone.navigationDirection ?? '')
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
    fillOpacity !== zone.fillOpacity ||
    navigationTime !== (zone.navigationTime ?? '') ||
    navigationDirection !== (zone.navigationDirection ?? '') ||
    JSON.stringify(geometry) !== JSON.stringify(zone.geometry)

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
        geometry,
        navigationTime: zone.zoneType === 'line' ? navigationTime.trim() || null : null,
        navigationDirection: zone.zoneType === 'line' ? navigationDirection.trim() || null : null,
        visible: zone.visible,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateLatLng = (point: LatLng, field: keyof LatLng, value: number): LatLng => ({
    ...point,
    [field]: value,
  })

  const updateGeometry = (updater: (current: MapZoneGeometry) => MapZoneGeometry) => {
    setGeometry((current) => updater(current))
  }

  const renderNumberInput = (label: string, value: number, onChange: (value: number) => void, step = 0.000001) => (
    <label className="block text-[11px] text-gray-500">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </label>
  )

  const renderPointInputs = (label: string, point: LatLng, onChange: (point: LatLng) => void) => (
    <div className="grid grid-cols-2 gap-1">
      {renderNumberInput(`${label} lat`, point.latitude, (value) => onChange(updateLatLng(point, 'latitude', value)))}
      {renderNumberInput(`${label} lng`, point.longitude, (value) => onChange(updateLatLng(point, 'longitude', value)))}
    </div>
  )

  const renderLineNavigationInputs = () => {
    if (geometry.type !== 'line') return null

    return (
      <div className="space-y-1">
        <label className="block text-[11px] text-gray-500">
          <span>Navigation time</span>
          <input
            type="text"
            placeholder="e.g. 12 min"
            value={navigationTime}
            onChange={(e) => setNavigationTime(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-[11px] text-gray-500">
          <span>Navigation direction</span>
          <input
            type="text"
            placeholder="e.g. NW or 315°"
            value={navigationDirection}
            onChange={(e) => setNavigationDirection(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
    )
  }

  const renderGeometryFields = () => {
    if (geometry.type === 'circle') {
      return (
        <div className="space-y-1">
          {renderPointInputs('Center', geometry.center, (center) =>
            updateGeometry((current) => current.type === 'circle' ? { ...current, center } : current)
          )}
          {renderNumberInput('Radius meters', geometry.radiusMeters, (radiusMeters) =>
            updateGeometry((current) => current.type === 'circle' ? { ...current, radiusMeters } : current), 1
          )}
        </div>
      )
    }

    if (geometry.type === 'ellipse') {
      return (
        <div className="space-y-1">
          {renderPointInputs('Center', geometry.center, (center) =>
            updateGeometry((current) => current.type === 'ellipse' ? { ...current, center } : current)
          )}
          <div className="grid grid-cols-3 gap-1">
            {renderNumberInput('Radius X m', geometry.radiusXmeters, (radiusXmeters) =>
              updateGeometry((current) => current.type === 'ellipse' ? { ...current, radiusXmeters } : current), 1
            )}
            {renderNumberInput('Radius Y m', geometry.radiusYmeters, (radiusYmeters) =>
              updateGeometry((current) => current.type === 'ellipse' ? { ...current, radiusYmeters } : current), 1
            )}
            {renderNumberInput('Rotation', geometry.rotationDegrees, (rotationDegrees) =>
              updateGeometry((current) => current.type === 'ellipse' ? { ...current, rotationDegrees } : current), 1
            )}
          </div>
        </div>
      )
    }

    if (geometry.type === 'rectangle') {
      return (
        <div className="grid grid-cols-2 gap-1">
          {(['north', 'south', 'east', 'west'] as const).map((field) =>
            renderNumberInput(field, geometry.bounds[field], (value) =>
              updateGeometry((current) =>
                current.type === 'rectangle' ? { ...current, bounds: { ...current.bounds, [field]: value } } : current
              )
            )
          )}
        </div>
      )
    }

    if (geometry.type === 'line' || geometry.type === 'polygon') {
      return (
        <div className="space-y-2">
          {renderLineNavigationInputs()}

          {geometry.points.map((point, index) => (
            <div key={`point-${index}`} className="rounded border border-gray-200 p-1">
              {renderPointInputs(`Point ${index + 1}`, point, (updatedPoint) =>
                updateGeometry((current) =>
                  (current.type === 'line' || current.type === 'polygon') && current.type === geometry.type
                    ? { ...current, points: current.points.map((existingPoint, pointIndex) => pointIndex === index ? updatedPoint : existingPoint) }
                    : current
                )
              )}
            </div>
          ))}

        </div>
      )
    }

    return null
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

        <div className="mt-2 max-h-56 overflow-y-auto rounded border border-gray-200 p-2">
          <div className="mb-1 text-xs font-semibold text-gray-600">Geometry</div>
          {renderGeometryFields()}
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
