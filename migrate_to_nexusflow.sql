-- ============================================================
-- NEXUS FLOW 2 — Migración al esquema nexusflow
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- PASO 1: Crear el esquema
CREATE SCHEMA IF NOT EXISTS nexusflow;

-- ============================================================
-- PASO 2: Crear tablas copiando estructura desde public o flow
-- ============================================================

-- nf_clients
CREATE TABLE IF NOT EXISTS nexusflow.nf_clients (LIKE public.nf_clients INCLUDING ALL);
INSERT INTO nexusflow.nf_clients SELECT * FROM public.nf_clients ON CONFLICT (id) DO NOTHING;

-- nf_products
CREATE TABLE IF NOT EXISTS nexusflow.nf_products (LIKE public.nf_products INCLUDING ALL);
INSERT INTO nexusflow.nf_products SELECT * FROM public.nf_products ON CONFLICT (id) DO NOTHING;

-- nf_sales
CREATE TABLE IF NOT EXISTS nexusflow.nf_sales (LIKE public.nf_sales INCLUDING ALL);
INSERT INTO nexusflow.nf_sales SELECT * FROM public.nf_sales ON CONFLICT (id) DO NOTHING;

-- nf_sale_items
CREATE TABLE IF NOT EXISTS nexusflow.nf_sale_items (LIKE public.nf_sale_items INCLUDING ALL);
INSERT INTO nexusflow.nf_sale_items SELECT * FROM public.nf_sale_items ON CONFLICT (id) DO NOTHING;

-- nf_invoices (con columnas adicionales para Recaudación)
CREATE TABLE IF NOT EXISTS nexusflow.nf_invoices (LIKE public.nf_invoices INCLUDING ALL);
INSERT INTO nexusflow.nf_invoices SELECT * FROM public.nf_invoices ON CONFLICT (id) DO NOTHING;
ALTER TABLE nexusflow.nf_invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendiente';
ALTER TABLE nexusflow.nf_invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- nf_payments (tabla nueva para el módulo de Recaudación)
CREATE TABLE IF NOT EXISTS nexusflow.nf_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PASO 3: Habilitar Row Level Security (básico, permisivo)
-- ============================================================
ALTER TABLE nexusflow.nf_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexusflow.nf_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexusflow.nf_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexusflow.nf_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexusflow.nf_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexusflow.nf_payments ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para anon y authenticated
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['nf_clients','nf_products','nf_sales','nf_sale_items','nf_invoices','nf_payments'] LOOP
    EXECUTE format('CREATE POLICY "allow_all_%s" ON nexusflow.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================
