/**
 * WhatsApp utilities for Nexus Flow
 */

export interface InvoiceInfo {
  folio: number;
  balance: number;
  dueDate?: Date;
}

export const generateWhatsAppLink = (
  phone: string | null | undefined,
  clientName: string,
  status: 'red' | 'yellow' | 'green' | 'gray',
  totalDebt: number,
  invoices: InvoiceInfo[]
) => {
  if (!phone) return '#';

  // Clean phone number (remove non-digits)
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Chilean number formatting logic
  if (cleanPhone.length === 8) {
    // 8 digits - assume mobile missing '9' and '56'
    cleanPhone = '569' + cleanPhone;
  } else if (cleanPhone.length === 9) {
    // 9 digits - assume mobile or landline with city code, missing '56'
    // If it starts with 9, it's definitely mobile
    cleanPhone = '56' + cleanPhone;
  }
  // If it's 11 or 12 digits and starts with 56, it's likely already correct
  
  // Base URL
  const baseUrl = `https://wa.me/${cleanPhone}?text=`;
  
  let message = '';
  
  if (status === 'red') {
    const invoiceList = invoices
      .map(inv => `#${inv.folio} ($${inv.balance.toLocaleString()})`)
      .join(', ');
      
    message = `Hola ${clientName}, le contacto de Nexus Flow. Registramos facturas atrasadas por un monto total de $${totalDebt.toLocaleString()}. Las facturas pendientes son: ${invoiceList}. Favor realizar la transferencia a la brevedad para evitar suspensión de servicio.`;
  } else if (status === 'yellow') {
    const invoiceList = invoices
      .map(inv => `#${inv.folio} ($${inv.balance.toLocaleString()})`)
      .join(', ');
      
    message = `Hola ${clientName}, le contacto de Nexus Flow para recordarle que tiene facturas por vencer esta semana por un monto de $${totalDebt.toLocaleString()}. La(s) factura(s) es/son: ${invoiceList}. Agradecemos su puntualidad para mantener su cuenta al día.`;
  } else {
    // Green or Gray - simple greeting or general inquiry
    message = `Hola ${clientName}, le contacto de Nexus Flow. ¿Cómo se encuentra hoy?`;
  }

  return baseUrl + encodeURIComponent(message);
};
