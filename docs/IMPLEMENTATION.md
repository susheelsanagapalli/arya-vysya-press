# Arya Vysya Press Document Builder 2.0 - Implementation Guide

## 1. Overview
This implementation upgrades the original document generator to a workflow-driven system with the relationship:

Customer -> Quotation -> Invoice -> Payment

The app keeps all original builder capabilities and adds:
- Management shell with modules (Dashboard, Customers, Quotations, Invoices, Payments, Letterheads, Templates, Settings, Builder)
- ID-based records (`CUS-`, `QUO-`, `INV-`, `PAY-`)
- Quotation-to-invoice conversion with source linkage
- Payment recording and auto status calculation
- Register tables with search
- Mobile-accessible responsive experience
- Modularized service files
- Google Sheets + Google Drive integration layer contract via Apps Script

## 2. Current Project Structure

- `index.html`: Main app shell + builder UI + orchestration
- `js/modules/app-config.js`: Global keys/config and constants
- `js/modules/storage.js`: Local JSON storage helpers
- `js/modules/format.js`: Date/amount/escape utility functions
- `js/services/businessStateService.js`: Persistent business state and ID generation
- `js/services/customerService.js`: Customer logic
- `js/services/quotationService.js`: Quotation logic
- `js/services/invoiceService.js`: Invoice logic and payment status recalculation
- `js/services/paymentService.js`: Payment record logic
- `js/services/letterheadService.js`: Letterhead defaults and management foundation
- `js/services/templateService.js`: Template seed and management foundation
- `js/services/googleSheetsService.js`: Sheets action client
- `js/services/googleDriveService.js`: Drive action client
- `js/services/googleIntegrationService.js`: Unified Google integration orchestrator
- `apps-script/Code.gs`: Google Apps Script backend (API endpoint)
- `apps-script/appsscript.json`: Apps Script manifest and OAuth scopes
- `docs/IMPLEMENTATION.md`: This document

## 3. Architecture

### Frontend
- Single-page management app
- Builder mode retains original quotation/invoice editor and PDF export
- Register views are driven by business state
- Settings page controls Google integration configuration

### Persistence (current)
- Local storage for immediate functionality
- Key app state is persisted:
  - Builder state
  - Business register state
  - Google configuration

### Google Integration (production target)
- Frontend sends action-based requests to Apps Script web app endpoint
- Apps Script performs Sheets/Drive operations securely
- Spreadsheet tabs are auto-created and managed
- Drive folder structure is auto-created and managed

## 4. Data Model

### Customer
Primary key: `Customer ID` (`CUS-00001`)

### Quotation
Primary key: `Quotation ID` (`QUO-00001`)
References: `Customer ID`
Conversion link: `Converted Invoice ID`

### Invoice
Primary key: `Invoice ID` (`INV-00001`)
References: `Quotation ID`, `Customer ID`
Payment fields:
- `Amount Paid`
- `Balance Due`
- `Payment Status`

### Payment
Primary key: `Payment ID` (`PAY-00001`)
References: `Invoice ID`, `Quotation ID`, `Customer ID`

## 5. Workflow Implementation

### 5.1 Save Quotation
1. Capture current builder quotation fields and line items
2. Resolve/create customer
3. Generate `QUO-xxxxx`
4. Save quotation record
5. Render in Quotations register

### 5.2 Create Invoice from Quotation
1. Select quotation in register
2. Validate conversion status
3. Prefill invoice fields and line items
4. Keep source reference in memory
5. Save invoice as new `INV-xxxxx`
6. Mark quotation as `Converted`

### 5.3 Record Payment
1. Open invoice action
2. Enter payment details
3. Create `PAY-xxxxx`
4. Recalculate invoice amounts and payment status
5. Dashboard and registers update

### 5.4 Overdue Logic
If `Balance Due > 0` and `Due Date < Today`, then `Payment Status = Overdue`.

## 6. Google Sheets Structure
Business Register spreadsheet:
- Customers
- Quotations
- Invoices
- Payments
- Letterheads
- Templates
- Settings

The Apps Script backend ensures header row, freeze, filter, and baseline formatting.

## 7. Google Drive Structure
Root:
- Arya Vysya Press/
  - Customers/
  - Quotations/2026/
  - Invoices/2026/
  - Letterheads/
  - Logos/
  - Templates/

## 8. Settings and Configuration
In-app settings fields:
- Google Client ID
- Apps Script Web App URL
- Business Register Spreadsheet ID (optional for first init)
- Drive Root Folder ID (optional for first init)

Buttons:
- Save Config
- Test Connection
- Initialize Workspace
- Sync Register

## 9. Deployment Paths

### Option A: Static Hosting + Apps Script (recommended now)
- Host `index.html` and `js/` files on static host (GitHub Pages / Netlify / Vercel)
- Deploy Apps Script as web app
- Paste web app URL into Settings

### Option B: Internal local hosting
- Serve files via local web server
- Use same Apps Script endpoint

## 10. Security Notes
- Do not expose Google client secrets in frontend
- Apps Script endpoint performs privileged API actions
- Use least-privilege scopes
- Restrict deployment access where possible

## 11. Mobile Usability
Implemented improvements:
- Management shell visible on mobile
- Slide-in sidebar navigation
- Single-column responsive KPI and settings layouts
- Builder stack layout for narrow screens
- Removed desktop-only blocker behavior

## 12. Troubleshooting

### Connection test fails
- Verify Apps Script URL is deployed as web app and accessible
- Ensure authorized access includes target account
- Ensure spreadsheet/folder IDs are valid

### Sync fails
- Run Initialize Workspace once
- Re-test connection
- Verify required tabs exist and header format is not corrupted

### Record mismatch
- Confirm IDs are not manually edited in sheets
- Re-run Sync Register

## 13. What Is Already Complete
- End-to-end local workflow execution
- Modular service separation for major domains
- Google integration backend contract and implementation files
- Responsive/mobile optimization baseline

## 14. What Still Needs Your External Inputs
To complete live Google operations, provide:

1. Google OAuth Client ID
2. Apps Script Web App URL
3. Optional Spreadsheet ID (if using existing register)
4. Optional Drive Root Folder ID (if using existing root)

Without these, local workflow works fully, but cloud sync cannot execute.

## 15. Exact Setup Steps You Need To Do

### Step 1 - Create Google Cloud project
- Google Cloud Console -> New Project
- Name: Arya Vysya Press Document Manager

### Step 2 - Enable APIs
- Google Sheets API
- Google Drive API

### Step 3 - Configure OAuth consent
- Internal (for same Workspace) or External (if needed)
- Fill app name/support email/developer email

### Step 4 - Create OAuth Client ID
- Type: Web Application
- Add your production origin and redirect URIs
- Copy Client ID

### Step 5 - Deploy Apps Script backend
1. Open script.new in your Google account
2. Replace default file with `apps-script/Code.gs`
3. Add `apps-script/appsscript.json` manifest values
4. Deploy -> New deployment -> Web app
5. Execute as: your account
6. Access: your domain users (or appropriate scope)
7. Copy Web App URL

### Step 6 - Provide values in app Settings
- Google Client ID
- Apps Script Web App URL
- Click Save Config
- Click Test Connection
- Click Initialize Workspace
- Click Sync Register

## 16. Validation Checklist
- Create customer -> appears in Customers register
- Save quotation -> appears in Quotations register with `QUO-xxxxx`
- Create invoice from quotation -> source link set, quotation marked converted
- Record payment -> payment entry created and invoice status recalculated
- Overdue appears on dashboard when due date is in past and balance > 0
- Sync register succeeds to Google sheets

## 17. Recommended Next Enhancements
- Replace prompt-based forms with modal forms for customer/payment creation
- Add explicit revision management UI
- Add retry-safe Export & Save with Drive file idempotency markers
- Add sheet-to-app refresh/recalculate with manual merge controls
