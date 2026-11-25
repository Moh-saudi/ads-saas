# Mesk developer sales demo identity

- The exact public sales host ads-kappa-one.vercel.app serves a Mesk demo at `/`, independent of the mapped customer tenant or Supabase availability. Its title, Open Graph/Twitter data and static logo identify Mesk as the developer and explicitly label the demo.
- Other customer hosts retain tenant branding and data. `/app` and `/login` keep the verified-tenant/authentication path. The public-host exception covers `/` only.
- `/demo-site`, demo workspace and demo invoice show Mesk. Named fictional customer companies in demo fixtures/tutorial examples were replaced with generic sample customers. No hosted customer records were updated; existing recorded videos are archival and were not re-recorded.
- Demo public enquiries are rejected server-side on the sales host, so they cannot create leads for the mapped customer. The customer-domain enquiry path is preserved.
- Static PNG served anonymously: HTTP 200, image/png, 1200×400, 73,260 bytes.
- Local production request with Host ads-kappa-one.vercel.app and a WhatsApp user agent: HTTP 200; Mesk demo title, developer label, demo-entry link and absolute static OG logo checked. Authenticated app and unrelated-host paths do not expose fixture workspace data.
- Browser checks passed at 1440px and 390px: visible developer/demo labels, loaded logos, Mesk workspace identity and no document overflow.
- Production build/TypeScript, demo integrity and `node scripts/test-showcase-branding.mjs` passed.

No SQL migration. Hosted deployment and WhatsApp's cached preview refresh were not verified. A new query-string URL can request a fresh preview after deployment.
