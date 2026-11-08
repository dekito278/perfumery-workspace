import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Copy, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';
import SummaryMetricCardMobile from '@/components/mobile/SummaryMetricCardMobile.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { buildRawMaterialDuplicateAudit } from '@/utils/rawMaterialDuplicateAudit.js';
import { MOBILE_PAGE_SIZE } from '@/pages/mobile/mobilePageUtils.js';

const groups = [
  { value: 'practical', label: 'Duplikat' },
  { value: 'review', label: 'CAS bentrok' },
  { value: 'missing', label: 'Data kurang' },
  { value: 'safe', label: 'Aman' },
];

const MobileRawMaterialAuditPage = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('practical');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getRawMaterialOptions({ forceRefresh: true });
      setMaterials(rows || []);
    } catch (error) {
      toast.error('Gagal memuat audit bahan baku');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadAudit();
      }
    };

    window.addEventListener('focus', loadAudit);
    window.addEventListener('pageshow', loadAudit);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', loadAudit);
      window.removeEventListener('pageshow', loadAudit);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadAudit]);

  const audit = useMemo(() => buildRawMaterialDuplicateAudit(materials), [materials]);
  const missingMetadata = useMemo(() => materials.filter((material) => !material.cas_number || !material.category || !material.workbook_code), [materials]);
  const safeMaterials = useMemo(() => materials.filter((material) => material.cas_number && material.category && (material.workbook_code || material.reference_abc_primary_family)), [materials]);
  const activeRows = {
    practical: audit.practicalMergeCandidates || [],
    review: audit.reviewGroups || [],
    missing: missingMetadata,
    safe: safeMaterials,
  }[tab] || [];
  const visible = activeRows.slice(0, visibleCount);

  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [tab]);

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Audit bahan baku - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Audit bahan baku"
          onBack={() => navigate('/mobile/raw-materials')}
          action={(
            <button
              type="button"
              onClick={loadAudit}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700 disabled:opacity-60"
              aria-label="Muat ulang audit"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        />
        {loading ? <MobileLoadingState eyebrow="Audit bahan baku" title="Memindai bahan baku..." subtitle="Memeriksa duplikat dan data yang belum lengkap." className="min-h-[calc(100dvh-260px)]" /> : (
          <>
            <section className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              <SummaryMetricCardMobile icon={Database} label="Total" value={materials.length} />
              <SummaryMetricCardMobile icon={Copy} label="Duplikat" value={audit.summary?.practicalMergeCandidateCount || 0} tone="rose" />
              <SummaryMetricCardMobile icon={AlertTriangle} label="Data kurang" value={missingMetadata.length} tone="amber" />
              <SummaryMetricCardMobile icon={ShieldCheck} label="Aman" value={safeMaterials.length} tone="green" />
            </section>
            <MobileSegmentedControl options={groups} value={tab} onChange={setTab} />
            {visible.length ? (
              <div className="space-y-3">
                {visible.map((row, index) => {
                  const material = row.material || row.master || row.duplicate || row.materials?.[0] || row;
                  return (
                    <MobileAccordion
                      key={row.id || material?.id || index}
                      title={material?.name || row.casNumber || 'Temuan audit'}
                      meta={row.reason || row.note || row.casNumber || 'Periksa metadata bahan'}
                    >
                      <div className="space-y-2 text-sm text-[#6b7280]">
                        {row.duplicate ? <div>Duplikat: {row.duplicate.name}</div> : null}
                        {row.materials?.length ? <div>{row.materials.length} bahan memakai CAS/grup yang sama.</div> : null}
                        {material?.cas_number ? <div>CAS {material.cas_number}</div> : <div>CAS belum diisi</div>}
                        <button type="button" onClick={() => navigate(`/mobile/raw-material/${material.id}`)} disabled={!material?.id} className="mt-2 h-11 rounded-2xl bg-amber-500 px-4 text-sm font-bold text-white disabled:bg-[#e5e7eb] disabled:text-[#6b7280]">
                          Buka bahan
                        </button>
                      </div>
                    </MobileAccordion>
                  );
                })}
                <PaginationOrLoadMore visibleCount={visible.length} totalCount={activeRows.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
              </div>
            ) : <MobileEmptyState icon={ShieldCheck} title="Tidak ada temuan di grup ini" />}
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialAuditPage;

