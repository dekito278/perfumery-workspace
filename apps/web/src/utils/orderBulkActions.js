const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const safeFilename = (value) => String(value || 'orders')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, '_');

export const exportOrdersCsv = (orders = [], filename = 'orders.csv') => {
  const rows = [
    ['Order', 'Customer', 'Contact', 'Payment', 'Shipment', 'Courier', 'Tracking', 'Subtotal', 'Created At'],
    ...orders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.contact,
      order.paymentStatus,
      order.shipmentStatus,
      order.courierName,
      order.trackingNumber,
      order.subtotal,
      order.createdAt,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return orders.length;
};

