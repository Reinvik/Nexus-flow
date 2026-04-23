-- ============================================================
-- NEXUS FLOW: ESTRUCTURA EN ESQUEMA PUBLIC
-- Tablas con prefijo 'nf_' para evitar colisiones con otros proyectos.
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================

-- 1. TABLA DE CONFIGURACIÓN
CREATE TABLE IF NOT EXISTS public.nf_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE PRODUCTOS (INVENTARIO)
CREATE TABLE IF NOT EXISTS public.nf_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    net_price NUMERIC NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.nf_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rut TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    commune TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE VENTAS
CREATE TABLE IF NOT EXISTS public.nf_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.nf_clients(id),
    invoice_id UUID, -- Se actualizará luego
    subtotal_net NUMERIC NOT NULL DEFAULT 0,
    total_tax NUMERIC NOT NULL DEFAULT 0,
    total_with_tax NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE ÍTEMS DE VENTA
CREATE TABLE IF NOT EXISTS public.nf_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.nf_sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.nf_products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_net NUMERIC NOT NULL DEFAULT 0,
    subtotal_net NUMERIC NOT NULL DEFAULT 0
);

-- 6. TABLA DE FACTURAS (INVOICES)
CREATE TABLE IF NOT EXISTS public.nf_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio INTEGER UNIQUE NOT NULL,
    sale_id UUID REFERENCES public.nf_sales(id),
    client_id UUID REFERENCES public.nf_clients(id),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_due_date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC NOT NULL DEFAULT 0
);

-- 7. FOLIO INICIAL
INSERT INTO public.nf_settings (key, value)
VALUES ('next_invoice_number', '1001')
ON CONFLICT (key) DO NOTHING;

-- 8. PERMISOS PARA LA API REST (anon = navegador sin login)
GRANT ALL ON public.nf_settings TO anon, authenticated;
GRANT ALL ON public.nf_products TO anon, authenticated;
GRANT ALL ON public.nf_clients TO anon, authenticated;
GRANT ALL ON public.nf_sales TO anon, authenticated;
GRANT ALL ON public.nf_sale_items TO anon, authenticated;
GRANT ALL ON public.nf_invoices TO anon, authenticated;

-- 9. HABILITAR RLS CON POLÍTICA ABIERTA (entorno de desarrollo)
ALTER TABLE public.nf_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_invoices ENABLE ROW LEVEL SECURITY;

-- Política permisiva para anon (desarrollo)
CREATE POLICY "nf allow all anon" ON public.nf_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "nf allow all anon" ON public.nf_products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "nf allow all anon" ON public.nf_clients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "nf allow all anon" ON public.nf_sales FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "nf allow all anon" ON public.nf_sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "nf allow all anon" ON public.nf_invoices FOR ALL TO anon USING (true) WITH CHECK (true);
