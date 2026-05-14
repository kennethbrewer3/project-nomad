import { useCallback, useEffect, useState } from 'react'

import api from '~/lib/api'
import type { CreateMapZonePayload, MapZoneGeometry, MapZoneResponse, MapZoneType, UpdateMapZonePayload } from '../../types/maps'

export interface MapZone {
  id: number
  name: string
  zoneType: MapZoneType
  geometry: MapZoneGeometry
  strokeColor: string
  fillColor?: string | null
  strokeWidth: number
  fillOpacity: number
  visible: boolean
  notes?: string | null
  navigationTime?: string | null
  navigationDirection?: string | null
  createdAt: string
  updatedAt?: string
}

const mapZoneResponse = (zone: MapZoneResponse): MapZone => ({
  id: zone.id,
  name: zone.name,
  zoneType: zone.zone_type,
  geometry: zone.geometry,
  strokeColor: zone.stroke_color,
  fillColor: zone.fill_color ?? null,
  strokeWidth: zone.stroke_width,
  fillOpacity: zone.fill_opacity,
  visible: zone.visible,
  notes: zone.notes ?? null,
  navigationTime: zone.navigation_time ?? null,
  navigationDirection: zone.navigation_direction ?? null,
  createdAt: zone.created_at,
  updatedAt: zone.updated_at,
})

export function useMapZones() {
  const [zones, setZones] = useState<MapZone[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.listMapZones().then((data) => {
      if (data) {
        setZones(data.map(mapZoneResponse))
      }

      setLoaded(true)
    })
  }, [])

  const addZone = useCallback(async (values: CreateMapZonePayload) => {
    const result = await api.createMapZone(values)

    if (result) {
      const zone = mapZoneResponse(result)
      setZones((prev) => [...prev, zone])
      return zone
    }

    return null
  }, [])

  const updateZone = useCallback(async (id: number, updates: UpdateMapZonePayload) => {
    const result = await api.updateMapZone(id, updates)

    if (result) {
      const zone = mapZoneResponse(result)
      setZones((prev) => prev.map((existingZone) => (existingZone.id === id ? zone : existingZone)))
    }
  }, [])

  const deleteZone = useCallback(async (id: number) => {
    await api.deleteMapZone(id)
    setZones((prev) => prev.filter((zone) => zone.id !== id))
  }, [])

  return { zones, loaded, addZone, updateZone, deleteZone }
}
