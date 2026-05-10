import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clipboard, Copy, CreditCard, Download, ExternalLink, Factory, FlaskConical, History, Loader2, Mail, MessageCircle, NotebookPen, PackageCheck, RefreshCw, Save, Send, Sparkles, Truck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderById,
  getOrderPaymentLogs,
  getOrderStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
  updateOrderBespokeProductionStatus,
  updateOrderInternalNotes,
  updateOrderProductionLinks,
  updateOrderShipment,
  updateOrderStatus,
} from '@/services/orderService.js';
import {
  buildNotificationMessage,
  canSendEmailNotification,
  getEmailNotificationUrl,
  getNotificationEventLabels,
  getWhatsAppNotificationUrl,
} from '@/services/notificationTemplateService.js';
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import { canExportShippingLabel, exportShippingLabelPdf } from '@/utils/shippingLabelPdf.js';

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const statusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const statusSteps = ['pending_payment', 'paid', 'processing', 'shipped', 'completed'];
const bespokeProductionSteps = ['review_brief', 'formula', 'sample', 'approval', 'production', 'ready'];

const paymentStatusLabels = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  refunded: 'Refunded',
};
const notificationEventLabels = getNotificationEventLabels();

const getPaymentTone = (status) => {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700';
  if (['failed', 'expired'].includes(status)) return 'bg-rose-50 text-rose-700';
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  return 'bg-stone-100 text-stone-600';
};

const getActiveStep = (status) => {
  if (status === 'cancelled') return -1;
  const index = statusSteps.indexOf(status);
  return index >= 0 ? index : 0;
};

const getBespokeProductionStep = (status) => {
  const index = bespokeProductionSteps.indexOf(status || 'review_brief');
  return index >= 0 ? index : 0;
};

const getPaymentLogTone = (status) => {
  if (status === 'applied') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ignored') return 'bg-amber-50 text-amber-700';
  if (['rejected', 'error'].includes(status)) return 'bg-rose-50 text-rose-700';
  return 'bg-stone-100 text-stone-600';
};

const parseNoteLines = (notes = '') => String(notes || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [label, ...rest] = line.split(':');
    return { label: label || 'Note', value: rest.join(':').trim() || '-' };
  });

const bespokeDetailRows = (item) => [
  ['Aroma', item?.preferredNotes || item?.notes],
  ['Momen', item?.occasion],
  ['Ukuran', item?.size],
  ['Botol', item?.bottleType],
  ['Cap', item?.capDesign],
  ['Label', item?.labelDesign],
  ['Material', item?.exoticMaterial],
  ['Budget', item?.budget],
  ['Reference', item?.referenceProductName],
  ['Story', item?.story],
].filter(([, value]) => value);

const buildOrderFormulaParams = (order, item) => {
  const params = new URLSearchParams({
    source: 'order',
    orderId: order?.id || order?.orderNumber || '',
  });
  const customer = order?.customerName || order?.customerCode || 'Customer';
  const aroma = item?.preferredNotes || item?.notes || item?.mood || 'Bespoke perfume';
  params.set('name', `${customer} bespoke formula`);
  params.set('notes', [
    `Order: ${order?.orderNumber || '-'}`,
    `Customer: ${customer}`,
    item?.size ? `Size: ${item.size}` : '',
    aroma ? `Aroma: ${aroma}` : '',
    item?.occasion ? `Occasion: ${item.occasion}` : '',
    item?.avoidedNotes ? `Avoid: ${item.avoidedNotes}` : '',
    item?.story ? `Story: ${item.story}` : '',
    item?.referenceProductName ? `Reference: ${item.referenceProductName}` : '',
  ].filter(Boolean).join('\n'));
  return params.toString();
};

const MobileOrderDetailPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [savingBespokeProduction, setSavingBespokeProduction] = useState(false);
  const [savingProductionLinks, setSavingProductionLinks] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [notificationEvent, setNotificationEvent] = useState('order_created');
  const [internalNotesDraft, setInternalNotesDraft] = useState('');
  const [shipmentDraft, setShipmentDraft] = useState({
    shipmentStatus: 'not_ready',
    courierName: '',
    trackingNumber: '',
    trackingUrl: '',
    shippedAt: '',
    deliveredAt: '',
    packingNotes: '',
  });
  const [productionLinksDraft, setProductionLinksDraft] = useState({
    batchReference: '',
    materialReferences: '',
    notes: '',
  });

  const setShipmentFromOrder = (nextOrder) => {
    setShipmentDraft({
      shipmentStatus: nextOrder?.shipmentStatus || 'not_ready',
      courierName: nextOrder?.courierName || '',
      trackingNumber: nextOrder?.trackingNumber || '',
      trackingUrl: nextOrder?.trackingUrl || '',
      shippedAt: nextOrder?.shippedAt ? nextOrder.shippedAt.slice(0, 16) : '',
      deliveredAt: nextOrder?.deliveredAt ? nextOrder.deliveredAt.slice(0, 16) : '',
      packingNotes: nextOrder?.packingNotes || '',
    });
  };

  const setProductionLinksFromOrder = (nextOrder) => {
    setProductionLinksDraft({
      batchReference: nextOrder?.productionLinks?.batchReference || '',
      materialReferences: nextOrder?.productionLinks?.materialReferences || '',
      notes: nextOrder?.productionLinks?.notes || '',
    });
  };

  const loadOrder = async () => {
    setLoading(true);
    try {
      const nextOrder = await getOrderById(orderId);
      const nextPaymentLogs = await getOrderPaymentLogs(orderId);
      setOrder(nextOrder);
      setPaymentLogs(nextPaymentLogs);
      setInternalNotesDraft(nextOrder?.internalNotes || '');
      setShipmentFromOrder(nextOrder);
      setProductionLinksFromOrder(nextOrder);
    } catch (error) {
      setOrder(null);
      setPaymentLogs([]);
      toast.error(error.message || 'Failed to load order detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const bespoke = isBespokeOrder(order);
  const bespokeItem = getBespokeItem(order);
  const noteRows = useMemo(() => parseNoteLines(order?.notes), [order?.notes]);
  const activeStep = getActiveStep(order?.status);
  const bespokeProductionStatus = order?.bespokeProductionStatus || 'review_brief';
  const bespokeProductionStep = getBespokeProductionStep(bespokeProductionStatus);
  const timeline = order?.statusTimeline?.length
    ? order.statusTimeline
    : [
      { status: 'pending_payment', label: statusLabels.pending_payment, note: 'Order created', at: order?.createdAt },
      ...(activeStep >= 1 ? statusSteps.slice(1, activeStep + 1).map((status) => ({ status, label: statusLabels[status], note: '', at: order?.updatedAt })) : []),
    ];

  const handleStatusChange = async (status) => {
    try {
      const orderKey = order.id || order.orderNumber;
      const nextOrders = await updateOrderStatus(orderKey, status);
      const nextOrder = nextOrders.find((item) => item.id === order.id || item.orderNumber === order.orderNumber) || await getOrderById(orderId);
      setOrder(nextOrder);
      setPaymentLogs(await getOrderPaymentLogs(orderKey));
      toast.success('Order status updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update order status');
    }
  };

  const saveInternalNotes = async () => {
    setSavingNotes(true);
    try {
      const nextOrder = await updateOrderInternalNotes(order.id || order.orderNumber, internalNotesDraft);
      setOrder(nextOrder || order);
      toast.success('Internal notes saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save internal notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const saveShipment = async () => {
    setSavingShipment(true);
    try {
      const nextOrder = await updateOrderShipment(order.id || order.orderNumber, {
        ...shipmentDraft,
        shippedAt: shipmentDraft.shippedAt ? new Date(shipmentDraft.shippedAt).toISOString() : '',
        deliveredAt: shipmentDraft.deliveredAt ? new Date(shipmentDraft.deliveredAt).toISOString() : '',
      });
      setOrder(nextOrder || order);
      setShipmentFromOrder(nextOrder || order);
      toast.success('Shipment saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save shipment');
    } finally {
      setSavingShipment(false);
    }
  };

  const saveBespokeProductionStatus = async (productionStatus) => {
    setSavingBespokeProduction(true);
    try {
      const nextOrder = await updateOrderBespokeProductionStatus(order.id || order.orderNumber, productionStatus);
      setOrder(nextOrder || order);
      toast.success('Bespoke workflow updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update bespoke workflow');
    } finally {
      setSavingBespokeProduction(false);
    }
  };

  const saveProductionLinks = async () => {
    setSavingProductionLinks(true);
    try {
      const nextOrder = await updateOrderProductionLinks(order.id || order.orderNumber, productionLinksDraft);
      setOrder(nextOrder || order);
      setProductionLinksFromOrder(nextOrder || order);
      toast.success('Production linkage saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save production linkage');
    } finally {
      setSavingProductionLinks(false);
    }
  };

  const syncDokuStatus = async () => {
    if (!order?.orderNumber) return;

    setSyncingPayment(true);
    try {
      const result = await refreshDokuPaymentStatus(order.orderNumber);
      const nextOrder = await getOrderById(order.id || order.orderNumber);
      setOrder(nextOrder || order);
      setPaymentLogs(await getOrderPaymentLogs(order.id || order.orderNumber));
      const statusLabel = paymentStatusLabels[result.paymentStatus] || result.paymentStatus || 'checked';
      if (result.syncApplied) {
        toast.success(`DOKU synced: ${statusLabel}`);
      } else {
        toast.warning(result.syncWarning || 'DOKU checked, but order was not updated');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to sync DOKU status');
    } finally {
      setSyncingPayment(false);
    }
  };

  const exportShippingLabel = () => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    exportShippingLabelPdf(order);
    toast.success('Resi PDF prepared');
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(order?.checkoutDraft || order?.notes || '');
      toast.success('Order draft copied');
    } catch (error) {
      toast.error(error.message || 'Failed to copy order draft');
    }
  };

  const notificationMessage = useMemo(
    () => buildNotificationMessage(order, notificationEvent),
    [notificationEvent, order],
  );

  const copyNotification = async () => {
    try {
      await navigator.clipboard.writeText(notificationMessage);
      toast.success('Notification copied');
    } catch (error) {
      toast.error(error.message || 'Failed to copy notification');
    }
  };

  const openWhatsAppNotification = () => {
    window.open(getWhatsAppNotificationUrl(order, notificationMessage), '_blank', 'noopener,noreferrer');
  };

  const openEmailNotification = () => {
    window.location.href = getEmailNotificationUrl(order, notificationEvent, notificationMessage);
  };

  const openFormulaHandoff = () => {
    navigate(`/mobile/formulas/new?${buildOrderFormulaParams(order, bespokeItem)}`);
  };

  if (loading) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <main className="mobile-page">
          <div className="mobile-card p-5 text-center text-xs font-bold text-[#6b7280]">Loading order detail...</div>
        </main>
      </MobileAuthenticatedLayout>
    );
  }

  if (!order) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <main className="mobile-page space-y-4">
          <MobileTopBar title="Order not found" subtitle="Studio orders" eyebrow="E-commerce" action={<PackageCheck className="h-5 w-5 text-amber-700" />} />
          <Button type="button" className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/studio/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Button>
        </main>
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet><title>{order.orderNumber} - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title={order.orderNumber}
          subtitle={formatDate(order.createdAt)}
          eyebrow="Order detail"
          action={<PackageCheck className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Current status</div>
              <h1 className="mt-1 text-2xl font-bold text-[#0b130c]">{statusLabels[order.status] || order.status}</h1>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.quantity} items / {formatTotal(order.subtotal)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${getPaymentTone(order.paymentStatus)}`}>
              {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {statusSteps.map((step, index) => {
              const done = activeStep >= index;
              return (
                <div key={step} className="min-w-0">
                  <div className={`h-1.5 rounded-full ${done ? 'bg-[#263d27]' : 'bg-stone-200'}`} />
                  <div className={`mt-1 truncate text-[8px] font-bold uppercase ${done ? 'text-[#263d27]' : 'text-[#8b949e]'}`}>{statusLabels[step]}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <UserRound className="h-4 w-4" />
            Customer
          </div>
          <h2 className="text-lg font-bold text-[#0b130c]">{order.customerName}</h2>
          <p className="mt-1 text-sm font-semibold text-[#6b7280]">{order.contact}</p>
          {order.customerCode ? <p className="mt-2 w-fit rounded-full bg-[#eef2e8] px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">{order.customerCode}</p> : null}
          {noteRows.length ? (
            <div className="mt-3 grid gap-2">
              {noteRows.map((row) => (
                <div key={`${row.label}-${row.value}`} className="rounded-2xl bg-[#f8f7f4] px-3 py-2 text-xs font-semibold">
                  <span className="text-[#6b7280]">{row.label}: </span>
                  <span className="text-[#1f2937]">{row.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <CreditCard className="h-4 w-4" />
            Payment
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#f8f7f4] p-3">
              <div className="text-[10px] font-bold uppercase text-[#6b7280]">Provider</div>
              <div className="mt-1 text-sm font-bold text-[#0b130c]">{order.paymentProvider || 'manual'}</div>
            </div>
            <div className="rounded-2xl bg-[#f8f7f4] p-3">
              <div className="text-[10px] font-bold uppercase text-[#6b7280]">Reference</div>
              <div className="mt-1 truncate text-sm font-bold text-[#0b130c]">{order.paymentReference || '-'}</div>
            </div>
          </div>
          {order.paymentUrl && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
            <Button type="button" className="mt-3 h-11 w-full rounded-2xl gap-2" onClick={() => navigate(`/mobile/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`)}>
              <CreditCard className="h-4 w-4" />
              Continue payment
            </Button>
          ) : null}
          {order.paymentUrl ? (
            <Button type="button" variant="outline" className="mt-2 h-11 w-full rounded-2xl bg-white gap-2" onClick={() => window.open(order.paymentUrl, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="h-4 w-4" />
              Open DOKU URL
            </Button>
          ) : null}
          {order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
            <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-2xl bg-white gap-2" onClick={syncDokuStatus} disabled={syncingPayment}>
              {syncingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync DOKU status
            </Button>
          ) : null}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
              <PackageCheck className="h-4 w-4" />
              Inventory linkage
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${order.inventoryDeducted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {order.inventoryDeducted ? 'Reserved' : 'Waiting checkout'}
            </span>
          </div>
          {order.inventoryEvents?.length ? (
            <div className="grid gap-2">
              {order.inventoryEvents.map((event, index) => (
                <div key={`${event.productId}-${event.variantId}-${index}`} className="rounded-2xl bg-[#f8f7f4] px-3 py-2">
                  <div className="text-xs font-bold text-[#0b130c]">{event.productName}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">
                    {event.direction === 'in' || event.type === 'restore' ? '+' : '-'}{event.quantity} stok {event.size ? `/ ${event.size}` : ''} / {formatDate(event.at)}
                  </div>
                  {event.batchKey || event.formulaId || event.sku ? (
                    <div className="mt-1 text-[10px] font-semibold text-[#263d27]">
                      {[event.batchKey ? `Batch ${event.batchKey}` : '', event.formulaId ? `Formula ${event.formulaId}` : '', event.sku ? `SKU ${event.sku}` : ''].filter(Boolean).join(' / ')}
                    </div>
                  ) : null}
                  {event.movement ? <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">{event.movement}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold leading-relaxed text-[#6b7280]">
              Stok produk ready di-reserve saat checkout tersimpan untuk mencegah oversell. Jika payment gagal, expired, refunded, atau order dibatalkan, stok dikembalikan otomatis.
            </p>
          )}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <MessageCircle className="h-4 w-4" />
            Notification templates
          </div>
          <select
            value={notificationEvent}
            onChange={(event) => setNotificationEvent(event.target.value)}
            className="h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
          >
            {Object.entries(notificationEventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea
            value={notificationMessage}
            readOnly
            rows={8}
            className="mt-3 w-full rounded-2xl border border-[#e5e7eb] bg-[#f8f7f4] px-3 py-3 text-xs font-semibold leading-relaxed text-[#1f2937] outline-none"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={copyNotification}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button type="button" className="h-11 rounded-2xl gap-1 text-xs" onClick={openWhatsAppNotification}>
              <MessageCircle className="h-4 w-4" />
              WA
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-1 text-xs" onClick={openEmailNotification} disabled={!canSendEmailNotification(order)}>
              <Mail className="h-4 w-4" />
              Email
            </Button>
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Manual dulu: copy template, kirim WhatsApp, atau buka email draft. Format ini siap dipakai nanti untuk automation penuh.
          </p>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
              <History className="h-4 w-4" />
              Payment log DOKU
            </div>
            <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">
              {paymentLogs.length} logs
            </span>
          </div>
          {paymentLogs.length ? (
            <div className="grid gap-2">
              {paymentLogs.map((log) => (
                <article key={log.id} className="rounded-2xl bg-[#f8f7f4] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0b130c]">
                        {log.transactionStatus || 'Callback'}
                        {log.mappedPaymentStatus ? ` / ${paymentStatusLabels[log.mappedPaymentStatus] || log.mappedPaymentStatus}` : ''}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{formatDate(log.receivedAt)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase ${getPaymentLogTone(log.processingStatus)}`}>
                      {log.processingStatus}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[10px] font-semibold text-[#6b7280]">
                    <div>Request: <span className="text-[#1f2937]">{log.requestId || '-'}</span></div>
                    <div>HTTP: <span className="text-[#1f2937]">{log.httpStatus || '-'}</span> / Signature: <span className="text-[#1f2937]">{log.signatureValid === false ? 'invalid' : log.signatureValid === true ? 'valid' : '-'}</span></div>
                    {log.errorMessage ? <div className="text-rose-700">{log.errorMessage}</div> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d9ded3] bg-[#f8f7f4] p-4 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Belum ada callback DOKU untuk order ini. Kalau customer sudah bayar tapi status belum berubah, bagian ini bisa dipakai untuk cek apakah webhook terlambat atau gagal masuk.
            </div>
          )}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <Truck className="h-4 w-4" />
            Shipment / Resi
          </div>
          <div className="grid gap-2">
            <select
              value={shipmentDraft.shipmentStatus}
              onChange={(event) => setShipmentDraft((current) => ({ ...current, shipmentStatus: event.target.value }))}
              className="h-11 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
            >
              {Object.entries(shipmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input
              value={shipmentDraft.courierName}
              onChange={(event) => setShipmentDraft((current) => ({ ...current, courierName: event.target.value }))}
              placeholder="Kurir, contoh: JNE / J&T / Paxel"
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <input
              value={shipmentDraft.trackingNumber}
              onChange={(event) => setShipmentDraft((current) => ({ ...current, trackingNumber: event.target.value }))}
              placeholder="Nomor resi"
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <input
              value={shipmentDraft.trackingUrl}
              onChange={(event) => setShipmentDraft((current) => ({ ...current, trackingUrl: event.target.value }))}
              placeholder="Tracking link opsional"
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Tanggal kirim
                <input
                  type="datetime-local"
                  value={shipmentDraft.shippedAt}
                  onChange={(event) => setShipmentDraft((current) => ({ ...current, shippedAt: event.target.value }))}
                  className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-xs font-semibold outline-none focus:border-amber-300"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase text-[#6b7280]">
                Delivered
                <input
                  type="datetime-local"
                  value={shipmentDraft.deliveredAt}
                  onChange={(event) => setShipmentDraft((current) => ({ ...current, deliveredAt: event.target.value }))}
                  className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-xs font-semibold outline-none focus:border-amber-300"
                />
              </label>
            </div>
            <textarea
              value={shipmentDraft.packingNotes}
              onChange={(event) => setShipmentDraft((current) => ({ ...current, packingNotes: event.target.value }))}
              rows={3}
              placeholder="Catatan packing..."
              className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <Button type="button" className="h-11 rounded-2xl gap-2" onClick={saveShipment} disabled={savingShipment}>
              <Send className="h-4 w-4" />
              {savingShipment ? 'Saving...' : 'Save shipment'}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={exportShippingLabel} disabled={!canExportShippingLabel(order)}>
              <Download className="h-4 w-4" />
              Resi PDF
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-[#0b130c]">Items</h2>
          {order.items.map((item) => (
            <article key={`${order.orderNumber}-${item.slug || item.name}`} className="mobile-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#0b130c]">{item.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">Qty {item.quantity} / {item.size || '-'}</p>
                </div>
                <div className="shrink-0 text-sm font-bold text-amber-700">{item.price || formatTotal(item.priceNumber)}</div>
              </div>
            </article>
          ))}
        </section>

        {bespoke ? (
          <section className="mobile-card border border-[#263d27]/10 bg-[#eef2e8] p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
              <Sparkles className="h-4 w-4" />
              Bespoke brief
            </div>
            <div className="grid gap-2">
              {bespokeDetailRows(bespokeItem).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[76px_1fr] gap-2 text-xs font-semibold leading-snug">
                  <span className="text-[#6b7280]">{label}</span>
                  <span className="text-[#1f2937]">{value}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {bespoke ? (
          <section className="mobile-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
                <Sparkles className="h-4 w-4" />
                Bespoke production
              </div>
              <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">
                {bespokeProductionStatusLabels[bespokeProductionStatus] || bespokeProductionStatus}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {bespokeProductionSteps.map((step, index) => {
                const done = bespokeProductionStep >= index;
                return (
                  <div key={step} className="min-w-0">
                    <div className={`h-1.5 rounded-full ${done ? 'bg-[#263d27]' : 'bg-stone-200'}`} />
                    <div className={`mt-1 truncate text-[7px] font-bold uppercase ${done ? 'text-[#263d27]' : 'text-[#8b949e]'}`}>
                      {bespokeProductionStatusLabels[step]}
                    </div>
                  </div>
                );
              })}
            </div>
            <select
              value={bespokeProductionStatus}
              onChange={(event) => saveBespokeProductionStatus(event.target.value)}
              disabled={savingBespokeProduction}
              className="mt-3 h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold outline-none focus:border-amber-300"
            >
              {Object.entries(bespokeProductionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {order.bespokeProductionTimeline?.length ? (
              <div className="mt-3 grid gap-2">
                {order.bespokeProductionTimeline.map((entry, index) => (
                  <div key={`${entry.status}-${entry.at}-${index}`} className="rounded-2xl bg-[#f8f7f4] px-3 py-2">
                    <div className="text-xs font-bold text-[#0b130c]">{entry.label}</div>
                    <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{formatDate(entry.at)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <Sparkles className="h-4 w-4" />
            Production linkage
          </div>
          {bespoke ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={openFormulaHandoff}>
                <FlaskConical className="h-4 w-4" />
                {order.productionLinks?.formulaId ? 'New formula' : 'Create formula'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl bg-white gap-2 text-xs font-bold"
                onClick={() => navigate(`/mobile/batches?formulaId=${encodeURIComponent(order.productionLinks.formulaId)}`)}
                disabled={!order.productionLinks?.formulaId}
              >
                <Factory className="h-4 w-4" />
                Open batch
              </Button>
            </div>
          ) : null}
          {order.productionLinks?.formulaId ? (
            <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[10px] font-bold uppercase text-emerald-700">Formula linked</div>
              <div className="mt-1 text-sm font-bold text-[#1f2937]">{order.productionLinks.formulaName || order.productionLinks.formulaCode || order.productionLinks.formulaId}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" size="sm" className="h-9 rounded-xl text-xs" onClick={() => navigate(`/mobile/formulas/${order.productionLinks.formulaId}`)}>Open formula</Button>
                <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl bg-white text-xs" onClick={() => navigate(`/mobile/batches?formulaId=${encodeURIComponent(order.productionLinks.formulaId)}`)}>Batch</Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <input
              value={productionLinksDraft.batchReference}
              onChange={(event) => setProductionLinksDraft((current) => ({ ...current, batchReference: event.target.value }))}
              placeholder="Batch / formula reference"
              className="h-11 rounded-2xl border border-[#e5e7eb] px-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <textarea
              value={productionLinksDraft.materialReferences}
              onChange={(event) => setProductionLinksDraft((current) => ({ ...current, materialReferences: event.target.value }))}
              rows={3}
              placeholder="Material terkait, satu baris per material..."
              className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <textarea
              value={productionLinksDraft.notes}
              onChange={(event) => setProductionLinksDraft((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              placeholder="Catatan linkage produksi..."
              className="rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
            />
            <Button type="button" className="h-11 rounded-2xl gap-2" onClick={saveProductionLinks} disabled={savingProductionLinks}>
              <Save className="h-4 w-4" />
              {savingProductionLinks ? 'Saving...' : 'Save linkage'}
            </Button>
          </div>
          {order.productionLinks?.updatedAt ? (
            <p className="mt-2 text-[10px] font-semibold text-[#6b7280]">Updated {formatDate(order.productionLinks.updatedAt)}</p>
          ) : null}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
            <NotebookPen className="h-4 w-4" />
            Internal notes
          </div>
          <textarea
            value={internalNotesDraft}
            onChange={(event) => setInternalNotesDraft(event.target.value)}
            rows={4}
            placeholder="Catatan internal untuk packing, follow up, atau produksi..."
            className="w-full rounded-2xl border border-[#e5e7eb] px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
          />
          <Button type="button" className="mt-3 h-11 w-full rounded-2xl gap-2" onClick={saveInternalNotes} disabled={savingNotes}>
            <Save className="h-4 w-4" />
            {savingNotes ? 'Saving...' : 'Save notes'}
          </Button>
        </section>

        <section className="mobile-card p-4">
          <h2 className="text-base font-bold text-[#0b130c]">Status timeline</h2>
          <div className="mt-3 grid gap-3">
            {timeline.map((entry, index) => (
              <div key={`${entry.status}-${entry.at}-${index}`} className="grid grid-cols-[28px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full bg-[#263d27]" />
                  {index < timeline.length - 1 ? <span className="mt-1 h-full min-h-8 w-px bg-[#d9ded3]" /> : null}
                </div>
                <div className="rounded-2xl bg-[#f8f7f4] px-3 py-2">
                  <div className="text-xs font-bold text-[#0b130c]">{entry.label}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{formatDate(entry.at)}</div>
                  {entry.note ? <div className="mt-1 text-xs font-semibold text-[#1f2937]">{entry.note}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/studio/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Button>
          <Button type="button" className="h-11 rounded-2xl gap-2" onClick={copyDraft}>
            <Clipboard className="h-4 w-4" />
            Copy draft
          </Button>
        </section>

        <section className="mobile-card p-4">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">Update status</div>
          <select value={order.status} onChange={(event) => handleStatusChange(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </section>
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileOrderDetailPage;
