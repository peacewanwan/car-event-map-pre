"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export type Spot = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: string | null;
  description: string | null;
  prefecture: string | null;
};

type Props = {
  spots: Spot[];
};

export default function MapView({ spots }: Props) {
  return (
    <MapContainer
      center={[36.5, 137.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {spots.map((spot) => (
        <Marker key={spot.id} position={[spot.lat, spot.lng]}>
          <Popup>
            <div className="space-y-1 min-w-[160px]">
              <p className="font-bold text-sm">{spot.name}</p>
              {spot.category && (
                <p className="text-xs text-gray-500">カテゴリ：{spot.category}</p>
              )}
              {spot.prefecture && (
                <p className="text-xs text-gray-500">{spot.prefecture}</p>
              )}
              {spot.description && (
                <p className="text-xs text-gray-700 mt-1">{spot.description}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
