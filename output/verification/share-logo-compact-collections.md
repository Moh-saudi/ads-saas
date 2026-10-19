# Social preview and compact collections

- Added Open Graph and Twitter large-image metadata with company name/title/description and configured company logo. Default Mesk logo uses the public Next image optimizer: PNG, 1200×400, 73,260 bytes (source: 1,022,404 bytes).
- Public fallback image fetched without authentication with HTTP 200 using a WhatsApp user agent; inherited social tags checked on /demo-site. The local homepage request with the production Host returned 503 at the existing Supabase tenant lookup, so the hosted homepage/actual WhatsApp preview was not verified.
- Collection totals and filter sit in one compact heading. Payment methods display across one row at desktop width and two columns on narrow screens. Card names retain their full tooltip labels.
- Production build/TypeScript and diff checks passed.
- Browser checks at 1440px and 390px passed: current-month five channels sum to 18,000; six-month filter retains historical unknown channel; finance and dashboard cards have no document overflow. Current-month card heights: 164.17px and 356.14px respectively.
- No SQL changes. Hosted deployment and third-party preview cache refresh are not verified.
