import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Clipboard,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  PackageCheck,
  Printer,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import StateBlock from '@/components/ui/state-block.jsx';
import StatusChip, { getOrderStatusTone, getPaymentStatusTone, getShipmentStatusTone } from '@/components/ui/status-chip.jsx';
import { refreshDokuPaymentStatus } from '@/services/dokuCheckoutService.js';
import {
  getOrderAuditLogs,
  getOrderById,
  getBespokeItem,
  getBespokeProductionStatusLabels,
  getOrderPaymentLogs,
  getOrderReservationExpiresAt,
  getOrderStatusLabels,
  getShipmentStatusLabels,
  isBespokeOrder,
  PAYMENT_RESERVATION_TTL_HOURS,
  reviewOrderPaymentProof,
  updateOrderInternalNotes,
  updateOrderPaymentStatus,
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
import { buildPublicTrackingUrl } from '@/services/publicTrackingService.js';
import { createPaymentProofSignedUrl } from '@/services/paymentProofStorageService.js';
import {
  getOrderProductItems,
  getOrderProductsSubtotal,
  getOrderShippingFee,
  getOrderSubtotalAfterVoucher,
  getOrderVoucherSnapshot,
} from '@/utils/orderTotals.js';
import { getDiscountedVoucherCartLines } from '@/utils/cartVoucherPricing.js';
import {
  getBespokeOrderSummary,
  hasShippingLabelPrinted,
  isArchivedOrder,
  isShippedOrder,
} from '@/utils/orderWorkflow.js';

const canExportShippingLabel = (order) => Boolean(
  order
    && order.paymentStatus === 'paid'
    && !['cancelled'].includes(order.status)
);

const statusLabels = getOrderStatusLabels();
const shipmentStatusLabels = getShipmentStatusLabels();
const bespokeProductionStatusLabels = getBespokeProductionStatusLabels();
const notificationEventLabels = getNotificationEventLabels();
const statusSteps = ['pending_payment', 'paid', 'processing', 'shipped', 'completed'];

const paymentStatusLabels = {
  unpaid: 'Belum dibayar',
  pending: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  failed: 'Gagal',
  expired: 'Expired',
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

const auditActionLabels = {
  order_status_updated: 'Status order',
  payment_status_updated: 'Status pembayaran',
  payment_proof_uploaded: 'Bukti diupload',
  payment_proof_approved: 'Bukti disetujui',
  payment_proof_rejected: 'Bukti ditolak',
  payment_proof_reviewed: 'Bukti direview',
  shipment_updated: 'Fulfillment / resi',
  order_cancelled: 'Order dibatalkan',
  order_deleted: 'Order dihapus',
};

const formatTotal = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const formatDate = (value) => (value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-');

const getLogTone = (status) => {
  if (status === 'applied') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ignored') return 'bg-amber-50 text-amber-700';
  if (['rejected', 'error'].includes(status)) return 'bg-rose-50 text-rose-700';
  return 'bg-stone-100 text-stone-600';
};

const formatAuditValues = (values = {}) => (
  Object.entries(values || {})
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' / ') || '-'
);

const formatAuditValue = (value) => {
  if (value === '' || value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatAuditLabel = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .replace(/^./, (char) => char.toUpperCase());

const getAuditChanges = (previousValues = {}, nextValues = {}) => {
  const keys = Array.from(new Set([...Object.keys(previousValues || {}), ...Object.keys(nextValues || {})]));
  return keys
    .filter((key) => formatAuditValue(previousValues?.[key]) !== formatAuditValue(nextValues?.[key]))
    .map((key) => ({
      key,
      label: formatAuditLabel(key),
      before: formatAuditValue(previousValues?.[key]),
      after: formatAuditValue(nextValues?.[key]),
    }));
};

const importantAuditKeys = ['paymentStatus', 'status', 'shipmentStatus', 'trackingNumber', 'payment_status', 'shipment_status', 'tracking_number'];
const paymentProofAuditActions = ['payment_proof_uploaded', 'payment_proof_approved', 'payment_proof_rejected', 'payment_proof_reviewed'];

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
      action: log.action,
      label: auditActionLabels[log.action] || log.action,
      at: log.createdAt,
      actor: log.actorName || log.actorEmail || 'System',
      status,
      notes: nextValues.paymentProofNotes || nextValues.payment_proof_notes || log.metadata?.reason || '',
      fileName: nextValues.paymentProofFileName || nextValues.payment_proof_file_name || log.metadata?.fileName || '',
      filePath: nextValues.paymentProofUrl || nextValues.payment_proof_url || '',
      previousStatus: previousValues.paymentProofStatus || previousValues.payment_proof_status || '',
    };
  });

const parseNoteLines = (notes = '') => String(notes || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [label, ...rest] = line.split(':');
    return { label: label || 'Note', value: rest.join(':').trim() || '-' };
  });

const getNoteValue = (rows, label) => (
  rows.find((row) => row.label.toLowerCase() === label.toLowerCase())?.value || ''
);

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

const getNextOperationalTask = (order, bespoke) => {
  if (!order) return { title: 'Review order', helper: 'Buka order dan cek data terbaru.' };
  if (order.paymentProofStatus === 'submitted') {
    return { title: 'Review bukti transfer', helper: 'Buka bukti, approve atau reject dengan catatan.' };
  }
  if (order.paymentStatus !== 'paid') {
    return { title: 'Tuntaskan pembayaran', helper: 'Follow-up pembayaran atau sinkron DOKU bila perlu.' };
  }
  if (bespoke && order.bespokeProductionStatus !== 'ready') {
    return { title: 'Lanjutkan produksi bespoke', helper: 'Update brief, formula, sample, sampai status Ready.' };
  }
  if (!hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order)) {
    return { title: 'Cetak resi PDF', helper: 'Setelah dicetak, order masuk antrean Label/resi.' };
  }
  if (hasShippingLabelPrinted(order) && !order.trackingNumber) {
    return { title: 'Lengkapi nomor resi', helper: 'Scan atau paste resi sebelum order ditandai dikirim.' };
  }
  if (hasShippingLabelPrinted(order)) {
    return { title: 'Packing lalu kirim', helper: 'Simpan kurir/resi dan tandai dikirim setelah paket keluar.' };
  }
  if (isShippedOrder(order) && !isArchivedOrder(order)) {
    return { title: 'Follow-up pengiriman', helper: 'Pantau tracking dan tutup order setelah delivered.' };
  }
  return { title: 'Order selesai', helper: 'Order sudah masuk arsip operasional.' };
};

const toDatetimeLocal = (value) => (value ? value.slice(0, 16) : '');
const fromDatetimeLocal = (value) => (value ? new Date(value).toISOString() : '');

const getNextOrderStatusForPayment = (paymentStatus) => {
  if (paymentStatus === 'paid') return 'paid';
  if (['failed', 'expired'].includes(paymentStatus)) return 'cancelled';
  return 'pending_payment';
};

const OrderDetailPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ admin: 'all', event: 'all', query: '' });
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingPaymentProof, setSavingPaymentProof] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState('');
  const [loadingPaymentProof, setLoadingPaymentProof] = useState(false);
  const [rejectProofOpen, setRejectProofOpen] = useState(false);
  const [rejectProofNotes, setRejectProofNotes] = useState('');
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

  const orderKey = order?.id || order?.orderNumber || orderId;
  const noteRows = useMemo(() => parseNoteLines(order?.notes), [order?.notes]);
  const address = getNoteValue(noteRows, 'Address');
  const area = getNoteValue(noteRows, 'Area');
  const shipping = getNoteValue(noteRows, 'Shipping');
  const reservationExpiresAt = getOrderReservationExpiresAt(order);
  const hasPaymentProofPath = Boolean(order?.paymentProofUrl);
  const paymentProofStatus = order?.paymentProofStatus || 'missing';
  const paymentProofIsImage = String(order?.paymentProofContentType || '').startsWith('image/');
  const activeStep = Math.max(0, statusSteps.indexOf(order?.status || 'pending_payment'));
  const timeline = order?.statusTimeline?.length
    ? order.statusTimeline
    : [
      { status: 'pending_payment', label: statusLabels.pending_payment, note: 'Order created', at: order?.createdAt },
      ...(activeStep >= 1 ? statusSteps.slice(1, activeStep + 1).map((status) => ({
        status,
        label: statusLabels[status],
        note: '',
        at: order?.updatedAt,
      })) : []),
    ];
  const notificationMessage = useMemo(
    () => buildNotificationMessage(order, notificationEvent),
    [notificationEvent, order],
  );
  const paymentReminderMessage = useMemo(() => [
    `Halo ${order?.customerName || 'Kak'},`,
    '',
    `Ini link pembayaran untuk order ${order?.orderNumber || '-'}:`,
    order?.paymentUrl || '',
    '',
    `Total: ${formatTotal(order?.subtotal)}`,
    order?.customerCode ? `Customer code: ${order.customerCode}` : '',
    '',
    'Kalau sudah dibayar, status order akan kami update. Terima kasih.',
  ].filter((line) => line !== '').join('\n'), [order]);
  const auditAdmins = useMemo(() => (
    Array.from(new Set(auditLogs.map((log) => log.actorEmail || log.actorName || 'system'))).filter(Boolean)
  ), [auditLogs]);
  const auditEvents = useMemo(() => (
    Array.from(new Set(auditLogs.map((log) => log.action))).filter(Boolean)
  ), [auditLogs]);
  const filteredAuditLogs = useMemo(() => {
    const query = auditFilters.query.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const admin = log.actorEmail || log.actorName || 'system';
      const matchesAdmin = auditFilters.admin === 'all' || admin === auditFilters.admin;
      const matchesEvent = auditFilters.event === 'all' || log.action === auditFilters.event;
      const matchesQuery = !query || [
        log.orderNumber,
        log.actorEmail,
        log.actorName,
        log.action,
        JSON.stringify(log.previousValues || {}),
        JSON.stringify(log.nextValues || {}),
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesAdmin && matchesEvent && matchesQuery;
    });
  }, [auditFilters, auditLogs]);
  const proofTimeline = useMemo(() => getProofTimeline(auditLogs), [auditLogs]);

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
          toast.error(error.message || 'Gagal membuka bukti pembayaran');
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

  const setShipmentFromOrder = (nextOrder) => {
    setShipmentDraft({
      shipmentStatus: nextOrder?.shipmentStatus || 'not_ready',
      courierName: nextOrder?.courierName || '',
      trackingNumber: nextOrder?.trackingNumber || '',
      trackingUrl: nextOrder?.trackingUrl || '',
      shippedAt: toDatetimeLocal(nextOrder?.shippedAt),
      deliveredAt: toDatetimeLocal(nextOrder?.deliveredAt),
      packingNotes: nextOrder?.packingNotes || '',
    });
  };

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const nextOrder = await getOrderById(orderId);
      const nextPaymentLogs = await getOrderPaymentLogs(orderId);
      const nextAuditLogs = await getOrderAuditLogs(orderId);
      setOrder(nextOrder);
      setPaymentLogs(nextPaymentLogs);
      setAuditLogs(nextAuditLogs);
      setInternalNotesDraft(nextOrder?.internalNotes || '');
      setShipmentFromOrder(nextOrder);
    } catch (error) {
      toast.error(error.message || 'Gagal memuat detail order');
      setOrder(null);
      setPaymentLogs([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const refreshOrder = async () => {
    const nextOrder = await getOrderById(orderKey);
    setOrder(nextOrder || order);
    const [nextPaymentLogs, nextAuditLogs] = await Promise.all([
      getOrderPaymentLogs(orderKey),
      getOrderAuditLogs(orderKey),
    ]);
    setPaymentLogs(nextPaymentLogs);
    setAuditLogs(nextAuditLogs);
    if (nextOrder) {
      setInternalNotesDraft(nextOrder.internalNotes || '');
      setShipmentFromOrder(nextOrder);
    }
    return nextOrder;
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text || '');
      toast.success(`${label} disalin`);
    } catch (error) {
      toast.error(error.message || `Gagal menyalin ${label}`);
    }
  };

  const prepareCustomerNotification = async (nextOrder, eventKey) => {
    const message = buildNotificationMessage(nextOrder, eventKey);
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      toast.success('Pesan customer disalin', {
        description: notificationEventLabels[eventKey] || 'Update order',
        action: {
          label: 'Buka WA',
          onClick: () => window.open(getWhatsAppNotificationUrl(nextOrder, message), '_blank', 'noopener,noreferrer'),
        },
      });
    } catch (error) {
      toast.success('Pesan customer siap', {
        description: 'Clipboard diblokir. Buka WhatsApp dari panel template.',
      });
    }
  };

  const updateStatus = async (status) => {
    setSavingStatus(true);
    try {
      await updateOrderStatus(orderKey, status);
      const nextOrder = await refreshOrder();
      if (['processing', 'shipped', 'completed'].includes(status)) {
        await prepareCustomerNotification(nextOrder || { ...order, status }, status);
      }
      toast.success('Status order diperbarui');
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui status order');
    } finally {
      setSavingStatus(false);
    }
  };

  const updatePayment = async (paymentStatus) => {
    setSavingPayment(true);
    try {
      await updateOrderPaymentStatus(orderKey, {
        paymentStatus,
        paymentProvider: order.paymentProvider || 'doku',
        status: getNextOrderStatusForPayment(paymentStatus),
      });
      const nextOrder = await refreshOrder();
      if (paymentStatus === 'paid') {
        await prepareCustomerNotification(nextOrder || { ...order, paymentStatus, status: 'paid' }, 'paid');
      }
      toast.success('Status pembayaran diperbarui');
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui status pembayaran');
    } finally {
      setSavingPayment(false);
    }
  };

  const saveShipment = async () => {
    setSavingShipment(true);
    try {
      const nextShipment = await updateOrderShipment(orderKey, {
        ...shipmentDraft,
        shippedAt: fromDatetimeLocal(shipmentDraft.shippedAt),
        deliveredAt: fromDatetimeLocal(shipmentDraft.deliveredAt),
      });
      const nextOrder = await refreshOrder();
      const notificationOrder = nextOrder || nextShipment || { ...order, ...shipmentDraft };
      if (shipmentDraft.shipmentStatus === 'shipped' || shipmentDraft.trackingNumber) {
        await prepareCustomerNotification(notificationOrder, 'shipped');
      }
      toast.success('Pengiriman tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan pengiriman');
    } finally {
      setSavingShipment(false);
    }
  };

  const saveInternalNotes = async () => {
    setSavingNotes(true);
    try {
      const nextOrder = await updateOrderInternalNotes(orderKey, internalNotesDraft);
      setOrder(nextOrder || order);
      toast.success('Catatan internal tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan catatan internal');
    } finally {
      setSavingNotes(false);
    }
  };

  const syncDokuStatus = async () => {
    setSyncingPayment(true);
    try {
      const result = await refreshDokuPaymentStatus(order.orderNumber);
      await refreshOrder();
      const label = paymentStatusLabels[result.paymentStatus] || result.paymentStatus || 'dicek';
      if (result.syncApplied) {
        toast.success(`DOKU tersinkron: ${label}`);
      } else {
        toast.warning(result.syncWarning || 'DOKU sudah dicek, tapi order tidak berubah');
      }
    } catch (error) {
      toast.error(error.message || 'Gagal sinkron status DOKU');
    } finally {
      setSyncingPayment(false);
    }
  };

  const openPaymentProof = async () => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti pembayaran belum tersedia');
      return;
    }

    try {
      const signedUrl = paymentProofPreviewUrl || (/^https?:\/\//i.test(order.paymentProofUrl)
        ? order.paymentProofUrl
        : await createPaymentProofSignedUrl(order.paymentProofUrl));
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Gagal membuka bukti pembayaran');
    }
  };

  const reviewPaymentProof = async (nextStatus, notes = '') => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti pembayaran belum tersedia');
      return;
    }

    if (nextStatus === 'rejected' && !notes.trim()) {
      toast.error('Catatan penolakan wajib diisi');
      return;
    }

    setSavingPaymentProof(true);
    try {
      const nextOrder = await reviewOrderPaymentProof(orderKey, {
        paymentProofStatus: nextStatus,
        notes,
      });
      setOrder(nextOrder || order);
      setAuditLogs(await getOrderAuditLogs(orderKey));
      if (nextStatus === 'rejected') {
        setRejectProofOpen(false);
        setRejectProofNotes('');
        await prepareCustomerNotification(nextOrder || { ...order, paymentProofStatus: 'rejected', paymentProofNotes: notes }, 'payment_proof_rejected');
      }
      if (nextStatus === 'approved') {
        toast.success('Bukti transfer disetujui');
      }
    } catch (error) {
      toast.error(error.message || 'Gagal mereview bukti pembayaran');
    } finally {
      setSavingPaymentProof(false);
    }
  };

  const openRejectProofDialog = () => {
    if (!order?.paymentProofUrl) {
      toast.error('File bukti pembayaran belum tersedia');
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
    await exportShippingLabelPdf(order);
    if (!hasShippingLabelPrinted(order) && !isShippedOrder(order) && !isArchivedOrder(order)) {
      await updateOrderShipment(orderKey, {
        ...shipmentDraft,
        shipmentStatus: 'packing',
        packingNotes: shipmentDraft.packingNotes || 'Resi PDF dicetak dari Detail Order Studio.',
      });
      await refreshOrder();
      toast.success('Resi PDF siap. Order masuk Label/resi.');
      return;
    }
    toast.success('Resi PDF siap');
  };

  const openWhatsApp = (message) => {
    window.open(getWhatsAppNotificationUrl(order, message), '_blank', 'noopener,noreferrer');
  };

  const copyPublicTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(buildPublicTrackingUrl(order.orderNumber));
      toast.success('Link tracking publik disalin');
    } catch (error) {
      toast.error(error.message || 'Gagal menyalin link tracking publik');
    }
  };

  const openPublicTrackingLink = () => {
    window.open(buildPublicTrackingUrl(order.orderNumber), '_blank', 'noopener,noreferrer');
  };

  const openEmail = () => {
    window.location.href = getEmailNotificationUrl(order, notificationEvent, notificationMessage);
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <StateBlock title="Memuat detail order" description="Mengambil detail payment, fulfillment, dan audit log." tone="loading" />
        </main>
      </AuthenticatedLayout>
    );
  }

  if (!order) {
    return (
      <AuthenticatedLayout>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Button variant="ghost" className="h-9 rounded-2xl gap-2" onClick={() => navigate('/studio/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Button>
          <StateBlock className="mt-5" title="Order tidak ditemukan" description={`Order ${orderId} tidak ditemukan.`} icon={PackageCheck} />
        </main>
      </AuthenticatedLayout>
    );
  }

  const voucherSnapshot = getOrderVoucherSnapshot(order);
  const discountedItemLines = getDiscountedVoucherCartLines(getOrderProductItems(order), voucherSnapshot || {});
  const bespoke = isBespokeOrder(order);
  const bespokeItem = getBespokeItem(order);
  const bespokeSummary = getBespokeOrderSummary(order);
  const nextOperationalTask = getNextOperationalTask(order, bespoke);

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{order.orderNumber} - Solivagant Studio</title>
        <meta name="description" content={`Detail operasional order ${order.orderNumber}.`} />
      </Helmet>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="h-9 rounded-2xl gap-2" onClick={() => navigate('/studio/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Cetak invoice
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={exportShippingLabel} disabled={!canExportShippingLabel(order)}>
              <Download className="h-4 w-4" />
              Resi PDF
            </Button>
          </div>
        </div>

        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <PackageCheck className="h-4 w-4 text-primary" />
              Detail operasional order
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold sm:text-4xl">{order.orderNumber}</h1>
              <StatusChip tone={getPaymentStatusTone(order.paymentStatus)} size="md">
                {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
              </StatusChip>
              <StatusChip tone={getOrderStatusTone(order.status)} size="md">
                {statusLabels[order.status] || order.status}
              </StatusChip>
              <StatusChip tone={getShipmentStatusTone(order.shipmentStatus)} size="md">
                {shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}
              </StatusChip>
            </div>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              {formatDate(order.createdAt)} / {order.quantity} item / {formatTotal(order.subtotal)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {order.inventoryDeducted ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                  Stok reserved sampai {formatDate(reservationExpiresAt)}
                </span>
              ) : ['expired', 'failed', 'refunded'].includes(order.paymentStatus) || order.status === 'cancelled' ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">Stok dilepas</span>
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Batas reserved {PAYMENT_RESERVATION_TTL_HOURS} jam</span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {statusSteps.map((step, index) => {
                const done = activeStep >= index;
                return (
                  <div key={step} className="min-w-0">
                    <div className={`h-2 rounded-full ${done ? 'bg-[#1b1a16]' : 'bg-stone-200'}`} />
                    <div className={`mt-1 truncate text-[10px] font-bold uppercase ${done ? 'text-[#1b1a16]' : 'text-muted-foreground'}`}>{statusLabels[step]}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Customer</span><strong>{order.customerName}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Pengiriman</span><strong>{shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}</strong></div>
            <div className="dashboard-hero-stat"><span className="dashboard-hero-stat-label">Total bayar</span><strong>{formatTotal(order.subtotal)}</strong></div>
          </div>
        </section>

        {voucherSnapshot ? (
          <section className="mb-5 rounded-2xl border border-[#1b1a16]/10 bg-[#f7f1e5] p-4 text-sm font-bold text-[#1b1a16] shadow-sm">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <div><span className="block text-[10px] uppercase text-[#6b7280]">Subtotal produk</span>{formatTotal(getOrderProductsSubtotal(order))}</div>
              <div><span className="block text-[10px] uppercase text-[#6b7280]">Voucher {voucherSnapshot.code}</span>-{formatTotal(voucherSnapshot.discountAmount)}</div>
              <div><span className="block text-[10px] uppercase text-[#6b7280]">Setelah voucher</span>{formatTotal(getOrderSubtotalAfterVoucher(order))}</div>
              <div><span className="block text-[10px] uppercase text-[#6b7280]">Ongkir / total</span>{getOrderShippingFee(order) ? `${formatTotal(getOrderShippingFee(order))} / ` : ''}{formatTotal(order.subtotal)}</div>
            </div>
          </section>
        ) : null}

        <section className="mb-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="rounded-2xl border border-[#1b1a16]/10 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
              <Clipboard className="h-4 w-4" />
              Tugas berikutnya
            </div>
            <h2 className="mt-2 text-xl font-bold text-[#1b1a16]">{nextOperationalTask.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">{nextOperationalTask.helper}</p>
          </div>
          <div className="rounded-2xl border border-[#1b1a16]/10 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-muted-foreground">Pembayaran</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusChip tone={getPaymentStatusTone(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</StatusChip>
              <StatusChip tone={paymentProofToneByStatus[paymentProofStatus] || 'warning'}>{paymentProofStatusLabels[paymentProofStatus] || paymentProofStatus}</StatusChip>
            </div>
            <p className="mt-3 text-sm font-bold text-[#1b1a16]">{formatTotal(order.subtotal)}</p>
          </div>
          <div className="rounded-2xl border border-[#1b1a16]/10 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-muted-foreground">Fulfillment</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusChip tone={getShipmentStatusTone(order.shipmentStatus)}>{shipmentStatusLabels[order.shipmentStatus] || order.shipmentStatus}</StatusChip>
              {order.trackingNumber ? <StatusChip tone="success">Resi siap</StatusChip> : <StatusChip tone="warning">Butuh resi</StatusChip>}
            </div>
            <p className="mt-3 truncate text-sm font-bold text-[#1b1a16]">{order.courierName || 'Kurir belum diisi'}</p>
          </div>
          <div className="rounded-2xl border border-[#1b1a16]/10 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-muted-foreground">{bespoke ? 'Bespoke' : 'Customer'}</div>
            {bespoke ? (
              <>
                <StatusChip tone="primary" className="mt-2">{bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}</StatusChip>
                <p className="mt-3 truncate text-sm font-bold text-[#1b1a16]">{bespokeSummary?.bottle}</p>
              </>
            ) : (
              <>
                <p className="mt-2 truncate text-sm font-bold text-[#1b1a16]">{order.customerName}</p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{order.contact || order.customerCode || '-'}</p>
              </>
            )}
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-[#1b1a16]/10 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase text-[#1b1a16]">Panel aksi</div>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Jalur cepat untuk pekerjaan harian: konfirmasi payment, mulai packing, cetak resi, dan follow-up customer.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => updatePayment('paid')} disabled={savingPayment || order.paymentStatus === 'paid'}>
                {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Tandai paid
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => updateStatus('processing')} disabled={savingStatus || order.status === 'processing'}>
                <PackageCheck className="h-4 w-4" />
                Proses
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={exportShippingLabel} disabled={!canExportShippingLabel(order)}>
                <Download className="h-4 w-4" />
                Resi PDF
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={copyPublicTrackingLink}>
                <Copy className="h-4 w-4" />
                Salin tracking
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={openPublicTrackingLink}>
                <ExternalLink className="h-4 w-4" />
                Buka tracking
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => openWhatsApp(notificationMessage)}>
                <MessageCircle className="h-4 w-4" />
                WA update
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-5">
            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <UserRound className="h-4 w-4" />
                Customer & alamat
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-[#fbfaf7] p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Customer</div>
                  <h2 className="mt-1 text-xl font-bold">{order.customerName}</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{order.contact}</p>
                  {order.customerCode ? <p className="mt-3 w-fit rounded-full bg-[#f7f1e5] px-3 py-1 text-xs font-bold uppercase text-[#1b1a16]">{order.customerCode}</p> : null}
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Pengiriman</div>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#1f2937]">{address || order.notes || '-'}</p>
                  {area ? <p className="mt-2 text-sm font-bold text-[#1b1a16]">{area}</p> : null}
                  {shipping ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{shipping}</p> : null}
                </div>
              </div>
            </section>

            {bespoke ? (
              <section className="rounded-2xl border border-[#1b1a16]/10 bg-[#f7f1e5] p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                    <Sparkles className="h-4 w-4" />
                    Bespoke brief
                  </div>
                  <StatusChip tone="primary">
                    {bespokeProductionStatusLabels[order.bespokeProductionStatus || 'review_brief']}
                  </StatusChip>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <span className="block text-[10px] font-bold uppercase text-[#6b7280]">Botol</span>
                    <span className="mt-1 block truncate text-sm font-bold text-[#1b1a16]">{bespokeSummary?.bottle}</span>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 md:col-span-2">
                    <span className="block text-[10px] font-bold uppercase text-[#6b7280]">Cap / label</span>
                    <span className="mt-1 block truncate text-sm font-bold text-[#1b1a16]">{bespokeSummary?.design}</span>
                  </div>
                </div>
                {bespokeSummary?.aroma ? (
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-relaxed text-[#1f2937]">{bespokeSummary.aroma}</p>
                ) : null}
                <details className="mt-3 rounded-2xl bg-white/70 px-4 py-3">
                  <summary className="cursor-pointer select-none text-xs font-bold text-[#1b1a16]">Buka detail brief lengkap</summary>
                  <div className="mt-3 grid gap-2 border-t border-[#1b1a16]/10 pt-3 sm:grid-cols-2">
                    {bespokeDetailRows(bespokeItem).map(([label, value]) => (
                      <p key={label} className="text-xs font-semibold text-muted-foreground">
                        <span className="block text-[10px] font-bold uppercase text-[#1b1a16]">{label}</span>
                        {value}
                      </p>
                    ))}
                  </div>
                </details>
              </section>
            ) : null}

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                  <FileCheck2 className="h-4 w-4" />
                  Timeline bukti pembayaran
                </div>
                <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-xs font-bold uppercase text-[#1b1a16]">{proofTimeline.length} event</span>
              </div>
              {proofTimeline.length ? (
                <div className="grid gap-3">
                  {proofTimeline.map((event) => (
                    <article key={event.id} className="rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">{event.label}</span>
                            <StatusChip tone={paymentProofToneByStatus[event.status] || 'warning'}>{paymentProofStatusLabels[event.status] || event.status || 'Event bukti'}</StatusChip>
                          </div>
                          <div className="mt-1 text-xs font-semibold text-muted-foreground">{formatDate(event.at)} / {event.actor}</div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-[#1b1a16]">Percobaan {event.attempt}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs font-semibold text-muted-foreground">
                        {event.previousStatus ? <div>Sebelumnya: <span className="text-[#1f2937]">{paymentProofStatusLabels[event.previousStatus] || event.previousStatus}</span></div> : null}
                        {event.fileName ? <div>File: <span className="text-[#1f2937]">{event.fileName}</span></div> : null}
                        {event.filePath ? <div className="break-all">Path: <span className="text-[#1f2937]">{event.filePath}</span></div> : null}
                        {event.notes ? <div className="rounded-xl bg-white px-3 py-2 text-rose-700">Catatan: {event.notes}</div> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-5 text-sm font-semibold leading-relaxed text-muted-foreground">
                  Belum ada history upload/approve/reject bukti transfer untuk order ini.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                  <CreditCard className="h-4 w-4" />
                  Payment
                </div>
                {order.paymentUrl ? (
                  <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => window.open(order.paymentUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" />
                    Buka pembayaran
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#fbfaf7] p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Provider</div>
                  <div className="mt-1 text-lg font-bold">{order.paymentProvider || 'manual'}</div>
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Referensi</div>
                  <div className="mt-1 truncate text-lg font-bold">{order.paymentReference || '-'}</div>
                </div>
                <div className="rounded-2xl bg-[#fbfaf7] p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground">Expired</div>
                  <div className="mt-1 text-lg font-bold">{formatDate(reservationExpiresAt || order.paymentExpiresAt)}</div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Fallback TTL {PAYMENT_RESERVATION_TTL_HOURS} jam dari checkout jika DOKU tidak memberi expiry.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <select value={order.paymentStatus} onChange={(event) => updatePayment(event.target.value)} disabled={savingPayment} className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                  {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => updatePayment('paid')} disabled={savingPayment || order.paymentStatus === 'paid'}>
                  {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Tandai paid
                </Button>
                {order.paymentProvider === 'doku' ? (
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={syncDokuStatus} disabled={syncingPayment}>
                    {syncingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sinkron DOKU
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-bold uppercase text-muted-foreground">Bukti transfer</div>
                      <StatusChip tone={paymentProofToneByStatus[paymentProofStatus] || 'warning'}>
                        {paymentProofStatusLabels[paymentProofStatus] || paymentProofStatus}
                      </StatusChip>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#1f2937]">
                      {hasPaymentProofPath
                        ? 'File bukti transfer sudah tersimpan di order.'
                        : 'Belum ada file bukti transfer untuk order ini.'}
                    </p>
                    {order.paymentProofFileName ? (
                      <div className="mt-2 truncate rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#1b1a16]">
                        {order.paymentProofFileName}
                      </div>
                    ) : null}
                    <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                      <span>Diupload: {formatDate(order.paymentProofUploadedAt)}</span>
                      <span>Tipe: {order.paymentProofContentType || '-'}</span>
                      {order.paymentProofNotes ? <span>Catatan: {order.paymentProofNotes}</span> : null}
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="h-11 shrink-0 rounded-2xl bg-white gap-2" onClick={openPaymentProof} disabled={!hasPaymentProofPath || loadingPaymentProof}>
                    {loadingPaymentProof ? <Loader2 className="h-4 w-4 animate-spin" /> : hasPaymentProofPath ? <ExternalLink className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Buka file
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => reviewPaymentProof('approved')} disabled={!hasPaymentProofPath || savingPaymentProof || paymentProofStatus === 'approved'}>
                    {savingPaymentProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Setujui bukti
                  </Button>
                  <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2 text-rose-700" onClick={openRejectProofDialog} disabled={!hasPaymentProofPath || savingPaymentProof || paymentProofStatus === 'rejected'}>
                    <AlertCircle className="h-4 w-4" />
                    Tolak bukti
                  </Button>
                </div>
                {paymentProofPreviewUrl && paymentProofIsImage ? (
                  <button type="button" onClick={openPaymentProof} className="mt-4 block overflow-hidden rounded-2xl border bg-white text-left">
                    <img src={paymentProofPreviewUrl} alt={`Bukti transfer ${order.orderNumber}`} className="max-h-80 w-full object-contain" />
                  </button>
                ) : null}
                {paymentProofPreviewUrl && !paymentProofIsImage ? (
                  <button type="button" onClick={openPaymentProof} className="mt-4 flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left text-sm font-bold text-[#1b1a16]">
                    <FileCheck2 className="h-5 w-5" />
                    File siap dibuka di tab baru
                  </button>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <Truck className="h-4 w-4" />
                Pengiriman & fulfillment
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={shipmentDraft.shipmentStatus} onChange={(event) => setShipmentDraft((current) => ({ ...current, shipmentStatus: event.target.value }))} className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                  {Object.entries(shipmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={shipmentDraft.courierName} onChange={(event) => setShipmentDraft((current) => ({ ...current, courierName: event.target.value }))} placeholder="Kurir, contoh: JNE / J&T" className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                <input value={shipmentDraft.trackingNumber} onChange={(event) => setShipmentDraft((current) => ({ ...current, trackingNumber: event.target.value }))} placeholder="Nomor resi kurir" className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                <input value={shipmentDraft.trackingUrl} onChange={(event) => setShipmentDraft((current) => ({ ...current, trackingUrl: event.target.value }))} placeholder="URL tracking kurir" className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                  Tanggal kirim
                  <input type="datetime-local" value={shipmentDraft.shippedAt} onChange={(event) => setShipmentDraft((current) => ({ ...current, shippedAt: event.target.value }))} className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-muted-foreground">
                  Tanggal diterima
                  <input type="datetime-local" value={shipmentDraft.deliveredAt} onChange={(event) => setShipmentDraft((current) => ({ ...current, deliveredAt: event.target.value }))} className="h-11 rounded-2xl border bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300" />
                </label>
              </div>
              <textarea value={shipmentDraft.packingNotes} onChange={(event) => setShipmentDraft((current) => ({ ...current, packingNotes: event.target.value }))} rows={3} placeholder="Catatan packing..." className="mt-3 w-full rounded-2xl border bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <Button type="button" className="mt-3 h-11 rounded-2xl gap-2" onClick={saveShipment} disabled={savingShipment}>
                {savingShipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Simpan pengiriman
              </Button>
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <PackageCheck className="h-4 w-4" />
                Item
              </div>
              <div className="overflow-hidden rounded-2xl border">
                {discountedItemLines.map((line) => {
                  const item = line.item;
                  const hasDiscount = line.discount > 0;
                  return (
                  <div key={`${order.orderNumber}-${item.slug || item.name}`} className="grid grid-cols-[1fr_80px_120px] gap-3 border-b bg-white px-4 py-3 text-sm font-semibold last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{item.name}</span>
                      {item.size ? <span className="text-xs text-muted-foreground">{item.size}</span> : null}
                      {hasDiscount ? <span className="mt-1 block text-[11px] font-bold text-[#1b1a16]">Diskon voucher -{formatTotal(line.discount)}</span> : null}
                    </span>
                    <span className="text-right">x{item.quantity || 1}</span>
                    <span className="text-right font-bold text-amber-700">
                      {hasDiscount ? (
                        <>
                          <span className="block text-[11px] text-[#9ca3af] line-through">{formatTotal(line.originalTotal)}</span>
                          <span className="block">{formatTotal(line.discountedTotal)}</span>
                        </>
                      ) : item.price || formatTotal(line.originalTotal)}
                    </span>
                  </div>
                  );
                })}
                {voucherSnapshot ? (
                  <div className="grid grid-cols-[1fr_80px_120px] gap-3 border-b bg-[#f7f1e5] px-4 py-3 text-sm font-semibold last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[#1b1a16]">Voucher {voucherSnapshot.code}</span>
                      <span className="text-xs text-[#6f695f]">{voucherSnapshot.discountType || 'discount'} {voucherSnapshot.discountValue || ''}</span>
                    </span>
                    <span className="text-right">-</span>
                    <span className="text-right font-bold text-[#1b1a16]">-{formatTotal(voucherSnapshot.discountAmount)}</span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="grid content-start gap-5">
            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <Clipboard className="h-4 w-4" />
                Aksi cepat
              </div>
              <div className="grid gap-2">
                <select value={order.status} onChange={(event) => updateStatus(event.target.value)} disabled={savingStatus} className="h-11 rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => copyText(order.checkoutDraft || order.notes, 'Draft order')}>
                  <Copy className="h-4 w-4" />
                  Salin draft order
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => navigate(`/customer/invoice/${encodeURIComponent(order.orderNumber)}?code=${encodeURIComponent(order.customerCode || '')}`)} disabled={!order.customerCode}>
                  <FileText className="h-4 w-4" />
                  Invoice customer
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white gap-2" onClick={() => copyText(paymentReminderMessage, 'Reminder pembayaran')} disabled={!order.paymentUrl}>
                  <CreditCard className="h-4 w-4" />
                  Salin link bayar
                </Button>
                <Button type="button" className="h-11 rounded-2xl gap-2" onClick={() => openWhatsApp(paymentReminderMessage)} disabled={!order.paymentUrl}>
                  <MessageCircle className="h-4 w-4" />
                  WA link bayar
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <MessageCircle className="h-4 w-4" />
                Template customer
              </div>
              <select value={notificationEvent} onChange={(event) => setNotificationEvent(event.target.value)} className="h-11 w-full rounded-2xl border bg-white px-3 text-sm font-bold outline-none focus:border-amber-300">
                {Object.entries(notificationEventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea value={notificationMessage} readOnly rows={8} className="mt-3 w-full rounded-2xl border bg-[#fbfaf7] px-3 py-3 text-xs font-semibold leading-relaxed outline-none" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white text-xs" onClick={() => copyText(notificationMessage, 'Template')}>
                  <Copy className="h-4 w-4" />
                  Salin
                </Button>
                <Button type="button" className="h-10 rounded-2xl text-xs" onClick={() => openWhatsApp(notificationMessage)}>
                  <MessageCircle className="h-4 w-4" />
                  WA
                </Button>
                <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white text-xs" onClick={openEmail} disabled={!canSendEmailNotification(order)}>
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <NotebookPen className="h-4 w-4" />
                Catatan internal
              </div>
              <textarea value={internalNotesDraft} onChange={(event) => setInternalNotesDraft(event.target.value)} rows={5} placeholder="Catatan internal untuk packing, follow-up, atau produksi..." className="w-full rounded-2xl border bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300" />
              <Button type="button" className="mt-3 h-11 w-full rounded-2xl gap-2" onClick={saveInternalNotes} disabled={savingNotes}>
                {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan catatan
              </Button>
            </section>
          </aside>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <ShieldCheck className="h-4 w-4" />
                Log audit admin
              </div>
              <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-xs font-bold uppercase text-[#1b1a16]">{auditLogs.length} log</span>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_150px_150px]">
              <input
                value={auditFilters.query}
                onChange={(event) => setAuditFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Filter order, admin, event, atau diff"
                className="h-10 rounded-2xl border bg-white px-3 text-xs font-semibold outline-none focus:border-amber-300"
              />
              <select
                value={auditFilters.admin}
                onChange={(event) => setAuditFilters((current) => ({ ...current, admin: event.target.value }))}
                className="h-10 rounded-2xl border bg-white px-3 text-xs font-bold outline-none focus:border-amber-300"
              >
                <option value="all">Semua admin</option>
                {auditAdmins.map((admin) => <option key={admin} value={admin}>{admin}</option>)}
              </select>
              <select
                value={auditFilters.event}
                onChange={(event) => setAuditFilters((current) => ({ ...current, event: event.target.value }))}
                className="h-10 rounded-2xl border bg-white px-3 text-xs font-bold outline-none focus:border-amber-300"
              >
                <option value="all">Semua event</option>
                {auditEvents.map((event) => <option key={event} value={event}>{auditActionLabels[event] || event}</option>)}
              </select>
            </div>
            {filteredAuditLogs.length ? (
              <div className="grid gap-3">
                {filteredAuditLogs.map((log) => {
                  const changes = getAuditChanges(log.previousValues, log.nextValues);
                  const important = changes.some((change) => importantAuditKeys.includes(change.key));
                  return (
                    <article key={log.id} className={`rounded-2xl p-3 ${important ? 'border border-amber-200 bg-amber-50' : 'bg-[#fbfaf7]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{auditActionLabels[log.action] || log.action}</div>
                          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {formatDate(log.createdAt)} / {log.actorName || log.actorEmail || 'Sistem'}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-[#1b1a16]">{log.actorEmail || 'system'}</span>
                      </div>
                      {changes.length ? (
                        <div className="mt-3 grid gap-2">
                          {changes.map((change) => {
                            const importantChange = importantAuditKeys.includes(change.key);
                            return (
                            <div key={change.key} className={`rounded-2xl border bg-white px-3 py-2 ${importantChange ? 'border-amber-200 ring-1 ring-amber-100' : 'border-[#1b1a16]/10'}`}>
                              <div className={`text-[10px] font-bold uppercase ${importantChange ? 'text-amber-800' : 'text-[#1b1a16]'}`}>{change.label}</div>
                              <div className="mt-1 grid gap-2 text-xs font-semibold text-muted-foreground sm:grid-cols-2">
                                <span className="min-w-0 rounded-xl bg-[#f8f7f4] px-2 py-1">Sebelum: <span className="text-[#1f2937]">{change.before}</span></span>
                                <span className="min-w-0 rounded-xl bg-[#f7f1e5] px-2 py-1">Sesudah: <span className="text-[#1f2937]">{change.after}</span></span>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs font-semibold text-muted-foreground">
                          {formatAuditValues(log.nextValues)}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-5 text-sm font-semibold leading-relaxed text-muted-foreground">
                Belum ada perubahan admin yang cocok dengan filter untuk order ini.
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <History className="h-4 w-4" />
                Log fulfillment
              </div>
              <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-xs font-bold uppercase text-[#1b1a16]">{timeline.length} event</span>
            </div>
            <div className="grid gap-3">
              {timeline.map((entry, index) => (
                <div key={`${entry.status}-${entry.at}-${index}`} className="grid grid-cols-[28px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="h-3 w-3 rounded-full bg-[#1b1a16]" />
                    {index < timeline.length - 1 ? <span className="mt-1 h-full min-h-8 w-px bg-[#d9ded3]" /> : null}
                  </div>
                  <div className="rounded-2xl bg-[#fbfaf7] px-3 py-2">
                    <div className="text-sm font-bold">{entry.label}</div>
                    <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDate(entry.at)}</div>
                    {entry.note ? <div className="mt-1 text-xs font-semibold">{entry.note}</div> : null}
                  </div>
                </div>
              ))}
              {order.inventoryEvents?.map((event, index) => (
                <div key={`${event.productSlug}-${event.variantId}-${index}`} className="rounded-2xl bg-[#fbfaf7] px-3 py-2 text-sm font-semibold">
                  <span className="font-bold">{event.movement || event.type}</span> / {event.productName} x{event.quantity}
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(event.at || event.restoredAt)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1b1a16]">
                <CreditCard className="h-4 w-4" />
                Log pembayaran
              </div>
              <span className="rounded-full bg-[#f7f1e5] px-3 py-1 text-xs font-bold uppercase text-[#1b1a16]">{paymentLogs.length} log</span>
            </div>
            {paymentLogs.length ? (
              <div className="grid gap-3">
                {paymentLogs.map((log) => (
                  <article key={log.id} className="rounded-2xl bg-[#fbfaf7] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold">
                          {log.transactionStatus || 'Callback'}
                          {log.mappedPaymentStatus ? ` / ${paymentStatusLabels[log.mappedPaymentStatus] || log.mappedPaymentStatus}` : ''}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDate(log.receivedAt)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getLogTone(log.processingStatus)}`}>{log.processingStatus}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
                      <div>Request: <span className="text-[#1f2937]">{log.requestId || '-'}</span></div>
                      <div>HTTP: <span className="text-[#1f2937]">{log.httpStatus || '-'}</span> / Signature: <span className="text-[#1f2937]">{log.signatureValid === false ? 'invalid' : log.signatureValid === true ? 'valid' : '-'}</span></div>
                      {log.errorMessage ? <div className="text-rose-700">{log.errorMessage}</div> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-5 text-sm font-semibold leading-relaxed text-muted-foreground">
                Belum ada callback DOKU untuk order ini. Kalau customer sudah bayar tapi status belum berubah, gunakan Sinkron DOKU atau cek webhook.
              </div>
            )}
          </section>
        </div>
      </div>
      <Dialog open={rejectProofOpen} onOpenChange={setRejectProofOpen}>
        <DialogContent className="max-w-xl rounded-[24px] p-6">
          <DialogHeader>
            <DialogTitle>Tolak bukti transfer</DialogTitle>
            <DialogDescription className="not-sr-only text-sm text-muted-foreground">
              Tulis alasan yang jelas untuk customer. Alasan ini akan tampil di halaman payment dan lacak order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="reject-proof-notes" className="text-xs font-bold uppercase text-muted-foreground">
              Alasan penolakan
            </label>
            <textarea
              id="reject-proof-notes"
              value={rejectProofNotes}
              onChange={(event) => setRejectProofNotes(event.target.value)}
              rows={5}
              className="min-h-32 rounded-2xl border bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
              placeholder="Contoh: Nominal transfer belum sesuai total order. Mohon upload ulang bukti transfer yang benar."
            />
            <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
              Order tetap pending. Customer bisa upload ulang bukti transfer setelah ditolak.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => setRejectProofOpen(false)} disabled={savingPaymentProof}>
              Batal
            </Button>
            <Button type="button" className="rounded-2xl bg-rose-700 text-white hover:bg-rose-800" onClick={submitRejectProof} disabled={savingPaymentProof || !rejectProofNotes.trim()}>
              {savingPaymentProof ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertCircle className="mr-2 h-4 w-4" />}
              Tolak bukti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
};

export default OrderDetailPage;
