# Consistent addition dialogs

A shared FormDialog now renders workspace and operations dialogs. Native address dialogs use the same heading, scrollable body and form action styling.

- Consistent desktop width, close button, field sizing and spacing.
- Fixed heading and sticky save actions; only the body scrolls.
- One-column fields and full-width save button on narrow screens.
- Preserved focus trapping, Escape, focus restoration and nested address creation.

Validation: production build including TypeScript passed. Browser checks passed for assets, customers, contracts, finance, licenses, employees and inventory at 1440px and 390px. Checks covered overflow, reachable save actions, fixed heading and Escape. Address hierarchy regression checks also passed at both widths. Demo saving remains disabled; no hosted data was written. Screenshots illustrate layout only; external map tile loading was not validated.
