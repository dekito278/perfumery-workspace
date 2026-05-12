import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clipboard, Copy, CreditCard, Download, ExternalLink, Factory, FileCheck2, FlaskConical, History, Loader2, Mail, MessageCircle, NotebookPen, PackageCheck, RefreshCw, Save, Send, Sparkles, Truck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import {
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderAuditLogs,
  getOrderById,
  getOrderPaymentLogs,
  getOrderStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
  reviewOrderPaymentProof,
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
import { createPaymentProofSignedUrl } from '@/services/paymentProofStorageService.js';
import { logMobileRenderIssue } from '@/utils/mobileRenderMonitoring.js';

const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

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
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Refund',
};
const paymentProofStatusLabels = {
  missing: 'Belum upload bukti',
  submitted: 'Bukti terkirim',
  approved: 'Bukti disetujui',
  rejected: 'Bukti ditolak',
};
const paymentProofToneByStatus = {
  missing: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};
const notificationEventLabels = getNotificationEventLabels();
const paymentProofAuditLabels = {
  payment_proof_uploaded: 'Bukti diupload',
  payment_proof_approved: 'Bukti disetujui',
  payment_proof_rejected: 'Bukti ditolak',
  payment_proof_reviewed: 'Bukti direview',
};
const paymentProofAuditActions = Object.keys(paymentProofAuditLabels);

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

const getProofTimeline = (logs = []) => logs
  .filter((log) => paymentProofAuditActions.includes(log.action))
  .map((log, index, proofLogs) => {
    const nextValues = log.nextValues || {};
    const previousValues = log.previousValues || {};
    const status = nextValues.paymentProofStatus || nextValues.payment_proof_status || (
      log.action === 'payment_proof_uploaded'
        ? 'submitted'
        : log.action === 'payment_proof_approved'
          ? 'approved'
          : log.action === 'payment_proof_rejected'
            ? 'rejected'
            : ''
    );
    return {
      id: log.id,
      attempt: proofLogs.length - index,
      label: paymentProofAuditLabels[log.action] || log.action,
      at: log.createdAt,
      actor: log.actorName || log.actorEmail || 'System',
      status,
      notes: nextValues.paymentProofNotes || nextValues.payment_proof_notes || log.metadata?.reason || '',
      fileName: nextValues.paymentProofFileName || nextValues.payment_proof_file_name || log.metadata?.fileName || '',
      filePath: nextValues.paymentProofUrl || nextValues.payment_proof_url || '',
      previousStatus: previousValues.paymentProofStatus || previousValues.payment_proof_status || '',
    };
  });

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
  const [savingPaymentProof, setSavingPaymentProof] = useState(false);
  const [savingBespokeProduction, setSavingBespokeProduction] = useState(false);
  const [savingProductionLinks, setSavingProductionLinks] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState('');
  const [loadingPaymentProof, setLoadingPaymentProof] = useState(false);
  const [rejectProofOpen, setRejectProofOpen] = useState(false);
  const [rejectProofNotes, setRejectProofNotes] = useState('');
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
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
      const [nextPaymentLogs, nextAuditLogs] = await Promise.all([
        getOrderPaymentLogs(orderId),
        getOrderAuditLogs(orderId),
      ]);
      setOrder(nextOrder);
      setPaymentLogs(nextPaymentLogs);
      setAuditLogs(nextAuditLogs);
      setInternalNotesDraft(nextOrder?.internalNotes || '');
      setShipmentFromOrder(nextOrder);
      setProductionLinksFromOrder(nextOrder);
    } catch (error) {
      setOrder(null);
      setPaymentLogs([]);
      setAuditLogs([]);
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
  const hasPaymentProofPath = Boolean(order?.paymentProofUrl);
  const paymentProofStatus = order?.paymentProofStatus || 'missing';
  const paymentProofIsImage = String(order?.paymentProofContentType || '').startsWith('image/');
  const proofTimeline = useMemo(() => getProofTimeline(auditLogs), [auditLogs]);
  const timeline = order?.statusTimeline?.length
    ? order.statusTimeline
    : [
      { status: 'pending_payment', label: statusLabels.pending_payment, note: 'Order created', at: order?.createdAt },
      ...(activeStep >= 1 ? statusSteps.slice(1, activeStep + 1).map((status) => ({ status, label: statusLabels[status], note: '', at: order?.updatedAt })) : []),
    ];

  useEffect(() => {
    let cancelled = false;

    const loadPaymentProofPreview = async () => {
      if (!order?.paymentProofUrl) {
        setPaymentProofPreviewUrl('');
        return;
      }

      setLoadingPaymentProof(true);
      try {
        const nextUrl = /^https?:\/\//i.test(order.paymentProofUrl)
          ? order.paymentProofUrl
          : await createPaymentProofSignedUrl(order.paymentProofUrl);
        if (!cancelled) setPaymentProofPreviewUrl(nextUrl);
      } catch (error) {
        if (!cancelled) {
          setPaymentProofPreviewUrl('');
          toast.error(error.message || 'Gagal membuka bukti transfer');
        }
      } finally {
        if (!cancelled) setLoadingPaymentProof(false);
      }
    };

    loadPaymentProofPreview();
    return () => {
      cancelled = true;
    };
  }, [order?.paymentProofUrl]);

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
      toast.error(error.message || 'Gagal menyimpan pengiriman');
    } finally {
      setSavingShipment(false);
    }
  };

  const quickShipmentUpdate = async (shipmentStatus, overrides = {}) => {
    setSavingShipment(true);
    const nextShipmentDraft = { ...shipmentDraft, ...overrides };
    try {
      const nextOrder = await updateOrderShipment(order.id || order.orderNumber, {
        ...nextShipmentDraft,
        shipmentStatus,
        shippedAt: shipmentStatus === 'shipped' ? new Date().toISOString() : nextShipmentDraft.shippedAt ? new Date(nextShipmentDraft.shippedAt).toISOString() : '',
        deliveredAt: nextShipmentDraft.deliveredAt ? new Date(nextShipmentDraft.deliveredAt).toISOString() : '',
      });
      setOrder(nextOrder || order);
      setShipmentFromOrder(nextOrder || order);
      toast.success(shipmentStatus === 'shipped' ? 'Order marked shipped' : 'Order moved to packing');
    } catch (error) {
      toast.error(error.message || 'Failed to update shipment');
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

  const openPaymentProof = async () => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti transfer belum tersedia');
      return;
    }

    try {
      const signedUrl = paymentProofPreviewUrl || (/^https?:\/\//i.test(order.paymentProofUrl)
        ? order.paymentProofUrl
        : await createPaymentProofSignedUrl(order.paymentProofUrl));
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Gagal membuka bukti transfer');
    }
  };

  const reviewPaymentProof = async (nextStatus, notes = '') => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti transfer belum tersedia');
      return;
    }

    if (nextStatus === 'rejected' && !notes.trim()) {
      toast.error('Catatan penolakan wajib diisi');
      return;
    }

    setSavingPaymentProof(true);
    try {
      const nextOrder = await reviewOrderPaymentProof(order.id || order.orderNumber, {
        paymentProofStatus: nextStatus,
        notes,
      });
      setOrder(nextOrder || order);
      setAuditLogs(await getOrderAuditLogs(order.id || order.orderNumber));
      if (nextStatus === 'rejected') {
        setRejectProofOpen(false);
        setRejectProofNotes('');
        const notificationOrder = nextOrder || { ...order, paymentProofStatus: 'rejected', paymentProofNotes: notes };
        const message = buildNotificationMessage(notificationOrder, 'payment_proof_rejected');
        try {
          await navigator.clipboard.writeText(message);
          toast.success('Template WA reject disalin', {
            action: {
              label: 'Open WA',
              onClick: () => window.open(getWhatsAppNotificationUrl(notificationOrder, message), '_blank', 'noopener,noreferrer'),
            },
          });
        } catch {
          toast.success('Template WA reject siap', {
            action: {
              label: 'Open WA',
              onClick: () => window.open(getWhatsAppNotificationUrl(notificationOrder, message), '_blank', 'noopener,noreferrer'),
            },
          });
        }
      }
      if (nextStatus === 'approved') {
        toast.success('Bukti transfer disetujui');
      }
    } catch (error) {
      toast.error(error.message || 'Gagal review bukti transfer');
    } finally {
      setSavingPaymentProof(false);
    }
  };

  const openRejectProofDialog = () => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti transfer belum tersedia');
      return;
    }
    setRejectProofNotes(order.paymentProofNotes || '');
    setRejectProofOpen(true);
  };

  const submitRejectProof = () => reviewPaymentProof('rejected', rejectProofNotes);

  const exportShippingLabel = async () => {
    if (!canExportShippingLabel(order)) {
      toast.error('Resi PDF tersedia setelah payment paid');
      return;
    }
    const { exportShippingLabelPdf } = await import('@/utils/shippingLabelPdf.js');
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

  const openSmartWhatsAppNotification = () => {
    const eventKey = order.shipmentStatus === 'shipped' || shipmentDraft.trackingNumber
      ? 'shipped'
      : order.paymentStatus === 'paid'
        ? 'paid'
        : 'order_created';
    const message = buildNotificationMessage({
      ...order,
      courierName: shipmentDraft.courierName || order.courierName,
      trackingNumber: shipmentDraft.trackingNumber || order.trackingNumber,
      trackingUrl: shipmentDraft.trackingUrl || order.trackingUrl,
    }, eventKey);
    window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer');
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
          <StateBlock
            className="mobile-card"
            tone="loading"
            title="Memuat detail order"
            description="Sebentar, data order sedang disiapkan."
          />
        </main>
      </MobileAuthenticatedLayout>
    );
  }

  if (!order) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <main className="mobile-page space-y-4">
          <MobileTopBar title="Order tidak ditemukan" subtitle="Studio orders" eyebrow="E-commerce" action={<PackageCheck className="h-5 w-5 text-amber-700" />} />
          <Button type="button" className="h-12 rounded-2xl gap-2" onClick={() => navigate('/mobile/studio/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke order
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
          eyebrow="Detail order"
          action={<PackageCheck className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Status saat ini</div>
              <h1 className="mt-1 text-2xl font-bold text-[#0b130c]">{statusLabels[order.status] || order.status}</h1>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">{order.quantity} items / {formatTotal(order.subtotal)}</p>
            </div>
            <StatusChip size="sm" tone={getPaymentStatusTone(order.paymentStatus)}>
              {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
            </StatusChip>
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusChip size="sm" tone={getPaymentStatusTone(order.paymentStatus)}>
              {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
            </StatusChip>
            <StatusChip size="sm" tone={getShipmentStatusTone(order.shipmentStatus)}>
              {shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}
            </StatusChip>
            {order.trackingNumber ? <StatusChip size="sm" tone="success">Resi siap</StatusChip> : null}
          </div>
        </section>

        <section className="mobile-card p-3">
          <div className="mb-3 text-[10px] font-bold uppercase text-[#263d27]">Aksi cepat</div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="col-span-2 h-16 rounded-2xl gap-2 text-base font-bold shadow-lg shadow-amber-100" onClick={() => quickShipmentUpdate('shipped')} disabled={savingShipment || order.paymentStatus !== 'paid'}>
              <Send className="h-5 w-5" />
              Tandai dikirim
            </Button>
            <Button type="button" variant="outline" className="h-14 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={() => quickShipmentUpdate('packing')} disabled={savingShipment || order.paymentStatus !== 'paid'}>
              <PackageCheck className="h-4 w-4" />
              Packed
            </Button>
            <Button type="button" className="h-14 rounded-2xl gap-2 text-xs font-bold" onClick={openSmartWhatsAppNotification}>
              <MessageCircle className="h-4 w-4" />
              WA customer
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={copyDraft}>
              <Clipboard className="h-4 w-4" />
              Salin draft
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={exportShippingLabel} disabled={!canExportShippingLabel(order)}>
              <Download className="h-4 w-4" />
              Resi
            </Button>
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
              Lanjut bayar
            </Button>
          ) : null}
          {order.paymentUrl ? (
            <Button type="button" variant="outline" className="mt-2 h-11 w-full rounded-2xl bg-white gap-2" onClick={() => window.open(order.paymentUrl, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="h-4 w-4" />
              Buka URL DOKU
            </Button>
          ) : null}
          {order.paymentProvider === 'doku' && ['unpaid', 'pending'].includes(order.paymentStatus) ? (
            <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-2xl bg-white gap-2" onClick={syncDokuStatus} disabled={syncingPayment}>
              {syncingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sinkron status DOKU
            </Button>
          ) : null}
          <div className="mt-3 rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-[#6b7280]">Bukti transfer</div>
                <div className="mt-2">
                  <StatusChip size="sm" tone={paymentProofToneByStatus[paymentProofStatus] || 'warning'}>
                    {paymentProofStatusLabels[paymentProofStatus] || paymentProofStatus}
                  </StatusChip>
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">
                  {hasPaymentProofPath ? 'File bukti transfer sudah tersimpan di order.' : 'Belum ada file bukti transfer.'}
                </p>
              </div>
              <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-2xl bg-white" onClick={openPaymentProof} disabled={!hasPaymentProofPath || loadingPaymentProof} aria-label="Buka bukti transfer">
                {loadingPaymentProof ? <Loader2 className="h-4 w-4 animate-spin" /> : hasPaymentProofPath ? <ExternalLink className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </Button>
            </div>
            {order.paymentProofFileName ? (
              <div className="mt-3 truncate rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#263d27]">
                {order.paymentProofFileName}
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" className="h-10 rounded-2xl gap-2 text-xs" onClick={() => reviewPaymentProof('approved')} disabled={!hasPaymentProofPath || savingPaymentProof || paymentProofStatus === 'approved'}>
                {savingPaymentProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                Approve
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2 text-xs text-rose-700" onClick={openRejectProofDialog} disabled={!hasPaymentProofPath || savingPaymentProof || paymentProofStatus === 'rejected'}>
                <AlertCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
            <div className="mt-2 grid gap-1 text-[10px] font-semibold text-[#6b7280]">
              <span>Dikirim: {formatDate(order.paymentProofUploadedAt)}</span>
              <span>Type: {order.paymentProofContentType || '-'}</span>
              {order.paymentProofNotes ? <span>Catatan: {order.paymentProofNotes}</span> : null}
            </div>
            {paymentProofPreviewUrl && paymentProofIsImage ? (
              <button type="button" onClick={openPaymentProof} className="mt-3 block aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-white text-left">
                <img
                  src={paymentProofPreviewUrl}
                  alt={`Bukti transfer ${order.orderNumber}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                  width="640"
                  height="480"
                  onError={() => logMobileRenderIssue('image-load-failed', {
                    source: 'payment-proof-preview',
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                  })}
                />
              </button>
            ) : null}
            {paymentProofPreviewUrl && !paymentProofIsImage ? (
              <button type="button" onClick={openPaymentProof} className="mt-3 flex w-full items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-left text-xs font-bold text-[#263d27]">
                <FileCheck2 className="h-4 w-4" />
                File siap dibuka
              </button>
            ) : null}
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
              <FileCheck2 className="h-4 w-4" />
              Timeline bukti
            </div>
            <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[10px] font-bold uppercase text-[#263d27]">{proofTimeline.length} event</span>
          </div>
          {proofTimeline.length ? (
            <div className="grid gap-2">
              {proofTimeline.map((event) => (
                <article key={event.id} className="rounded-2xl bg-[#f8f7f4] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0b130c]">{event.label}</div>
                      <div className="mt-1 text-[10px] font-semibold text-[#6b7280]">{formatDate(event.at)} / {event.actor}</div>
                    </div>
                    <StatusChip size="sm" tone={paymentProofToneByStatus[event.status] || 'warning'}>
                      {paymentProofStatusLabels[event.status] || event.status || `Attempt ${event.attempt}`}
                    </StatusChip>
                  </div>
                  <div className="mt-2 grid gap-1 text-[10px] font-semibold text-[#6b7280]">
                    <span>Attempt: {event.attempt}</span>
                    {event.previousStatus ? <span>Previous: {paymentProofStatusLabels[event.previousStatus] || event.previousStatus}</span> : null}
                    {event.fileName ? <span>File: {event.fileName}</span> : null}
                    {event.filePath ? <span className="break-all">Path: {event.filePath}</span> : null}
                    {event.notes ? <span className="rounded-xl bg-white px-2 py-1 text-rose-700">Catatan: {event.notes}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-[#f8f7f4] px-3 py-3 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Belum ada history upload, approve, atau reject bukti transfer.
            </p>
          )}
        </section>

        <section className="mobile-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#263d27]">
              <PackageCheck className="h-4 w-4" />
              Link inventory
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${order.inventoryDeducted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {order.inventoryDeducted ? 'Reserved' : 'Menunggu checkout'}
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
              Log payment DOKU
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
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const trackingNumber = String(event.currentTarget.value || '').trim();
                if (!trackingNumber) return;
                setShipmentDraft((current) => ({ ...current, trackingNumber, shipmentStatus: current.shipmentStatus === 'shipped' ? 'shipped' : 'packing' }));
                quickShipmentUpdate(shipmentDraft.shipmentStatus === 'shipped' ? 'shipped' : 'packing', { trackingNumber });
              }}
              placeholder="Nomor resi"
              className="h-14 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-base font-bold tracking-[0.04em] outline-none focus:border-amber-400"
              autoCapitalize="characters"
              enterKeyHint="done"
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
                Terkirim
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
              {savingShipment ? 'Menyimpan...' : 'Simpan pengiriman'}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={exportShippingLabel} disabled={!canExportShippingLabel(order)}>
              <Download className="h-4 w-4" />
              Resi PDF
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-[#0b130c]">Item</h2>
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
      <Dialog open={rejectProofOpen} onOpenChange={setRejectProofOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-[26px] p-5">
          <DialogHeader>
            <DialogTitle>Reject bukti transfer</DialogTitle>
            <DialogDescription className="not-sr-only text-sm font-semibold leading-relaxed text-[#6b7280]">
              Alasan ini akan tampil untuk customer dan order tetap pending.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="mobile-reject-proof-notes" className="text-[10px] font-bold uppercase text-[#6b7280]">
              Alasan penolakan
            </label>
            <textarea
              id="mobile-reject-proof-notes"
              value={rejectProofNotes}
              onChange={(event) => setRejectProofNotes(event.target.value)}
              rows={5}
              className="min-h-32 rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
              placeholder="Contoh: Nominal transfer belum sesuai total order."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => setRejectProofOpen(false)} disabled={savingPaymentProof}>
              Batal
            </Button>
            <Button type="button" className="rounded-2xl bg-rose-700 text-white hover:bg-rose-800" onClick={submitRejectProof} disabled={savingPaymentProof || !rejectProofNotes.trim()}>
              {savingPaymentProof ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertCircle className="mr-2 h-4 w-4" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileAuthenticatedLayout>
  );
};

export default MobileOrderDetailPage;
