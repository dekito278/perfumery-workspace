import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { publicMaterials as materials } from '@/data/publicStorefront.js';

const PublicMaterialsPage = () => (
  <>
    <Helmet>
      <title>Raw Material Archive - SOLIVAGANT</title>
      <meta name="description" content="A public raw material storytelling archive from SOLIVAGANT." />
    </Helmet>

    <main className="solivagant-editorial-home">
      <PublicHeader />

      <section className="editorial-page-hero">
        <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
        <h1>Raw Material Archive</h1>
        <p>Raw materials presented as sensory stories: origin, olfactive family, texture, and mood. This is a public archive, not an internal inventory.</p>
      </section>

      <section className="editorial-section editorial-section--compact">
        <div className="editorial-material-grid">
          {materials.map((material) => (
            <article key={material.name} className="editorial-material-card">
              <span>{material.family}</span>
              <h3>{material.name}</h3>
              <p className="editorial-material-card__origin">{material.origin}</p>
              <p>{material.description}</p>
              <strong>{material.mood}</strong>
              <p>{material.usageStory}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="editorial-footer">
        <span>SOLIVAGANT by Dekito</span>
        <Link to="/journal">Read Journal</Link>
      </footer>
    </main>
  </>
);

export default PublicMaterialsPage;
