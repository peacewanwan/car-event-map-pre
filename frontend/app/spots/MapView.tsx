'use client'

import { useState } from 'react'
import {
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  type MapAdvancedMarkerClickEvent,
} from '@vis.gl/react-google-maps'

export type Spot = {
  id: number
  name: string
  lat: number
  lng: number
  category: string | null
  description: string | null
  prefecture: string | null
}

type Props = {
  spots: Spot[]
}

export default function MapView({ spots }: Props) {
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  const [activeMarker, setActiveMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null)

  function handleMarkerClick(spot: Spot, e: MapAdvancedMarkerClickEvent) {
    setActiveSpot(spot)
    setActiveMarker(e.marker)
  }

  function handleClose() {
    setActiveSpot(null)
    setActiveMarker(null)
  }

  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={{ lat: 36.5, lng: 137.5 }}
      defaultZoom={6}
      style={{ width: '100%', height: '100%' }}
    >
      {spots.map((spot) => (
        <AdvancedMarker
          key={spot.id}
          position={{ lat: spot.lat, lng: spot.lng }}
          onClick={(e) => handleMarkerClick(spot, e)}
        >
          <Pin />
        </AdvancedMarker>
      ))}

      {activeSpot && activeMarker && (
        <InfoWindow anchor={activeMarker} onCloseClick={handleClose}>
          <div className="space-y-1 min-w-[160px]">
            <p className="font-bold text-sm">{activeSpot.name}</p>
            {activeSpot.category && (
              <p className="text-xs text-gray-500">カテゴリ：{activeSpot.category}</p>
            )}
            {activeSpot.prefecture && (
              <p className="text-xs text-gray-500">{activeSpot.prefecture}</p>
            )}
            {activeSpot.description && (
              <p className="text-xs text-gray-700 mt-1">{activeSpot.description}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </Map>
  )
}
