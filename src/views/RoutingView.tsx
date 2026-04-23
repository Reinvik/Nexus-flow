import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocoding';
import DynamicMap from '@/components/Routing/DynamicMap';
import toast from 'react-hot-toast';
import { Map as MapIcon, RefreshCw, AlertTriangle, Info, Play, Pause } from 'lucide-react';

interface ClientWithStatus {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'red' | 'yellow' | 'green' | 'gray';
  debtInfo?: string;
  commune?: string;
  phone?: string;
  totalDebt?: number;
  pendingInvoices?: Array<{ folio: number; balance: number }>;
}

export default function RoutingView() {
  const [clients, setClients] = useState<ClientWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isAutoGeocodeEnabled, setIsAutoGeocodeEnabled] = useState(false);
  const [selectedCommune, setSelectedCommune] = useState<string>('Todas');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'red' | 'yellow' | 'green' | 'gray'>('all');
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });

  const isAutoGeocodeEnabledRef = useRef(isAutoGeocodeEnabled);
  useEffect(() => {
    isAutoGeocodeEnabledRef.current = isAutoGeocodeEnabled;
  }, [isAutoGeocodeEnabled]);

  const failedAddresses = useState<Set<string>>(new Set())[0];

  const fetchClientsAndInvoices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, address, commune, latitude, longitude, phone');

      if (clientsError) throw clientsError;

      // Fetch pending/active invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, client_id, total_amount, paid_amount, payment_due_date, issued_at, status, folio')
        .neq('status', 'Pagada'); // Only interested in unpaid ones

      if (invoicesError) throw invoicesError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const now = new Date();
      const endOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);

      const processedClients: ClientWithStatus[] = (clientsData || []).map(client => {
        const clientInvoices = (invoicesData || []).filter(inv => inv.client_id === client.id);
        const totalDebt = clientInvoices.reduce((acc, inv) => acc + (Number(inv.total_amount) - Number(inv.paid_amount || 0)), 0);
        
        let status: 'red' | 'yellow' | 'green' | 'gray' = 'green'; // Default to green
        let debtInfo = '';

        if (totalDebt > 0) {
          const hasOverdue = clientInvoices.some(inv => {
            const dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
            if (dueDate) {
              dueDate.setHours(0, 0, 0, 0);
              return dueDate < today;
            }
            // Fallback: Si no hay fecha de vencimiento, usar issued_at + 30 días
            const issuedAt = inv.issued_at ? new Date(inv.issued_at) : null;
            if (issuedAt) {
              const fallbackDue = new Date(issuedAt);
              fallbackDue.setDate(fallbackDue.getDate() + 30);
              fallbackDue.setHours(0, 0, 0, 0);
              return fallbackDue < today;
            }
            return false;
          });

          const hasDueThisWeek = !hasOverdue && clientInvoices.some(inv => {
            let dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
            if (!dueDate && inv.issued_at) {
              dueDate = new Date(inv.issued_at);
              dueDate.setDate(dueDate.getDate() + 30);
            }
            if (dueDate) {
              dueDate.setHours(0, 0, 0, 0);
              return dueDate >= today && dueDate <= endOfWeek;
            }
            return false;
          });

          if (hasOverdue) {
            status = 'red';
            debtInfo = `Deuda Vencida: $${totalDebt.toLocaleString()}`;
          } else if (hasDueThisWeek) {
            status = 'yellow';
            debtInfo = `Vence esta semana: $${totalDebt.toLocaleString()}`;
          } else {
            status = 'green';
            debtInfo = `Deuda al día: $${totalDebt.toLocaleString()}`;
          }
        } else {
          status = 'gray';
          debtInfo = 'Sin deuda pendiente';
        }

        return {
          id: client.id,
          name: client.name,
          address: `${client.address || ''}, ${client.commune || ''}`.trim(),
          latitude: client.latitude,
          longitude: client.longitude,
          status,
          debtInfo,
          commune: client.commune,
          phone: client.phone,
          totalDebt,
          pendingInvoices: clientInvoices.map(inv => ({
            folio: inv.folio,
            balance: Number(inv.total_amount) - Number(inv.paid_amount || 0)
          }))
        };
      });

      setClients(processedClients.filter(c => c.latitude && c.longitude));

      // Handle geocoding for clients missing coordinates
      // We only process if they haven't failed in this session and if we're not already geocoding
      const missingCoords = processedClients.filter(c => 
        (!c.latitude || !c.longitude) && 
        c.address && 
        c.address.length > 5 && 
        !failedAddresses.has(c.id)
      );

      if (missingCoords.length > 0 && !isGeocoding && isAutoGeocodeEnabled) {
        // Limit to 5 per batch to avoid hitting the API too hard
        processMissingCoordinates(missingCoords.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos del mapa');
    } finally {
      setLoading(false);
    }
  }, [isGeocoding, failedAddresses, isAutoGeocodeEnabled]);

  const processMissingCoordinates = async (missing: ClientWithStatus[]) => {
    setIsGeocoding(true);
    setGeocodingProgress({ current: 0, total: missing.length });
    let successCount = 0;
    
    for (let i = 0; i < missing.length; i++) {
      // Check ref to see if user paused during the batch
      if (!isAutoGeocodeEnabledRef.current) {
        break;
      }

      const client = missing[i];
      setGeocodingProgress(prev => ({ ...prev, current: i + 1 }));
      
      // Safety check: skip if we already tried this address and it's empty or too short
      if (!client.address || client.address.length < 5) continue;

      toast.loading(`Ubicando: ${client.name} (${i + 1}/${missing.length})...`, { id: 'geocoding' });

      try {
        const coords = await geocodeAddress(client.address);
        if (coords) {
          const { error } = await supabase
            .from('clients')
            .update({ latitude: coords.lat, longitude: coords.lon })
            .eq('id', client.id);

          if (!error) {
            successCount++;
            setClients(prev => {
              const exists = prev.some(c => c.id === client.id);
              if (exists) {
                return prev.map(c => c.id === client.id ? { ...c, latitude: coords.lat, longitude: coords.lon } : c);
              }
              return [...prev, { ...client, latitude: coords.lat, longitude: coords.lon }];
            });
          }
        } else {
          // If coords is null, geocoding failed (maybe address not found)
          // Store in failedAddresses to avoid retrying in this session
          failedAddresses.add(client.id);
        }
      } catch (err) {
        console.error(`Failed to geocode ${client.address}:`, err);
        failedAddresses.add(client.id);
      }
    }

    if (successCount > 0) {
      toast.success(`Se ubicaron ${successCount} clientes nuevos`, { id: 'geocoding' });
    } else {
      toast.dismiss('geocoding');
    }
    setIsGeocoding(false);
  };;

  const handleMarkerDrag = async (id: string, lat: number, lon: number) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ latitude: lat, longitude: lon })
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.map(c => c.id === id ? { ...c, latitude: lat, longitude: lon } : c));
      toast.success('Ubicación actualizada manualmente', { duration: 2000 });
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('No se pudo guardar la nueva ubicación');
    }
  };

  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Filter by Commune
    if (selectedCommune !== 'Todas') {
      if (selectedCommune === 'Sin Comuna') {
        filtered = filtered.filter(c => !c.commune);
      } else {
        filtered = filtered.filter(c => c.commune === selectedCommune);
      }
    }

    // Filter by Status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(c => c.status === selectedStatus);
    }

    return filtered;
  }, [clients, selectedCommune, selectedStatus]);

  const communes = useMemo(() => {
    const list = new Set<string>();
    let hasEmpty = false;
    clients.forEach(c => {
      if (c.commune) list.add(c.commune);
      else hasEmpty = true;
    });
    const result = ['Todas', ...Array.from(list).sort()];
    if (hasEmpty) result.push('Sin Comuna');
    return result;
  }, [clients]);

  useEffect(() => {
    fetchClientsAndInvoices();
  }, [fetchClientsAndInvoices]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <MapIcon className="text-primary" /> Routing
          </h2>
          <p className="text-slate-500 text-sm">Visualización de ruta de cobranza</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsAutoGeocodeEnabled(!isAutoGeocodeEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              isAutoGeocodeEnabled 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' 
                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
            }`}
          >
            {isAutoGeocodeEnabled ? (
              <><Pause size={16} /> Detener Actualización</>
            ) : (
              <><Play size={16} /> Actualizar Ubicaciones</>
            )}
          </button>

          <select
            value={selectedCommune}
            onChange={(e) => setSelectedCommune(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
          >
            {communes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            onClick={() => fetchClientsAndInvoices()}
            disabled={loading || isGeocoding}
            className="p-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'red' ? 'all' : 'red')}
          className={`p-3 rounded-xl flex items-center gap-3 transition-all border ${
            selectedStatus === 'red' 
              ? 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/20' 
              : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
          }`}
        >
          <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] ${selectedStatus === 'red' ? 'bg-white' : 'bg-red-500'}`}></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Vencidos</span>
        </button>
        
        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'yellow' ? 'all' : 'yellow')}
          className={`p-3 rounded-xl flex items-center gap-3 transition-all border ${
            selectedStatus === 'yellow' 
              ? 'bg-yellow-500 text-white border-yellow-600 shadow-lg shadow-yellow-500/20' 
              : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20'
          }`}
        >
          <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] ${selectedStatus === 'yellow' ? 'bg-white' : 'bg-yellow-500'}`}></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Esta Semana</span>
        </button>

        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'green' ? 'all' : 'green')}
          className={`p-3 rounded-xl flex items-center gap-3 transition-all border ${
            selectedStatus === 'green' 
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
          }`}
        >
          <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${selectedStatus === 'green' ? 'bg-white' : 'bg-emerald-500'}`}></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Al Día</span>
        </button>

        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'gray' ? 'all' : 'gray')}
          className={`p-3 rounded-xl flex items-center gap-3 transition-all border ${
            selectedStatus === 'gray' 
              ? 'bg-slate-500 text-white border-slate-600 shadow-lg shadow-slate-500/20' 
              : 'bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${selectedStatus === 'gray' ? 'bg-white' : 'bg-slate-400'}`}></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Sin Deuda</span>
        </button>
      </div>

      <div className="flex-1 min-h-[400px] relative rounded-2xl overflow-hidden glass-card shadow-2xl border border-card-border">
        {loading && clients.length === 0 ? (
          <div className="absolute inset-0 z-10 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="animate-spin text-primary" size={40} />
            <p className="text-slate-300 font-medium">Cargando ubicaciones de clientes...</p>
          </div>
        ) : clients.length === 0 && !isGeocoding ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <div className="p-4 bg-amber-500/10 rounded-full">
              <AlertTriangle className="text-amber-500" size={48} />
            </div>
            <h3 className="text-xl font-bold">No hay clientes con ubicación</h3>
            <p className="text-slate-400 max-w-md">
              Asegúrate de que los clientes tengan dirección registrada. El sistema geocodificará las direcciones automáticamente la próxima vez que cargues esta vista.
            </p>
          </div>
        ) : null}
        
        <DynamicMap clients={filteredClients} onMarkerDrag={handleMarkerDrag} />

        {isGeocoding && (
          <div className="absolute bottom-4 left-4 right-4 z-20 md:w-80 md:left-auto md:right-4">
            <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl space-y-2">
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="animate-spin" />
                <div className="flex-1">
                  <span className="text-sm font-semibold">Actualizando ubicaciones...</span>
                  <p className="text-[10px] text-indigo-200">Procesando {geocodingProgress.current} de {geocodingProgress.total}</p>
                </div>
              </div>
              <div className="w-full bg-indigo-900/50 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-300" 
                  style={{ width: `${(geocodingProgress.current / geocodingProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

