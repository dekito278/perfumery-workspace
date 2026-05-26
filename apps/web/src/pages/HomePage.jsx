import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import ProductVisual from '@/components/storefront/ProductVisual.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { featuredProducts, perfumerProfile } from '@/data/storefront.js';
import { getPublicFragranceCatalog, getPublicMaterialArchive } from '@/data/publicStorefront.js';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';
import { useCart } from '@/hooks/useCart.js';
import { getJournalCategoryLabel, getJournalPublicPath, getPublishedJournalPosts } from '@/services/journalPostsSupabaseService.js';
import { isProductVisibleInStorefront } from '@/services/productCatalogService.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';

const homeAssets = {
  rawMaterialLibrary: '/brand/home/raw-material-library.jpg',
  rawMaterialShelf: '/brand/home/raw-material-shelf.jpg',
  perfumerPipettes: '/brand/home/perfumer-pipettes.jpg',
  perfumerCylinder: '/brand/home/perfumer-cylinder.jpg',
};

const fallbackCollection = getPublicFragranceCatalog(featuredProducts).slice(0, 4);

const formatProductDescription = (product) => product?.subtitle || product?.description || product?.notes || product?.mood || 'A quiet Solivagant composition made for skin, atmosphere, and ritual.';
const getNotes = (product, key, fallback = []) => (Array.isArray(product?.[key]) && product[key].length ? product[key] : fallback);
const getArticleExcerpt = (article) => article?.excerpt || String(article?.content || '').replace(/[`*_>#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 130);
const toHomeMaterial = (material = {}) => ({
  name: material.name || 'Untitled material',
  family: material.scent_family || material.category || material.note_type || 'Raw material',
  origin: material.vendor || material.cas_number || material.workbook_code || 'Atelier library',
  description: material.description || material.notes || 'Material dari library studio SOLIVAGANT.',
  mood: [material.note_type, material.category].filter(Boolean).join(' / ') || 'Studio material',
  relatedFragranceReferences: [],
});

const HomePage = () => {
  const { addItem, items, summary } = useCart();
  const catalogProducts = useCatalogProducts();
  const [publishedArticles, setPublishedArticles] = useState([]);
  const [liveMaterials, setLiveMaterials] = useState([]);
  const [lastAddedSlug, setLastAddedSlug] = useState('');
  const visibleProducts = useMemo(
    () => catalogProducts.filter(isProductVisibleInStorefront),
    [catalogProducts]
  );
  const publicCatalog = useMemo(() => getPublicFragranceCatalog(visibleProducts.length ? visibleProducts : featuredProducts), [visibleProducts]);
  const collection = publicCatalog.slice(0, 4);
  const featured = collection[0] || fallbackCollection[0];
  const fallbackMaterials = useMemo(() => getPublicMaterialArchive(publicCatalog).slice(0, 4), [publicCatalog]);
  const materials = liveMaterials.length ? liveMaterials : fallbackMaterials;

  const topNotes = getNotes(featured, 'topNotes', ['Bergamot', 'Green fig', 'Cardamom']);
  const heartNotes = getNotes(featured, 'heartNotes', ['Orris', 'Tea absolute', 'Soft woods']);
  const baseNotes = getNotes(featured, 'baseNotes', ['Amberwood', 'Clean musk', 'Cedar']);
  const firstCartItem = items[0];

  useEffect(() => {
    let active = true;
    getPublishedJournalPosts()
      .then((posts) => {
        if (active) setPublishedArticles(posts.slice(0, 3));
      })
      .catch(() => {
        if (active) setPublishedArticles([]);
      });
    getRawMaterials()
      .then((rows) => {
        if (active) setLiveMaterials((rows || []).slice(0, 4).map(toHomeMaterial));
      })
      .catch(() => {
        if (active) setLiveMaterials([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const addFeaturedToCart = () => {
    if (!featured) return;
    addItem(featured, 1);
    setLastAddedSlug(featured.slug);
    toast.success(`${featured.name} masuk ke keranjang`);
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === featured.slug ? '' : current));
    }, 1800);
  };

  const addCollectionItemToCart = (product) => {
    addItem(product, 1);
    setLastAddedSlug(product.slug);
    toast.success(`${product.name} masuk ke keranjang`);
    window.setTimeout(() => {
      setLastAddedSlug((current) => (current === product.slug ? '' : current));
    }, 1800);
  };

  return (
    <>
      <Helmet>
        <title>SOLIVAGANT - Artisan Perfumery Atelier by Dekito</title>
        <meta
          name="description"
          content="SOLIVAGANT is an artisan perfumery atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual."
        />
        <meta property="og:title" content="SOLIVAGANT - Artisan Perfumery Atelier" />
        <meta property="og:description" content="A refined editorial perfume house by perfumer Dekito." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/brand/home/raw-material-library.jpg" />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-hero">
          <div className="editorial-hero__copy">
            <p className="editorial-eyebrow">ARTISAN PERFUMERY ATELIER</p>
            <h1>Fragrance as a memory object.</h1>
            <p className="editorial-lede">
              SOLIVAGANT is an artisan perfume atelier by Dekito, crafting quiet olfactive works from raw materials, memory, and personal ritual.
            </p>
            <div className="editorial-actions">
              <Link to="/catalog" className="editorial-button editorial-button--primary">
                Explore Collection
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/bespoke" className="editorial-button">
                Book Bespoke Consultation
              </Link>
            </div>
          </div>
          <div className="editorial-hero__visual" aria-label="Solivagant perfume atelier composition">
            <div className="editorial-hero__panel">
              <img src={homeAssets.perfumerCylinder} alt="Perfume bottle and formulation objects in the Solivagant atelier" />
              <div className="editorial-bottle-card">
                <span>Limited atelier object</span>
                <strong>{featured?.name || 'Featured fragrance'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="editorial-section editorial-story">
          <div className="editorial-image-frame">
            <img src={homeAssets.perfumerPipettes} alt="Dekito working with pipettes and perfume materials" />
          </div>
          <div className="editorial-story__copy">
            <p className="editorial-eyebrow">PERFUMER STORY</p>
            <h2>Dekito builds scent as personal atmosphere.</h2>
            <p>{perfumerProfile.intro}</p>
            <blockquote>
              <span>Atelier note</span>
              <p>Each formula is treated as a small archive: raw material behavior, emotional direction, skin texture, and the memory it should leave behind.</p>
            </blockquote>
          </div>
        </section>

        <section id="collection" className="editorial-section">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">FRAGRANCE COLLECTION</p>
            <h2>Quiet signatures for skin, atmosphere, and ritual.</h2>
            <Link to="/catalog">View all fragrances <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="editorial-product-grid">
            {collection.map((product, index) => (
              <article key={product.id || product.slug || product.name} className="editorial-product-card">
                <ProductVisual
                  product={product}
                  className="editorial-product-card__visual"
                  imageFit="cover"
                  priority={index === 0}
                />
                <div className="editorial-product-card__body">
                  <span>{product.category || 'Atelier'}</span>
                  <h3>{product.name}</h3>
                  <p>{formatProductDescription(product)}</p>
                  <dl>
                    <div>
                      <dt>Notes</dt>
                      <dd>{product.notes || [topNotes[0], heartNotes[0], baseNotes[0]].join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Size</dt>
                      <dd>{product.sizeVariants?.[0]?.size || product.size || '30 ml'} / {product.price || 'Rp 289.000'}</dd>
                    </div>
                  </dl>
                  <div className="editorial-product-card__actions">
                    <Link to={`/catalog/${product.slug}`}>View Details</Link>
                    <button
                      type="button"
                      className={lastAddedSlug === product.slug ? 'is-added' : ''}
                      onClick={() => addCollectionItemToCart(product)}
                    >
                      {lastAddedSlug === product.slug ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Added
                        </>
                      ) : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="editorial-section editorial-featured">
          <div className="editorial-featured__visual">
            <ProductVisual product={featured} className="editorial-featured__product" priority />
          </div>
          <div className="editorial-featured__copy">
            <p className="editorial-eyebrow">PRODUCT DETAIL PREVIEW</p>
            <h2>{featured?.name || 'Featured fragrance'}</h2>
            <p>{formatProductDescription(featured)}</p>
            <div className="editorial-notes-grid">
              <div><span>Top</span><p>{topNotes.join(', ')}</p></div>
              <div><span>Heart</span><p>{heartNotes.join(', ')}</p></div>
              <div><span>Base</span><p>{baseNotes.join(', ')}</p></div>
            </div>
            <div className="editorial-feature-list">
              <span>{featured?.mood || 'Quiet daily signature'}</span>
              <span>{featured?.concentration || 'Eau de Parfum'}</span>
              <span>{featured?.sizeVariants?.map((variant) => variant.size).join(' / ') || '10 ml / 30 ml / 50 ml'}</span>
            </div>
            <button type="button" className="editorial-button editorial-button--primary" onClick={addFeaturedToCart}>
              {lastAddedSlug === featured?.slug ? 'Added to Cart' : 'Add to Cart'}
              {lastAddedSlug === featured?.slug ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            </button>
          </div>
        </section>

        <section id="bespoke" className="editorial-section editorial-bespoke">
          <div>
            <p className="editorial-eyebrow">BESPOKE CONSULTATION</p>
            <h2>A custom perfume request, shaped through the atelier.</h2>
            <p>
              Begin with aroma direction, personal preference, bottle size, delivery area, and a brief note for Dekito. The studio work stays private; the request stays simple.
            </p>
            <ol className="editorial-steps">
              {['Aroma', 'Preferensi', 'Botol', 'Ongkir', 'Bayar'].map((step) => (
                <li key={step}><Check className="h-4 w-4" />{step}</li>
              ))}
            </ol>
          </div>
          <div className="editorial-form">
            <p className="editorial-eyebrow">LIVE BESPOKE FLOW</p>
            <h3>Request custom sekarang dibuat sebagai order Studio.</h3>
            <p>Form lengkap, opsi botol, estimasi, dan payment sudah tersedia di halaman bespoke desktop.</p>
            <Link to="/bespoke" className="editorial-button editorial-button--primary">Book Consultation</Link>
          </div>
        </section>

        <section id="materials" className="editorial-section">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">PUBLIC RAW MATERIAL ARCHIVE</p>
            <h2>Materials as stories, not inventory.</h2>
          </div>
          <div className="editorial-material-grid">
            {materials.map((material) => (
              <article key={material.name} className="editorial-material-card">
                <span>{material.family}</span>
                <h3>{material.name}</h3>
                <p className="editorial-material-card__origin">{material.origin}</p>
                <p>{material.description}</p>
                <strong>{material.mood}</strong>
                {material.relatedFragranceReferences?.length ? (
                  <p>Seen in {material.relatedFragranceReferences.map((fragrance) => fragrance.name).join(', ')}.</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section id="journal" className="editorial-section editorial-journal">
          <div className="editorial-section-heading">
            <p className="editorial-eyebrow">JOURNAL / EDITORIAL</p>
            <h2>Field notes from the atelier.</h2>
            <Link to="/journal">Read journal <BookOpenText className="h-4 w-4" /></Link>
          </div>
          <div className="editorial-journal-grid">
            {publishedArticles.map((article) => (
              <article key={article.id}>
                <span>{getJournalCategoryLabel(article.category)}</span>
                <h3>{article.title}</h3>
                <p>{getArticleExcerpt(article) || 'Artikel published dari studio journal.'}</p>
                <Link to={getJournalPublicPath(article)} className="editorial-journal-link">Read More <BookOpenText className="h-4 w-4" /></Link>
              </article>
            ))}
            {!publishedArticles.length ? (
              <article>
                <span>Journal</span>
                <h3>Belum ada artikel published.</h3>
                <p>Artikel homepage akan tampil otomatis setelah dipublish dari Studio Journal.</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="editorial-section editorial-commerce">
          <div className="editorial-cart-preview">
            <p className="editorial-eyebrow">CART / CHECKOUT</p>
            <h2>{summary.quantity ? 'Cart aktif.' : 'Cart siap dipakai.'}</h2>
            {firstCartItem ? (
              <div className="editorial-cart-line">
                <div>
                  <strong>{firstCartItem.name}</strong>
                  <span>{firstCartItem.size} - {firstCartItem.price}</span>
                </div>
                <div className="editorial-qty"><Minus className="h-3 w-3" />{firstCartItem.quantity}<Plus className="h-3 w-3" /></div>
              </div>
            ) : (
              <p className="editorial-notice">Belum ada item. Tambahkan fragrance dari collection untuk mulai checkout.</p>
            )}
            <div className="editorial-subtotal"><span>Subtotal</span><strong>Rp {new Intl.NumberFormat('id-ID').format(summary.subtotal)}</strong></div>
            <div className="editorial-checkout-fields">
              <span>Shipping dihitung di checkout</span>
              <span>Payment: BCA transfer atau DOKU</span>
            </div>
            <Link to="/cart" className="editorial-button editorial-button--primary">Open Cart</Link>
          </div>
          <div id="tracking" className="editorial-tracking-preview">
            <p className="editorial-eyebrow">ORDER TRACKING</p>
            <h2>Public order status.</h2>
            <p>Masukkan nomor order atau resi di halaman tracking untuk melihat status publik pesanan.</p>
            <div className="editorial-timeline">
              {['Order received', 'Payment confirmed', 'In preparation', 'Packed', 'Shipped'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <Link to="/track-order" className="editorial-button"><Search className="h-4 w-4" />Track Order</Link>
          </div>
        </section>

        <footer className="editorial-footer">
          <PackageCheck className="h-5 w-5" />
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/track-order">Track Order</Link>
        </footer>
      </main>
    </>
  );
};

export default HomePage;
