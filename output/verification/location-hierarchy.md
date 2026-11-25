# Connected location entry

- One shared hierarchy: governorate → district → street → billboard map point.
- Descendants clear when a parent changes; street options belong to the selected district.
- Administrators can create missing address records in a native modal without discarding the billboard draft. Successful server inserts return their persisted ID for immediate selection.
- The location directory filters streets by the selected hierarchy and shows governorate / district context. Its add-billboard action carries the selected street into the billboard form.
- Existing tenant and district database policies remain in force. Demo saving remains disabled. No new SQL migration.
- Updated interactive tour instructions.

Validation: production build and TypeScript, existing demo integrity suite, browser interaction checks at desktop and mobile widths. Hosted production writes are not exercised by the demo browser checks.
