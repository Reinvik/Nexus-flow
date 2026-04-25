import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogIn, Mail, Lock, Loader2, Sparkles, ShieldCheck, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Acceso Autorizado', {
        style: { background: '#020617', color: '#fff', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.2em', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }
      });
    } catch (error: any) {
      toast.error(error.message || 'Error de Autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] relative overflow-hidden font-outfit selection:bg-cyan-500/30">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60rem] h-[60rem] bg-cyan-500/[0.03] rounded-full blur-[140px] animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60rem] h-[60rem] bg-blue-600/[0.03] rounded-full blur-[140px] animate-pulse duration-[8s]" />
      </div>
      
      {/* Precision Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

      <div className="relative z-10 w-full max-w-[1000px] px-4 sm:px-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="glass-card rounded-[4rem] border-white/5 relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row min-h-[600px]">
          {/* Left Panel: Branding */}
          <div className="w-full lg:w-[45%] bg-white/5 p-12 sm:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/5">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.1),transparent)]" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-10 shadow-[0_20px_40px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-all duration-700">
                <Zap size={28} className="text-[#020617]" fill="currentColor" />
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl font-black text-white tracking-tight uppercase leading-none">
                  Nexus <span className="text-cyan-500">Flow</span>
                </h1>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-px bg-slate-700" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">System Core 2.0</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-8 mt-12 lg:mt-0">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Arquitectura operativa integral que cubre desde la venta y el inventario hasta la logística de última milla y la cobranza, bajo una filosofía Smart & Lean.
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                 <div className="flex -space-x-3">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] font-black text-white">
                       {i}
                     </div>
                   ))}
                 </div>
                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Active nodes online</p>
              </div>
            </div>
          </div>

          {/* Right Panel: Form */}
          <div className="flex-1 p-12 sm:p-16 flex flex-col justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
            
            <div className="relative z-10 space-y-12">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acceso Operativo</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ingresa tus credenciales de autorización</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Identidad</label>
                  <div className="relative group">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.01] border border-white/5 text-white px-7 py-6 rounded-3xl outline-none focus:border-cyan-500/30 focus:bg-white/[0.03] transition-all duration-700 placeholder:text-slate-800 text-sm font-black uppercase tracking-wider"
                      placeholder="USUARIO@NEXUS"
                      required
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800 group-focus-within:text-cyan-500 transition-colors">
                       <Mail size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Credencial</label>
                    <button type="button" className="text-[9px] font-black text-slate-700 hover:text-cyan-500 uppercase tracking-widest transition-colors">Recuperar</button>
                  </div>
                  <div className="relative group">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.01] border border-white/5 text-white px-7 py-6 rounded-3xl outline-none focus:border-cyan-500/30 focus:bg-white/[0.03] transition-all duration-700 placeholder:text-slate-800 text-sm font-black"
                      placeholder="••••••••"
                      required
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800 group-focus-within:text-cyan-500 transition-colors">
                       <Lock size={18} />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-24 bg-white text-black rounded-3xl font-black text-[12px] tracking-[0.4em] uppercase hover:bg-cyan-400 transition-all duration-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group/btn shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
                >
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      <span>Autorizar Acceso</span>
                      <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center group-hover/btn:translate-x-2 transition-transform">
                        <ChevronRight size={20} />
                      </div>
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between pt-4">
                <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Precision Operational Architecture</p>
                <div className="flex gap-2">
                   <div className="w-1 h-1 bg-slate-800 rounded-full" />
                   <div className="w-1 h-1 bg-slate-800 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;

