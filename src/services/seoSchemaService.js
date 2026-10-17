/**
 * BASMA (@basma.llb) — Dynamic SEO Meta Updater & JSON-LD Schema Generator
 * Manages document.title, meta description, canonical URLs, and LocalBusiness + Product JSON-LD.
 */

export function updatePageSeoMeta({ title, description, sectionHash = '' }) {
  if (title) {
    document.title = title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    if (twTitle) twTitle.setAttribute('content', title);
  }

  if (description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    if (ogDesc) ogDesc.setAttribute('content', description);
    if (twDesc) twDesc.setAttribute('content', description);
  }

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl && typeof window !== 'undefined') {
    const baseOrigin = window.location.origin.includes('localhost')
      ? 'https://basma-studio.vercel.app'
      : window.location.origin;
    canonicalEl.setAttribute('href', `${baseOrigin}/${sectionHash ? '#' + sectionHash.replace(/^#/, '') : ''}`);
  }
}

export function injectStructuredDataSchema(products, settings) {
  const existing = document.getElementById('basmaJsonLdSchema');
  if (existing) existing.remove();

  const siteOrigin = typeof window !== 'undefined' && !window.location.origin.includes('localhost')
    ? window.location.origin
    : 'https://basma-studio.vercel.app';

  const cleanWa = (settings?.whatsappNumber || '96170360671').replace(/[^0-9]/g, '');

  const schemaGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `${siteOrigin}/#studio`,
        name: 'BASMA | بصمة (@basma.llb) — 3D CNC Wood Carving & Wall Art Studio',
        alternateName: 'Basma 3D Wood Design',
        description: 'Luxury Lebanese woodworking studio crafting precision 0.1mm 3D CNC solid walnut relief carvings and sleek matte-black layered automotive & gaming wall silhouettes.',
        url: siteOrigin,
        telephone: `+${cleanWa}`,
        email: settings?.studioEmail || 'concierge@basma-studio.com',
        image: `${siteOrigin}/assets/hero-car-silhouette.jpg`,
        logo: `${siteOrigin}/assets/basma-logo.jpg`,
        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Beirut',
          addressCountry: 'LB'
        },
        sameAs: [
          'https://www.instagram.com/basma.llb',
          `https://wa.me/${cleanWa}`
        ]
      },
      ...products.map((prod) => {
        const prices = (prod.sizes || []).map(s => Number(s.priceUSD) || 89);
        const lowPrice = Math.min(...prices);
        const highPrice = Math.max(...prices);
        const imgUrl = prod.image && prod.image.startsWith('http')
          ? prod.image
          : `${siteOrigin}/${(prod.image || 'assets/product-supercar-wall.jpg').replace(/^\//, '')}`;

        return {
          '@type': 'Product',
          '@id': `${siteOrigin}/#product-${prod.id}`,
          name: prod.title,
          description: prod.description,
          image: imgUrl,
          sku: prod.id,
          category: prod.category,
          material: prod.finish,
          brand: {
            '@type': 'Brand',
            name: 'BASMA | بصمة (@basma.llb)'
          },
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'USD',
            lowPrice: String(lowPrice),
            highPrice: String(highPrice),
            offerCount: String((prod.sizes || []).length || 3),
            availability: 'https://schema.org/InStock',
            url: `${siteOrigin}/#collections`
          }
        };
      })
    ]
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'basmaJsonLdSchema';
  script.textContent = JSON.stringify(schemaGraph);
  document.head.appendChild(script);
}
