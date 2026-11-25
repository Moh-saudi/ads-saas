# A4 invoice redesign

- A4 portrait, 12 mm page margins, normal document flow (no absolute print positioning).
- Local Mesk | vlab Ai logo prepared from the user-supplied image. Demo explicitly uses Mesk identity; real issuer data and configured company logos remain authoritative, with Mesk as the missing-logo default.
- Compact RTL line table with currency in caption; totals, recorded payments, signature and company stamp areas. No changes to financial calculations or actual invoice data.
- Static public `/media/` files bypass tenant lookup so local demo logos load correctly. Protected application routes retain their tenant/auth checks.

Validation: production build including TypeScript passed. Chromium checks at 1440 and 390 pixels verified loaded logo, three demo invoice lines and no page overflow. Print rules hide actions and use normal flow, repeating table headers and no mobile minimum table width. PDF inspection reports one A4 page (594.96 × 841.92 pt) for `invoice-a4-demo.pdf`; manually inspected its rendered preview. Stress test appended 60 cloned rows in the browser for layout only: four A4 pages, table header text present on all four, final row number 60 present. Stress output is temporary and is not a financial sample or committed invoice.
