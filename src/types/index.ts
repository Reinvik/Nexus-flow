export interface Product {
    id: string;
    name: string;
    sku?: string;
    net_price: number;
    stock: number;
    created_at?: string;
}

export interface Client {
    id: string;
    name: string;
    rut: string;
    phone: string;
    email?: string;
    address?: string;
    commune?: string;
    invoice_count?: number;
    created_at?: string;
}

export interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    unit_price_net: number;
    subtotal_net: number;
}

export interface Sale {
    id: string;
    client_id?: string;
    invoice_id?: string;
    subtotal_net: number;
    total_tax: number;
    total_with_tax: number;
    created_at?: string;
    // Relationships (optional)
    invoice?: Invoice;
}

export interface Invoice {
    id: string;
    folio: number;
    sale_id: string;
    issued_at: string;
    payment_due_date?: string;
    total_amount: number;
    paid_amount: number;
    status: 'Pendiente' | 'Pagada' | 'Anulada';
    client_id?: string;
    // Relationships (optional)
    sale?: Sale;
    client?: Client;
}

export interface Payment {
    id: string;
    invoice_id: string;
    amount: number;
    payment_date: string;
    created_at: string;
}

export interface AppSetting {
    id: string;
    key: string;
    value: string;
}

