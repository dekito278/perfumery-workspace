import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Copy, Database, ShieldCheck } from 'lucide-react';
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
  { value: 'practical', label: 'Duplicate' },
  { value: 'review', label: 'CAS Collision' },
  { value: 'missing', label: 'Missing' },
  { value: 'safe', label: 'Safe' },
];

const MobileRawMaterialAuditPage = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('practical');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);

  useEffect(() => {
    let active = true;
    const loadAudit = async () => {
      setLoading(true);
      try {
        const rows = await getRawMaterialOptions({ forceRefresh: true });
        if (active) setMaterials(rows || []);
      } catch (error) {
        toast.error('Failed to load material audit');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAudit();
    return () => { active = false; };
  }, []);

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
      <Helmet><title>Mobile Material Audit - Solivagant</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Material Audit" onBack={() => navigate('/mobile/raw-materials')} action={<AlertTriangle className="h-6 w-6 text-amber-600" />} />
        {loading ? <MobileLoadingState eyebrow="Material audit" title="Scanning materials..." subtitle="Checking duplicates and missing data." className="min-h-[calc(100dvh-260px)]" /> : (
          <>
            <section className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              <SummaryMetricCardMobile icon={Database} label="Total" value={materials.length} />
              <SummaryMetricCardMobile icon={Copy} label="Duplicates" value={audit.summary?.practicalMergeCandidateCount || 0} tone="rose" />
              <SummaryMetricCardMobile icon={AlertTriangle} label="Missing" value={missingMetadata.length} tone="amber" />
              <SummaryMetricCardMobile icon={ShieldCheck} label="Safe" value={safeMaterials.length} tone="green" />
            </section>
            <MobileSegmentedControl options={groups} value={tab} onChange={setTab} />
            {visible.length ? (
              <div className="space-y-3">
                {visible.map((row, index) => {
                  const material = row.material || row.master || row.duplicate || row.materials?.[0] || row;
                  return (
                    <MobileAccordion
                      key={row.id || material?.id || index}
                      title={material?.name || row.casNumber || 'Audit issue'}
                      meta={row.reason || row.note || row.casNumber || 'Review material metadata'}
                    >
                      <div className="space-y-2 text-sm text-[#6b7280]">
                        {row.duplicate ? <div>Duplicate: {row.duplicate.name}</div> : null}
                        {row.materials?.length ? <div>{row.materials.length} materials share this CAS/group.</div> : null}
                        {material?.cas_number ? <div>CAS {material.cas_number}</div> : <div>CAS missing</div>}
                        <button type="button" onClick={() => material?.id && navigate(`/mobile/raw-material/${material.id}`)} className="mt-2 h-11 rounded-2xl bg-amber-500 px-4 text-sm font-bold text-white">
                          Open material
                        </button>
                      </div>
                    </MobileAccordion>
                  );
                })}
                <PaginationOrLoadMore visibleCount={visible.length} totalCount={activeRows.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
              </div>
            ) : <MobileEmptyState icon={ShieldCheck} title="No issues in this group" />}
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialAuditPage;

