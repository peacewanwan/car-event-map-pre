"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { supabase } from "@/lib/supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl: "/marker-icon.png",
  iconRetinaUrl: "/marker-icon-2x.png",
  shadowUrl: "/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Map() {
  const [spots, setSpots] = useState<any[]>([]);

  useEffect(() => {
    async function loadSpots() {
      const { data, error } = await supabase
        .from("spots")
        .select("*");

      if (error) {
        console.error(error);
      } else {
        setSpots(data);
      }
    }

    loadSpots();
  }, []);

  return (
    <MapContainer
      center={[35.35, 139.35]}
      zoom={9}
      style={{ height: "600px", width: "100%" }}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {spots.map((spot) => (
        <Marker
          key={spot.id}
          position={[spot.lat, spot.lng]}
          icon={markerIcon}
        >
          <Popup>{spot.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}