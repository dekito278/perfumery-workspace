import React from 'react';
import { Helmet } from 'react-helmet';
import { Download, Factory, Home, Package2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import PageHeader from '@/components/PageHeader.jsx';
import ProductionBulkTab from '@/components/production-costing/ProductionBulkTab.jsx';
import ProductionCostOverviewCards from '@/components/production-costing/ProductionCostOverviewCards.jsx';
import ProductionCostToolbar from '@/components/production-costing/ProductionCostToolbar.jsx';
import ProductionRetailTab from '@/components/production-costing/ProductionRetailTab.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useProductionCostPage } from '@/hooks/useProductionCostPage.js';

const ProductionCostPage = () => {
  const navigate = useNavigate();
  const {
    activeTab,
    addBulkScenario,
    bulkChampion,
    bulkComputed,
    bulkInputs,
    bulkScenarios,
    formulas,
    handleExportPdf,
    handleExportQuotationPdf,
    handlePrint,
    handlePrintQuotation,
    loading,
    quotationInputs,
    quotationOpen,
    retailChampion,
    retailComputed,
    retailInputs,
    retailScenarios,
    selectedFormula,
    selectedFormulaId,
    selectedQuotationRow,
    selectedSolventId,
    setActiveTab,
    setQuotationOpen,
    setSelectedFormulaId,
    setSelectedSolventId,
    solventOptions,
    updateBulkInput,
    updateBulkScenario,
    updateQuotationInput,
    updateRetailInput,
    updateRetailScenario,
    removeBulkScenario,
  } = useProductionCostPage();

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Production Costing - Perfumer Studio</title>
        <meta
          name="description"
          content="Calculate retail bottle COGS and bulk brand pricing from formula concentrate, solvent, packaging, overhead, and manual markup."
        />
      </Helmet>

      <div className="page-container">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/studio')}
            className="mb-4 h-9 gap-2"
          >
            <Home className="h-4 w-4" />
            Back to dashboard
          </Button>
        </div>

        <PageHeader
          title="Production Costing"
          description="Pakai satu halaman untuk dua kebutuhan: costing botol retail dan harga bulk juice ke brand dengan volume quote yang bisa diatur sendiri."
          action="Export PDF"
          actionIcon={Download}
          onAction={handleExportPdf}
          eyebrow="Costing"
        />

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <ProductionCostOverviewCards
              retailComputed={retailComputed}
              bulkComputed={bulkComputed}
              retailChampion={retailChampion}
              bulkChampion={bulkChampion}
            />

            <ProductionCostToolbar
              formulas={formulas}
              onExportPdf={handleExportPdf}
              onPrint={handlePrint}
              retailInputs={retailInputs}
              selectedFormulaId={selectedFormulaId}
              selectedSolventId={selectedSolventId}
              setSelectedFormulaId={setSelectedFormulaId}
              setSelectedSolventId={setSelectedSolventId}
              solventOptions={solventOptions}
              updateRetailInput={updateRetailInput}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto w-full justify-start gap-2 rounded-xl bg-muted/50 p-1">
                <TabsTrigger value="retail" className="gap-2 rounded-lg px-4 py-2">
                  <Package2 className="h-4 w-4" />
                  Bottle Costing
                </TabsTrigger>
                <TabsTrigger value="bulk" className="gap-2 rounded-lg px-4 py-2">
                  <Factory className="h-4 w-4" />
                  Bulk / Brand Costing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="retail" className="mt-4 space-y-6">
                <ProductionRetailTab
                  onPrint={handlePrint}
                  retailComputed={retailComputed}
                  retailInputs={retailInputs}
                  retailScenarios={retailScenarios}
                  updateRetailInput={updateRetailInput}
                  updateRetailScenario={updateRetailScenario}
                />
              </TabsContent>

              <TabsContent value="bulk" className="mt-4 space-y-6">
                <ProductionBulkTab
                  addBulkScenario={addBulkScenario}
                  bulkComputed={bulkComputed}
                  bulkInputs={bulkInputs}
                  bulkScenarios={bulkScenarios}
                  handleExportQuotationPdf={handleExportQuotationPdf}
                  handlePrintQuotation={handlePrintQuotation}
                  quotationInputs={quotationInputs}
                  quotationOpen={quotationOpen}
                  removeBulkScenario={removeBulkScenario}
                  selectedFormula={selectedFormula}
                  selectedQuotationRow={selectedQuotationRow}
                  setQuotationOpen={setQuotationOpen}
                  updateBulkInput={updateBulkInput}
                  updateBulkScenario={updateBulkScenario}
                  updateQuotationInput={updateQuotationInput}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductionCostPage;
