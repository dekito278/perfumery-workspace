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
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const syncOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const nextOrders = await getOrders();
        if (isMounted) {
          setOrders(nextOrders);
        }
      } catch (syncError) {
        if (isMounted) {
          setError(syncError.message || 'Orders could not be loaded. Check the connection and retry.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
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
    error,
    reload: async () => {
      setLoading(true);
      setError('');
      try {
        setOrders(await getOrders());
      } catch (reloadError) {
        setError(reloadError.message || 'Orders could not be loaded. Check the connection and retry.');
        throw reloadError;
      } finally {
        setLoading(false);
      }
    },
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
