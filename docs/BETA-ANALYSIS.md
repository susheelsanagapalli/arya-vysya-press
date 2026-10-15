# Beta-Enhanced Analysis

Consolidated review of the `beta-enhanced` branch (based on `beta` commit `266e2c1`), compared with `main` (`f858360`).

This document merges two passes:
1. the initial analysis of the beta branch, and
2. a full read of every file (`index.html`, `js/**`, `apps-script/**`, workflow).

Findings come from reading the code. Nothing was executed, so items marked **(likely)** should be confirmed in a browser. Line numbers refer to `index.html` unless another file is named.

## 1. Summary

Beta turns a single-page quotation/invoice builder into a small business management app that tracks **Customer -> Quotation -> Invoice -> Payment**, with an optional push to Google Sheets through an Apps Script backend.

The structure and data model are sensible, but beta is effectively a single-browser app. All data lives in `localStorage`; the Google sync is likely broken from the browser and unauthenticated if it does work; and several bugs produce wrong totals, wrong customers or lost records. The **High** items below should be fixed before the app is used for real business records.

## 2. What Beta Adds Over Main

| Area | Change |
| --- | --- |
| Navigation | Sidebar with Dashboard, Customers, Quotations, Invoices, Payments, Document Register, Letterheads, Templates, Settings, Builder |
| Records | ID-based records: `CUS-00001`, `QUO-00001`, `INV-00001`, `PAY-00001` |
| Workflow | Quotation -> invoice conversion (quotation marked `Converted`); payments update invoice status (Unpaid / Partially Paid / Paid / Overdue) |
| Dashboard | Outstanding, paid this month, pending, overdue, conversion rate; overdue list; recent activity |
| Letterheads & templates | Saved letterheads with a default; templates with line items entered as JSON |
| Tax mode | GST / non-GST bill type (`f-gst-enabled`) |
| Mobile | Responsive layout; desktop-only blocker disabled |
| Code layout | `js/services/*.js` (customer, quotation, invoice, payment, letterhead, template, Google services), `js/modules/*.js` (config, storage, formatting) |
| Backend | `apps-script/Code.gs`: one `doPost` endpoint that initializes 8 Sheets tabs and Drive folders and upserts rows by ID |
| Deployment | `.github/workflows/deploy-beta-pages.yml` publishes `main` at `/`, `beta` at `/beta`, `beta-enhanced` at `/beta-enhanced` |

## 3. Architecture

- **Frontend:** `index.html` (~5,000 lines) holds the UI, the builder and the orchestration logic, and loads the service classes as ES modules.
- **Persistence:** `localStorage` keys `avp_business_register_v1` (records), `avp_document_state_v1` (builder state, including the logo), `avp_google_config_v1` (Google settings), `avp_export_settings_v1` (PDF settings).
- **Cloud sync:** one-way push of the full register to Apps Script, which upserts rows by primary-key column. Nothing is read back.
- **PDF export:** the active document is cloned into a hidden iframe and printed through the browser's print dialog (Save as PDF).

## 4. Findings

Severity: **High** = wrong money figures, wrong documents, data loss or security exposure. **Medium** = broken feature or misleading behaviour. **Low** = cosmetic or minor.

### 4.1 High

| ID | Issue | Where | Fix |
| --- | --- | --- | --- |
| H1 | **Google sync likely fails in every browser (CORS).** Requests use `Content-Type: application/json`, which triggers a preflight that Apps Script doesn't answer. | `js/services/googleIntegrationService.js` `post` | Send `text/plain;charset=utf-8`; `Code.gs` already parses the body as JSON. |
| H2 | **Backend has no authentication and its URL is public.** The URL is hardcoded in `js/modules/app-config.js` and served on GitHub Pages. Anyone can write rows, and a caller can pass any `config.spreadsheetId`, so `ensureSheet` will overwrite row 1 and insert tabs in any spreadsheet the owner can edit. *(Correction to the earlier analysis: `health` probably does not leak the owner's email, because `Session.getActiveUser()` usually returns an empty string for anonymous callers.)* | `apps-script/Code.gs` `doPost`, `resolveSpreadsheet` | Check a shared secret in `doPost`; keep the spreadsheet and Drive IDs in Script Properties and ignore client-supplied IDs. Requires redeploying the script. |
| H3 | **Sync can't be turned off, and it sends data to a third party by default.** Empty config values fall back to the defaults, so clearing the Apps Script URL restores the hardcoded one on reload. Every Export & Save on the public site sends all customers, GSTINs, addresses and payments to the repo owner's endpoint. | `googleIntegrationService.js` constructor; `app-config.js` | Ship with an empty default URL; keep an empty value as "not configured". |
| H4 | **Documents are attached to the wrong customer.** (a) Customer phone and email come from `f-cell` / `f-email`, which are the **press's own** letterhead details, and matching on them merges every new customer into the first one. (b) The company name comes from the invoice consignee field even for quotations, and the GSTIN from the quotation field even for invoices. (c) When an existing customer matches, the new details are discarded. | `ensureCustomerFromCurrentBuilder` (~2283); `customerService.js` `upsertFromBuilder` | Use only fields from the active document; match on GSTIN first, then exact name; update matched customers with new non-empty details. |
| H5 | **Every export creates a new record.** All Export & Save buttons call `exportAndSaveActiveDocument`, which creates a new quotation or invoice unless an edit is in progress. Saving and then exporting, or exporting twice, creates duplicates. Two of the four Export & Save buttons are never disabled during export, so double clicks also duplicate. | `exportAndSaveActiveDocument` (~2420); `setExportBusy` (~4252); markup ~1576-1580, ~1768-1769 | After a save, keep the record ID as the "currently open" document so later saves and exports update it; remove the duplicate buttons. |
| H6 | **ID clashes and invoice numbering.** ID counters live in each browser's storage, so two devices (or two tabs) both create `INV-00001` and overwrite each other in Sheets. Saving an invoice also replaces the user's invoice number (e.g. `8`) with `INV-0000x`; GST rules require one continuous invoice series. | `businessStateService.js` `nextId`; `saveInvoiceRecord` (~2405) | Issue IDs from the server (Apps Script + `LockService`) or prefix them per device; keep the user-facing invoice number separate from the internal ID. |
| H7 | **0% GST items become 18%.** `normalizeRow` uses `Number(row.gstPct \|\| 18)`, so a rate of 0 is replaced. Affects template items and every reload; exempt items get taxed and totals are wrong. The record loaders use the same pattern. | `normalizeRow` (~4015); loaders ~2487, ~2530, ~2576 | Default only when the value is missing (`??`), not when it is 0. |
| H8 | **Non-GST bills print GST anyway.** Non-GST mode adds a `gst-disabled` class to the page `<body>`, but the PDF is built in an iframe whose `<body>` doesn't get it, so the PDF shows the GST column and both GSTINs. | `applyGstMode` (~2177); `savePDF` (~4839) | Add the `gst-disabled` class to the export document's body when GST is off. |
| H9 | **Builder Reset erases the Document Register.** `resetToDefaults` clears `bizState.documentHistory`, which is the same object the app saves, so the next save stores an empty history. | `resetToDefaults` (~4291) | Reset only builder state; never touch business records. |
| H10 | **Dates are a day behind after midnight in India.** `todayIsoDate` and `toIsoDate` use `toISOString()` (UTC), so from 00:00 to 05:29 IST new documents get yesterday's date, shifting due dates and overdue status. | `todayIsoDate` (~2169); `js/modules/format.js` `toIsoDate`, `plusDays`; `getDatePlusDays` | Build the date from local year, month and day. |
| H11 | **main, beta and beta-enhanced share stored data.** All three are served from `susheelsanagapalli.github.io`, so they share one `localStorage` and use the same keys. Testing `/beta-enhanced/` reads and overwrites beta's (and main's builder) data. | `app-config.js` `APP_KEYS`; `APP_CONFIG` (~2038) | Namespace storage keys per deployment path. |
| H12 | **A large logo can silently stop all saving.** The logo is stored as base64 inside the builder state (a 5 MB file is ~6.7 MB of text). Browsers allow roughly 5-10 MB per site, after which `setItem` throws; errors are swallowed, so builder state, and possibly the business register, stop saving without warning **(likely)**. | `persistAppState` (~4031); `js/modules/storage.js` `writeJson` | Lower the logo limit and downscale on upload; warn the user when a save fails. |

### 4.2 Medium

| ID | Issue | Where | Fix |
| --- | --- | --- | --- |
| M1 | **Two print dialogs (likely).** With auto-print on, both the iframe's own `window.onload` and the parent's `frame.onload` call `print()`. | `savePDF` (~4856, ~4900) | Print from one place only. |
| M2 | **With auto-print off, export does nothing visible.** The print frame is 0x0 and hidden, so its "Save as PDF" bar can't be seen, and no dialog opens. | `savePDF` | Always open the print dialog from the parent; remove the option or open a visible preview. |
| M3 | **Letterhead address is garbled.** The default `f-addr1` already contains `#` and `Near Gymkhana Club`, and the preview template adds both again (duplicated after a reload). Applying a saved letterhead splits the address at the first comma, so line 1 becomes `# 26-4-10`. | markup ~1790; `splitAddressLines` (~3141); `letterheadService.js` `ensureDefault` | Make the preview spans hold the full lines; store letterhead lines separately. |
| M4 | **Editing records overwrites or mixes fields.** Editing a quotation resets its date to today, replaces the subject with `Quotation QUO-...`, and copies the notes into both body and closing. Invoice Reference is saved as notes; quotations take payment terms from the invoice terms field. | `saveQuotationRecord` (~2309); `loadQuotationIntoQuotationBuilder` (~2506); `saveInvoiceRecord` | Store subject, body, closing and date as their own fields and restore them as saved. |
| M5 | **Two copies of the app state.** `bizState` and `stateService.state` are assigned back and forth; which one is saved last decides what survives. | `loadBusinessState`, `saveBusinessState` | Use the service's state as the single source. |
| M6 | **Drive integration is incomplete.** Folders are created but no PDF is ever uploaded; `uploadDocument` / `uploadLogo` aren't supported by `Code.gs`; "View Drive" only runs a Drive search. | `googleDriveService.js`, `Code.gs` | Implement uploads or hide the Drive buttons. |
| M7 | **Concurrent syncs can overwrite rows.** Seven upserts run in parallel and `upsertRows` takes no lock. | `syncBusinessRegister`; `Code.gs` `upsertRows` | Use `LockService` in `upsertRows`. |
| M8 | **Cursor jumps while typing in the preview.** `sanitizeEditable` compares `innerHTML` with plain text, so any `&`, `<`, `>` (e.g. "Printers & Binders") or Enter rewrites the element and moves the cursor to the start. | `sanitizeEditable` (~4136) | Only rewrite when the element actually contains child elements. |
| M9 | **Edits made directly on the preview are lost on reload.** Syncing only goes from the form to the preview. | `bindFormSyncEvents`, `restoreAppState` | Sync preview edits back to the form fields. |
| M10 | **Quotation PDFs have no number or date.** The `QUO-xxxxx` ID and the date are never printed. | quotation markup ~1797 | Add a number/date line to the quotation header. |
| M11 | **No way to set a line's GST rate.** The builder table has no GST % input; only templates can set it. | `renderRows` (~4594) | Add a GST % input per line. |
| M12 | **Applying a seed template empties the table.** The 6 seeded templates have no line items. | `templateService.js` `ensureSeedTemplates`; `applyTemplateToBuilder` | Keep current rows when a template has none. |
| M13 | **Overpayments disappear.** Balance is clamped to 0, so the extra amount isn't recorded. | `recalcInvoiceFinancials`; `invoiceService.js` `recalc` | Record a credit balance or block overpayment. |

### 4.3 Low

| ID | Issue | Where |
| --- | --- | --- |
| L1 | ES modules don't load over `file://`; opening `index.html` directly breaks the app (use a local server). | `<script type="module">` |
| L2 | Customers are added and edited through a chain of `prompt()` pop-ups. | `addCustomerFromPrompt`, `editCustomerFromPrompt` |
| L3 | Document history is silently capped at 200 entries. | `upsertDocumentHistoryEntry` |
| L4 | A Google OAuth Client ID ships in config but no OAuth flow uses it. | `app-config.js` |
| L5 | The signature block's "For Arya Vysya Press" is fixed text and ignores the company name. | markup ~1952 |
| L6 | Divider comments are garbled (`â•â•`) from an encoding mix-up. | throughout `index.html` |
| L7 | The PDF loads Google Fonts, so offline exports use fallback fonts; printing may start before fonts load. | `savePDF` |
| L8 | `fmtIN` uses Western digit grouping (`1,234,567`), not Indian (`12,34,567`). | `fmtIN` (~4649) |
| L9 | The "Use existing folder ID" setting (`autoCreateRoot`) is never used by the backend. | Settings view; `Code.gs` |
| L10 | Due date is always invoice date + 30 days, whatever the payment terms say. | `saveInvoiceRecord` |
| L11 | Dashboard "Pending" and "Outstanding" sum practically the same amount. | `renderDashboardView` |
| L12 | `ensureSheet` rewrites a mismatched header row without moving existing data, which can misalign columns. | `Code.gs` `ensureSheet` |
| L13 | The PDF prints an empty action column (remove buttons are stripped, their column isn't). | `savePDF` |
| L14 | The hidden "Desktop Only" blocker markup is dead code. | markup ~1971 |

## 5. Fix Plan

Fixes go to `beta-enhanced` only, in small commits, highest severity first.

| Batch | Scope | Items |
| --- | --- | --- |
| 1 | Totals, dates and PDF output | H7, H8, H10, M1, M2, L13 |
| 2 | Data integrity | H9, H4, H5, H12, H1, H3 |
| 3 | Editing and presentation | M3, M4, M8, M10, M11, M12, L5, L8 |
| Needs a decision | Backend auth and redeploy (H2), server-issued IDs and invoice numbering (H6), storage namespacing and data migration (H11), state refactor (M5), Drive uploads (M6), sync locking (M7), other Low items | |

## 6. Running Locally

```powershell
# from the project folder
npx serve .
# then open http://localhost:3000
```

Without a server, the browser blocks the ES module imports and the app won't start.
