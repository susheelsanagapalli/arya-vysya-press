# Apps Script Backend Setup

The Google Sheet "Arya Vysya Press - Business Register" is the shared copy of all business records. Every device syncs with it through this Apps Script web app, so a record created on one device appears on every other device.

## Files
- `Code.gs`: web app endpoint, sync logic and one-time setup functions.
- `appsscript.json`: manifest with the required OAuth scopes.

## One-time setup
1. Open https://script.google.com with the Google account that should own the register, and open the existing project (or create one with **New project**).
2. Replace the contents of `Code.gs` with this folder's `Code.gs`, then click **Save**.
3. (New project only) In **Project Settings**, enable **Show "appsscript.json" manifest file in editor** and replace the manifest with this folder's `appsscript.json`.
4. Turn on the **Drive API** (needed to update a saved PDF in place, keeping its link): in the editor's left sidebar click **Services +**, choose **Drive API**, version **v3**, identifier `Drive`, then **Add**. (Pasting this folder's `appsscript.json` does the same.)
5. Set the **business password**: **Project Settings** (gear icon) > **Script Properties** > **Add script property**. Property `AVP_API_KEY`, value: your password (long and hard to guess). Click **Save script properties**. (Alternatively run `setupApiKey` to generate a random one and read it from the Execution log.)
6. **Deploy > New deployment**, type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the website must be able to reach it; the password keeps everyone else out)
   - Click **Deploy** and copy the **Web app URL**. Set it as `appsScriptUrl` in `js/modules/app-config.js`.
   To update the code later without changing the URL: **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**.
7. Open the app on any device. A **Sign in to sync** box asks for the business password once; with **Remember on this device** ticked it is not asked again. On the first device, also click **Settings > Initialize Workspace** once.

To use an existing register spreadsheet, put its ID in **Settings > Business Register Spreadsheet ID** before clicking **Initialize Workspace** the first time. After that the spreadsheet is fixed on the server.

To change the password, edit `AVP_API_KEY` in Script Properties. Every device then asks for the new password once. After 25 wrong attempts, sign-in is locked for 10 minutes.

On a shared computer, untick **Remember on this device**, or use **Settings > Sign out & remove data from this device** when done.

## How sync works
- On start, after every change, when the app comes back into view, and on **Sync now**, the app sends only the records changed on that device and receives only the rows other devices changed since its last sync (`syncAll`). For each record, the most recently changed version wins.
- Every write gets the next number of a server-side change counter (Script Property `AVP_SYNC_MARK`), stored in each row's hidden **Synced At** column; a device asks for rows numbered above the one it last saw. A device's first sync, and **Settings > Sync Register**, exchange everything. Don't delete `AVP_SYNC_MARK`.
- New quotation, invoice, payment and customer numbers are issued by the server (`allocateIds`), so two devices never create the same number. Creating these records needs a connection.
- Each tab keeps readable columns plus two hidden columns: **Synced At** and **Record JSON** (the complete record, line items included). Don't edit them by hand. Rows edited directly in the sheet reach devices only through **Sync Register**.
- When a new version adds columns (e.g. **Manual No.** and **Credit** on Invoices), the script moves the existing data so every value stays under its heading.
- Deleted records are kept with `deleted: true` and Status "Deleted" so the deletion reaches every device. Invoices are cancelled, never deleted.

## Firms and numbering
- The **Firms** tab holds each business (name, GSTIN, address, bank details, contact, default texts; the logo is in its own column).
- Quotation, invoice and payment numbers are issued per firm: `<CODE>-QUO-00001`, `<CODE>-INV-00001`, `<CODE>-PAY-00001`. Customers are shared (`CUS-00001`).
- Records created before firms existed (unprefixed, e.g. `INV-00003`) belong to firm `AVP`, whose series continues that count (`AVP-INV-00004`).
- An invoice can also have a **Manual No.** (typed by the user, unique within the firm). The auto number stays the invoice's ID and names its Drive PDF; the printed copy (Print button) shows the Manual No. The Invoices tab shows both.
- Each firm's PDFs go to a top-level Drive folder named after the firm; `AVP` keeps the original `Arya Vysya Press` folder.

## PDFs in Google Drive
- **Save Quotation** / **Save Invoice** renders the quotation or invoice to PDF in the browser (an exact copy of the preview) and uploads it (`savePdf`) to `Arya Vysya Press/Quotations/<year>/` or `Invoices/<year>/`, named `<number> - <customer>.pdf`.
- Saving the same record again updates the same Drive file (same link; Drive keeps earlier versions). Without the Drive API the old file is trashed and a new one created.
- **View file** on any quotation/invoice opens the PDF in Drive. If an upload fails (e.g. offline), the record shows **Upload PDF** to retry.

## Supported actions
All requests are JSON `POST`s with `action`, `apiKey`, `config` and `payload`:
- `health`
- `initializeBusinessRegister`
- `initializeDriveStructure`
- `pullAll`
- `syncAll`
- `allocateIds`
- `savePdf`
