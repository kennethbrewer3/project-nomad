export type BaseStylesFile = {
  version: number
  sources: {
    [key: string]: MapSource
  }
  layers: MapLayer[]
  sprite: string
  glyphs: string
}

export type MapSource = {
  type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video'
  attribution?: string
  url: string
}

export type MapLayer = {
  'id': string
  'type': string
  'source'?: string
  'source-layer'?: string
  [key: string]: any
}

/** ISO 3166-1 alpha-2 country code (e.g. "DE", "FR", "US"). */
export type CountryCode = string

export type Country = {
  code: CountryCode
  code3: string
  name: string
  continent: string
  subregion: string
  population: number
}

export type CountryGroup = {
  id: string
  name: string
  description: string
  countries: CountryCode[]
}

export type MapExtractRequest = {
  countries: CountryCode[]
  maxzoom?: number
}

export type MapExtractPreflight = {
  tiles: number
  bytes: number
  source: {
    url: string
    date: string
    key: string
  }
}

export type CreateMapMarkerPayload = {
  name: string
  notes?: string | null
  longitude: number
  latitude: number
  color?: string
  custom_color?: string | null
  icon?: string | null
  icon_color?: string | null
  visible?: boolean
}

export type UpdateMapMarkerPayload = Partial<CreateMapMarkerPayload>

export type MapMarkerResponse = {
  id: number
  name: string
  longitude: number
  latitude: number
  color: string
  custom_color?: string | null
  icon?: string | null
  icon_color?: string | null
  visible?: boolean
  notes?: string | null
  created_at: string
  updated_at?: string
}

export type LatLng = {
  latitude: number
  longitude: number
}

export type MapZoneType = 'circle' | 'ellipse' | 'rectangle' | 'polygon' | 'line'

export type MapZoneGeometry =
  | {
      type: 'circle'
      center: LatLng
      radiusMeters: number
    }
  | {
      type: 'ellipse'
      center: LatLng
      radiusXmeters: number
      radiusYmeters: number
      rotationDegrees: number
    }
  | {
      type: 'rectangle'
      mode: 'corner_to_corner' | 'center_out'
      bounds: {
        north: number
        south: number
        east: number
        west: number
      }
      rotationDegrees?: number
    }
  | {
      type: 'polygon'
      lineMode: 'straight' | 'curve'
      points: LatLng[]
      closed: true
    }
  | {
      type: 'line'
      lineMode: 'straight' | 'curve'
      points: LatLng[]
      markerAId?: number | null
      markerBId?: number | null
      distanceMeters?: number
    }

export type CreateMapZonePayload = {
  name: string
  zone_type: MapZoneType
  geometry: MapZoneGeometry
  stroke_color?: string
  fill_color?: string | null
  stroke_width?: number
  fill_opacity?: number
  visible?: boolean
  notes?: string | null
}

export type UpdateMapZonePayload = Partial<CreateMapZonePayload>

export type MapZoneResponse = {
  id: number
  name: string
  zone_type: MapZoneType
  geometry: MapZoneGeometry
  stroke_color: string
  fill_color?: string | null
  stroke_width: number
  fill_opacity: number
  visible: boolean
  notes?: string | null
  created_at: string
  updated_at?: string
}
