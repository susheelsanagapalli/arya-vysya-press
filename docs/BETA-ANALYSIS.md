# Beta Branch Analysis

Analysis of the `beta` branch (commit `266e2c1`) of `susheelsanagapalli/arya-vysya-press`, compared against `main` (commit `f858360`).

Findings come from reading the code. Nothing was executed, so items marked **likely** should be confirmed in a browser before fixing.

## 1. Summary

The beta branch turns a single-page quotation/invoice builder into a small business management app that tracks the chain **Customer -> Quotation -> Invoice -> Payment**, with an optional push to Google Sheets through an Apps Script backend.

The structure and data model are sensible. In practice, however, beta is a single-browser app: all data lives in `localStorage`, and the Google sync is likely not working from the browser and is unauthenticated if it is. The issues in section 4 should be fixed before anyone relies on it for real business records.

## 2. What Beta Adds Over Main

| Area | Change |
| --- | --- |
| Navigation | Sidebar shell with Dashboard, Customers, Quotations, Invoices, Payments, Documents, Letterheads, Templates, Settings, Builder |
| Records | ID-based records: `CUS-00001`, `QUO-00001`, `INV-00001`, `PAY-00001` |
| Workflow | Quotation -> invoice conversion (quotation marked `Converted`); payments update invoice status (Unpaid / Partially Paid / Paid / Overdue) |
| Dashboard | KPIs: outstanding, paid this month, pending, overdue, conversion rate; overdue list; recent activity |
| Letterheads & templates | Saved letterheads with a default; templates with line items entered as raw JSON |
| Tax mode | GST / non-GST toggle (`f-gst-enabled`); invoice title switches to `INVOICE` when GST is off |
| Mobile | Desktop-only blocker removed; responsive layout |
| Code layout | `js/services/*.js` (customer, quotation, invoice, payment, letterhead, template, Google services), `js/modules/*.js` (config, storage, formatting) |
| Backend | `apps-script/Code.gs`: one `doPost` endpoint that initializes 8 Sheets tabs and Drive folders and upserts rows by ID |
| Deployment | `.github/workflows/deploy-beta-pages.yml` publishes `main` at `/` and `beta` at `/beta` on GitHub Pages |

## 3. Architecture

- **Frontend:** `index.html` (~5,000 lines) holds the UI, the builder and the orchestration logic. It loads the service classes as ES modules.
- **Persistence:** `localStorage` keys `avp_business_register_v1` (records), `avp_document_state_v1` (builder state), `avp_google_config_v1` (Google settings), `avp_export_settings_v1` (PDF settings).
- **Cloud sync:** one-way push. The browser sends the full register to Apps Script, which upserts rows by primary-key column. Nothing is read back from Sheets.
- **PDF export:** the active document is cloned into a hidden iframe and printed with the browser's print dialog (Save as PDF).

## 4. Critical Issues

### 4.1 Google sync likely fails in every browser (CORS)
`js/services/googleIntegrationService.js` sends `fetch` requests with `Content-Type: application/json`. That triggers a CORS preflight (`OPTIONS`) request, and Apps Script web apps don't answer preflights. Test Connection, Initialize Workspace and Sync Register are therefore likely to fail with a network error.

**Fix:** send the body as `text/plain;charset=utf-8` (a "simple" request with no preflight). `Code.gs` already parses `e.postData.contents` as JSON, so it needs no change.

### 4.2 Backend has no authentication and its URL is public
The Apps Script URL is hardcoded in `js/modules/app-config.js`, which is served publicly from GitHub Pages. For a static site to call the script, it generally has to be deployed with access set to "Anyone". `doPost` performs no authentication, so anyone can:
- write or overwrite rows in the business register;
- read the owner's Google account email through the `health` action;
- supply any `config.spreadsheetId`. `ensureSheet` then overwrites row 1 and inserts tabs in **any spreadsheet the owner's account can edit**.

**Fix:** check a shared secret or token in `doPost`; store the spreadsheet ID and Drive root ID in Script Properties on the server side and ignore client-supplied IDs; remove `accountEmail` from `health`.

### 4.3 Every document is attached to the first customer
`ensureCustomerFromCurrentBuilder` (`index.html`, ~line 2283) fills the customer's `phone` and `email` from `f-cell` / `f-email`, which are the **press's own** letterhead contact details. `CustomerService.upsertFromBuilder` treats any customer with a matching phone or email as the same customer. Because those values never change, every quotation and invoice after the first is linked to customer #1.

**Fix:** take customer contact details from customer-specific fields (add them to the builder), and match on GSTIN first, then on exact name plus company.

### 4.4 Every PDF export creates a new record
Both the Save PDF button and the export dialog call `exportAndSaveActiveDocument`, which creates a new quotation or invoice unless an edit is in progress. Exporting the same document three times produces three records (`QUO-00001`, `QUO-00002`, `QUO-00003`).

**Fix:** after the first save, keep the saved record's ID for the open document so later exports update it; or separate "Save" from "Export PDF".

### 4.5 ID clashes between devices; invoice number overwritten
- ID counters live in each browser's `localStorage`. Two devices both create `INV-00001`, and because the Sheets upsert matches rows by ID, they overwrite each other.
- `saveInvoiceRecord` replaces the user-entered invoice number (e.g. `8`) with `INV-0000x`. GST rules require invoices to follow one continuous number series, so this matters for tax compliance.

**Fix:** have the server issue IDs (Apps Script with `LockService` and a counter in Script Properties), or include a device or user prefix; keep the user-facing invoice number separate from the internal record ID.

## 5. Other Issues

| # | Issue | Location |
| --- | --- | --- |
| 5.1 | Drive integration incomplete: folders are created but no PDF is ever uploaded. `uploadDocument` / `uploadLogo` are called by the client but `Code.gs` doesn't support them. "View Drive" only runs a Drive search. | `googleDriveService.js`, `Code.gs` |
| 5.2 | ES modules don't load over `file://`, so opening `index.html` by double-clicking breaks the app. A local web server is required (e.g. `npx serve`). | `index.html` `<script type="module">` |
| 5.3 | Two copies of the app state (`bizState` and `stateService.state`) are assigned back and forth; changes can be lost depending on which copy is saved last. | `index.html` (`loadBusinessState`, `saveBusinessState`) |
| 5.4 | Field mix-ups: invoice Reference is saved as the invoice's notes; quotation closing text is saved as notes, then loaded back into both the body and the closing fields; quotations take payment terms from the invoice's terms field. | `saveQuotationRecord`, `saveInvoiceRecord`, `loadQuotationIntoQuotationBuilder` |
| 5.5 | Customers are added and edited through a chain of `prompt()` pop-ups. | `addCustomerFromPrompt`, `editCustomerFromPrompt` |
| 5.6 | The 7 Sheets updates run in parallel and `upsertRows` doesn't take a lock, so two people syncing at once can overwrite each other's rows. | `syncBusinessRegister`, `Code.gs` `upsertRows` |
| 5.7 | Document history is silently capped at 200 entries. | `upsertDocumentHistoryEntry` |
| 5.8 | A hardcoded Google OAuth Client ID ships in config but no OAuth flow uses it. | `app-config.js` |

## 6. Bugs Carried Over From Main

| # | Issue |
| --- | --- |
| 6.1 | Letterhead address is duplicated after a reload: the `f-addr1` value already contains `#` and `Near Gymkhana Club`, and the preview template adds both again around `d-addr1`. |
| 6.2 | Text edited directly on the preview is lost on reload, because syncing only goes from the form to the preview. |
| 6.3 | The signature block says "For Arya Vysya Press" in fixed text and doesn't follow the company name. |
| 6.4 | Divider comments are garbled (`â•â•`) because box-drawing characters were saved with the wrong encoding. |
| 6.5 | The PDF export loads Google Fonts, so offline exports fall back to other fonts. |

## 7. Recommended Fix Order

1. **CORS:** switch requests to `text/plain` (4.1).
2. **Backend security:** shared-secret check, server-side spreadsheet and Drive IDs, no email in `health` (4.2).
3. **Customer matching** (4.3).
4. **Duplicate records on export** (4.4).
5. **Invoice numbering and ID generation** (4.5).
6. **Single source of truth for state** (5.3) and the field mix-ups (5.4).
7. **Finish or remove the Drive upload feature** (5.1).
8. **Carried-over bugs** (section 6).

## 8. Running Locally

```powershell
# from the project folder
npx serve .
# then open http://localhost:3000
```

Without a server, the browser blocks the ES module imports and the app won't start.
