import { toast } from 'sonner';
import { getNotificationHandoffUrl } from '@/services/notificationTemplateService.js';

/**
 * Bulk "WA follow-up", one buyer at a time.
 *
 * Studio audit, 15 Nov 2026: the three bulk buttons (orders, phone orders, shipments) copied EVERY
 * selected buyer's message to the clipboard as one block and opened a chat with only the first buyer.
 * Pasting that block — the natural next move — sent every other buyer's name, items and total to that
 * one person. Now each chat opens with its own message already typed, and a toast offers the next one.
 * Nothing goes to the clipboard, so there is nothing to paste into the wrong chat.
 */
export const openFollowUpsOneByOne = (entries = [], index = 0) => {
  const list = entries.filter((entry) => entry?.message);
  const current = list[index];
  if (!current) return;
  window.open(getNotificationHandoffUrl(current.order, current.message), '_blank', 'noopener,noreferrer');
  const label = `${current.order?.orderNumber || ''} · ${current.order?.customerName || ''}`.trim();
  if (index + 1 < list.length) {
    toast.success(`WA ${index + 1} dari ${list.length} dibuka (${label})`, {
      duration: 120000,
      action: { label: 'Buka berikutnya', onClick: () => openFollowUpsOneByOne(list, index + 1) },
    });
  } else {
    toast.success(list.length > 1 ? `WA terakhir dibuka — ${list.length} pembeli selesai` : `WA dibuka (${label})`);
  }
};

export default openFollowUpsOneByOne;
