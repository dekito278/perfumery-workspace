import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Truck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useOrders } from '@/hooks/useOrders.js';

const ShipmentsPage = () => {
  const navigate = useNavigate();
  const { summary } = useOrders();

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Shipments - Solivagant</title>
        <meta name="description" content="Prepare future e-commerce shipment workflows for Solivagant orders." />
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Button variant="ghost" className="h-9 gap-2 rounded-2xl" onClick={() => navigate('/studio')}>
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <div className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <Truck className="h-4 w-4 text-primary" />
              E-commerce
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Shipments</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Area ini disiapkan untuk tracking fulfillment, resi, courier, shipping status, dan handoff dari order e-commerce.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="h-11 rounded-2xl gap-2" onClick={() => navigate('/studio/orders')}>
                <PackageCheck className="h-4 w-4" />
                Open orders
              </Button>
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Active orders</span><strong>{summary.active}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total orders</span><strong>{summary.total}</strong></div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white/90 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
              <Truck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">Shipment module coming next</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground">
                Untuk sekarang, payment dan manual order flow tetap masuk ke Orders. Nanti shipment bisa mengambil order yang sudah siap kirim, lalu menyimpan courier, tracking number, status delivery, dan notes packing.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
};

export default ShipmentsPage;
