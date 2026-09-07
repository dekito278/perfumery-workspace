import { useEffect, useMemo, useState } from 'react';
import { getCustomers, getCustomerSummary } from '@/services/customerService.js';

export const useCustomers = () => {
  // Seeded empty rather than from localStorage: the customer cache is gone, and getCustomers now throws
  // instead of quietly answering [] — an admin being shown "0 pelanggan" because a fetch failed is the
  // same lie as a write that reports success (audit round 9).
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const syncCustomers = async () => {
      setLoading(true);
      try {
        const nextCustomers = await getCustomers();
        if (mounted) {
          setCustomers(nextCustomers);
          setError('');
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'Gagal memuat pelanggan');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    window.addEventListener('storage', syncCustomers);
    window.addEventListener('dekito:customers-updated', syncCustomers);
    syncCustomers();

    return () => {
      mounted = false;
      window.removeEventListener('storage', syncCustomers);
      window.removeEventListener('dekito:customers-updated', syncCustomers);
    };
  }, []);

  const summary = useMemo(() => getCustomerSummary(customers), [customers]);

  // `refresh` had no consumer (both pages destructure only customers/summary/loading), so it is gone.
  return { customers, summary, loading, error };
};
