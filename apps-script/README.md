# Apps Script Backend Setup

The Google Sheet "Arya Vysya Press - Business Register" is the shared copy of all business records. Every device syncs with it through this Apps Script web app, so a record created on one device appears on every other device.

## Files
- `Code.gs`: web app endpoint, sync logic and one-time setup functions.
- `appsscript.json`: manifest with the required OAuth scopes.

## One-time setup
1. Open https://script.google.com with the Google account that should own the register, and open the existing project (or create one with **New project**).
2. Replace the contents of `Code.gs` with this folder's `Code.gs`, then click **Save**.
3. (New project only) In **Project Settings**, enable **Show "appsscript.json" manifest file in editor** and replace the manifest with this folder's `appsscript.json`.
4. Set the **business password**: **Project Settings** (gear icon) > **Script Properties** > **Add script property**. Property `AVP_API_KEY`, value: your password (long and hard to guess). Click **Save script properties**. (Alternatively run `setupApiKey` to generate a random one and read it from the Execution log.)
5. **Deploy > New deployment**, type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the website must be able to reach it; the password keeps everyone else out)
   - Click **Deploy** and copy the **Web app URL**. Set it as `appsScriptUrl` in `js/modules/app-config.js`.
   To update the code later without changing the URL: **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**.
6. Open the app on any device. A **Sign in to sync** box asks for the business password once; with **Remember on this device** ticked it is not asked again. On the first device, also click **Settings > Initialize Workspace** once.

To use an existing register spreadsheet, put its ID in **Settings > Business Register Spreadsheet ID** before clicking **Initialize Workspace** the first time. After that the spreadsheet is fixed on the server.

To change the password, edit `AVP_API_KEY` in Script Properties. Every device then asks for the new password once. After 25 wrong attempts, sign-in is locked for 10 minutes.

On a shared computer, untick **Remember on this device**, or use **Settings > Sign out & remove data from this device** when done.

## How sync works
- On start, after every change, and when the app comes back into view, the app sends its records and receives the full register (`syncAll`). For each record, the most recently changed version wins.
- New quotation, invoice, payment and customer numbers are issued by the server (`allocateIds`), so two devices never create the same number. Creating these records needs a connection.
- Each tab keeps readable columns plus a hidden **Record JSON** column holding the complete record (line items included). Don't edit the Record JSON column by hand.

## Supported actions
All requests are JSON `POST`s with `action`, `apiKey`, `config` and `payload`:
- `health`
- `initializeBusinessRegister`
- `initializeDriveStructure`
- `pullAll`
- `syncAll`
- `allocateIds`
