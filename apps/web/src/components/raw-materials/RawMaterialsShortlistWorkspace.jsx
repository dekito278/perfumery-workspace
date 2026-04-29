import React from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RawMaterialsShortlistWorkspace = ({
  briefContext,
  shortlistLoading,
  shortlistItems,
  shortlistRoles,
  selectedMaterialIds,
  shortlistMaterialIds,
  handleSaveSelectionToShortlist,
  handleRemoveShortlistItem,
  handleUpdateShortlistRole,
  openFormulaWizard,
  navigateToBriefBoard,
}) => (
  <div className="mb-6 rounded-[26px] border bg-[linear-gradient(180deg,rgba(255,250,243,0.95)_0%,rgba(250,244,234,0.92)_100%)] p-5 shadow-sm">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-primary" />
          Material shortlist workspace
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {briefContext
            ? `You are shortlisting materials for "${briefContext.title}". Pilih kandidat dari tabel, simpan ke shortlist, lalu kirim langsung ke formula wizard.`
            : 'You are working in shortlist mode for a brief. Pick candidates from the table, save them, then move directly into formula composition.'}
        </p>
        {briefContext?.mood_story ? (
          <div className="mt-3 rounded-[18px] border bg-white/75 px-4 py-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Brief mood:</strong> {briefContext.mood_story}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={navigateToBriefBoard}
        >
          Open brief board
        </Button>
        <Button
          className="rounded-2xl gap-2"
          onClick={() => openFormulaWizard(selectedMaterialIds.length ? selectedMaterialIds : shortlistMaterialIds)}
        >
          Continue to formula
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[22px] border bg-white/80 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current selection</div>
        <div className="mt-2 text-2xl font-bold">{selectedMaterialIds.length}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Select rows from the table, then save them to this brief shortlist.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-2xl"
            disabled={!selectedMaterialIds.length}
            onClick={handleSaveSelectionToShortlist}
          >
            Save selection to shortlist
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            disabled={!selectedMaterialIds.length}
            onClick={() => openFormulaWizard(selectedMaterialIds)}
          >
            Compose from selection
          </Button>
        </div>
      </div>

      <div className="rounded-[22px] border bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved shortlist</div>
            <div className="mt-2 text-2xl font-bold">{shortlistLoading ? '...' : shortlistItems.length}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            disabled={!shortlistItems.length}
            onClick={() => openFormulaWizard(shortlistMaterialIds)}
          >
            Compose from shortlist
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {shortlistLoading ? (
            <div className="text-sm text-muted-foreground">Loading shortlist...</div>
          ) : shortlistItems.length ? shortlistItems.slice(0, 6).map((item) => (
            <div key={item.id} className="grid gap-3 rounded-[18px] border bg-background/75 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.expand?.raw_material_id?.name || 'Unknown material'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.expand?.raw_material_id?.category || item.expand?.raw_material_id?.type || 'Material'}
                </div>
              </div>
              <Select value={item.role || 'candidate'} onValueChange={(value) => handleUpdateShortlistRole(item.id, value)}>
                <SelectTrigger className="h-10 rounded-xl bg-white">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {shortlistRoles.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl px-3"
                onClick={() => handleRemoveShortlistItem(item.id)}
              >
                Remove
              </Button>
            </div>
          )) : (
            <div className="rounded-[18px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              No saved shortlist yet. Pick materials from the table and save them here first.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default RawMaterialsShortlistWorkspace;
