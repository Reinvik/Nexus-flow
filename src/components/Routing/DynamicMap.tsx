import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MessageCircle, Phone } from 'lucide-react'
import { generateWhatsAppLink } from '@/lib/whatsapp'

// Fix for default marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface MapProps {
  clients: Array<{
    id: string
    name: string
    address: string
    latitude: number
    longitude: number
    status: 'red' | 'yellow' | 'green' | 'gray'
    debtInfo?: string
    phone?: string
    totalDebt?: number
    pendingInvoices?: Array<{ folio: number; balance: number }>
  }>
  onMarkerDrag?: (id: string, newLat: number, newLon: number) => void
}

const getMarkerIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); cursor: grab;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

const colorMap = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#10b981',
  gray: '#94a3b8',
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
  }, [center])
  return null
}

export default function DynamicMap({ clients, onMarkerDrag }: MapProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return <div className="w-full h-full bg-slate-900 rounded-2xl animate-pulse flex items-center justify-center text-slate-500">Cargando mapa...</div>

  const defaultCenter: [number, number] = clients.length > 0 
    ? [clients[0].latitude, clients[0].longitude] 
    : [-33.4489, -70.6693]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '1rem', zIndex: 1 }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {clients.map((client) => (
        <Marker
          key={client.id}
          position={[client.latitude, client.longitude]}
          icon={getMarkerIcon(colorMap[client.status])}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              if (onMarkerDrag) {
                onMarkerDrag(client.id, position.lat, position.lng);
              }
            },
          }}
        >
          <Popup>
            <div className="p-1 text-slate-900">
              <h3 className="font-bold mb-1">{client.name}</h3>
              <p className="text-xs mb-1">{client.address}</p>
              <p className="text-[10px] text-slate-400 mb-2 italic">Arrastra el marcador para ajustar ubicación</p>
              <div className={`text-[10px] px-2 py-1 rounded inline-block font-semibold uppercase ${
                client.status === 'red' ? 'bg-red-100 text-red-700' :
                client.status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                client.status === 'green' ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {client.debtInfo || 'Sin deuda'}
              </div>
              
              {client.phone && (
                <div className="mt-3 flex gap-2">
                  <a 
                    href={generateWhatsAppLink(
                      client.phone,
                      client.name,
                      client.status,
                      client.totalDebt || 0,
                      client.pendingInvoices || []
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 no-underline"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <a 
                    href={`tel:${client.phone}`}
                    className="p-2 bg-slate-100 text-slate-600 hover:bg-primary hover:text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center"
                    title="Llamar"
                  >
                    <Phone size={14} />
                  </a>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      <ChangeView center={defaultCenter} />
    </MapContainer>
  )
}

