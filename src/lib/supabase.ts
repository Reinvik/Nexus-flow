import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Usamos el esquema 'flow' donde residen las tablas de producción (sin prefijo nf_).
// Esto garantiza la carga correcta de datos desde el dataset validado.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'flow'
  }
});
