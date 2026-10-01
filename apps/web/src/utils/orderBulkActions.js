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

/**
 * Run one action across a selection and report what actually happened.
 *
 * Promise.all rejects on the FIRST failure, so a bulk action over five orders where the third fails told
 * the owner "Gagal mark paid massal" while four of them had in fact been marked paid — the other requests
 * were already in flight and still completed. He would reload, see the work apparently undone, and never
 * learn which single order had failed.
 *
 * MobileOrdersPage already settled its one bulk action and counted the failures, with the reason written
 * beside it. This is that, lifted so the other six stop being copies of the broken shape.
 *
 * Returns the counts and the first real message, because a bulk toast has room for one reason.
 */
export const settleBulk = async (tasks = []) => {
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((result) => result.status === 'rejected');
  return {
    total: results.length,
    ok: results.length - rejected.length,
    failed: rejected.length,
    reason: rejected[0]?.reason?.message || '',
  };
};
