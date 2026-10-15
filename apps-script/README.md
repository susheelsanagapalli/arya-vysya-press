# Apps Script Backend Setup

The Google Sheet "Arya Vysya Press - Business Register" is the shared copy of all business records. Every device syncs with it through this Apps Script web app, so a record created on one device appears on every other device.

## Files
- `Code.gs`: web app endpoint, sync logic and one-time setup functions.
- `appsscript.json`: manifest with the required OAuth scopes.

## One-time setup
1. Open https://script.google.com with the Google account that should own the register, and open the existing project (or create one with **New project**).
2. Replace the contents of `Code.gs` with this folder's `Code.gs`, then click **Save**.
3. (New project only) In **Project Settings**, enable **Show "appsscript.json" manifest file in editor** and replace the manifest with this folder's `appsscript.json`.
4. In the function dropdown at the top of the editor, select `setupApiKey` and click **Run**. Approve the permission prompt the first time. The **Execution log** shows the API key (`avp_...`). Keep it private.
5. **Deploy > New deployment**, type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the website must be able to reach it; the API key keeps everyone else out)
   - Click **Deploy** and copy the **Web app URL**.
   Creating a *new* deployment leaves older deployments (and the sites that use them) unchanged.
6. In the app, open **Settings** on every device and enter:
   - **Apps Script Web App URL**: the URL from step 5
   - **API Key**: the key from step 4
   Then click **Save Config**. On the first device, also click **Initialize Workspace** once.

To use an existing register spreadsheet, put its ID in **Business Register Spreadsheet ID** before clicking **Initialize Workspace** the first time. After that the spreadsheet is fixed on the server.

To change the key, run `rotateApiKey` and enter the new key on every device.

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
