export const createDokuCheckout = async ({
  order,
  amount,
  customerName,
  contact,
}) => {
  const response = await fetch('/api/doku/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderNumber: order.orderNumber,
      amount,
      customerName,
      contact,
      callbackBaseUrl: window.location.origin,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create DOKU checkout');
  }

  if (!data.paymentUrl) {
    throw new Error('DOKU payment URL is missing');
  }

  return data;
};
