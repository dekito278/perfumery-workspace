import React from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Says out loud that this catalogue came from the browser's own storage because the server could not be
 * reached.
 *
 * The fallback itself is worth keeping — a stale shop beats a blank one on a flaky connection. What was
 * not acceptable is that it was SILENT. Dekito opened his own shop through a VPN and read a product
 * description that had been replaced two days earlier; the server no longer held that text anywhere, so
 * nothing on the page could have told him. A buyer in the same position sees prices that may have moved
 * and adds them to a cart the order endpoint then prices properly at checkout.
 *
 * Deliberately not a blocker. The shop stays usable and the buyer gets to decide whether to trust what
 * they are reading, which is the whole point of saying it.
 */
const StaleCatalogNotice = ({ stale, className = '' }) => {
  if (!stale) return null;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-900 ${className}`}
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-[12rem] flex-1">
        Koneksi ke server gagal, jadi katalog ini ditampilkan dari simpanan di perangkatmu. Harga dan
        deskripsinya bisa sudah tidak berlaku.
      </span>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('dekito:products-updated'))}
        className="rounded-xl border border-amber-400 bg-white px-3 py-1.5 font-bold text-amber-900"
      >
        Coba muat ulang
      </button>
    </div>
  );
};

export default StaleCatalogNotice;
