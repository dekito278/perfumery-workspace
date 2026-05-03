import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { BookmarkPlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import DeleteConfirmationDialog from '@/components/mobile-ui/DeleteConfirmationDialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { getRawMaterialById } from '@/services/rawMaterialsService.js';
import { formatNullable, formatPercentage, formatStatus } from '@/utils/formatting.js';

const MobileRawMaterialDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deleteMaterial } = useRawMaterials();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadMaterial = async () => {
      setLoading(true);
      try {
        const row = await getRawMaterialById(id);
        if (active) setMaterial(row);
      } catch (error) {
        toast.error('Failed to load material');
        navigate('/mobile/raw-materials');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMaterial();
    return () => { active = false; };
  }, [id, navigate]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMaterial(id);
      toast.success('Material deleted');
      navigate('/mobile/raw-materials');
    } catch (error) {
      toast.error(error.message || 'Failed to delete material');
      setDeleting(false);
    }
  };

  if (loading || !material) {
    return <MobileAuthenticatedLayout><main className="mobile-page"><div className="mobile-card p-6 text-sm text-[#6b7280]">Loading material...</div></main></MobileAuthenticatedLayout>;
  }

  const ready = Boolean(material.workbook_code || material.reference_impact || material.reference_life_hours || material.ifra_limit);
  const sections = [
    ['Basic information', [['Type', formatStatus(material.type)], ['Category', formatStatus(material.category)], ['Unit', material.unit || '-']]],
    ['CAS and supplier', [['CAS', formatNullable(material.cas_number)], ['Supplier', formatNullable(material.vendor)], ['Workbook', formatNullable(material.workbook_code)]]],
    ['Usage recommendation', [['Typical use', material.reference_use_level_typical_percent != null ? formatPercentage(material.reference_use_level_typical_percent, 2) : 'N/A'], ['Max use', material.reference_use_level_max_percent != null ? formatPercentage(material.reference_use_level_max_percent, 2) : 'N/A']]],
    ['Safety / audit status', [['IFRA', material.ifra_limit != null ? formatPercentage(material.ifra_limit, 2) : 'N/A'], ['Impact', material.reference_impact ?? 'N/A'], ['Life hours', material.reference_life_hours ?? 'N/A']]],
  ];

  return (
    <MobileAuthenticatedLayout>
      <Helmet><title>{material.name} - Mobile Material</title></Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title={material.name} subtitle={`CAS ${material.cas_number || 'Not set'}`} onBack={() => navigate('/mobile/raw-materials')} action={<MobileStatusBadge tone={ready ? 'active' : 'warning'}>{ready ? 'Ready' : 'Audit'}</MobileStatusBadge>} />
        {sections.map(([title, rows]) => (
          <section key={title} className="mobile-card p-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <div className="mt-3 grid gap-2">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#f8f7f4] p-3">
                  <div className="text-[11px] font-bold uppercase text-[#9ca3af]">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-[#1f2937]">{value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {material.notes ? <section className="mobile-card p-4"><h2 className="text-lg font-bold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm text-[#6b7280]">{material.notes}</p></section> : null}
        <StickyBottomActionBar>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="rounded-2xl bg-white text-xs" onClick={() => toast.success('Material added to shortlist')}><BookmarkPlus className="mr-1 h-4 w-4" />Shortlist</Button>
            <Button className="rounded-2xl text-xs" onClick={() => navigate(`/mobile/formulas/new?materialIds=${material.id}`)}><Plus className="mr-1 h-4 w-4" />Formula</Button>
            <Button variant="outline" className="rounded-2xl border-rose-200 bg-rose-50 text-xs text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
          </div>
        </StickyBottomActionBar>
      </main>
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} itemName={material.name} onConfirm={handleDelete} loading={deleting} />
    </MobileAuthenticatedLayout>
  );
};

export default MobileRawMaterialDetailPage;
