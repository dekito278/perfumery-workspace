import { useEffect, useMemo, useState } from 'react';
import {
  clearOrders,
  deleteOrder,
  getOrderSummary,
  getLocalOrders,
  getOrders,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from '@/services/orderService.js';

export const useOrders = () => {
  const [orders, setOrders] = useState(getLocalOrders);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const syncOrders = async () => {
      setLoading(true);
      const nextOrders = await getOrders();
      if (isMounted) {
        setOrders(nextOrders);
        setLoading(false);
      }
    };

    window.addEventListener('storage', syncOrders);
    window.addEventListener('dekito:orders-updated', syncOrders);
    syncOrders();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncOrders);
      window.removeEventListener('dekito:orders-updated', syncOrders);
    };
  }, []);

  const summary = useMemo(() => getOrderSummary(orders), [orders]);

  return {
    orders,
    summary,
    loading,
    reload: async () => setOrders(await getOrders()),
    updateStatus: async (orderId, status) => setOrders(await updateOrderStatus(orderId, status)),
    updatePaymentStatus: async (orderId, paymentStatus) => {
      const nextOrderStatus = paymentStatus === 'paid'
        ? 'paid'
        : ['failed', 'expired'].includes(paymentStatus)
          ? 'cancelled'
          : 'pending_payment';
      await updateOrderPaymentStatus(orderId, {
        paymentStatus,
        paymentProvider: 'doku',
        status: nextOrderStatus,
      });
      setOrders(await getOrders());
    },
    deleteOne: async (orderId) => setOrders(await deleteOrder(orderId)),
    clearAll: () => {
      clearOrders();
      setOrders([]);
    },
  };
};
