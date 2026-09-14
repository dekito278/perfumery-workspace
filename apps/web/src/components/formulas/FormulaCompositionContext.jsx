import React from 'react';
import { Badge } from '@/components/ui/badge';
import { composerSectionClass } from '@/hooks/useFormulaComposer.js';

const FormulaCompositionContext = ({ seedMaterialCount }) => (
  <div className={`mb-4 space-y-4 xl:hidden ${composerSectionClass}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="eyebrow text-muted-foreground">
          Konteks komposisi
        </div>
        <h2 className="mt-2 text-lg font-semibold">
          {seedMaterialCount ? 'Compose from selected materials' : 'Standalone formula'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {seedMaterialCount
            ? 'Formula ini dimulai dari material yang dipilih. Rapikan struktur dan gramnya dari composer di bawah.'
            : 'Isi nama formula, pilih material dari library, atur gram, lalu simpan sebagai formula mandiri.'}
        </p>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border bg-card/85 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">Sumber formula</div>
          <Badge variant="outline" className="rounded-full">
            {seedMaterialCount ? 'Material awal' : 'Formula mandiri'}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {seedMaterialCount
            ? `${seedMaterialCount} material dipakai sebagai struktur awal composer.`
            : 'Formula ini akan disimpan sebagai komposisi mandiri.'}
        </p>
      </div>
    </div>
  </div>
);

export default FormulaCompositionContext;
