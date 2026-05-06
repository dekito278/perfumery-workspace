import { useEffect, useMemo, useState } from 'react';
import {
  clearOrders,
  deleteOrder,
  getOrderSummary,
  getOrders,
  updateOrderStatus,
} from '@/services/orderService.js';

export const useOrders = () => {
  const [orders, setOrders] = useState(getOrders);

  useEffect(() => {
    const syncOrders = () => setOrders(getOrders());
    window.addEventListener('storage', syncOrders);
    window.addEventListener('dekito:orders-updated', syncOrders);
    syncOrders();

    return () => {
      window.removeEventListener('storage', syncOrders);
      window.removeEventListener('dekito:orders-updated', syncOrders);
    };
  }, []);

  const summary = useMemo(() => getOrderSummary(orders), [orders]);

  return {
    orders,
    summary,
    updateStatus: (orderId, status) => setOrders(updateOrderStatus(orderId, status)),
    deleteOne: (orderId) => setOrders(deleteOrder(orderId)),
    clearAll: () => {
      clearOrders();
      setOrders([]);
    },
  };
};
