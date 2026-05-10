import { useMemo, useState } from 'react'
import {
  IconCircle,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLetterCase,
  IconLine,
  IconList,
  IconMap2,
  IconPolygon,
  IconRectangle,
  IconRulerMeasure,
  IconSitemap,
  IconTrash,
} from '@tabler/icons-react'

import type { MapZone } from '~/hooks/useMapZones'

interface ZonePanelProps {
  zones: MapZone[]
  hiddenDistanceZoneIds: Set<number>
  hiddenNameZoneIds: Set<number>
  showZoneDistances: boolean
  showZoneNames: boolean
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onFlyTo: (longitude: number, latitude: number) => void
  onSelect: (id: number | null) => void
  onToggleDistanceVisibility: (id: number) => void
  onToggleNameVisibility: (id: number) => void
  onToggleShowZoneDistances: (visible: boolean) => void
  onToggleShowZoneNames: (visible: boolean) => void
  onToggleVisibility: (id: number, visible: boolean) => void
  selectedZoneId: number | null
}

type SortField = 'name' | 'type' | 'color' | 'visibility'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'list' | 'tree'

type ZoneGroup = {
  key: string
  label: string
  zones: MapZone[]
}

type ZoneCenter = {
  longitude: number
  latitude: number
}

const zoneTypeLabel = (zone: MapZone) => {
  if (zone.zoneType === 'rectangle') return 'Rectangle'
  if (zone.zoneType === 'polygon') return 'Polygon'
  if (zone.zoneType === 'ellipse') return 'Ellipse'
  if (zone.zoneType === 'circle') return 'Circle'
  return 'Line'
}

const getZoneCenter = (zone: MapZone): ZoneCenter => {
  const geometry = zone.geometry

  if (geometry.type === 'circle' || geometry.type === 'ellipse') return geometry.center

  if (geometry.type === 'rectangle') {
    return {
      longitude: (geometry.bounds.east + geometry.bounds.west) / 2,
      latitude: (geometry.bounds.north + geometry.bounds.south) / 2,
    }
  }

  if (geometry.type === 'polygon' || geometry.type === 'line') {
    const pointCount = geometry.points.length || 1

    return {
      longitude: geometry.points.reduce((sum, point) => sum + point.longitude, 0) / pointCount,
      latitude: geometry.points.reduce((sum, point) => sum + point.latitude, 0) / pointCount,
    }
  }

  return { longitude: 0, latitude: 0 }
}

const ZoneTypeIcon = ({ zone }: { zone: MapZone }) => {
  if (zone.zoneType === 'rectangle') return <IconRectangle size={16} className="shrink-0" style={{ color: zone.strokeColor }} />
  if (zone.zoneType === 'polygon') return <IconPolygon size={16} className="shrink-0" style={{ color: zone.strokeColor }} />
  if (zone.zoneType === 'line') return <IconLine size={16} className="shrink-0" style={{ color: zone.strokeColor }} />
  return <IconCircle size={16} className="shrink-0" style={{ color: zone.strokeColor }} />
}

export default function ZonePanel({
  zones,
  hiddenDistanceZoneIds,
  hiddenNameZoneIds,
  showZoneDistances,
  showZoneNames,
  onDelete,
  onEdit,
  onFlyTo,
  onSelect,
  onToggleDistanceVisibility,
  onToggleNameVisibility,
  onToggleShowZoneDistances,
  onToggleShowZoneNames,
  onToggleVisibility,
  selectedZoneId,
}: ZonePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const sortDirectionLabel = sortDirection === 'asc' ? 'A → Z' : 'Z → A'

  const filteredAndSortedZones = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return [...zones]
      .filter((zone) => {
        if (!query) return true
        return zone.name.toLowerCase().includes(query) || zoneTypeLabel(zone).toLowerCase().includes(query)
      })
      .sort((a, b) => {
        const result =
          sortField === 'name'
            ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            : sortField === 'type'
              ? zoneTypeLabel(a).localeCompare(zoneTypeLabel(b), undefined, { sensitivity: 'base' })
              : sortField === 'visibility'
                ? Number(a.visible) - Number(b.visible)
                : a.strokeColor.localeCompare(b.strokeColor, undefined, { sensitivity: 'base' })

        return sortDirection === 'asc' ? result : -result
      })
  }, [zones, searchQuery, sortField, sortDirection])

  const zoneGroups = useMemo(() => {
    const groups = new Map<string, ZoneGroup>()

    filteredAndSortedZones.forEach((zone) => {
      const label = zoneTypeLabel(zone)

      if (!groups.has(label)) {
        groups.set(label, { key: label, label, zones: [] })
      }

      groups.get(label)?.zones.push(zone)
    })

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [filteredAndSortedZones])

  const allGroupsCollapsed = zoneGroups.length > 0 && zoneGroups.every((group) => collapsedGroups.has(group.key))

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)

      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }

      return next
    })
  }

  const setGroupVisibility = (group: ZoneGroup, visible: boolean) => {
    group.zones.forEach((zone) => {
      if (zone.visible !== visible) {
        onToggleVisibility(zone.id, visible)
      }
    })
  }

  const renderZoneRow = (zone: MapZone) => {
    const center = getZoneCenter(zone)

    return (
      <li
        key={zone.id}
        className={`group flex items-center gap-2 border-b border-border-subtle px-3 py-2 transition-colors last:border-b-0 ${
          zone.id === selectedZoneId ? 'bg-desert-green/10' : 'hover:bg-surface-secondary'
        } ${zone.visible ? '' : 'opacity-60'}`}
      >
        <ZoneTypeIcon zone={zone} />

        <button
          type="button"
          onClick={() => {
            onSelect(zone.id)
            onFlyTo(center.longitude, center.latitude)
          }}
          className="min-w-0 flex-1 text-left"
          title={zone.name}
        >
          <p className="truncate text-sm font-medium text-text-primary">{zone.name}</p>
          <p className="truncate text-[11px] text-text-muted">
            {zoneTypeLabel(zone)} · Stroke {zone.strokeWidth}px · Fill {Math.round(zone.fillOpacity * 100)}%
          </p>
        </button>

        <span
          className="h-3 w-3 shrink-0 rounded-full border border-border-default"
          style={{ backgroundColor: zone.fillColor ?? zone.strokeColor, borderColor: zone.strokeColor }}
          title={`Color ${zone.strokeColor}`}
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleVisibility(zone.id, !zone.visible)
          }}
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
          title={zone.visible ? 'Hide zone' : 'Show zone'}
          aria-label={zone.visible ? 'Hide zone' : 'Show zone'}
        >
          {zone.visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleDistanceVisibility(zone.id)
          }}
          className={`shrink-0 rounded p-1 transition-colors hover:bg-surface-secondary hover:text-text-primary ${
            hiddenDistanceZoneIds.has(zone.id) ? 'text-text-muted opacity-50' : 'text-text-muted'
          }`}
          title={hiddenDistanceZoneIds.has(zone.id) ? 'Show zone distances' : 'Hide zone distances'}
          aria-label={hiddenDistanceZoneIds.has(zone.id) ? 'Show zone distances' : 'Hide zone distances'}
        >
          <IconRulerMeasure size={14} />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleNameVisibility(zone.id)
          }}
          className={`shrink-0 rounded p-1 transition-colors hover:bg-surface-secondary hover:text-text-primary ${
            hiddenNameZoneIds.has(zone.id) ? 'text-text-muted opacity-50' : 'text-text-muted'
          }`}
          title={hiddenNameZoneIds.has(zone.id) ? 'Show zone name' : 'Hide zone name'}
          aria-label={hiddenNameZoneIds.has(zone.id) ? 'Show zone name' : 'Hide zone name'}
        >
          <IconLetterCase size={14} />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(zone.id)
            onEdit(zone.id)
            onFlyTo(center.longitude, center.latitude)
          }}
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
          title="Edit zone"
          aria-label="Edit zone"
        >
          <IconEdit size={14} />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(zone.id)
          }}
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-secondary hover:text-desert-red"
          title="Delete zone"
          aria-label="Delete zone"
        >
          <IconTrash size={14} />
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="space-y-2 border-b border-border-subtle px-3 py-2">
        <input
          type="search"
          placeholder="Search zones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-text-primary placeholder:text-text-muted focus:border-desert-green focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="List view"
            className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-[#424420] text-white'
                : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            <IconList size={14} />
            List
          </button>

          <button
            type="button"
            onClick={() => setViewMode('tree')}
            title="Tree view"
            className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              viewMode === 'tree'
                ? 'bg-[#424420] text-white'
                : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            <IconSitemap size={14} />
            Tree
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-text-primary focus:border-desert-green focus:outline-none"
          >
            <option value="name">Sort by name</option>
            <option value="type">Sort by type</option>
            <option value="color">Sort by color</option>
            <option value="visibility">Sort by visibility</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-secondary"
          >
            {sortDirectionLabel}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 rounded border border-border-default px-2 py-1 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={showZoneDistances}
              onChange={(event) => onToggleShowZoneDistances(event.target.checked)}
            />
            Distances
          </label>

          <label className="flex items-center gap-1.5 rounded border border-border-default px-2 py-1 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={showZoneNames}
              onChange={(event) => onToggleShowZoneNames(event.target.checked)}
            />
            Names
          </label>
        </div>

        {viewMode === 'tree' && (
          <button
            type="button"
            onClick={() => setCollapsedGroups(allGroupsCollapsed ? new Set() : new Set(zoneGroups.map((group) => group.key)))}
            className="w-full rounded bg-[#424420] px-2 py-1 text-xs text-white hover:bg-[#525530]"
          >
            {allGroupsCollapsed ? 'Expand all zones' : 'Collapse all zones'}
          </button>
        )}
      </div>

      <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
        {zones.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <IconMap2 size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted">Use the draw tools to create zones</p>
          </div>
        ) : filteredAndSortedZones.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-text-muted">No zones match your search.</p>
          </div>
        ) : viewMode === 'list' ? (
          <ul>{filteredAndSortedZones.map(renderZoneRow)}</ul>
        ) : (
          <div>
            {zoneGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key)
              const allVisible = group.zones.every((zone) => zone.visible)
              const someVisible = group.zones.some((zone) => zone.visible)

              return (
                <div key={group.key} className="border-b border-border-subtle last:border-b-0">
                  <div className="flex items-center gap-2 bg-surface-secondary/70 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapsed(group.key)}
                      className="min-w-0 flex-1 text-left text-xs font-semibold text-text-primary"
                      title={group.label}
                    >
                      <span className="truncate">
                        {isCollapsed ? '▸' : '▾'} {group.label} ({group.zones.length})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGroupVisibility(group, !allVisible)}
                      className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-primary hover:text-text-primary"
                      title={allVisible ? 'Hide all zones in group' : 'Show all zones in group'}
                      aria-label={allVisible ? 'Hide all zones in group' : 'Show all zones in group'}
                    >
                      {allVisible || someVisible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                    </button>
                  </div>

                  {!isCollapsed && <ul>{group.zones.map(renderZoneRow)}</ul>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
