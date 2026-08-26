# Apps Script Backend Setup

This folder contains the backend contract used by the frontend app to work with Google Sheets and Google Drive.

## Files
- `Code.gs`: API handlers and business register/drive operations.
- `appsscript.json`: Manifest with required OAuth scopes.

## Deploy
1. Open `https://script.new` with your target Google account.
2. Replace default `Code.gs` with this folder's `Code.gs` content.
3. Open project settings and enable `Show "appsscript.json" manifest file`.
4. Replace manifest with this folder's `appsscript.json`.
5. Deploy -> New deployment -> Web app.
6. Execute as: `Me`.
7. Who has access: choose your workspace audience (recommended: your organization users).
8. Copy Web App URL and paste into app Settings.

## Supported Actions
- `health`
- `initializeBusinessRegister`
- `initializeDriveStructure`
- `upsertCustomers`
- `upsertQuotations`
- `upsertInvoices`
- `upsertPayments`
- `upsertDocumentHistory`
- `upsertLetterheads`
- `upsertTemplates`

## Notes
- This backend is action-based and expects JSON POST body:
  - `action`: string
  - `config`: object
  - `payload`: object
- The frontend sends all entities with ID fields and Apps Script upserts rows by ID.
