export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

export const formatRUT = (rut: string) => {
  if (!rut) return '';
  // Remove dots and hyphens
  let value = rut.replace(/[.-]/g, '').toUpperCase();
  if (value.length < 2) return value;
  
  const dv = value.slice(-1);
  const body = value.slice(0, -1);
  
  // Add dots to body
  let formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  return `${formattedBody}-${dv}`;
};

export const validateRUT = (rut: string) => {
  if (!rut) return false;
  let value = rut.replace(/[.-]/g, '').toUpperCase();
  if (value.length < 8) return false;
  
  const dv = value.slice(-1);
  const body = value.slice(0, -1);
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDV = 11 - (sum % 11);
  const dvStr = expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : expectedDV.toString();
  
  return dvStr === dv;
};
