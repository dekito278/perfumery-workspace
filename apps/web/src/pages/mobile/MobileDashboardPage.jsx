import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Beaker, ClipboardCheck, ClipboardList, LibraryBig, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileLoadingSkeleton from '@/components/mobile-ui/MobileLoadingSkeleton.jsx';
import SummaryMetricCardMobile from '@/components/mobile/SummaryMetricCardMobile.jsx';
import ActivityCardMobile from '@/components/mobile/ActivityCardMobile.jsx';
import FormulaCardMobile from '@/components/mobile/FormulaCardMobile.jsx';
import BriefCardMobile from '@/components/mobile/BriefCardMobile.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { useValidationLogs } from '@/hooks/useValidationLogs.js';
import { getDisplayName, MOBILE_ACTIVITY_LIMIT, sortByUpdated } from '@/pages/mobile/mobilePageUtils.js';

const MobileDashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { fetchMaterialsSummary } = useRawMaterials();
  const { getFormulas } = useFormulas();
  const { getBriefs } = useBriefs();
  const { getValidationLogs } = useValidationLogs();
  const [materials, setMaterials] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [materialRows, formulaRows, briefRows, logRows] = await Promise.all([
          fetchMaterialsSummary(),
          getFormulas(),
          getBriefs(),
          getValidationLogs(),
        ]);
        if (!active) return;
        setMaterials(materialRows || []);
        setFormulas(formulaRows || []);
        setBriefs(briefRows || []);
        setLogs(logRows || []);
      } catch (error) {
        toast.error('Failed to load mobile dashboard');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [fetchMaterialsSummary, getBriefs, getFormulas, getValidationLogs]);

  const activeBriefs = useMemo(() => briefs.filter((brief) => ['draft', 'active'].includes(brief.status || 'draft')), [briefs]);
  const draftFormulas = useMemo(() => sortByUpdated(formulas.filter((formula) => (formula.status || 'draft') === 'draft')).slice(0, MOBILE_ACTIVITY_LIMIT), [formulas]);
  const recentBriefs = useMemo(() => sortByUpdated(briefs).slice(0, MOBILE_ACTIVITY_LIMIT), [briefs]);
  const recentActivity = useMemo(() => [
    ...sortByUpdated(formulas).slice(0, 3).map((formula) => ({ id: `formula-${formula.id}`, title: formula.name, meta: 'Formula updated', date: formula.updated || formula.created, path: `/mobile/formulas/${formula.id}` })),
    ...sortByUpdated(briefs).slice(0, 2).map((brief) => ({ id: `brief-${brief.id}`, title: brief.title, meta: 'Brief updated', date: brief.updated || brief.created, path: `/mobile/briefs/${brief.id}` })),
  ].slice(0, MOBILE_ACTIVITY_LIMIT), [briefs, formulas]);

  const formulasById = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula])), [formulas]);

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>Mobile Dashboard - Perfumer Studio</title></Helmet>
      <main className="mobile-page space-y-5">
        <MobileTopBar title="Home" subtitle={`Halo, ${getDisplayName(currentUser)}`} eyebrow="Perfumer Studio" action={<Sparkles className="h-6 w-6 text-amber-600" />} />
        <section className="mobile-soft-card p-5">
          <div className="text-xs font-bold uppercase text-amber-700">Workspace status</div>
          <h2 className="mt-2 text-2xl font-bold text-[#1f2937]">R&D flow is ready.</h2>
          <p className="mt-2 text-sm text-[#6b7280]">Brief, formula, material, and validation work are grouped for quick mobile decisions.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="rounded-2xl" onClick={() => navigate('/mobile/formulas/new')}>New Formula</Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => navigate('/mobile/briefs/new')}>New Brief</Button>
          </div>
        </section>

        {loading ? <MobileLoadingSkeleton count={4} /> : (
          <>
            <section className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              <SummaryMetricCardMobile icon={ClipboardList} label="Active Briefs" value={activeBriefs.length} />
              <SummaryMetricCardMobile icon={Beaker} label="Formulas" value={formulas.length} tone="blue" />
              <SummaryMetricCardMobile icon={LibraryBig} label="Materials" value={materials.length} tone="green" />
              <SummaryMetricCardMobile icon={ClipboardCheck} label="Validations" value={logs.length} tone="rose" />
            </section>

            <section className="mobile-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Pipeline progress</h2>
                <span className="text-xs font-bold text-amber-700">{logs.filter((log) => log.status === 'action_needed').length} action</span>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ['Briefs', activeBriefs.length, Math.max(briefs.length, 1)],
                  ['Draft formulas', draftFormulas.length, Math.max(formulas.length, 1)],
                  ['Validation logs', logs.length, Math.max(logs.length + 2, 1)],
                ].map(([label, value, total]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs font-bold text-[#6b7280]"><span>{label}</span><span>{value}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3f4f6]"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min((value / total) * 100, 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Draft formulas</h2><Button variant="ghost" onClick={() => navigate('/mobile/formulas')}>View all</Button></div>
              {draftFormulas.slice(0, 2).map((formula) => (
                <FormulaCardMobile key={formula.id} formula={formula} pipeline={{}} onView={() => navigate(`/mobile/formulas/${formula.id}`)} onDuplicate={() => {}} onEdit={() => navigate(`/mobile/formulas/${formula.id}/edit`)} onDelete={() => {}} />
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Brief updates</h2><Button variant="ghost" onClick={() => navigate('/mobile/briefs')}>View all</Button></div>
              {recentBriefs.slice(0, 2).map((brief) => (
                <BriefCardMobile key={brief.id} brief={brief} linkedFormula={formulasById.get(brief.formula_id)} onOpen={() => navigate(`/mobile/briefs/${brief.id}`)} />
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold">Recent activity</h2>
              {recentActivity.map((item) => (
                <ActivityCardMobile key={item.id} title={item.title} meta={item.meta} date={item.date} onClick={() => navigate(item.path)} />
              ))}
            </section>
          </>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileDashboardPage;
