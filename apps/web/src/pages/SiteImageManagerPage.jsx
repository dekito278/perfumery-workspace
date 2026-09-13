import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import {
  deleteSiteImage,
  groupDuplicateSlots,
  listSiteImageFingerprints,
  SITE_IMAGE_SLOTS,
  uploadSiteImage,
} from '@/services/siteImageStorageService.js';

const ImageSlotCard = ({ slot, currentUrl, duplicateLabels = [], onUpload, onDelete }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(slot.key, file);
      toast.success(`${slot.label} updated`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus gambar "${slot.label}" dari situs? Slot ini akan kosong di storefront sampai kamu upload ulang.`)) return;
    try {
      await onDelete(slot.key);
      toast.success(`${slot.label} removed`);
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const hasImage = Boolean(currentUrl);

  return (
    <div className="site-image-slot">
      <div className="site-image-slot__preview">
        {hasImage ? (
          <img src={currentUrl} alt={slot.label} loading="lazy" />
        ) : (
          <div className="site-image-slot__placeholder">
            <ImagePlus className="h-8 w-8" />
            <span>{slot.hint}</span>
          </div>
        )}
      </div>
      <div className="site-image-slot__info">
        <div>
          <h3>{slot.label}</h3>
          <p>{slot.hint}</p>
          <code>{slot.key}</code>
          {/* An uploaded slot looks finished whether or not the same file is in three others. Storage
              gives us the content hash, so say it here rather than letting the storefront say it. */}
          {duplicateLabels.length ? (
            <p className="site-image-slot__duplicate" role="status">
              Gambar sama persis dengan: {duplicateLabels.join(', ')}.
            </p>
          ) : null}
        </div>
        <div className="site-image-slot__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            hidden
          />
          <Button
            size="sm"
            variant={hasImage ? 'outline' : 'default'}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : hasImage ? 'Replace' : 'Upload'}
          </Button>
          {hasImage ? (
            <Button size="sm" variant="outline" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const SiteImageManagerPage = () => {
  const { images, loading, refresh } = useSiteImages();

  const handleUpload = async (key, file) => {
    await uploadSiteImage(key, file);
    await refresh();
  };

  const handleDelete = async (key) => {
    await deleteSiteImage(key);
    await refresh();
  };

  const [duplicates, setDuplicates] = useState({});
  const loadDuplicates = useCallback(async () => {
    try {
      setDuplicates(groupDuplicateSlots(await listSiteImageFingerprints()));
    } catch (error) {
      // A failed fingerprint read must not take the manager down with it: the slots and their previews
      // are still usable, we just cannot point out the repeats.
      console.warn('Could not check for repeated site images:', error?.message || error);
      setDuplicates({});
    }
  }, []);
  useEffect(() => { loadDuplicates(); }, [loadDuplicates, images]);

  const labelFor = (key) => SITE_IMAGE_SLOTS.find((slot) => slot.key === key)?.label || key;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Site Images - SOLIVAGANT Studio</title>
      </Helmet>

      <div className="site-image-manager">
        <div className="site-image-manager__header">
          <div>
            <h1>Site Images</h1>
            <p>Upload and manage images used across the storefront — hero banners, mood visuals, and section backgrounds. Changes go live immediately without redeploying.</p>
          </div>
        </div>

        {loading ? (
          <div className="site-image-manager__loading">Loading images...</div>
        ) : (
          <div className="site-image-manager__grid">
            {SITE_IMAGE_SLOTS.map((slot) => (
              <ImageSlotCard
                key={slot.key}
                slot={slot}
                currentUrl={images[slot.key] || ''}
                duplicateLabels={(duplicates[slot.key] || []).map(labelFor)}
                onUpload={handleUpload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default SiteImageManagerPage;
