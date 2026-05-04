import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Beaker, BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import MobileEmptyState from '@/components/mobile-ui/MobileEmptyState.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useBriefDetailPage } from '@/hooks/useBriefDetailPage.js';
import { useBriefs } from '@/hooks/useBriefs.js';
import { formatDate, formatStatus } from '@/utils/formatting.js';

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'direction', label: 'Direction' },
  { value: 'materials', label: 'Materials' },
  { value: 'formula', label: 'Formula' },
  { value: 'activity', label: 'Activity' },
];

const MobileBriefDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { deleteBrief } = useBriefs();
  const detail = useBriefDetailPage(id);
  const {
    actionNeededLogs,
    brief,
    formula,
    loading,
    readyStageCount,
    selectedItemsByStage,
    validationLogs,
  } = detail;

  const selectedItems = useMemo(() => ['top', 'middle', 'base'].flatMap((stage) => selectedItemsByStage?.[stage] || []), [selectedItemsByStage]);

  const handleDelete = async () => {
    if (!brief) return;
    setDeleting(true);
    try {
      await deleteBrief(brief.id);
      toast.success('Brief deleted');
      navigate('/mobile/briefs');
    } catch (error) {
      toast.error(error.message || 'Failed to delete brief');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !brief) {
    return (
      <MobileAuthenticatedLayout>
        <main className="mobile-page"><div className="mobile-card p-6 text-sm text-[#6b7280]">Loading brief project...</div></main>
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{brief.title} - Mobile Brief</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title={brief.title}
          subtitle={`Updated ${formatDate(brief.updated || brief.created)}`}
          onBack={() => navigate('/mobile/briefs')}
          action={<MobileStatusBadge status={brief.status || 'draft'} />}
        />
        <section className="mobile-soft-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Progress</div>
              <div className="mt-1 text-2xl font-bold text-[#1f2937]">{readyStageCount || 0}/3 stages</div>
            </div>
            <div className="text-right text-xs font-bold text-[#6b7280]">{actionNeededLogs?.length || 0} action logs</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(((readyStageCount || 0) / 3) * 100, 100)}%` }} />
          </div>
        </section>
        <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} />
        <section className="space-y-3">
          {tab === 'overview' ? (
            <>
              <div className="mobile-card p-4">
                <h2 className="text-lg font-bold">Brief summary</h2>
                <p className="mt-2 text-sm text-[#6b7280]">{brief.mood_story || 'No mood story yet.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">Formula</div><div className="mt-1 text-sm font-bold">{formula?.name || 'Not linked'}</div></div>
                <div className="mobile-card p-4"><div className="text-xs font-bold uppercase text-[#9ca3af]">Status</div><div className="mt-1 text-sm font-bold capitalize">{brief.status || 'draft'}</div></div>
              </div>
            </>
          ) : null}
          {tab === 'direction' ? (
            ['mood_story', 'audience_usage', 'performance_target', 'budget_direction'].map((field) => (
              <div key={field} className="mobile-card p-4">
                <div className="text-xs font-bold uppercase text-[#9ca3af]">{formatStatus(field)}</div>
                <p className="mt-2 text-sm text-[#374151]">{brief[field] || 'Not set'}</p>
              </div>
            ))
          ) : null}
          {tab === 'materials' ? (
            selectedItems.length ? selectedItems.slice(0, 7).map((item) => (
              <div key={item.id || item.raw_material_id} className="mobile-card p-4">
                <div className="text-sm font-bold">{item.raw_material_name || item.material_name || item.name || 'Selected material'}</div>
                <div className="mt-1 text-xs text-[#6b7280]">Stage {item.stage || 'project'} · {item.selection_state || 'selected'}</div>
              </div>
            )) : <MobileEmptyState title="No shortlisted materials" description="Add materials from the material library to shape this brief." />
          ) : null}
          {tab === 'formula' ? (
            <div className="mobile-card p-4">
              <div className="text-lg font-bold">{formula?.name || 'No formula linked'}</div>
              <p className="mt-2 text-sm text-[#6b7280]">{formula ? `Code ${formula.code}` : 'Create a formula from this brief when stage decisions are ready.'}</p>
              <Button className="mt-4 w-full rounded-2xl" onClick={() => navigate(formula ? `/mobile/formulas/${formula.id}` : `/mobile/formulas/new?briefId=${brief.id}`)}>
                {formula ? 'Open Formula' : 'Create Formula'}
              </Button>
            </div>
          ) : null}
          {tab === 'activity' ? (
            validationLogs?.length ? validationLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="mobile-card p-4">
                <MobileStatusBadge status={log.status || 'logged'} />
                <div className="mt-2 text-sm font-medium">{log.note}</div>
                <div className="mt-2 text-xs text-[#6b7280]">{formatDate(log.tested_at || log.created)}</div>
              </div>
            )) : <MobileEmptyState title="No activity yet" description="Validation and project activity will appear here." />
          ) : null}
        </section>
        <StickyBottomActionBar>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/briefs/${brief.id}/edit`)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => navigate(`/mobile/raw-materials?briefId=${brief.id}`)}><BookmarkPlus className="mr-1 h-4 w-4" />Shortlist</Button>
            <Button className="rounded-2xl text-xs" onClick={() => navigate(formula ? `/mobile/formulas/${formula.id}/edit?briefId=${brief.id}` : `/mobile/formulas/new?briefId=${brief.id}`)}><Beaker className="mr-1 h-4 w-4" />Formula</Button>
            <Button variant="outline" className="rounded-2xl border-rose-100 bg-rose-50 text-xs text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={brief.title} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileBriefDetailPage;
