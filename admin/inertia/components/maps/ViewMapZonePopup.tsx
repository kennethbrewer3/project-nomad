import { Popup } from 'react-map-gl/maplibre'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { MapZone } from '~/hooks/useMapZones'

type ViewMapZonePopupProps = {
  zone: MapZone
  longitude: number
  latitude: number
  onClose: () => void
  onEdit: () => void
  onMouseEnter?: () => void
}

export default function ViewMapZonePopup({
  zone,
  longitude,
  latitude,
  onClose,
  onEdit,
  onMouseEnter,
}: ViewMapZonePopupProps) {
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      offset={[0, -12] as [number, number]}
      onClose={onClose}
      closeOnClick={false}
      closeButton={false}
    >
      <div
        className="max-w-[280px]"
        onMouseEnter={onMouseEnter}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium break-words">{zone.name}</div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
          <span>{zone.zoneType}</span>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.strokeColor }} />
        </div>

        {zone.notes && (
          <div className="mt-1 max-w-[260px] break-all whitespace-pre-wrap text-xs text-gray-500">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 underline hover:text-blue-700"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {zone.notes}
            </ReactMarkdown>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="w-16 rounded bg-[#424420] px-2.5 py-1 text-xs text-white hover:bg-[#525530] border-none outline-none"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="w-16 rounded bg-[#424420] px-2.5 py-1 text-xs text-white hover:bg-[#525530] border-none outline-none"
          >
            Edit
          </button>
        </div>
      </div>
    </Popup>
  )
}
