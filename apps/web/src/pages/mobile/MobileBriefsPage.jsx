import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import BriefCardMobile from '@/components/mobile/BriefCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { filterByText, getVisibleItems, MOBILE_PAGE_SIZE, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const MobileBriefsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryFormulaId = searchParams.get('formulaId') || '';
  const { getBriefs } = useBriefs();
  const { getFormulas } = useFormulas();
  const [briefs, setBriefs] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [briefRows, formulaRows] = await Promise.all([getBriefs(), getFormulas()]);
        if (!active) return;
        setBriefs(briefRows || []);
        setFormulas(formulaRows || []);
      } catch (error) {
        toast.error('Failed to load briefs');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [getBriefs, getFormulas]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);
  const filtered = useMemo(() => {
    const searched = filterByText(briefs, query, ['title', 'status', 'mood_story', (brief) => formulasById.get(brief.formula_id)?.name]);
    return sortByUpdated(searched).filter((brief) => status === 'all' || (brief.status || 'draft') === status);
  }, [briefs, formulasById, query, status]);
  const visible = getVisibleItems(filtered, visibleCount);

  useEffect(() => setVisibleCount(MOBILE_PAGE_SIZE), [query, status]);

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Briefs - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-3">
        <MobileTopBar
          title="Briefs"
          subtitle="Project direction and R&D handoff"
          action={<Button type="button" size="icon" onClick={() => navigate(queryFormulaId ? `/mobile/briefs/new?formulaId=${queryFormulaId}` : '/mobile/briefs/new')} className="h-11 w-11 rounded-2xl"><Plus className="h-5 w-5" /></Button>}
        />
        <div className="mobile-sticky-search">
          <MobileSearchBar value={query} onChange={setQuery} placeholder="Search briefs or formulas..." disabled={loading} />
          <MobileFilterChips options={statusOptions} value={status} onChange={setStatus} />
        </div>
        {loading ? <MobileLoadingSkeleton count={4} /> : briefs.length === 0 ? (
          <MobileEmptyState icon={ClipboardList} title="No briefs yet" description="Create a brief to capture mood, audience, performance, and formula direction." action="New Brief" onAction={() => navigate('/mobile/briefs/new')} />
        ) : filtered.length === 0 ? (
          <MobileEmptyState title="No matching briefs" description="Try a different search or status filter." />
        ) : (
          <>
            <div className="space-y-2">
              {visible.map((brief) => (
                <BriefCardMobile
                  key={brief.id}
                  brief={brief}
                  linkedFormula={formulasById.get(brief.formula_id)}
                  onOpen={() => navigate(`/mobile/briefs/${brief.id}`)}
                />
              ))}
            </div>
            <PaginationOrLoadMore visibleCount={visible.length} totalCount={filtered.length} onLoadMore={() => setVisibleCount((current) => current + MOBILE_PAGE_SIZE)} />
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBriefsPage;
