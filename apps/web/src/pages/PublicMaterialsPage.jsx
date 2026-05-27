import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const toPublicMaterial = (material = {}) => ({
  name: material.name || 'Untitled material',
  family: material.scent_family || material.category || material.note_type || 'Raw material',
  origin: material.vendor || material.cas_number || material.workbook_code || 'Atelier library',
  description: material.description || material.notes || material.safety_notes || 'Material dari library studio SOLIVAGANT.',
  mood: [material.note_type, material.type, material.category].filter(Boolean).join(' / ') || 'Studio material',
  usageStory: material.olfactive_description || material.usage_notes || material.notes || 'Dipakai sebagai referensi formulasi dan evaluasi aroma di studio.',
  relatedFragranceReferences: [],
});

const PublicMaterialsPage = () => {
  const [liveMaterials, setLiveMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const materials = liveMaterials;
  const visibleMaterials = useMemo(() => materials.slice(0, visibleCount), [materials, visibleCount]);

  useEffect(() => {
    let active = true;

    const loadMaterials = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getRawMaterials();
        if (!active) return;
        setLiveMaterials((rows || []).slice(0, 16).map(toPublicMaterial));
      } catch (err) {
        if (active) {
          setError('Raw material studio belum bisa dimuat.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMaterials();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Raw Material Archive - SOLIVAGANT</title>
        <meta name="description" content="A public raw material storytelling archive from SOLIVAGANT." />
        <meta property="og:title" content="Raw Material Archive - SOLIVAGANT" />
        <meta property="og:description" content="Public raw material stories for origin, olfactive family, sensory texture, mood, and related SOLIVAGANT fragrances." />
      </Helmet>
      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero editorial-page-hero--compact">
          <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
          <h1>Raw Material Archive</h1>
          <p>Raw materials from the studio library, presented as sensory notes, origin cues, and formulation stories.</p>
        </section>

        <section className="editorial-section editorial-section--compact">
          {loading ? <p className="editorial-notice">Memuat raw material studio...</p> : null}
          {error ? <p className="editorial-notice">{error}</p> : null}
          {!loading && !materials.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">NO MATERIALS</p>
              <h2>Belum ada raw material publik.</h2>
              <p>Raw material akan tampil setelah data studio tersedia.</p>
            </div>
          ) : null}
          <div className="editorial-material-grid">
            {visibleMaterials.map((material) => (
              <article key={`${material.name}-${material.origin}`} className="editorial-material-card">
                <span>{material.family}</span>
                <h3>{material.name}</h3>
                <p className="editorial-material-card__origin">{material.origin}</p>
                <p>{material.description}</p>
                <strong>{material.mood}</strong>
                <p>{material.usageStory}</p>
                {material.relatedFragranceReferences?.length ? (
                  <p>Related fragrance: {material.relatedFragranceReferences.map((fragrance) => fragrance.name).join(', ')}</p>
                ) : null}
              </article>
            ))}
          </div>
          {visibleMaterials.length < materials.length ? (
            <div className="editorial-load-more">
              <button type="button" className="editorial-button" onClick={() => setVisibleCount((current) => current + 8)}>
                Tampilkan lebih banyak
              </button>
              <span>{visibleMaterials.length} dari {materials.length} material</span>
            </div>
          ) : null}
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/journal">Read Journal</Link>
        </footer>
      </main>
    </>
  );
};

export default PublicMaterialsPage;
