import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/^\ufeff/, '').trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.replace(/^\ufeff/, '').trim();

// Validación robusta de variables de entorno
if (!supabaseUrl || supabaseUrl === 'undefined' || !supabaseAnonKey || supabaseAnonKey === 'undefined') {
  const errorMsg = 'Faltan variables de entorno de Supabase. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.';
  console.error(errorMsg, { url: supabaseUrl });
  throw new Error(errorMsg);
}

// Verificar que la URL sea válida antes de inicializar el cliente
try {
  new URL(supabaseUrl);
} catch (e) {
  const errorMsg = `URL de Supabase inválida: "${supabaseUrl}". Debe ser una URL completa (ej. https://xyz.supabase.co)`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Usamos el esquema 'flow' donde residen las tablas de producción.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  }
});
