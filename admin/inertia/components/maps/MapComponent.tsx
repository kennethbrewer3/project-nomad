import Map, {
  FullscreenControl,
  Layer,
  Marker,
  MapProvider,
  NavigationControl,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { Protocol } from 'pmtiles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useMapMarkers } from '~/hooks/useMapMarkers'
import { useMapZones } from '~/hooks/useMapZones'
import type { MapZone } from '~/hooks/useMapZones'
import type { LatLng, MapZoneGeometry, MapZoneType } from '../../../types/maps'

import MarkerPin from './MarkerPin'
import MarkerPanel from './MarkerPanel'
import CoordinateOverlay from './CoordinateOverlay'
import ViewMapMarkerPopup from './ViewMapMarkerPopup'
import MapMarkerFormPopup from './MapMarkerFormPopup'
import ScaleUnitToggle from './ScaleUnitSelector'

type ScaleUnit = 'imperial' | 'metric' | 'nautical'

type MapCommand = {
  id: number
  lat: number
  lng: number
  action: 'fly' | 'marker'
}

type MapComponentProps = {
  mapCommand?: MapCommand | null
  isHoveringUI?: boolean
  showCoordinatesEnabled?: boolean
}

type MapLocationParams = {
  lat: number
  lng: number
  zoom: number
}

type DrawMode =
  | 'marker'
  | 'circle'
  | 'ellipse'
  | 'rectangle_corner'
  | 'rectangle_center'
  | 'polygon'
  | 'polygon_curve'
  | 'line'
  | 'curve'
  | 'marker_distance'

const getMapLocationParams = (): MapLocationParams | null => {
  const params = new URLSearchParams(window.location.search)

  const lat = Number(params.get('lat'))
  const lngParam = params.get('lng')
  const longParam = params.get('long')
  const lng = Number(lngParam ?? longParam)
  const zoom = Number(params.get('zoom') ?? 12)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }

  if (!lngParam && longParam) {
    params.set('lng', longParam)
    params.delete('long')

    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    )
  }

  return {
    lat,
    lng,
    zoom: Number.isFinite(zoom) ? zoom : 12,
  }
}

type DrawPoint = {
  longitude: number
  latitude: number
}

const DRAW_TOOLS: { mode: DrawMode; label: string; title: string }[] = [
  { mode: 'marker', label: 'Pin', title: 'Drop map pins' },
  { mode: 'circle', label: 'Circle', title: 'Draw circular zones with two clicks' },
  { mode: 'ellipse', label: 'Ellipse', title: 'Draw elliptical zones with two clicks' },
  { mode: 'rectangle_corner', label: 'Rect C-C', title: 'Draw rectangles from corner to corner' },
  { mode: 'rectangle_center', label: 'Rect Center', title: 'Draw rectangles from center outward' },
  { mode: 'polygon', label: 'Polygon', title: 'Draw straight polygon zones' },
  { mode: 'polygon_curve', label: 'Curve Poly', title: 'Draw curved polygon zones' },
  { mode: 'line', label: 'Line', title: 'Draw distance lines' },
  { mode: 'curve', label: 'Curve', title: 'Draw curved distance lines' },
  { mode: 'marker_distance', label: 'Pin Line', title: 'Select two pins to draw a distance line' },
]

const isValidMarkerCoordinate = (marker: DrawPoint) =>
  Number.isFinite(marker.longitude) &&
  Number.isFinite(marker.latitude) &&
  marker.longitude >= -180 &&
  marker.longitude <= 180 &&
  marker.latitude >= -90 &&
  marker.latitude <= 90

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const toDegrees = (radians: number) => (radians * 180) / Math.PI

const distanceMeters = (a: LatLng, b: LatLng) => {
  const earthRadiusMeters = 6371008.8
  const deltaLatitude = toRadians(b.latitude - a.latitude)
  const deltaLongitude = toRadians(b.longitude - a.longitude)
  const latitude1 = toRadians(a.latitude)
  const latitude2 = toRadians(b.latitude)
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

const destinationPoint = (center: LatLng, bearingDegrees: number, meters: number): [number, number] => {
  const earthRadiusMeters = 6371008.8
  const angularDistance = meters / earthRadiusMeters
  const bearing = toRadians(bearingDegrees)
  const latitude1 = toRadians(center.latitude)
  const longitude1 = toRadians(center.longitude)
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
      Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing)
  )
  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
      Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2)
    )

  return [toDegrees(longitude2), toDegrees(latitude2)]
}

const circleCoordinates = (center: LatLng, radiusMeters: number, steps = 96) => {
  const coordinates = Array.from({ length: steps }, (_, index) =>
    destinationPoint(center, (index / steps) * 360, radiusMeters)
  )

  coordinates.push(coordinates[0])
  return coordinates
}

const ellipseCoordinates = (
  center: LatLng,
  radiusXmeters: number,
  radiusYmeters: number,
  rotationDegrees: number,
  steps = 96
) => {
  const coordinates = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const x = radiusXmeters * Math.cos(angle)
    const y = radiusYmeters * Math.sin(angle)
    const rotatedX = x * Math.cos(toRadians(rotationDegrees)) - y * Math.sin(toRadians(rotationDegrees))
    const rotatedY = x * Math.sin(toRadians(rotationDegrees)) + y * Math.cos(toRadians(rotationDegrees))
    const bearing = toDegrees(Math.atan2(rotatedX, rotatedY))
    const meters = Math.sqrt(rotatedX ** 2 + rotatedY ** 2)

    return destinationPoint(center, bearing, meters)
  })

  coordinates.push(coordinates[0])
  return coordinates
}

const zoneToFeature = (zone: MapZone) => {
  const geometry = zone.geometry
  let geoJsonGeometry: any = null

  if (geometry.type === 'circle') {
    geoJsonGeometry = { type: 'Polygon', coordinates: [circleCoordinates(geometry.center, geometry.radiusMeters)] }
  } else if (geometry.type === 'ellipse') {
    geoJsonGeometry = {
      type: 'Polygon',
      coordinates: [
        ellipseCoordinates(
          geometry.center,
          geometry.radiusXmeters,
          geometry.radiusYmeters,
          geometry.rotationDegrees
        ),
      ],
    }
  } else if (geometry.type === 'rectangle') {
    const { north, south, east, west } = geometry.bounds
    geoJsonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    }
  } else if (geometry.type === 'polygon') {
    const coordinates = geometry.points.map((point) => [point.longitude, point.latitude])
    geoJsonGeometry = { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] }
  } else if (geometry.type === 'line') {
    geoJsonGeometry = {
      type: 'LineString',
      coordinates: geometry.points.map((point) => [point.longitude, point.latitude]),
    }
  }

  return {
    type: 'Feature',
    properties: {
      id: zone.id,
      name: zone.name,
      strokeColor: zone.strokeColor,
      fillColor: zone.fillColor ?? zone.strokeColor,
      strokeWidth: zone.strokeWidth,
      fillOpacity: zone.fillOpacity,
      zoneType: zone.zoneType,
    },
    geometry: geoJsonGeometry,
  }
}

const drawPointToLatLng = (point: DrawPoint): LatLng => ({
  longitude: point.longitude,
  latitude: point.latitude,
})

const createRectangleGeometry = (
  first: DrawPoint,
  second: DrawPoint,
  mode: 'corner_to_corner' | 'center_out'
): MapZoneGeometry => {
  if (mode === 'center_out') {
    const longitudeDelta = Math.abs(second.longitude - first.longitude)
    const latitudeDelta = Math.abs(second.latitude - first.latitude)

    return {
      type: 'rectangle',
      mode,
      bounds: {
        north: first.latitude + latitudeDelta,
        south: first.latitude - latitudeDelta,
        east: first.longitude + longitudeDelta,
        west: first.longitude - longitudeDelta,
      },
    }
  }

  return {
    type: 'rectangle',
    mode,
    bounds: {
      north: Math.max(first.latitude, second.latitude),
      south: Math.min(first.latitude, second.latitude),
      east: Math.max(first.longitude, second.longitude),
      west: Math.min(first.longitude, second.longitude),
    },
  }
}

const createPreviewGeometry = (
  mode: DrawMode,
  points: DrawPoint[],
  previewPoint: DrawPoint | null
): MapZoneGeometry | null => {
  const first = points[0]

  if (!first || !previewPoint) return null

  if (mode === 'circle') {
    return {
      type: 'circle',
      center: drawPointToLatLng(first),
      radiusMeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(previewPoint)),
    }
  }

  if (mode === 'ellipse') {
    return {
      type: 'ellipse',
      center: drawPointToLatLng(first),
      radiusXmeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(previewPoint)),
      radiusYmeters: distanceMeters(drawPointToLatLng(first), {
        longitude: first.longitude,
        latitude: previewPoint.latitude,
      }),
      rotationDegrees: 0,
    }
  }

  if (mode === 'rectangle_corner' || mode === 'rectangle_center') {
    return createRectangleGeometry(
      first,
      previewPoint,
      mode === 'rectangle_center' ? 'center_out' : 'corner_to_corner'
    )
  }

  if (mode === 'polygon' || mode === 'polygon_curve') {
    if (points.length < 2) {
      return {
        type: 'line',
        lineMode: mode === 'polygon_curve' ? 'curve' : 'straight',
        points: [drawPointToLatLng(first), drawPointToLatLng(previewPoint)],
      }
    }

    return {
      type: 'polygon',
      lineMode: mode === 'polygon_curve' ? 'curve' : 'straight',
      points: [...points, previewPoint].map(drawPointToLatLng),
      closed: true,
    }
  }

  if (mode === 'line' || mode === 'curve') {
    return {
      type: 'line',
      lineMode: mode === 'curve' ? 'curve' : 'straight',
      points: [drawPointToLatLng(first), drawPointToLatLng(previewPoint)],
      distanceMeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(previewPoint)),
    }
  }

  return null
}

export default function MapComponent({
                                       mapCommand,
                                       isHoveringUI = false,
                                       showCoordinatesEnabled = true,
                                     }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null)
  const animationFrameRef = useRef<number | null>(null)
  const handledMapCommandIdRef = useRef<number | null>(null)

  const { markers, addMarker, updateMarker, deleteMarker } = useMapMarkers()
  const { zones, addZone } = useMapZones()

  const [targetIndicator, setTargetIndicator] = useState<{ lng: number; lat: number } | null>(null)
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const [placingMarker, setPlacingMarker] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null)
  const [editingMarkerId, setEditingMarkerId] = useState<number | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>('marker')
  const [drawPoints, setDrawPoints] = useState<DrawPoint[]>([])
  const [previewPoint, setPreviewPoint] = useState<DrawPoint | null>(null)
  const [markerDistanceStartId, setMarkerDistanceStartId] = useState<number | null>(null)
  const [hasUnsavedMarkerChanges, setHasUnsavedMarkerChanges] = useState(false)
  const [showCoordinates, setShowCoordinates] = useState(false)

  const getInitialScaleUnit = (): ScaleUnit => {
    const stored = localStorage.getItem('nomad:map-scale-unit')

    return stored === 'metric' || stored === 'imperial' || stored === 'nautical'
      ? stored
      : 'metric'
  }

  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>(getInitialScaleUnit)

  const [cursorLngLat, setCursorLngLat] = useState<{
    lng: number
    lat: number
    x: number
    y: number
  } | null>(null)

  const zoneGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: zones.filter((zone) => zone.visible).map(zoneToFeature),
    }),
    [zones]
  )

  const previewGeoJson = useMemo(() => {
    const geometry = createPreviewGeometry(drawMode, drawPoints, previewPoint)

    if (!geometry) {
      return {
        type: 'FeatureCollection',
        features: [],
      }
    }

    const previewZone: MapZone = {
      id: -1,
      name: 'Drawing preview',
      zoneType: geometry.type === 'line' ? 'line' : geometry.type,
      geometry,
      strokeColor: '#f97316',
      fillColor: geometry.type === 'line' ? null : '#f97316',
      strokeWidth: 2,
      fillOpacity: 0.18,
      visible: true,
      createdAt: new Date().toISOString(),
    }

    return {
      type: 'FeatureCollection',
      features: [zoneToFeature(previewZone)],
    }
  }, [drawMode, drawPoints, previewPoint])

  const saveZone = useCallback(
    async (zoneType: MapZoneType, geometry: MapZoneGeometry, name: string) => {
      await addZone({
        name,
        zone_type: zoneType,
        geometry,
        stroke_color: zoneType === 'line' ? '#f97316' : '#2563eb',
        fill_color: zoneType === 'line' ? null : '#2563eb',
        stroke_width: 2,
        fill_opacity: 0.2,
        visible: true,
      })
    },
    [addZone]
  )

  const finishDrawFromPoints = useCallback(
    async (points: DrawPoint[], mode: DrawMode) => {
      const first = points[0]
      const second = points[1]

      if (!first || !second) return false

      if (mode === 'circle') {
        await saveZone('circle', {
          type: 'circle',
          center: drawPointToLatLng(first),
          radiusMeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(second)),
        }, 'Circular zone')
        return true
      }

      if (mode === 'ellipse') {
        await saveZone('ellipse', {
          type: 'ellipse',
          center: drawPointToLatLng(first),
          radiusXmeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(second)),
          radiusYmeters: distanceMeters(drawPointToLatLng(first), {
            longitude: first.longitude,
            latitude: second.latitude,
          }),
          rotationDegrees: 0,
        }, 'Elliptical zone')
        return true
      }

      if (mode === 'rectangle_corner' || mode === 'rectangle_center') {
        await saveZone(
          'rectangle',
          createRectangleGeometry(first, second, mode === 'rectangle_center' ? 'center_out' : 'corner_to_corner'),
          'Rectangular zone'
        )
        return true
      }

      if (mode === 'line' || mode === 'curve') {
        await saveZone('line', {
          type: 'line',
          lineMode: mode === 'curve' ? 'curve' : 'straight',
          points: [drawPointToLatLng(first), drawPointToLatLng(second)],
          distanceMeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(second)),
        }, 'Distance line')
        return true
      }

      return false
    },
    [saveZone]
  )

  const hideCoordinates = useCallback(() => {
    setShowCoordinates(false)
    setCursorLngLat(null)
  }, [])

  const flyToLocationParams = useCallback(() => {
    const location = getMapLocationParams()
    if (!location) return

    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: location.zoom,
      duration: 1500,
    })
  }, [])

  const confirmDiscardMarkerChanges = useCallback(() => {
    if (!hasUnsavedMarkerChanges) return true
    return window.confirm('Discard unsaved marker changes?')
  }, [hasUnsavedMarkerChanges])

  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    return () => {
      maplibregl.removeProtocol('pmtiles')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!mapCommand) return
    if (handledMapCommandIdRef.current === mapCommand.id) return

    handledMapCommandIdRef.current = mapCommand.id

    if (mapCommand.action === 'fly') {
      const currentZoom = mapRef.current?.getZoom() ?? 12

      setTargetIndicator({
        lng: mapCommand.lng,
        lat: mapCommand.lat,
      })

      mapRef.current?.flyTo({
        center: [mapCommand.lng, mapCommand.lat],
        zoom: currentZoom,
        duration: 1500,
      })

      return
    }

    if (mapCommand.action === 'marker') {
      if (!confirmDiscardMarkerChanges()) return

      setTargetIndicator(null)

      const currentZoom = mapRef.current?.getZoom() ?? 12

      mapRef.current?.flyTo({
        center: [mapCommand.lng, mapCommand.lat],
        zoom: currentZoom,
        duration: 750,
      })

      window.setTimeout(() => {
        setPlacingMarker({
          lng: mapCommand.lng,
          lat: mapCommand.lat,
        })

        setSelectedMarkerId(null)
        setEditingMarkerId(null)
        setHasUnsavedMarkerChanges(false)
      }, 750)
    }
  }, [mapCommand, confirmDiscardMarkerChanges])

  useEffect(() => {
    if (!selectedMarkerId) return

    const marker = markers.find((existingMarker) => existingMarker.id === selectedMarkerId)

    if (!marker || marker.visible === false) {
      setSelectedMarkerId(null)
      setEditingMarkerId(null)
    }
  }, [markers, selectedMarkerId])

  const handleScaleUnitChange = useCallback((unit: ScaleUnit) => {
    setScaleUnit(unit)
    localStorage.setItem('nomad:map-scale-unit', unit)
  }, [])

  const handleMapLoad = useCallback(() => {
    flyToLocationParams()
  }, [flyToLocationParams])

  const handleMapClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (!confirmDiscardMarkerChanges()) return

      if (drawMode !== 'marker' && drawMode !== 'marker_distance') {
        const nextPoints = [...drawPoints, { longitude: e.lngLat.lng, latitude: e.lngLat.lat }]

        if (drawMode === 'polygon' || drawMode === 'polygon_curve') {
          setDrawPoints(nextPoints)
          setPreviewPoint(null)
          return
        }

        if (nextPoints.length >= 2) {
          const finished = await finishDrawFromPoints(nextPoints, drawMode)
          if (finished) {
            setDrawPoints([])
            setPreviewPoint(null)
          }
          return
        }

        setDrawPoints(nextPoints)
        setPreviewPoint(null)
        return
      }

      setPlacingMarker({ lng: e.lngLat.lng, lat: e.lngLat.lat })
      setSelectedMarkerId(null)
      setEditingMarkerId(null)
      setHasUnsavedMarkerChanges(false)
      setTargetIndicator(null)
    },
    [confirmDiscardMarkerChanges, drawMode, drawPoints, finishDrawFromPoints]
  )

  const finishPolygon = useCallback(async () => {
    if (drawPoints.length < 3) return

    await saveZone('polygon', {
      type: 'polygon',
      lineMode: drawMode === 'polygon_curve' ? 'curve' : 'straight',
      points: drawPoints.map(drawPointToLatLng),
      closed: true,
    }, 'Polygonal zone')
    setDrawPoints([])
    setPreviewPoint(null)
  }, [drawMode, drawPoints, saveZone])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement | null

      if (
        !showCoordinatesEnabled ||
        isHoveringUI ||
        isDraggingMap ||
        target?.closest('.maplibregl-control-container, .maplibregl-ctrl')
      ) {
        hideCoordinates()
        return
      }

      if (drawMode !== 'marker' && drawMode !== 'marker_distance' && drawPoints.length > 0) {
        setPreviewPoint({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
        })
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        setShowCoordinates(true)
        setCursorLngLat({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          x: e.point.x,
          y: e.point.y,
        })
      })
    },
    [drawMode, drawPoints.length, hideCoordinates, isHoveringUI, isDraggingMap, showCoordinatesEnabled]
  )

  const handleFlyTo = useCallback((longitude: number, latitude: number) => {
    setTargetIndicator(null)
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 12, duration: 1500 })
  }, [])

  const handleDeleteMarker = useCallback(
    (id: number) => {
      if (selectedMarkerId === id) setSelectedMarkerId(null)
      if (editingMarkerId === id) setEditingMarkerId(null)

      deleteMarker(id)
    },
    [selectedMarkerId, editingMarkerId, deleteMarker]
  )

  const selectedMarker = selectedMarkerId
    ? markers.find((marker) => marker.id === selectedMarkerId && isValidMarkerCoordinate(marker))
    : null

  return (
    <MapProvider>
      <div
        style={{ position: 'relative', width: '100%', height: '100vh' }}
        onMouseLeave={() => {
          setIsDraggingMap(false)
          hideCoordinates()
        }}
        onMouseMoveCapture={(e) => {
          const target = e.target as HTMLElement | null

          if (
            target?.closest(
              '.maplibregl-control-container, .maplibregl-ctrl, .maplibregl-ctrl-group, .maplibregl-ctrl-scale'
            )
          ) {
            hideCoordinates()
          }
        }}
      >
        <div
          className="absolute left-4 top-32 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-primary/95 p-2 shadow-lg backdrop-blur-sm"
          onMouseEnter={hideCoordinates}
        >
          {DRAW_TOOLS.map((tool) => (
            <button
              key={tool.mode}
              type="button"
              title={tool.title}
              onClick={() => {
                setDrawMode(tool.mode)
                setDrawPoints([])
                setPreviewPoint(null)
                setMarkerDistanceStartId(null)
                setPlacingMarker(null)
                setSelectedMarkerId(null)
              }}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                drawMode === tool.mode
                  ? 'bg-[#424420] text-white'
                  : 'bg-surface-primary text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              {tool.label}
            </button>
          ))}

          {(drawMode === 'polygon' || drawMode === 'polygon_curve') && (
            <button
              type="button"
              onClick={finishPolygon}
              disabled={drawPoints.length < 3}
              className="rounded bg-desert-orange px-2 py-1 text-xs text-white disabled:opacity-40"
            >
              Finish ({drawPoints.length})
            </button>
          )}

          {drawPoints.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrawPoints([])
                setPreviewPoint(null)
              }}
              className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary"
            >
              Clear
            </button>
          )}
        </div>

        <Map
          ref={mapRef}
          reuseMaps
          style={{ width: '100%', height: '100vh' }}
          cursor={isDraggingMap ? 'grabbing' : 'crosshair'}
          mapStyle={`${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/maps/styles`}
          mapLib={maplibregl}
          initialViewState={{
            longitude: -101,
            latitude: 40,
            zoom: 3.5,
          }}
          onLoad={handleMapLoad}
          onMouseDown={() => {
            setIsDraggingMap(true)
            hideCoordinates()
          }}
          onMouseUp={() => {
            setIsDraggingMap(false)
          }}
          onDragStart={() => {
            setIsDraggingMap(true)
            hideCoordinates()
          }}
          onDragEnd={() => {
            setIsDraggingMap(false)
            hideCoordinates()
          }}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={hideCoordinates}
        >
          <NavigationControl style={{ marginTop: '110px', marginRight: '36px' }} />
          <FullscreenControl style={{ marginTop: '30px', marginRight: '36px' }} />
          <ScaleControl position="bottom-left" maxWidth={150} unit={scaleUnit} />

          <Source id="map-zones" type="geojson" data={zoneGeoJson as any}>
            <Layer
              id="map-zones-fill"
              type="fill"
              filter={['!=', ['geometry-type'], 'LineString']}
              paint={{
                'fill-color': ['get', 'fillColor'],
                'fill-opacity': ['get', 'fillOpacity'],
              }}
            />
            <Layer
              id="map-zones-line"
              type="line"
              paint={{
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth'],
              }}
            />
          </Source>

          <Source id="map-zone-preview" type="geojson" data={previewGeoJson as any}>
            <Layer
              id="map-zone-preview-fill"
              type="fill"
              filter={['!=', ['geometry-type'], 'LineString']}
              paint={{
                'fill-color': ['get', 'fillColor'],
                'fill-opacity': ['get', 'fillOpacity'],
              }}
            />
            <Layer
              id="map-zone-preview-line"
              type="line"
              paint={{
                'line-color': ['get', 'strokeColor'],
                'line-width': ['get', 'strokeWidth'],
                'line-dasharray': [2, 1],
              }}
            />
          </Source>

          {showCoordinates && cursorLngLat && (
            <CoordinateOverlay
              latitude={cursorLngLat.lat}
              longitude={cursorLngLat.lng}
              x={cursorLngLat.x}
              y={cursorLngLat.y}
            />
          )}

          {targetIndicator && (
            <Marker longitude={targetIndicator.lng} latitude={targetIndicator.lat} anchor="center">
              <div
                className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full border-2 border-desert-orange bg-surface-primary/70 shadow-lg"
                aria-hidden="true"
              >
                <div className="relative h-5 w-5">
                  <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-desert-orange" />
                  <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-desert-orange" />
                </div>
              </div>
            </Marker>
          )}

          <ScaleUnitToggle
            scaleUnit={scaleUnit}
            onChange={handleScaleUnitChange}
            onMouseEnter={hideCoordinates}
          />

          {markers
            .filter((marker) => marker.visible)
            .map((marker) => (
              <Marker
                key={marker.id}
                longitude={marker.longitude}
                latitude={marker.latitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation()

                  if (!confirmDiscardMarkerChanges()) return

                  if (drawMode === 'marker_distance') {
                    if (!markerDistanceStartId) {
                      setMarkerDistanceStartId(marker.id)
                      setSelectedMarkerId(marker.id)
                      return
                    }

                    if (markerDistanceStartId !== marker.id) {
                      const startMarker = markers.find((existingMarker) => existingMarker.id === markerDistanceStartId)

                      if (startMarker) {
                        saveZone('line', {
                          type: 'line',
                          lineMode: 'straight',
                          points: [
                            { longitude: startMarker.longitude, latitude: startMarker.latitude },
                            { longitude: marker.longitude, latitude: marker.latitude },
                          ],
                          markerAId: startMarker.id,
                          markerBId: marker.id,
                          distanceMeters: distanceMeters(
                            { longitude: startMarker.longitude, latitude: startMarker.latitude },
                            { longitude: marker.longitude, latitude: marker.latitude }
                          ),
                        }, 'Marker distance line')
                      }
                    }

                    setMarkerDistanceStartId(null)
                    setSelectedMarkerId(null)
                    return
                  }

                  setSelectedMarkerId(marker.id === selectedMarkerId ? null : marker.id)
                  setPlacingMarker(null)
                  setEditingMarkerId(null)
                  setHasUnsavedMarkerChanges(false)
                  setTargetIndicator(null)
                }}
              >
                <MarkerPin
                  color={marker.color}
                  customColor={marker.customColor}
                  icon={marker.icon}
                  iconColor={marker.iconColor}
                  visible={marker.visible}
                  active={marker.id === selectedMarkerId}
                />
              </Marker>
            ))}

          {placingMarker && (
            <MapMarkerFormPopup
              longitude={placingMarker.lng}
              latitude={placingMarker.lat}
              onDirtyChange={setHasUnsavedMarkerChanges}
              onMouseEnter={hideCoordinates}
              onSave={async ({ name, notes, color, customColor, icon   }) => {
                await addMarker({
                  name,
                  longitude: placingMarker.lng,
                  latitude: placingMarker.lat,
                  color,
                  customColor,
                  icon,
                  notes: notes || null,
                })

                setPlacingMarker(null)
                setHasUnsavedMarkerChanges(false)
                setTargetIndicator(null)
              }}
              onCancel={() => {
                if (!confirmDiscardMarkerChanges()) return

                setPlacingMarker(null)
                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
                setTargetIndicator(null)
              }}
            />
          )}

          {selectedMarker && editingMarkerId !== selectedMarker.id && (
            <ViewMapMarkerPopup
              marker={selectedMarker}
              onClose={() => setSelectedMarkerId(null)}
              onEdit={() => setEditingMarkerId(selectedMarker.id)}
              onMouseEnter={hideCoordinates}
            />
          )}

          {selectedMarker && editingMarkerId === selectedMarker.id && (
            <MapMarkerFormPopup
              longitude={selectedMarker.longitude}
              latitude={selectedMarker.latitude}
              initialMarker={selectedMarker}
              onDirtyChange={setHasUnsavedMarkerChanges}
              onMouseEnter={hideCoordinates}
              onSave={async ({ id, name, notes, color, customColor, icon  }) => {
                if (!id) return

                await updateMarker(id, {
                  name,
                  notes: notes || null,
                  color,
                  customColor,
                  icon,
                })

                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
              }}
              onCancel={() => {
                if (!confirmDiscardMarkerChanges()) return

                setEditingMarkerId(null)
                setHasUnsavedMarkerChanges(false)
              }}
            />
          )}
        </Map>
      </div>

      <div onMouseEnter={hideCoordinates}>
        <MarkerPanel
          markers={markers}
          onDelete={handleDeleteMarker}
          onFlyTo={handleFlyTo}
          onSelect={setSelectedMarkerId}
          selectedMarkerId={selectedMarkerId}
          onToggleVisibility={(id, visible) => updateMarker(id, { visible })}
        />
      </div>
    </MapProvider>
  )
}
