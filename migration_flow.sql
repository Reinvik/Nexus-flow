-- ============================================================
-- NEXUS FLOW: MIGRACIÓN AL ESQUEMA 'flow'
-- ============================================================

-- 1. CREAR ESQUEMA
CREATE SCHEMA IF NOT EXISTS flow;

-- 2. TABLA DE CONFIGURACIÓN
CREATE TABLE IF NOT EXISTS flow.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE PRODUCTOS
CREATE TABLE IF NOT EXISTS flow.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    net_price NUMERIC NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS flow.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rut TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    commune TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE VENTAS
CREATE TABLE IF NOT EXISTS flow.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES flow.clients(id),
    invoice_id UUID, -- Se actualizará luego
    subtotal_net NUMERIC NOT NULL DEFAULT 0,
    total_tax NUMERIC NOT NULL DEFAULT 0,
    total_with_tax NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA DE ÍTEMS DE VENTA
CREATE TABLE IF NOT EXISTS flow.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES flow.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES flow.products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_net NUMERIC NOT NULL DEFAULT 0,
    subtotal_net NUMERIC NOT NULL DEFAULT 0
);

-- 7. TABLA DE FACTURAS (INVOICES)
CREATE TABLE IF NOT EXISTS flow.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio INTEGER UNIQUE NOT NULL,
    sale_id UUID REFERENCES flow.sales(id),
    client_id UUID REFERENCES flow.clients(id),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_due_date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'Pagada', 'Parcial', 'Anulada'
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT
);

-- 8. TABLA DE PAGOS (ABONOS)
CREATE TABLE IF NOT EXISTS flow.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES flow.invoices(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. MIGRACIÓN DE DATOS (Desde public.nf_*)
-- Nota: Solo migramos si las tablas de origen existen
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_settings') THEN
        INSERT INTO flow.settings (id, key, value, updated_at)
        SELECT id, key, value, updated_at FROM public.nf_settings
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_products') THEN
        INSERT INTO flow.products (id, name, sku, net_price, stock, created_at)
        SELECT id, name, sku, net_price, stock, created_at FROM public.nf_products
        ON CONFLICT (sku) DO NOTHING;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_clients') THEN
        INSERT INTO flow.clients (id, name, rut, phone, email, address, commune, created_at)
        SELECT id, name, rut, phone, email, address, commune, created_at FROM public.nf_clients
        ON CONFLICT (rut) DO NOTHING;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_sales') THEN
        INSERT INTO flow.sales (id, client_id, invoice_id, subtotal_net, total_tax, total_with_tax, created_at)
        SELECT id, client_id, invoice_id, subtotal_net, total_tax, total_with_tax, created_at FROM public.nf_sales;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_sale_items') THEN
        INSERT INTO flow.sale_items (id, sale_id, product_id, quantity, unit_price_net, subtotal_net)
        SELECT id, sale_id, product_id, quantity, unit_price_net, subtotal_net FROM public.nf_sale_items;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nf_invoices') THEN
        INSERT INTO flow.invoices (id, folio, sale_id, client_id, issued_at, payment_due_date, total_amount)
        SELECT id, folio, sale_id, client_id, issued_at, payment_due_date, total_amount FROM public.nf_invoices
        ON CONFLICT (folio) DO NOTHING;
    END IF;
END $$;

-- 10. PERMISOS
GRANT USAGE ON SCHEMA flow TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA flow TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA flow TO anon, authenticated;

-- 11. RLS
ALTER TABLE flow.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_anon" ON flow.settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.clients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.sales FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.invoices FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON flow.payments FOR ALL TO anon USING (true) WITH CHECK (true);
