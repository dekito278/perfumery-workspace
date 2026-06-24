import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useSiteImages } from '@/hooks/useSiteImages.js';
import {
  deleteSiteImage,
  SITE_IMAGE_SLOTS,
  uploadSiteImage,
} from '@/services/siteImageStorageService.js';

const MobileImageSlotCard = ({ slot, currentUrl, onUpload, onDelete }) => {
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
    try {
      await onDelete(slot.key);
      toast.success(`${slot.label} removed`);
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const hasImage = Boolean(currentUrl);

  return (
    <div className="mobile-site-image-card">
      <div className="mobile-site-image-card__preview">
        {hasImage ? (
          <img src={currentUrl} alt={slot.label} loading="lazy" />
        ) : (
          <div className="mobile-site-image-card__placeholder">
            <ImagePlus size={24} />
          </div>
        )}
      </div>
      <div className="mobile-site-image-card__body">
        <h3>{slot.label}</h3>
        <p>{slot.hint}</p>
        <div className="mobile-site-image-card__actions">
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
            <Upload size={14} />
            {uploading ? 'Uploading...' : hasImage ? 'Replace' : 'Upload'}
          </Button>
          {hasImage && (
            <Button size="sm" variant="outline" onClick={handleDelete}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const MobileSiteImagesPage = () => {
  const { images, loading, refresh } = useSiteImages();

  const handleUpload = async (key, file) => {
    await uploadSiteImage(key, file);
    await refresh();
  };

  const handleDelete = async (key) => {
    await deleteSiteImage(key);
    await refresh();
  };

  return (
    <MobileAuthenticatedLayout>
      <Helmet>
        <title>Site Images - SOLIVAGANT Studio</title>
      </Helmet>
      <MobileTopBar title="Site Images" />

      <div className="mobile-site-images">
        <p className="mobile-site-images__desc">
          Manage storefront images — hero, mood visuals, and banners. Changes go live immediately.
        </p>

        {loading ? (
          <div className="mobile-site-images__loading">Loading...</div>
        ) : (
          <div className="mobile-site-images__list">
            {SITE_IMAGE_SLOTS.map((slot) => (
              <MobileImageSlotCard
                key={slot.key}
                slot={slot}
                currentUrl={images[slot.key] || ''}
                onUpload={handleUpload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </MobileAuthenticatedLayout>
  );
};

export default MobileSiteImagesPage;
