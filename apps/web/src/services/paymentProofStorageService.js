import supabase from '@/lib/supabaseClient.js';

export const PAYMENT_PROOFS_BUCKET = 'storefront-payment-proofs';

const MAX_PAYMENT_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_PAYMENT_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PAYMENT_PROOF_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const sanitizePathSegment = (value, fallback = 'payment-proof') => String(value || fallback)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || fallback;

export const validatePaymentProofFile = (file) => {
  if (!file) {
    throw new Error('Pilih file bukti transfer dulu');
  }

  if (!SUPPORTED_PAYMENT_PROOF_TYPES.includes(file.type)) {
    throw new Error('Gunakan file JPG, PNG, WebP, atau PDF');
  }

  if (file.size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    throw new Error('Ukuran bukti transfer maksimal 5 MB');
  }
};

const getPaymentProofExtension = (file) => {
  const mappedExtension = PAYMENT_PROOF_EXTENSIONS[file?.type];
  if (mappedExtension) return mappedExtension;

  const nameExtension = String(file?.name || '').split('.').pop();
  return sanitizePathSegment(nameExtension, 'proof');
};

export const buildPaymentProofPath = ({ orderNumber, file }) => {
  const safeOrderNumber = sanitizePathSegment(orderNumber, 'order');
  const extension = getPaymentProofExtension(file);
  const token = Math.random().toString(36).slice(2, 10);
  return `orders/${safeOrderNumber}/${Date.now()}-${token}.${extension}`;
};

export const uploadPaymentProof = async ({ file, orderNumber }) => {
  validatePaymentProofFile(file);

  const path = buildPaymentProofPath({ orderNumber, file });
  const { error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Gagal upload bukti transfer');
  }

  return {
    bucket: PAYMENT_PROOFS_BUCKET,
    path,
    paymentProofUrl: path,
    fileName: file.name || path.split('/').pop(),
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
};

export const createPaymentProofSignedUrl = async (path, expiresIn = 60 * 10) => {
  if (!path) {
    throw new Error('Path bukti transfer tidak tersedia');
  }

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Gagal membuka bukti transfer');
  }

  return data.signedUrl;
};
