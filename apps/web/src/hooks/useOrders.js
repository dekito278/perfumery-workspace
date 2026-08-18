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
      // Keep the order's own provider. Hardcoding 'doku' relabelled every manual-transfer order as a DOKU
      // payment the moment an admin marked it paid from a list or a bulk action, so the payment method on
      // record no longer matched how the buyer actually paid.
      const target = orders.find((order) => order.id === orderId || order.orderNumber === orderId);
      await updateOrderPaymentStatus(orderId, {
        paymentStatus,
        paymentProvider: target?.paymentProvider || 'doku',
        status: nextOrderStatus,
      });
      setOrders(await getOrders());
    },
    // Confirm here rather than at each call site: the mobile list used to hard-delete a live order on a
    // single mis-tap because only the desktop page asked first (audit round 7).
    deleteOne: async (orderId) => {
      if (typeof window !== 'undefined'
        && !window.confirm('Hapus order ini permanen? Stok yang direservasi akan dikembalikan dan tindakan ini tidak bisa dibatalkan.')) {
        return;
      }
      setOrders(await deleteOrder(orderId));
    },
    clearAll: () => {
      clearOrders();
      setOrders([]);
    },
  };
};
