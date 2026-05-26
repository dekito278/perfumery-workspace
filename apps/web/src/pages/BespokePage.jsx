import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { bespokeOccasionOptions } from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createBespokeRequest, updateOrderPaymentStatus, updateOrderStatus } from '@/services/orderService.js';
import { formatRupiah } from '@/services/productCatalogService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const steps = ['Aroma', 'Preferensi', 'Botol', 'Alamat', 'Bayar'];

const firstEnabled = (options = []) => options.find((option) => option.enabled) || options[0] || {};

const BespokePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const settings = useBespokeSettings();
  const bottleSizeOptions = useMemo(() => settings.bottleSizes.filter((option) => option.enabled), [settings.bottleSizes]);
  const bottleTypeOptions = useMemo(() => settings.bottleTypes.filter((option) => option.enabled), [settings.bottleTypes]);
  const capDesignOptions = useMemo(() => settings.capDesigns.filter((option) => option.enabled), [settings.capDesigns]);
  const labelDesignOptions = useMemo(() => settings.labelDesigns.filter((option) => option.enabled), [settings.labelDesigns]);
  const exoticMaterialOptions = useMemo(() => settings.exoticMaterials.filter((option) => option.enabled), [settings.exoticMaterials]);
  const defaultSize = firstEnabled(bottleSizeOptions);
  const defaultBottle = firstEnabled(bottleTypeOptions);
  const defaultCap = firstEnabled(capDesignOptions);
  const defaultLabel = firstEnabled(labelDesignOptions);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    contact: '',
    customerCode: '',
    perfumeName: '',
    scentDescription: referenceProduct?.notes || '',
    occasion: bespokeOccasionOptions[0] || '',
    size: defaultSize.value || '',
    bottleType: defaultBottle.value || '',
    capDesign: defaultCap.value || '',
    labelDesign: defaultLabel.value || '',
    exoticMaterial: '',
    deliveryAddress: '',
    deliveryArea: '',
    paymentMethod: checkoutPaymentMethods[0]?.id || 'manual_transfer_bca',
    preorderAcknowledged: false,
  });

  const selectedSize = bottleSizeOptions.find((option) => option.value === form.size) || defaultSize;
  const selectedBottle = bottleTypeOptions.find((option) => option.value === form.bottleType) || defaultBottle;
  const selectedCap = capDesignOptions.find((option) => option.value === form.capDesign) || defaultCap;
  const selectedLabel = labelDesignOptions.find((option) => option.value === form.labelDesign) || defaultLabel;
  const selectedMaterial = exoticMaterialOptions.find((option) => option.value === form.exoticMaterial);
  const selectedPaymentMethod = getCheckoutPaymentMethod(form.paymentMethod);
  const isManualPayment = isManualTransferPayment(selectedPaymentMethod.provider);
  const estimatedTotal = [
    selectedSize?.price,
    selectedBottle?.price,
    selectedCap?.price,
    selectedLabel?.price,
    selectedMaterial?.price,
  ].reduce((sum, value) => sum + Number(value || 0), 0);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      size: bottleSizeOptions.some((option) => option.value === current.size) ? current.size : (defaultSize.value || ''),
      bottleType: bottleTypeOptions.some((option) => option.value === current.bottleType) ? current.bottleType : (defaultBottle.value || ''),
      capDesign: capDesignOptions.some((option) => option.value === current.capDesign) ? current.capDesign : (defaultCap.value || ''),
      labelDesign: labelDesignOptions.some((option) => option.value === current.labelDesign) ? current.labelDesign : (defaultLabel.value || ''),
      exoticMaterial: current.exoticMaterial && exoticMaterialOptions.some((option) => option.value === current.exoticMaterial) ? current.exoticMaterial : '',
    }));
  }, [bottleSizeOptions, bottleTypeOptions, capDesignOptions, labelDesignOptions, exoticMaterialOptions, defaultSize.value, defaultBottle.value, defaultCap.value, defaultLabel.value]);

  const validateForm = () => {
    if (!form.customerName.trim()) return 'Nama wajib diisi.';
    if (!form.contact.trim()) return 'Email atau WhatsApp wajib diisi.';
    if (!form.scentDescription.trim()) return 'Ceritakan arah aroma dulu.';
    if (!form.size) return 'Pilih ukuran botol.';
    if (!form.deliveryAddress.trim()) return 'Alamat pengiriman wajib diisi.';
    if (!form.preorderAcknowledged) return 'Konfirmasi estimasi pre-order dulu.';
    return '';
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const order = await createBespokeRequest({
        ...form,
        preferredNotes: form.scentDescription,
        budget: formatRupiah(estimatedTotal),
        itemPrice: estimatedTotal,
        estimatedTotal,
        totalPrice: estimatedTotal,
        paymentProvider: selectedPaymentMethod.provider,
        referenceProductName: referenceProduct?.name || '',
        referenceProductSlug: referenceProduct?.slug || '',
      });
      createdOrder = order;

      if (isManualPayment) {
        const manualTransfer = {
          method: selectedPaymentMethod.provider,
          bankName: selectedPaymentMethod.bankName,
          accountNumber: selectedPaymentMethod.accountNumber,
          accountName: selectedPaymentMethod.accountName,
          amount: estimatedTotal,
        };
        await updateOrderPaymentStatus(order.id || order.orderNumber, {
          paymentStatus: 'pending',
          paymentProvider: selectedPaymentMethod.provider,
          paymentReference: `${selectedPaymentMethod.bankName}-${order.orderNumber}`,
          paymentUrl: '',
          paymentExpiresAt: '',
          paymentSessionId: '',
          paymentResponse: manualTransfer,
          status: 'pending_payment',
          audit: false,
        });
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
          paymentType: selectedPaymentMethod.provider,
          paymentProvider: selectedPaymentMethod.provider,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          amount: estimatedTotal,
          customerName: form.customerName,
          paymentStatus: 'pending',
          manualTransfer,
          createdAt: new Date().toISOString(),
        }));
        toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
        navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: estimatedTotal,
        customerName: form.customerName,
        contact: form.contact,
        items: order.items || [],
        callbackPath: '/payment',
      });
      await updateOrderPaymentStatus(order.id || order.orderNumber, {
        paymentStatus: 'pending',
        paymentProvider: 'doku',
        paymentReference: checkout.requestId || '',
        paymentUrl: checkout.paymentUrl,
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        paymentResponse: checkout.dokuResponse || {},
        status: 'pending_payment',
        audit: false,
      });
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentType: 'doku',
        paymentProvider: 'doku',
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        amount: estimatedTotal,
        customerName: form.customerName,
        paymentStatus: 'pending',
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        createdAt: new Date().toISOString(),
      }));
      toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
      navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
    } catch (error) {
      if (createdOrder) {
        await updateOrderStatus(createdOrder.id || createdOrder.orderNumber, 'cancelled');
      }
      toast.error(error.message || 'Gagal menyimpan request bespoke.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Bespoke Perfume Consultation - SOLIVAGANT</title>
        <meta name="description" content="Request a SOLIVAGANT custom perfume consultation through aroma, bottle choices, delivery data, and payment." />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero editorial-page-hero--split">
          <div>
            <p className="editorial-eyebrow">BESPOKE PERFUME CONSULTATION</p>
            <h1>Bespoke Perfume Consultation</h1>
            <p className="editorial-product-detail__price">Request parfum custom / Pre-order 7-14 hari</p>
            <p>Ceritakan arah aroma, pilih detail botol, lalu buat request. Setelah submit, kamu akan diarahkan ke instruksi pembayaran.</p>
          </div>
          <ol className="editorial-steps editorial-steps--panel">
            {steps.map((step, index) => (
              <li key={step}><Check className="h-4 w-4" />{index + 1}. {step}</li>
            ))}
          </ol>
        </section>

        <section className="editorial-section editorial-bespoke editorial-section--compact">
          <div>
            <p className="editorial-eyebrow">LIVE BRIEF</p>
            <h2>Custom request yang masuk ke order studio.</h2>
            <p>
              Pilihan botol, label, material, dan pembayaran mengikuti pengaturan bespoke yang aktif, sehingga request yang masuk siap diproses sebagai order.
            </p>
            <div className="editorial-bespoke-summary">
              <p className="editorial-eyebrow">REQUEST SUMMARY</p>
              <dl>
                <div><dt>Nama parfum</dt><dd>{form.perfumeName || 'Belum diisi'}</dd></div>
                <div><dt>Aroma</dt><dd>{form.scentDescription || 'Belum diisi'}</dd></div>
                <div><dt>Botol</dt><dd>{[selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / ') || '-'}</dd></div>
                <div><dt>Total estimasi</dt><dd>{formatRupiah(estimatedTotal)}</dd></div>
              </dl>
            </div>
          </div>
          <form className="editorial-form" onSubmit={submitRequest}>
            <label>Nama parfum / project name<input type="text" value={form.perfumeName} onChange={(event) => updateField('perfumeName', event.target.value)} placeholder="A working name for the custom scent" /></label>
            <label>Scent direction<textarea rows="4" value={form.scentDescription} onChange={(event) => updateField('scentDescription', event.target.value)} placeholder="Woody, floral, aquatic, gourmand, smoky..." /></label>
            <label>Occasion<select value={form.occasion} onChange={(event) => updateField('occasion', event.target.value)}>{bespokeOccasionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>Size selection<select value={form.size} onChange={(event) => updateField('size', event.target.value)}>{bottleSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} / {formatRupiah(option.price || 0)}</option>)}</select></label>
            <label>Bottle type<select value={form.bottleType} onChange={(event) => updateField('bottleType', event.target.value)}>{bottleTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} / {formatRupiah(option.price || 0)}</option>)}</select></label>
            <label>Cap design<select value={form.capDesign} onChange={(event) => updateField('capDesign', event.target.value)}>{capDesignOptions.map((option) => <option key={option.value} value={option.value}>{option.label} / {formatRupiah(option.price || 0)}</option>)}</select></label>
            <label>Label design<select value={form.labelDesign} onChange={(event) => updateField('labelDesign', event.target.value)}>{labelDesignOptions.map((option) => <option key={option.value} value={option.value}>{option.label} / {formatRupiah(option.price || 0)}</option>)}</select></label>
            <label>Material add-on<select value={form.exoticMaterial} onChange={(event) => updateField('exoticMaterial', event.target.value)}><option value="">Tanpa add-on</option>{exoticMaterialOptions.map((option) => <option key={option.value} value={option.value}>{option.label} / {formatRupiah(option.price || 0)}</option>)}</select></label>
            <label>Name<input type="text" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="Your name" /></label>
            <label>Email / WhatsApp<input type="text" value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="name@example.com / +62..." /></label>
            <label>Delivery area<input type="text" value={form.deliveryArea} onChange={(event) => updateField('deliveryArea', event.target.value)} placeholder="City / district" /></label>
            <label>Delivery address<textarea rows="4" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="Alamat lengkap pengiriman" /></label>
            <label>Payment<select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>{checkoutPaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
            <label className="editorial-checkbox-row">
              <input type="checkbox" checked={form.preorderAcknowledged} onChange={(event) => updateField('preorderAcknowledged', event.target.checked)} />
              Saya memahami bespoke perfume adalah pre-order dengan estimasi pengerjaan 7-14 hari setelah brief dikonfirmasi.
            </label>
            <button type="submit" className="editorial-button editorial-button--primary" disabled={saving}>
              {saving ? 'Saving request...' : (isManualPayment ? 'Buat order & upload bukti' : 'Buat order & bayar')}
              {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </button>
          </form>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/catalog">Explore Collection</Link>
        </footer>
      </main>
    </>
  );
};

export default BespokePage;
