import { useEffect, useMemo, useState } from 'react';
import { getCustomers, getCustomerSummary, getLocalCustomers } from '@/services/customerService.js';

export const useCustomers = () => {
  const [customers, setCustomers] = useState(getLocalCustomers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncCustomers = async () => {
      setLoading(true);
      const nextCustomers = await getCustomers();
      if (mounted) {
        setCustomers(nextCustomers);
        setLoading(false);
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

  return { customers, summary, loading, refresh: async () => setCustomers(await getCustomers()) };
};
