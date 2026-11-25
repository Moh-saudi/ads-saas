# Business workflow verification — 2026-10-19

- Production build and TypeScript passed after correcting the contract/asset form regression found by browser checks.
- 210 database assertions passed with the existing-installation upgrade bundle when collection methods were not yet installed.
- The same 210 assertions passed with the bundle when collection methods were already installed.
- License checks include inclusive boundaries, adjacent renewals, gaps, expired/future/revoked permits, admin exceptions, shortening/revocation/deletion protection, multi-asset atomicity and tenant/district boundaries.
- Linked journey covers outsourced manufacture request, no stock before receipt, inventory receipt, weighted-cost issue to work and billboard, installation completion, scoped pricing, licensed booking, invoicing, electronic reference validation, receipt reconciliation and balanced journals.
- Existing demo integrity passed: 18 assets, 14 contract lines, 18 permits and 30 populated operations datasets. Fixtures include three price rules, coverage rows, linked procurement and six receipt records (five customer receipts and one authority payment).
- Browser checks at 1440px and 390px passed: actual-data setup progress, retained billboard dimensions, multi-board permits, dependent procurement/work selection, calendar event details, independent negotiated price and permit preview, 18-row result report, customer statement with five receipts, method-aware reference requirement and demo saving disabled.
- Receipt print rendered one A4 PDF page, 594.96 × 841.92 points. Local artifact: /tmp/mesk-receipt-demo.pdf.

The browser checks use demo fixtures. Auth and Storage in database tests are platform fixtures; application migrations and policies execute unchanged. No hosted tenant data was written, and hosted deployment or migration application was not verified. Internal BOM manufacturing, bank gateway settlement and automatic posting of estimated depreciation are not implemented by this update. Report results are administrative estimates before tax and unallocated general costs.
