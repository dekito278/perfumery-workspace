import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FORMULA_CATEGORIES, FORMULA_STATUSES } from '@/utils/constants.js';

const FormulaMetadataDialog = ({
  open,
  onOpenChange,
  title = 'Create formula',
  description = 'Isi identitas formula dulu sebelum mulai menyusun komposisinya.',
  name,
  code,
  category,
  version,
  status,
  onNameChange,
  onCodeChange,
  onCategoryChange,
  onVersionChange,
  onStatusChange,
  validationErrors = {},
  onConfirm,
  confirmLabel = 'OK',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[28px] border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,246,239,1)_100%)] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-[-0.02em]">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="formula-meta-name">Formula name *</Label>
            <Input
              id="formula-meta-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g., Summer Breeze"
              className="h-11 rounded-2xl"
            />
            {validationErrors.name ? <p className="text-xs text-destructive">{validationErrors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="formula-meta-code">Formula code *</Label>
            <Input
              id="formula-meta-code"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="e.g., SB-001"
              className="h-11 rounded-2xl"
            />
            {validationErrors.code ? <p className="text-xs text-destructive">{validationErrors.code}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="formula-meta-category">Category</Label>
            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger id="formula-meta-category" className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMULA_CATEGORIES.map((formulaCategory) => (
                  <SelectItem key={formulaCategory.value} value={formulaCategory.value}>
                    {formulaCategory.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="formula-meta-version">Version</Label>
            <Input
              id="formula-meta-version"
              value={version}
              onChange={(event) => onVersionChange(event.target.value)}
              placeholder="e.g., 1.0"
              className="h-11 rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="formula-meta-status">Status</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger id="formula-meta-status" className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMULA_STATUSES.map((formulaStatus) => (
                  <SelectItem key={formulaStatus.value} value={formulaStatus.value}>
                    {formulaStatus.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" onClick={onConfirm} className="h-11 rounded-2xl px-5">
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FormulaMetadataDialog;
