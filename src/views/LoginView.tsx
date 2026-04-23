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

      <div className="relative z-10 w-full max-w-[440px] px-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex flex-col items-center mb-14">
          <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-[0_40px_80px_rgba(255,255,255,0.15)] group hover:scale-105 transition-all duration-700">
            <Zap size={36} className="text-[#020617]" fill="currentColor" />
          </div>
          
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black text-white tracking-tight uppercase">
              Nexus <span className="text-cyan-500">Flow</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="w-8 h-px bg-slate-800" />
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">System Core 2.0</p>
              <span className="w-8 h-px bg-slate-800" />
            </div>
          </div>
        </div>

        <div className="glass-card p-12 rounded-[3.5rem] border-white/5 relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
          {/* Subtle Scanline Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
          
          <form onSubmit={handleLogin} className="space-y-10 relative z-10">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Identidad</label>
              </div>
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
        </div>

        <div className="mt-16 text-center space-y-4">
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">
            Precision Operational Architecture
          </p>
          <div className="flex items-center justify-center gap-6 opacity-20">
             <div className="w-1.5 h-1.5 bg-white rounded-full" />
             <div className="w-1.5 h-1.5 bg-white rounded-full" />
             <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;

