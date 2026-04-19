import React, { useEffect, useMemo, useState } from 'react';
import { Search, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNullable, formatPercentage } from '@/utils/formatting.js';
import {
  assignPrimaryReferenceProfile,
  removePrimaryReferenceProfile,
  searchReferenceProfiles,
} from '@/services/materialReferenceService.js';

const ManualReferenceMatchModal = ({
  open,
  onOpenChange,
  material,
  currentLink,
  onSuccess,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const currentProfile = currentLink?.reference_profile || null;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedId(null);
      setLoading(false);
      setSaving(false);
      return;
    }

    let cancelled = false;

    const loadResults = async () => {
      setLoading(true);
      try {
        const nextResults = await searchReferenceProfiles(query, 12);
        if (!cancelled) {
          setResults(nextResults);
        }
      } catch (_error) {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(loadResults, query ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const selectedProfile = useMemo(
    () => results.find((item) => item.id === selectedId) || null,
    [results, selectedId]
  );

  const handleAssign = async () => {
    if (!material?.id || !selectedProfile?.id) {
      return;
    }

    setSaving(true);
    try {
      await assignPrimaryReferenceProfile(material.id, selectedProfile.id, `Manually matched from UI on ${new Date().toISOString()}`);
      await onSuccess?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!material?.id || !currentProfile) {
      return;
    }

    setSaving(true);
    try {
      await removePrimaryReferenceProfile(material.id);
      await onSuccess?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden border-white/70 bg-[#fffaf2] p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Match Reference Profile</DialogTitle>
          <DialogDescription>
            Attach a workbook reference profile to <strong>{material?.name || 'this material'}</strong> without changing stock, vendor, cost, or dilution data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-border/60 bg-white/70 px-6 py-5 lg:border-b-0 lg:border-r">
            <div className="rounded-2xl border border-border/60 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inventory material</div>
              <div className="mt-3 text-lg font-semibold">{material?.name || 'Unknown material'}</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div>Workbook code: {formatNullable(material?.workbook_code)}</div>
                <div>CAS: {formatNullable(material?.cas_number)}</div>
                <div>Vendor: {formatNullable(material?.vendor)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current link</div>
              {currentProfile ? (
                <div className="mt-3 space-y-2">
                  <div className="text-base font-semibold">{currentProfile.name}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Ref {currentProfile.reference_code}</Badge>
                    <Badge variant="outline">{currentLink?.match_method || 'manual'}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ABC: {formatNullable(currentProfile.abc_code)} · IFRA: {currentProfile.ifra_limit_percent !== null ? formatPercentage(currentProfile.ifra_limit_percent, 2) : 'N/A'}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No primary reference profile linked yet.
                </p>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by reference code, name, CAS, ABC family..."
                className="h-11 rounded-2xl border-white/70 bg-white pl-10"
              />
            </div>

            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-white/80 p-5 text-sm text-muted-foreground">
                  Loading reference profiles...
                </div>
              ) : results.length ? results.map((profile) => {
                const selected = profile.id === selectedId;
                const isCurrent = currentProfile?.id === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-white/90 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{profile.name}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="secondary">Ref {profile.reference_code}</Badge>
                          {profile.abc_code ? <Badge variant="outline">{profile.abc_code}</Badge> : null}
                          {isCurrent ? <Badge variant="outline">Current link</Badge> : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>CAS {formatNullable(profile.cas_no)}</div>
                        <div>{formatNullable(profile.supplier, 'Supplier N/A')}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <div>Family: {formatNullable(profile.abc_primary_family)}</div>
                      <div>Typical: {profile.use_level_typical_percent !== null ? formatPercentage(profile.use_level_typical_percent, 2) : 'N/A'}</div>
                      <div>IFRA: {profile.ifra_limit_percent !== null ? formatPercentage(profile.ifra_limit_percent, 2) : 'N/A'}</div>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-white/80 p-5 text-sm text-muted-foreground">
                  No reference profiles found for that search yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          {currentProfile ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={saving}
              className="gap-2"
            >
              <Unlink className="h-4 w-4" />
              Remove link
            </Button>
          ) : <div />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAssign} disabled={!selectedProfile || saving}>
              {saving ? 'Saving...' : 'Use selected profile'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualReferenceMatchModal;
