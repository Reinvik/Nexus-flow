import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocoding';
import DynamicMap from '@/components/Routing/DynamicMap';
import toast from 'react-hot-toast';
import { Map as MapIcon, RefreshCw, AlertTriangle, Play, Pause, Filter, MapPin, Phone, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

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
  const [searchQuery, setSearchQuery] = useState('');

  const isAutoGeocodeEnabledRef = useRef(isAutoGeocodeEnabled);
  useEffect(() => {
    isAutoGeocodeEnabledRef.current = isAutoGeocodeEnabled;
  }, [isAutoGeocodeEnabled]);

  const failedAddresses = useRef<Set<string>>(new Set()).current;

  const fetchClientsAndInvoices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('nf_clients')
        .select('id, name, address, commune, latitude, longitude, phone');

      if (clientsError) throw clientsError;

      // Fetch pending/active invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('nf_invoices')
        .select('id, client_id, total_amount, paid_amount, payment_due_date, issued_at, status, folio')
        .neq('status', 'Pagada');

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
        
        let status: 'red' | 'yellow' | 'green' | 'gray' = 'green';
        let debtInfo = '';

        if (totalDebt > 0) {
          const hasOverdue = clientInvoices.some(inv => {
            let dueDate: Date | null = null;
            if (inv.payment_due_date) {
              dueDate = new Date(inv.payment_due_date);
            } else if (inv.issued_at) {
              dueDate = new Date(inv.issued_at);
              dueDate.setDate(dueDate.getDate() + 30);
            }
            
            if (dueDate) {
              dueDate.setHours(0, 0, 0, 0);
              return dueDate < today;
            }
            return false;
          });

          const hasDueThisWeek = !hasOverdue && clientInvoices.some(inv => {
            let dueDate: Date | null = null;
            if (inv.payment_due_date) {
              dueDate = new Date(inv.payment_due_date);
            } else if (inv.issued_at) {
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
            debtInfo = `Vencido: ${formatCurrency(totalDebt)}`;
          } else if (hasDueThisWeek) {
            status = 'yellow';
            debtInfo = `Esta semana: ${formatCurrency(totalDebt)}`;
          } else {
            status = 'green';
            debtInfo = `Al día: ${formatCurrency(totalDebt)}`;
          }
        } else {
          status = 'gray';
          debtInfo = 'Sin deuda';
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

      // Auto geocoding logic
      const missingCoords = processedClients.filter(c => 
        (!c.latitude || !c.longitude) && 
        c.address && 
        c.address.length > 5 && 
        !failedAddresses.has(c.id)
      );

      if (missingCoords.length > 0 && !isGeocoding && isAutoGeocodeEnabled) {
        processMissingCoordinates(missingCoords.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos del mapa');
    } finally {
      setLoading(false);
    }
  }, [isGeocoding, isAutoGeocodeEnabled]);

  const processMissingCoordinates = async (missing: ClientWithStatus[]) => {
    setIsGeocoding(true);
    setGeocodingProgress({ current: 0, total: missing.length });
    let successCount = 0;
    
    for (let i = 0; i < missing.length; i++) {
      if (!isAutoGeocodeEnabledRef.current) break;

      const client = missing[i];
      setGeocodingProgress(prev => ({ ...prev, current: i + 1 }));
      
      if (!client.address || client.address.length < 5) continue;

      try {
        const coords = await geocodeAddress(client.address);
        if (coords) {
          const { error } = await supabase
            .from('nf_clients')
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
          failedAddresses.add(client.id);
        }
      } catch (err) {
        console.error(`Failed to geocode ${client.address}:`, err);
        failedAddresses.add(client.id);
      }
    }

    if (successCount > 0) {
      toast.success(`Se ubicaron ${successCount} clientes nuevos`);
    }
    setIsGeocoding(false);
  };

  const handleMarkerDrag = async (id: string, lat: number, lon: number) => {
    try {
      const { error } = await supabase
        .from('nf_clients')
        .update({ latitude: lat, longitude: lon })
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.map(c => c.id === id ? { ...c, latitude: lat, longitude: lon } : c));
      toast.success('Ubicación actualizada');
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Error al guardar ubicación');
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesCommune = selectedCommune === 'Todas' || (selectedCommune === 'Sin Comuna' ? !c.commune : c.commune === selectedCommune);
      const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.address.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCommune && matchesStatus && matchesSearch;
    });
  }, [clients, selectedCommune, selectedStatus, searchQuery]);

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
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-6 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <MapIcon className="text-primary w-8 h-8" />
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight text-foreground">Logística & Rutas</h2>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Geolocalización de Cobranza en Tiempo Real</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
              <Filter size={18} />
            </div>
            <input
              type="text"
              placeholder="Buscar cliente o dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white/10 transition-all w-64 md:w-80 backdrop-blur-md"
            />
          </div>

          <button
            onClick={() => setIsAutoGeocodeEnabled(!isAutoGeocodeEnabled)}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
              isAutoGeocodeEnabled 
                ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' 
                : 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95'
            }`}
          >
            {isAutoGeocodeEnabled ? (
              <><Pause size={18} /> Detener Scan</>
            ) : (
              <><Play size={18} /> Iniciar Scan</>
            )}
          </button>

          <button 
            onClick={() => fetchClientsAndInvoices()}
            disabled={loading || isGeocoding}
            className="p-3.5 bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 active:scale-90"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 px-2">
        <div className="lg:col-span-1">
          <select
            value={selectedCommune}
            onChange={(e) => setSelectedCommune(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-md appearance-none cursor-pointer hover:bg-white/10 transition-all"
          >
            {communes.map(c => <option key={c} value={c} className="bg-slate-100 dark:bg-slate-900 text-foreground">{c}</option>)}
          </select>
        </div>

        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'red' ? 'all' : 'red')}
          className={`p-4 rounded-2xl flex items-center justify-between transition-all border group ${
            selectedStatus === 'red' 
              ? 'bg-rose-500 text-white border-rose-600 shadow-xl shadow-rose-500/20' 
              : 'bg-white/5 border-white/10 text-rose-500 hover:bg-rose-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full relative ${selectedStatus === 'red' ? 'bg-white' : 'bg-rose-500'}`}>
              <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${selectedStatus === 'red' ? 'bg-white' : 'bg-rose-500'}`} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Vencidos</span>
          </div>
          <span className={`text-xs font-black ${selectedStatus === 'red' ? 'text-white/70' : 'text-slate-500'}`}>
            {clients.filter(c => c.status === 'red').length}
          </span>
        </button>
        
        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'yellow' ? 'all' : 'yellow')}
          className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${
            selectedStatus === 'yellow' 
              ? 'bg-amber-500 text-white border-amber-600 shadow-xl shadow-amber-500/20' 
              : 'bg-white/5 border-white/10 text-amber-500 hover:bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${selectedStatus === 'yellow' ? 'bg-white' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Esta Semana</span>
          </div>
          <span className={`text-xs font-black ${selectedStatus === 'yellow' ? 'text-white/70' : 'text-slate-500'}`}>
            {clients.filter(c => c.status === 'yellow').length}
          </span>
        </button>

        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'green' ? 'all' : 'green')}
          className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${
            selectedStatus === 'green' 
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-xl shadow-emerald-500/20' 
              : 'bg-white/5 border-white/10 text-emerald-500 hover:bg-emerald-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${selectedStatus === 'green' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Al Día</span>
          </div>
          <span className={`text-xs font-black ${selectedStatus === 'green' ? 'text-white/70' : 'text-slate-500'}`}>
            {clients.filter(c => c.status === 'green').length}
          </span>
        </button>

        <button 
          onClick={() => setSelectedStatus(selectedStatus === 'gray' ? 'all' : 'gray')}
          className={`p-4 rounded-2xl flex items-center justify-between transition-all border group ${
            selectedStatus === 'gray' 
              ? 'bg-slate-500 text-white border-slate-600 shadow-xl shadow-slate-500/20' 
              : 'bg-slate-200/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:bg-slate-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${selectedStatus === 'gray' ? 'bg-white' : 'bg-slate-400'}`} />
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Sin Deuda</span>
          </div>
          <span className={`text-xs font-black ${selectedStatus === 'gray' ? 'text-white/70' : 'text-slate-500'}`}>
            {clients.filter(c => c.status === 'gray').length}
          </span>
        </button>
      </div>

      {/* Map Container */}
      <div className="flex-1 min-h-[450px] relative rounded-[2.5rem] overflow-hidden glass-card shadow-2xl border border-slate-200 dark:border-white/10 group">
        {loading && clients.length === 0 ? (
          <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
            <div className="relative">
                <RefreshCw className="animate-spin text-primary" size={60} />
                <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full blur-xl" />
            </div>
            <div className="text-center">
                <p className="text-2xl font-black tracking-tight text-foreground">Sincronizando Coordenadas</p>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Accediendo a la base de datos maestra</p>
            </div>
          </div>
        ) : filteredClients.length === 0 && !isGeocoding ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-8 p-12 text-center bg-background/50 backdrop-blur-sm">
            <div className="p-8 bg-amber-500/10 rounded-[2.5rem] border border-amber-500/20 animate-bounce">
              <AlertTriangle className="text-amber-500" size={64} />
            </div>
            <div className="space-y-4">
                <h3 className="text-3xl font-black tracking-tight text-foreground">No se encontraron clientes</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-medium text-lg leading-relaxed">
                  Ajusta los filtros o busca otra dirección. El sistema solo muestra clientes con coordenadas válidas.
                </p>
            </div>
          </div>
        ) : null}
        
        <div className="absolute inset-0">
            <DynamicMap clients={filteredClients} onMarkerDrag={handleMarkerDrag} />
        </div>

        {/* Legend / Info Overlay */}
        <div className="absolute top-6 left-6 z-10 hidden md:block">
            <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-white/10 backdrop-blur-xl shadow-2xl space-y-4 w-64">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <MapPin size={12} className="text-primary" /> Referencia de Ruta
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">Clientes Totales</span>
                        <span className="text-sm font-black text-primary">{clients.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">En el Mapa</span>
                        <span className="text-sm font-black text-emerald-500">{filteredClients.length}</span>
                    </div>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                        <span className="text-[10px] font-bold text-slate-400">Riesgo Alto (Vencido)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                        <span className="text-[10px] font-bold text-slate-400">Atención (Semana actual)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <span className="text-[10px] font-bold text-slate-400">Crédito Saludable</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Geocoding Progress */}
        {isGeocoding && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-6">
            <div className="bg-primary border border-primary-light/30 text-white p-6 rounded-3xl shadow-2xl shadow-primary/30 backdrop-blur-md animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                    <RefreshCw size={24} className="animate-spin" />
                </div>
                <div className="flex-1">
                  <span className="text-lg font-black tracking-tight block">Escaneando Direcciones</span>
                  <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">
                    Progreso: {geocodingProgress.current} de {geocodingProgress.total}
                  </p>
                </div>
              </div>
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
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
