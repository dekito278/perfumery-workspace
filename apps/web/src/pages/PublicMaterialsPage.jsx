import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const FAMILY_COLORS = {
  fresh: { bg: '#e8f0e4', accent: '#4a7c59' },
  floral: { bg: '#f3e4ef', accent: '#8c4a7c' },
  woody: { bg: '#ede4d8', accent: '#7c5a3a' },
  gourmand: { bg: '#f0e8d8', accent: '#8c6a3a' },
  citrus: { bg: '#f5f0d8', accent: '#7c7a3a' },
  oriental: { bg: '#e8dce0', accent: '#6a4a5a' },
  aromatic: { bg: '#dce8e0', accent: '#3a6a5a' },
  musk: { bg: '#e8e4e0', accent: '#6a6058' },
};

const getFamilyStyle = (family) => {
  const key = String(family || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(FAMILY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: '#f7f1e5', accent: '#1b1a16' };
};

const toPublicMaterial = (material = {}) => ({
  name: material.name || 'Untitled material',
  family: material.scent_family || material.category || material.note_type || 'Raw material',
  origin: material.vendor || material.cas_number || material.workbook_code || 'Atelier library',
  description: material.description || material.notes || material.safety_notes || 'Material dari library studio SOLIVAGANT.',
  mood: [material.note_type, material.type, material.category].filter(Boolean).join(' · ') || 'Studio material',
  usageStory: material.olfactive_description || material.usage_notes || material.notes || '',
});

const FAMILIES = ['All', 'Fresh', 'Floral', 'Woody', 'Gourmand', 'Citrus', 'Oriental', 'Aromatic', 'Musk'];

const PublicMaterialsPage = () => {
  const revealRef = useScrollReveal();
  const [liveMaterials, setLiveMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFamily, setActiveFamily] = useState('All');
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let active = true;
    const loadMaterials = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getRawMaterials();
        if (!active) return;
        setLiveMaterials((rows || []).slice(0, 24).map(toPublicMaterial));
      } catch {
        if (active) setError('Raw material studio belum bisa dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMaterials();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (activeFamily === 'All') return liveMaterials;
    return liveMaterials.filter((m) => m.family.toLowerCase().includes(activeFamily.toLowerCase()));
  }, [liveMaterials, activeFamily]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  return (
    <>
      <Helmet>
        <title>Raw Material Archive - SOLIVAGANT</title>
        <meta name="description" content="A public raw material storytelling archive from SOLIVAGANT." />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />

        <section className="materials-hero">
          <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">RAW MATERIAL ARCHIVE</p>
          <h1 className="hero-animate-text hero-animate-text--d2">The Library</h1>
          <p className="hero-animate-text hero-animate-text--d3">Raw materials from the studio, presented as sensory notes, origin cues, and formulation stories.</p>
        </section>

        {/* Family filter */}
        <nav className="journal-tabs hero-animate-fade">
          {FAMILIES.map((fam) => (
            <button
              key={fam}
              type="button"
              className={`journal-tab${activeFamily === fam ? ' is-active' : ''}`}
              onClick={() => { setActiveFamily(fam); setVisibleCount(12); }}
            >
              {fam}
            </button>
          ))}
        </nav>

        <section className="materials-content">
          {loading ? <p className="editorial-notice">Memuat raw material studio...</p> : null}
          {error ? <p className="editorial-notice">{error}</p> : null}
          {!loading && !filtered.length ? (
            <div className="editorial-empty-state">
              <p className="editorial-eyebrow">NO MATERIALS</p>
              <h2>Belum ada material{activeFamily !== 'All' ? ` di keluarga ${activeFamily}` : ''}.</h2>
            </div>
          ) : null}

          <div className="materials-grid" data-reveal data-stagger-children>
            {visible.map((material) => {
              const style = getFamilyStyle(material.family);
              return (
                <article key={`${material.name}-${material.origin}`} className="materials-card card-lift" style={{ '--mat-bg': style.bg, '--mat-accent': style.accent }}>
                  <div className="materials-card__badge">{material.family}</div>
                  <h3>{material.name}</h3>
                  <p className="materials-card__origin">{material.origin}</p>
                  <p className="materials-card__desc">{material.description}</p>
                  {material.mood ? <span className="materials-card__mood">{material.mood}</span> : null}
                  {material.usageStory ? <p className="materials-card__usage">{material.usageStory}</p> : null}
                </article>
              );
            })}
          </div>

          {visibleCount < filtered.length ? (
            <div className="journal-load-more">
              <button type="button" onClick={() => setVisibleCount((c) => c + 12)}>
                Load more materials
              </button>
              <span>{Math.min(visibleCount, filtered.length)} of {filtered.length}</span>
            </div>
          ) : null}
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default PublicMaterialsPage;
