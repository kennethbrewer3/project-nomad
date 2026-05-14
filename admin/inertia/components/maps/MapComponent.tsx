import Map, {
  FullscreenControl,
  Layer,
  Marker,
  MapProvider,
  NavigationControl,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre'
import type {MapLayerMouseEvent, MapRef} from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import {Protocol} from 'pmtiles'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useMapMarkers} from '~/hooks/useMapMarkers'
import {useMapZones} from '~/hooks/useMapZones'
import type {MapZone} from '~/hooks/useMapZones'
import type {LatLng, MapZoneGeometry, MapZoneType} from '../../../types/maps'

import MarkerPin from './MarkerPin'
import MarkerPanel from './MarkerPanel'
import ZonePanel from './ZonePanel'
import CoordinateOverlay from './CoordinateOverlay'
import ViewMapMarkerPopup from './ViewMapMarkerPopup'
import MapMarkerFormPopup from './MapMarkerFormPopup'
import ScaleUnitToggle from './ScaleUnitSelector'
import ViewMapZonePopup from './ViewMapZonePopup'
import MapZoneFormPopup from './MapZoneFormPopup'
import type {DrawMode} from './DrawToolsSelector'

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
  drawMode: DrawMode
  onDrawControlsChange?: (controls: MapDrawControls) => void
}

export type MapDrawControls = {
  drawPointCount: number
  finishPolygon: () => void
  clearDrawing: () => void
}

type MapLocationParams = {
  lat: number
  lng: number
  zoom: number
}

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

type ZoneDistanceLabel = {
  id: string
  longitude: number
  latitude: number
  lines: string[]
  alignRightOfName?: boolean
}

type RectangleGeometry = Extract<MapZoneGeometry, { type: 'rectangle' }>

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

const formatDistance = (meters: number, unit: ScaleUnit) => {
  if (unit === 'imperial') {
    const feet = meters * 3.28084
    return feet < 5280 ? `${feet.toFixed(0)} ft` : `${(feet / 5280).toFixed(2)} mi`
  }

  if (unit === 'nautical') {
    return `${(meters / 1852).toFixed(2)} nm`
  }

  return meters < 1000 ? `${meters.toFixed(0)} m` : `${(meters / 1000).toFixed(2)} km`
}

const midpoint = (a: LatLng, b: LatLng): LatLng => ({
  longitude: (a.longitude + b.longitude) / 2,
  latitude: (a.latitude + b.latitude) / 2,
})

const zoneAnchor = (zone: MapZone): LatLng => {
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

  return {longitude: 0, latitude: 0}
}

const zoneDistanceLabels = (zone: MapZone, unit: ScaleUnit): ZoneDistanceLabel[] => {
  const geometry = zone.geometry

  if (geometry.type === 'circle') {
    return [
      {
        id: `${zone.id}-radius`,
        longitude: geometry.center.longitude,
        latitude: geometry.center.latitude,
        lines: [`r ${formatDistance(geometry.radiusMeters, unit)}`],
      },
    ]
  }

  if (geometry.type === 'ellipse') {
    return [
      {
        id: `${zone.id}-radius-x`,
        longitude: geometry.center.longitude,
        latitude: geometry.center.latitude,
        lines: [`rx ${formatDistance(geometry.radiusXmeters, unit)}`],
      },
      {
        id: `${zone.id}-radius-y`,
        longitude: geometry.center.longitude,
        latitude: geometry.center.latitude,
        lines: [`ry ${formatDistance(geometry.radiusYmeters, unit)}`],
      },
    ]
  }

  if (geometry.type === 'rectangle') {
    const northWest = {longitude: geometry.bounds.west, latitude: geometry.bounds.north}
    const northEast = {longitude: geometry.bounds.east, latitude: geometry.bounds.north}
    const southWest = {longitude: geometry.bounds.west, latitude: geometry.bounds.south}

    return [
      {
        id: `${zone.id}-width`,
        ...midpoint(northWest, northEast),
        lines: [formatDistance(distanceMeters(northWest, northEast), unit)],
      },
      {
        id: `${zone.id}-height`,
        ...midpoint(northWest, southWest),
        lines: [formatDistance(distanceMeters(northWest, southWest), unit)],
      },
    ]
  }

  if (geometry.type === 'line') {
    const points = geometry.points

    if (points.length < 2) return []

    const startPoint = points[0]
    const endPoint = points[points.length - 1]

    return [
      {
        id: `${zone.id}-line-summary`,
        ...zoneAnchor(zone),
        lines: [
          formatDistance(
            geometry.distanceMeters ?? distanceMeters(startPoint, endPoint),
            unit
          ),
          zone.navigationTime,
        ].filter((line): line is string => Boolean(line)),
        alignRightOfName: true,
      },
    ]
  }

  if (geometry.type === 'polygon') {
    const points = geometry.closed
      ? [...geometry.points, geometry.points[0]]
      : geometry.points

    return points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1]

      return {
        id: `${zone.id}-segment-${index}`,
        ...midpoint(point, nextPoint),
        lines: [formatDistance(distanceMeters(point, nextPoint), unit)],
      }
    })
  }

  return []
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
  const coordinates = Array.from({length: steps}, (_, index) =>
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
  const coordinates = Array.from({length: steps}, (_, index) => {
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
    geoJsonGeometry = {type: 'Polygon', coordinates: [circleCoordinates(geometry.center, geometry.radiusMeters)]}
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
    const {north, south, east, west} = geometry.bounds
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
    geoJsonGeometry = {type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]]}
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

const snapPointToAngleIncrement = (start: DrawPoint, point: DrawPoint, incrementDegrees = 5): DrawPoint => {
  const latitudeScale = Math.cos(toRadians(start.latitude))
  const deltaX = (point.longitude - start.longitude) * latitudeScale
  const deltaY = point.latitude - start.latitude
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  if (distance === 0 || !Number.isFinite(distance)) return point

  const angle = Math.atan2(deltaY, deltaX)
  const increment = toRadians(incrementDegrees)
  const snappedAngle = Math.round(angle / increment) * increment
  const snappedX = Math.cos(snappedAngle) * distance
  const snappedY = Math.sin(snappedAngle) * distance

  return {
    longitude: start.longitude + snappedX / latitudeScale,
    latitude: start.latitude + snappedY,
  }
}

const formatLineAngle = (start: DrawPoint, end: DrawPoint) => {
  const latitudeScale = Math.cos(toRadians(start.latitude))
  const deltaX = (end.longitude - start.longitude) * latitudeScale
  const deltaY = end.latitude - start.latitude

  if (deltaX === 0 && deltaY === 0) return '0.00°'

  const angle = (toDegrees(Math.atan2(deltaX, deltaY)) + 360) % 360

  return `${angle.toFixed(2)}°`
}

const createRectangleGeometry = (
  first: DrawPoint,
  second: DrawPoint,
  mode: 'corner_to_corner' | 'center_out'
): RectangleGeometry => {
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

  if (mode === 'polygon') {
    if (points.length < 2) {
      return {
        type: 'line',
        lineMode: 'straight',
        points: [drawPointToLatLng(first), drawPointToLatLng(previewPoint)],
      }
    }

    const polygonPoints = [...points, previewPoint].map(drawPointToLatLng)

    return {
      type: 'polygon',
      lineMode: 'straight',
      points: polygonPoints,
      closed: true,
    }
  }

  if (mode === 'line') {
    return {
      type: 'line',
      lineMode: 'straight',
      points: [drawPointToLatLng(first), drawPointToLatLng(previewPoint)],
      distanceMeters: distanceMeters(drawPointToLatLng(first), drawPointToLatLng(previewPoint)),
    }
  }

  return null
}

const drawingMeasurementLabel = (
  mode: DrawMode,
  points: DrawPoint[],
  previewPoint: DrawPoint | null,
  unit: ScaleUnit
) => {
  const first = points[0]

  if (!first || !previewPoint || mode === 'marker' || mode === 'marker_distance') return null

  const firstLatLng = drawPointToLatLng(first)
  const previewLatLng = drawPointToLatLng(previewPoint)

  if (mode === 'circle') {
    return `Radius ${formatDistance(distanceMeters(firstLatLng, previewLatLng), unit)}`
  }

  if (mode === 'ellipse') {
    const radiusX = distanceMeters(firstLatLng, previewLatLng)
    const radiusY = distanceMeters(firstLatLng, {longitude: first.longitude, latitude: previewPoint.latitude})

    return `Rx ${formatDistance(radiusX, unit)} · Ry ${formatDistance(radiusY, unit)}`
  }

  if (mode === 'rectangle_corner' || mode === 'rectangle_center') {
    const geometry = createRectangleGeometry(
      first,
      previewPoint,
      mode === 'rectangle_center' ? 'center_out' : 'corner_to_corner'
    )
    const northWest = {longitude: geometry.bounds.west, latitude: geometry.bounds.north}
    const northEast = {longitude: geometry.bounds.east, latitude: geometry.bounds.north}
    const southWest = {longitude: geometry.bounds.west, latitude: geometry.bounds.south}

    return `${formatDistance(distanceMeters(northWest, northEast), unit)} × ${formatDistance(distanceMeters(northWest, southWest), unit)}`
  }

  if (mode === 'line') {
    return `${formatDistance(distanceMeters(firstLatLng, previewLatLng), unit)} · ${formatLineAngle(first, previewPoint)}`
  }

  if (mode === 'polygon') {
    const previousPoint = points[points.length - 1]
    const segmentDistance = distanceMeters(drawPointToLatLng(previousPoint), previewLatLng)
    const totalDistance = [...points, previewPoint].slice(0, -1).reduce((sum, point, index, allPoints) => {
      const nextPoint = allPoints[index + 1]
      return nextPoint ? sum + distanceMeters(drawPointToLatLng(point), drawPointToLatLng(nextPoint)) : sum
    }, segmentDistance)

    return points.length > 1
      ? `Segment ${formatDistance(segmentDistance, unit)} · Total ${formatDistance(totalDistance, unit)}`
      : formatDistance(segmentDistance, unit)
  }

  return null
}

export default function MapComponent({
                                       mapCommand,
                                       isHoveringUI = false,
                                       showCoordinatesEnabled = true,
                                       drawMode,
                                       onDrawControlsChange,
                                     }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null)
  const animationFrameRef = useRef<number | null>(null)
  const handledMapCommandIdRef = useRef<number | null>(null)

  const {markers, addMarker, updateMarker, deleteMarker} = useMapMarkers()
  const {zones, addZone, updateZone, deleteZone} = useMapZones()

  const [lineArrowImageReady, setLineArrowImageReady] = useState(false)
  const [hiddenArrowZoneIds, setHiddenArrowZoneIds] = useState<Set<number>>(new Set())
  const [targetIndicator, setTargetIndicator] = useState<{ lng: number; lat: number } | null>(null)
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const [placingMarker, setPlacingMarker] = useState<{ lng: number; lat: number } | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null)
  const [editingMarkerId, setEditingMarkerId] = useState<number | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null)
  const [showZoneDistances, setShowZoneDistances] = useState(true)
  const [showZoneNames, setShowZoneNames] = useState(true)
  const [hiddenDistanceZoneIds, setHiddenDistanceZoneIds] = useState<Set<number>>(new Set())
  const [hiddenNameZoneIds, setHiddenNameZoneIds] = useState<Set<number>>(new Set())
  const [drawPoints, setDrawPoints] = useState<DrawPoint[]>([])
  const [previewPoint, setPreviewPoint] = useState<DrawPoint | null>(null)
  const [isShiftKeyDown, setIsShiftKeyDown] = useState(false)
  const [markerDistanceStartId, setMarkerDistanceStartId] = useState<number | null>(null)
  const [hasUnsavedMarkerChanges, setHasUnsavedMarkerChanges] = useState(false)
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [hoveredLineZoneId, setHoveredLineZoneId] = useState<number | null>(null)
  const [snapRouteStart, setSnapRouteStart] = useState<{
    zoneId: number
    endpoint: 'start' | 'end'
    point: LatLng
  } | null>(null)

  const zoneArrowGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: zones
        .filter(
          (zone) =>
            zone.visible &&
            zone.geometry.type === 'line' &&
            !hiddenArrowZoneIds.has(zone.id)
        )
        .map(zoneToFeature),
    }),
    [hiddenArrowZoneIds, zones]
  )

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

  const distanceLabels = useMemo(
    () =>
      showZoneDistances
        ? zones
          .filter((zone) => zone.visible && !hiddenDistanceZoneIds.has(zone.id))
          .flatMap((zone) => zoneDistanceLabels(zone, scaleUnit))
        : [],
    [hiddenDistanceZoneIds, scaleUnit, showZoneDistances, zones]
  )

  const zoneNameLabels = useMemo(
    () =>
      showZoneNames
        ? zones
          .filter((zone) => zone.visible && !hiddenNameZoneIds.has(zone.id))
          .map((zone) => ({
            id: zone.id,
            name: zone.name,
            isLine: zone.geometry.type === 'line',
            ...zoneAnchor(zone),
          }))
        : [],
    [hiddenNameZoneIds, showZoneNames, zones]
  )

  const previewGeoJson = useMemo(() => {
    const firstDrawPoint = drawPoints[0]
    const snappedPreviewPoint =
      drawMode === 'line' && isShiftKeyDown && firstDrawPoint && previewPoint
        ? snapPointToAngleIncrement(firstDrawPoint, previewPoint)
        : previewPoint
    const geometry = createPreviewGeometry(drawMode, drawPoints, snappedPreviewPoint)

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
  }, [drawMode, drawPoints, isShiftKeyDown, previewPoint])

  const cursorMeasurementLabel = useMemo(
    () => {
      const firstDrawPoint = drawPoints[0]
      const snappedPreviewPoint =
        drawMode === 'line' && isShiftKeyDown && firstDrawPoint && previewPoint
          ? snapPointToAngleIncrement(firstDrawPoint, previewPoint)
          : previewPoint

      return drawingMeasurementLabel(drawMode, drawPoints, snappedPreviewPoint, scaleUnit)
    },
    [drawMode, drawPoints, isShiftKeyDown, previewPoint, scaleUnit]
  )

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
    async (points: DrawPoint[], mode: DrawMode, snapLine = false) => {
      const first = points[0]
      const rawSecond = points[1]

      if (!first || !rawSecond) return false

      const second = mode === 'line' && snapLine ? snapPointToAngleIncrement(first, rawSecond) : rawSecond

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

      if (mode === 'line') {
        await saveZone('line', {
          type: 'line',
          lineMode: 'straight',
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setIsShiftKeyDown(true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') return

      setIsShiftKeyDown(false)

      if (drawMode !== 'line' || drawPoints.length !== 1 || !previewPoint) return

      const finishLine = async () => {
        const finished = await finishDrawFromPoints([...drawPoints, previewPoint], 'line', true)

        if (finished) {
          setDrawPoints([])
          setPreviewPoint(null)
        }
      }

      finishLine()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [drawMode, drawPoints, finishDrawFromPoints, previewPoint])

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

  useEffect(() => {
    if (!selectedZoneId) return

    const zone = zones.find((existingZone) => existingZone.id === selectedZoneId)

    if (!zone) {
      setSelectedZoneId(null)
      setEditingZoneId(null)
    }
  }, [selectedZoneId, zones])

  useEffect(() => {
    setDrawPoints([])
    setPreviewPoint(null)
    setMarkerDistanceStartId(null)
    setPlacingMarker(null)
    setSelectedMarkerId(null)
  }, [drawMode])

  const handleScaleUnitChange = useCallback((unit: ScaleUnit) => {
    setScaleUnit(unit)
    localStorage.setItem('nomad:map-scale-unit', unit)
  }, [])

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()

    if (!map) {
      flyToLocationParams()
      return
    }

    if (map.hasImage('line-arrow')) {
      setLineArrowImageReady(true)
      flyToLocationParams()
      return
    }

    const size = 32
    const canvas = document.createElement('canvas')

    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.fillStyle = '#000'

      ctx.beginPath()
      ctx.moveTo(26, 16)
      ctx.lineTo(8, 6)
      ctx.lineTo(12, 16)
      ctx.lineTo(8, 26)
      ctx.closePath()
      ctx.fill()

      const imageData = ctx.getImageData(0, 0, size, size)

      map.addImage('line-arrow', imageData, { sdf: true })

      setLineArrowImageReady(true)
    }

    flyToLocationParams()
  }, [flyToLocationParams])

  const handleMapClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (e.originalEvent.detail > 1) return

      if (!confirmDiscardMarkerChanges()) return

      if (drawMode !== 'marker' && drawMode !== 'marker_distance') {
        const nextPoints = [...drawPoints, {longitude: e.lngLat.lng, latitude: e.lngLat.lat}]

        if (drawMode === 'polygon') {
          setDrawPoints(nextPoints)
          setPreviewPoint(null)
          return
        }

        if (nextPoints.length >= 2) {
          const finished = await finishDrawFromPoints(nextPoints, drawMode, e.originalEvent.shiftKey)
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

      setPlacingMarker({lng: e.lngLat.lng, lat: e.lngLat.lat})
      setSelectedMarkerId(null)
      setEditingMarkerId(null)
      setHasUnsavedMarkerChanges(false)
      setTargetIndicator(null)
    },
    [confirmDiscardMarkerChanges, drawMode, drawPoints, finishDrawFromPoints]
  )

  const finishPolygon = useCallback(async () => {
    if (drawPoints.length < 3) return

    const polygonPoints = drawPoints.map(drawPointToLatLng)

    await saveZone('polygon', {
      type: 'polygon',
      lineMode: 'straight',
      points: polygonPoints,
      closed: true,
    }, 'Polygonal zone')
    setDrawPoints([])
    setPreviewPoint(null)
  }, [drawMode, drawPoints, saveZone])

  const handleZoneDoubleClick = useCallback((e: MapLayerMouseEvent) => {
    e.originalEvent.preventDefault()
    e.originalEvent.stopPropagation()

    if (drawMode === 'polygon' && drawPoints.length >= 3) {
      finishPolygon()
      return
    }

    const feature = e.features?.[0]
    const zoneId = Number(feature?.properties?.id)

    if (!Number.isFinite(zoneId)) return

    setSelectedZoneId(zoneId)
    setEditingZoneId(null)
    setSelectedMarkerId(null)
    setEditingMarkerId(null)
    setPlacingMarker(null)
    setDrawPoints([])
    setPreviewPoint(null)
    setMarkerDistanceStartId(null)
    setHasUnsavedMarkerChanges(false)
  }, [drawMode, drawPoints.length, finishPolygon])

  const clearDrawing = useCallback(() => {
    setDrawPoints([])
    setPreviewPoint(null)
    setMarkerDistanceStartId(null)
    setSnapRouteStart(null)
  }, [])

  const handleMapContextMenu = useCallback(
    (event: MapLayerMouseEvent) => {
      if (
        drawPoints.length === 0 &&
        !previewPoint &&
        !markerDistanceStartId &&
        !snapRouteStart
      ) {
        return
      }

      event.preventDefault()

      clearDrawing()
    },
    [
      clearDrawing,
      drawPoints.length,
      markerDistanceStartId,
      previewPoint,
      snapRouteStart,
    ]
  )

  useEffect(() => {
    onDrawControlsChange?.({
      drawPointCount: drawPoints.length,
      finishPolygon,
      clearDrawing,
    })
  }, [clearDrawing, drawPoints.length, finishPolygon, onDrawControlsChange])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement | null

      const feature = e.features?.find(
        (feature) => feature.layer.id === 'map-zones-line'
      )

      const zoneId = Number(feature?.properties?.id)

      setHoveredLineZoneId(Number.isFinite(zoneId) ? zoneId : null)

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
    [
      drawMode,
      drawPoints.length,
      hideCoordinates,
      isHoveringUI,
      isDraggingMap,
      showCoordinatesEnabled,
    ]
  )

  const handleFlyTo = useCallback((longitude: number, latitude: number) => {
    setTargetIndicator(null)
    mapRef.current?.flyTo({center: [longitude, latitude], zoom: 12, duration: 1500})
  }, [])

  const handleFlyToZone = useCallback((longitude: number, latitude: number) => {
    setTargetIndicator(null)
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom: Math.max(mapRef.current?.getZoom() ?? 12, 12),
      duration: 1500
    })
  }, [])

  const handleSelectZone = useCallback((id: number | null) => {
    setSelectedZoneId(id)
    setEditingZoneId(null)
    setSelectedMarkerId(null)
    setEditingMarkerId(null)
    setPlacingMarker(null)
    setHasUnsavedMarkerChanges(false)
  }, [])

  const handleEditZone = useCallback((id: number) => {
    setSelectedZoneId(id)
    setEditingZoneId(id)
    setSelectedMarkerId(null)
    setEditingMarkerId(null)
    setPlacingMarker(null)
    setHasUnsavedMarkerChanges(false)
  }, [])

  const handleToggleZoneDistanceVisibility = useCallback((id: number) => {
    setHiddenDistanceZoneIds((prev) => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }, [])

  const handleToggleZoneNameVisibility = useCallback((id: number) => {
    setHiddenNameZoneIds((prev) => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }, [])

  const handleDeleteZone = useCallback(
    (id: number) => {
      if (selectedZoneId === id) setSelectedZoneId(null)
      if (editingZoneId === id) setEditingZoneId(null)

      setHiddenDistanceZoneIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })

      setHiddenNameZoneIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })

      setHiddenArrowZoneIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })

      deleteZone(id)
    },
    [deleteZone, editingZoneId, selectedZoneId]
  )

  const handleToggleZoneArrowVisibility = useCallback((id: number) => {
    setHiddenArrowZoneIds((prev) => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
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

  const selectedZone = selectedZoneId ? zones.find((zone) => zone.id === selectedZoneId) : null
  const editingZone = editingZoneId ? zones.find((zone) => zone.id === editingZoneId) : null
  const selectedZoneAnchor = selectedZone ? zoneAnchor(selectedZone) : null
  const editingZoneAnchor = editingZone ? zoneAnchor(editingZone) : null

  const activeLineHandleZone = zones.find(
    (zone) =>
      zone.id === hoveredLineZoneId &&
      zone.visible &&
      zone.geometry.type === 'line' &&
      zone.geometry.points.length >= 2
  )

  const activeLineHandles =
    activeLineHandleZone?.geometry.type === 'line'
      ? [
        {
          endpoint: 'start' as const,
          point: activeLineHandleZone.geometry.points[0],
        },
        {
          endpoint: 'end' as const,
          point:
            activeLineHandleZone.geometry.points[
            activeLineHandleZone.geometry.points.length - 1
              ],
        },
      ]
      : []

  return (
    <MapProvider>
      <div
        style={{position: 'relative', width: '100%', height: '100vh'}}
        onMouseLeave={() => {
          setIsDraggingMap(false)
          hideCoordinates()
          setHoveredLineZoneId(null)
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
        <Map
          ref={mapRef}
          reuseMaps
          style={{width: '100%', height: '100vh'}}
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
          onDblClick={handleZoneDoubleClick}
          onContextMenu={handleMapContextMenu}
          onMouseMove={handleMouseMove}
          onMouseLeave={hideCoordinates}
          interactiveLayerIds={['map-zones-fill', 'map-zones-line']}
        >
          <NavigationControl style={{marginTop: '110px', marginRight: '36px'}}/>
          <FullscreenControl style={{marginTop: '30px', marginRight: '36px'}}/>
          <ScaleControl position="bottom-left" maxWidth={150} unit={scaleUnit}/>



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

          {lineArrowImageReady && (
            <Source id="map-zone-arrows" type="geojson" data={zoneArrowGeoJson as any}>
              <Layer
                id="map-zones-line-arrows"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'icon-image': 'line-arrow',
                  'icon-size': 0.7,
                  'symbol-spacing': 100,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-rotation-alignment': 'map',
                  'icon-pitch-alignment': 'map',
                  'icon-keep-upright': false,
                }}
                paint={{
                  'icon-color': ['get', 'strokeColor'],
                }}
              />
            </Source>
          )}

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
            {lineArrowImageReady && (
              <Layer
                id="map-zone-preview-line-arrows"
                type="symbol"
                filter={['==', ['geometry-type'], 'LineString']}
                layout={{
                  'symbol-placement': 'line',
                  'icon-image': 'line-arrow',
                  'icon-size': 0.7,
                  'symbol-spacing': 100,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-rotation-alignment': 'map',
                  'icon-pitch-alignment': 'map',
                  'icon-keep-upright': false,
                }}
                paint={{
                  'icon-color': ['get', 'strokeColor'],
                }}
              />
            )}
          </Source>
          {activeLineHandleZone &&
            activeLineHandles.map(({ endpoint, point }) => (
              <Marker
                key={`line-handle-${activeLineHandleZone.id}-${endpoint}`}
                longitude={point.longitude}
                latitude={point.latitude}
                anchor="center"
                style={{ zIndex: 35 }}
                onClick={(event) => {
                  event.originalEvent.stopPropagation()

                  const snappedPoint = {
                    longitude: point.longitude,
                    latitude: point.latitude,
                  }

                  if (drawMode === 'line' && drawPoints.length === 1) {
                    finishDrawFromPoints([drawPoints[0], snappedPoint], 'line', isShiftKeyDown)

                    setDrawPoints([])
                    setPreviewPoint(null)
                    setHoveredLineZoneId(null)

                    return
                  }

                  setDrawPoints([snappedPoint])
                  setPreviewPoint(null)
                  setSelectedZoneId(null)
                  setEditingZoneId(null)
                  setPlacingMarker(null)
                }}
              >
                <div
                  className="h-4 w-4 cursor-crosshair rounded-full border-2 border-white bg-desert-green shadow transition-transform hover:scale-125"
                  title={
                    endpoint === 'start'
                      ? 'Start new line from start of line'
                      : 'Start new line from end of line'
                  }
                />
              </Marker>
            ))}
          {showCoordinates && cursorLngLat && (
            <CoordinateOverlay
              latitude={cursorLngLat.lat}
              longitude={cursorLngLat.lng}
              x={cursorLngLat.x}
              y={cursorLngLat.y}
              label={cursorMeasurementLabel ?? undefined}
            />
          )}

          {targetIndicator && (
            <Marker longitude={targetIndicator.lng} latitude={targetIndicator.lat} anchor="center">
              <div
                className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full border-2 border-desert-orange bg-surface-primary/70 shadow-lg"
                aria-hidden="true"
              >
                <div className="relative h-5 w-5">
                  <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-desert-orange"/>
                  <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-desert-orange"/>
                </div>
              </div>
            </Marker>
          )}

          <ScaleUnitToggle
            scaleUnit={scaleUnit}
            onChange={handleScaleUnitChange}
            onMouseEnter={hideCoordinates}
          />

          {distanceLabels.map((distanceLabel) => (
            <Marker
              key={distanceLabel.id}
              longitude={distanceLabel.longitude}
              latitude={distanceLabel.latitude}
              anchor={distanceLabel.alignRightOfName ? 'left' : 'center'}
              offset={distanceLabel.alignRightOfName ? [6, 0] : [0, 0]}
              style={distanceLabel.alignRightOfName ? { zIndex: 20 } : undefined}
            >
              <div className="pointer-events-none rounded bg-surface-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-text-primary shadow">
                {distanceLabel.lines.map((line, index) => (
                  <div key={`${distanceLabel.id}-line-${index}`}>{line}</div>
                ))}
              </div>
            </Marker>
          ))}

          {zoneNameLabels.map((zoneNameLabel) => (
            <Marker
              key={`zone-name-${zoneNameLabel.id}`}
              longitude={zoneNameLabel.longitude}
              latitude={zoneNameLabel.latitude}
              anchor={zoneNameLabel.isLine ? 'right' : 'center'}
              offset={zoneNameLabel.isLine ? [-6, 0] : [0, 0]}
              style={zoneNameLabel.isLine ? { zIndex: 20 } : undefined}
            >
              <div className="pointer-events-none flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white shadow">
                <span>{zoneNameLabel.name}</span>
              </div>
            </Marker>
          ))}

          {markers
            .filter((marker) => marker.visible)
            .map((marker) => (
              <Marker
                key={marker.id}
                longitude={marker.longitude}
                latitude={marker.latitude}
                anchor="bottom"
                style={{zIndex: 30}}
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
                            {longitude: startMarker.longitude, latitude: startMarker.latitude},
                            {longitude: marker.longitude, latitude: marker.latitude},
                          ],
                          markerAId: startMarker.id,
                          markerBId: marker.id,
                          distanceMeters: distanceMeters(
                            {longitude: startMarker.longitude, latitude: startMarker.latitude},
                            {longitude: marker.longitude, latitude: marker.latitude}
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
              onSave={async ({name, notes, color, customColor, icon}) => {
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
              onSave={async ({id, name, notes, color, customColor, icon}) => {
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

          {selectedZone && selectedZoneAnchor && editingZoneId !== selectedZone.id && (
            <ViewMapZonePopup
              zone={selectedZone}
              longitude={selectedZoneAnchor.longitude}
              latitude={selectedZoneAnchor.latitude}
              onClose={() => setSelectedZoneId(null)}
              onEdit={() => setEditingZoneId(selectedZone.id)}
              onMouseEnter={hideCoordinates}
            />
          )}

          {editingZone && editingZoneAnchor && (
            <MapZoneFormPopup
              zone={editingZone}
              longitude={editingZoneAnchor.longitude}
              latitude={editingZoneAnchor.latitude}
              onMouseEnter={hideCoordinates}
              onSave={async ({
                               id,
                               name,
                               notes,
                               strokeColor,
                               fillColor,
                               fillOpacity,
                               geometry,
                               navigationTime,
                               navigationDirection,
                               visible
                             }) => {
                await updateZone(id, {
                  name,
                  notes: notes || null,
                  stroke_color: strokeColor,
                  fill_color: fillColor,
                  fill_opacity: fillOpacity,
                  geometry,
                  navigation_time: navigationTime || null,
                  navigation_direction: navigationDirection || null,
                  visible,
                })

                setEditingZoneId(null)
              }}
              onCancel={() => setEditingZoneId(null)}
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
          onToggleVisibility={(id, visible) => updateMarker(id, {visible})}
          zoneCount={zones.length}
          zonePanel={
            <ZonePanel
              zones={zones}
              hiddenDistanceZoneIds={hiddenDistanceZoneIds}
              hiddenNameZoneIds={hiddenNameZoneIds}
              hiddenArrowZoneIds={hiddenArrowZoneIds}
              showZoneDistances={showZoneDistances}
              showZoneNames={showZoneNames}
              onDelete={handleDeleteZone}
              onEdit={handleEditZone}
              onFlyTo={handleFlyToZone}
              onSelect={handleSelectZone}
              onToggleDistanceVisibility={handleToggleZoneDistanceVisibility}
              onToggleNameVisibility={handleToggleZoneNameVisibility}
              onToggleShowZoneDistances={setShowZoneDistances}
              onToggleShowZoneNames={setShowZoneNames}
              selectedZoneId={selectedZoneId}
              onToggleVisibility={(id, visible) => updateZone(id, { visible })}
              onToggleArrowVisibility={handleToggleZoneArrowVisibility}
            />
          }
        />
      </div>
    </MapProvider>
  )
}
