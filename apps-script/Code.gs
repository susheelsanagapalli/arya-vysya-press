// Arya Vysya Press - Business Register backend (Google Apps Script web app).
//
// The Google Sheet is the shared copy of the business register; every device syncs with it.
// Every request must carry the business password stored in Script Properties as AVP_API_KEY.

// Column layout per tab: [header, record field, optional toCell(record), optional fromCell(value)].
// The last column of every tab is 'Record JSON', which holds the full record so it round-trips exactly.
const TAB_COLUMNS = {
  Customers: [
    ['Customer ID', 'id'], ['Customer Name', 'customerName'], ['Company Name', 'companyName'],
    ['Contact Person', 'contactPerson'], ['Phone', 'phone'], ['Email', 'email'],
    ['Billing Address', 'billingAddress'], ['Shipping Address', 'shippingAddress'], ['GSTIN', 'gstin'],
    ['PAN', 'pan'], ['State', 'state'], ['State Code', 'stateCode'], ['Pincode', 'pincode'],
    ['Customer Type', 'customerType'], ['Notes', 'notes'], ['Drive Folder ID', 'driveFolderId'],
    ['Created Date', 'createdDate'], ['Last Updated', 'lastUpdated'], ['Status', 'status']
  ],
  Quotations: [
    ['Quotation ID', 'id'], ['Quotation Number', 'quotationNumber'], ['Customer ID', 'customerId'],
    ['Customer Name', 'customerName'], ['Company Name', 'companyName'], ['Quotation Date', 'quotationDate'],
    ['Valid Until', 'validUntil'], ['Letterhead ID', 'letterheadId'], ['Subtotal', 'subtotal'], ['GST', 'gst'],
    ['Grand Total', 'grandTotal'], ['Currency', 'currency'], ['Payment Terms', 'paymentTerms'], ['Notes', 'notes'],
    ['Status', 'status'], ['Source Document ID', 'sourceDocumentId'], ['Created Date', 'createdDate'],
    ['Last Updated', 'lastUpdated'], ['Drive File ID', 'driveFileId'], ['Drive File URL', 'driveFileUrl'],
    ['Created By', 'createdBy'], ['Converted Invoice ID', 'convertedInvoiceId'],
    ['Tax Mode', 'taxMode', r => r.taxMode || (r.gstApplicable === false ? 'NON_GST' : 'GST')]
  ],
  Invoices: [
    ['Invoice ID', 'id'], ['Invoice Number', 'invoiceNumber'], ['Quotation ID', 'quotationId'],
    ['Quotation Number', 'quotationNumber'], ['Customer ID', 'customerId'], ['Customer Name', 'customerName'],
    ['Company Name', 'companyName'], ['Invoice Date', 'invoiceDate'], ['Due Date', 'dueDate'],
    ['Letterhead ID', 'letterheadId'], ['Subtotal', 'subtotal'], ['GST', 'gst'], ['Grand Total', 'grandTotal'],
    ['Amount Paid', 'amountPaid'], ['Balance Due', 'balanceDue'], ['Payment Status', 'paymentStatus'],
    ['Payment Terms', 'paymentTerms'], ['Notes', 'notes'], ['Status', 'status'],
    ['Source Document ID', 'sourceDocumentId'], ['Created Date', 'createdDate'], ['Last Updated', 'lastUpdated'],
    ['Drive File ID', 'driveFileId'], ['Drive File URL', 'driveFileUrl'], ['Created By', 'createdBy'],
    ['Tax Mode', 'taxMode', r => r.taxMode || (r.gstApplicable === false ? 'NON_GST' : 'GST')]
  ],
  Payments: [
    ['Payment ID', 'id'], ['Invoice ID', 'invoiceId'], ['Invoice Number', 'invoiceNumber'],
    ['Quotation ID', 'quotationId'], ['Customer ID', 'customerId'], ['Customer Name', 'customerName'],
    ['Payment Date', 'paymentDate'], ['Amount Received', 'amountReceived'], ['Payment Mode', 'paymentMode'],
    ['Credited To', 'creditedTo'], ['Transferred To', 'transferredTo'],
    ['Transaction Reference', 'transactionReference'], ['Bank / Account', 'bankAccount'],
    ['Payment Details', 'paymentDetails'], ['Notes', 'notes'], ['Recorded By', 'recordedBy'],
    ['Created Date', 'createdDate']
  ],
  'Document Register': [
    ['Document ID', 'id'], ['Document Type', 'documentType'], ['Document Number', 'documentNumber'],
    ['Customer ID', 'customerId'], ['Customer Name', 'customerName'], ['Document Date', 'documentDate'],
    ['Amount', 'amount'], ['Status', 'status'], ['Drive File ID', 'driveFileId'], ['Drive URL', 'driveFileUrl'],
    ['Source Quotation ID', 'sourceQuotationId'], ['Source Invoice ID', 'sourceInvoiceId'],
    ['Created Date', 'createdDate'], ['Last Updated', 'lastUpdated']
  ],
  Letterheads: [
    ['Letterhead ID', 'id'], ['Letterhead Name', 'letterheadName'], ['Company Name', 'companyName'],
    ['Tagline', 'tagline'], ['GSTIN', 'gstin'], ['Address', 'address'], ['Phone', 'phone'], ['Email', 'email'],
    ['Website', 'website'], ['Footer', 'footer'], ['Terms', 'terms'], ['Brand Style', 'brandStyle'],
    ['Logo Drive File ID', 'logoDriveFileId'], ['Logo Drive URL', 'logoDriveUrl'], ['Created Date', 'createdDate'],
    ['Last Updated', 'lastUpdated'],
    ['Default', 'isDefault', r => (r.isDefault ? 'Yes' : 'No'), v => v === 'Yes' || v === true],
    ['Status', 'status', r => r.status || 'Active']
  ],
  Firms: [
    ['Firm Code', 'id'], ['Firm Name', 'name'], ['Tagline', 'tagline'], ['GSTIN', 'gstin'],
    ['Address Line 1', 'addr1'], ['Address Line 2', 'addr2'], ['Phone', 'phone'], ['Email', 'email'],
    ['Website', 'website'], ['Bank Account Name', 'bankAccountName'], ['Bank Name & Branch', 'bankName'],
    ['Bank Account No', 'bankAccountNo'], ['IFSC', 'ifsc'], ['Contact Person', 'contactName'],
    ['Contact Phone', 'contactPhone'], ['Contact Email', 'contactEmail'], ['Default Terms', 'defaultTerms'],
    ['Quotation Opening Text', 'quotationIntro'], ['Quotation Closing Text', 'quotationClosing'],
    ['Default', 'isDefault', r => (r.isDefault ? 'Yes' : 'No'), v => v === 'Yes' || v === true],
    ['Created Date', 'createdDate'], ['Last Updated', 'lastUpdated'], ['Status', 'status', r => r.status || 'Active'],
    // The logo is kept in its own cell (not in Record JSON) to stay under the 50,000-character cell limit.
    ['Logo', 'logo']
  ],
  Templates: [
    ['Template ID', 'id'], ['Template Name', 'templateName'], ['GST %', 'gstPct'], ['Payment Terms', 'paymentTerms'],
    ['Notes', 'notes'], ['Letterhead ID', 'letterheadId'],
    ['Line Items JSON', 'lineItems', r => JSON.stringify(r.lineItems || []), v => safeJsonParse(v, [])],
    ['Created Date', 'createdDate'], ['Last Updated', 'lastUpdated'], ['Status', 'status', r => r.status || 'Active']
  ]
};

const RECORD_JSON_HEADER = 'Record JSON';

// Large fields stored only in their own column, not inside Record JSON (cell limit 50,000 chars).
const JSON_EXCLUDED_FIELDS = { Firms: ['logo'] };

// App collection name -> sheet tab.
const COLLECTION_TABS = {
  customers: 'Customers',
  quotations: 'Quotations',
  invoices: 'Invoices',
  payments: 'Payments',
  documentHistory: 'Document Register',
  letterheads: 'Letterheads',
  templates: 'Templates',
  firms: 'Firms'
};

// Server-issued record numbers.
const ID_PREFIXES = { customer: 'CUS', quotation: 'QUO', invoice: 'INV', payment: 'PAY' };
const ID_TABS = { customer: 'Customers', quotation: 'Quotations', invoice: 'Invoices', payment: 'Payments' };

const SETTINGS_HEADERS = ['Key', 'Value', 'Updated Date'];

const DRIVE_FOLDERS = ['Customers', 'Quotations', 'Invoices', 'Letterheads', 'Logos', 'Templates'];

const PROP_API_KEY = 'AVP_API_KEY';
const PROP_SPREADSHEET_ID = 'AVP_SPREADSHEET_ID';
const PROP_DRIVE_ROOT_ID = 'AVP_DRIVE_ROOT_FOLDER_ID';
const PROP_COUNTER_PREFIX = 'AVP_COUNTER_';
const REGISTER_TITLE = 'Arya Vysya Press - Business Register';

// ---------------------------------------------------------------------------
// One-time setup: run from the Apps Script editor (select setupApiKey, click Run).
// ---------------------------------------------------------------------------
function setupApiKey() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(PROP_API_KEY);
  if (key) {
    Logger.log('An API key already exists (run rotateApiKey to replace it). Your API key is: ' + key);
    return key;
  }
  key = 'avp_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  props.setProperty(PROP_API_KEY, key);
  Logger.log('Your business password is: ' + key);
  Logger.log('To use a memorable one instead, edit AVP_API_KEY in Project Settings > Script Properties.');
  return key;
}

// Replaces the API key. Every device must then be updated with the new key.
function rotateApiKey() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_API_KEY);
  return setupApiKey();
}

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    requireApiKey(req.apiKey);

    const action = req.action;
    const payload = req.payload || {};
    const config = req.config || {};
    let data;

    switch (action) {
      case 'health':
        data = health();
        break;
      case 'initializeBusinessRegister':
        data = initializeBusinessRegister(config);
        break;
      case 'initializeDriveStructure':
        data = initializeDriveStructure(payload, config);
        break;
      case 'pullAll':
        data = pullAll();
        break;
      case 'syncAll':
        data = withLock(() => {
          const result = upsertCollections(payload);
          return { result: result, records: pullAll() };
        });
        break;
      case 'allocateIds':
        data = withLock(() => allocateIds(payload.kinds || {}, payload.firm || '', payload.legacyFirm === true));
        break;
      case 'savePdf':
        data = savePdf(payload);
        break;
      default:
        throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse({ ok: true, data: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

// The API key doubles as the business password: the value of the AVP_API_KEY script property
// (set it to anything memorable in Project Settings > Script Properties).
// Repeated wrong attempts lock sign-in for 10 minutes to stop password guessing.
const MAX_FAILED_SIGNINS = 25;
const SIGNIN_LOCK_SECONDS = 600;

function requireApiKey(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty(PROP_API_KEY);
  if (!expected) throw new Error('Server has no business password yet. Set AVP_API_KEY in the Apps Script project settings.');

  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get('avp_failed_signins') || 0);
  if (failures >= MAX_FAILED_SIGNINS) {
    throw new Error('Too many wrong passwords. Try again in 10 minutes.');
  }
  if (!provided || String(provided) !== expected) {
    cache.put('avp_failed_signins', String(failures + 1), SIGNIN_LOCK_SECONDS);
    throw new Error('Wrong business password.');
  }
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function health() {
  const spreadsheet = getRegister(false);
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty(PROP_DRIVE_ROOT_ID) || '';
  let driveRootUrl = '';
  let quotationsFolderUrl = '';
  let invoicesFolderUrl = '';

  if (rootId) {
    try {
      const root = DriveApp.getFolderById(rootId);
      driveRootUrl = root.getUrl();
      const q = root.getFoldersByName('Quotations');
      if (q.hasNext()) quotationsFolderUrl = q.next().getUrl();
      const i = root.getFoldersByName('Invoices');
      if (i.hasNext()) invoicesFolderUrl = i.next().getUrl();
    } catch (error) {
      driveRootUrl = '';
    }
  }

  return {
    spreadsheetId: spreadsheet ? spreadsheet.getId() : '',
    spreadsheetName: spreadsheet ? spreadsheet.getName() : '',
    spreadsheetUrl: spreadsheet ? spreadsheet.getUrl() : '',
    driveRootId: rootId,
    driveRootUrl: driveRootUrl,
    quotationsFolderUrl: quotationsFolderUrl,
    invoicesFolderUrl: invoicesFolderUrl,
    serverTime: new Date().toISOString()
  };
}

// Creates (or adopts) the register spreadsheet and makes sure every tab and header exists.
// A client-supplied spreadsheet ID is only accepted the first time, before one is stored.
function initializeBusinessRegister(config) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(PROP_SPREADSHEET_ID) && config.spreadsheetId) {
    const adopted = SpreadsheetApp.openById(config.spreadsheetId);
    props.setProperty(PROP_SPREADSHEET_ID, adopted.getId());
  }
  const spreadsheet = getRegister(true);
  Object.keys(TAB_COLUMNS).forEach(tab => ensureTab(spreadsheet, tab));
  ensureSheet(spreadsheet, 'Settings', SETTINGS_HEADERS);

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function initializeDriveStructure(payload, config) {
  const props = PropertiesService.getScriptProperties();
  let root = null;
  const storedId = props.getProperty(PROP_DRIVE_ROOT_ID);
  const requestedId = config.driveRootId || payload.rootFolderId;

  if (storedId) {
    try { root = DriveApp.getFolderById(storedId); } catch (error) { root = null; }
  }
  if (!root && requestedId) {
    root = DriveApp.getFolderById(requestedId);
  }
  if (!root) {
    const name = payload.rootFolderName || 'Arya Vysya Press';
    const iter = DriveApp.getFoldersByName(name);
    root = iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
  }
  props.setProperty(PROP_DRIVE_ROOT_ID, root.getId());

  const folders = {};
  DRIVE_FOLDERS.forEach(name => {
    const iter = root.getFoldersByName(name);
    const folder = iter.hasNext() ? iter.next() : root.createFolder(name);
    folders[name] = { id: folder.getId(), url: folder.getUrl() };
  });

  return {
    rootFolderId: root.getId(),
    rootFolderName: root.getName(),
    rootFolderUrl: root.getUrl(),
    quotationsFolderId: folders.Quotations.id,
    quotationsFolderUrl: folders.Quotations.url,
    invoicesFolderId: folders.Invoices.id,
    invoicesFolderUrl: folders.Invoices.url
  };
}

// Returns every record of every collection.
function pullAll() {
  const spreadsheet = getRegister(false);
  const out = { serverTime: new Date().toISOString() };
  Object.keys(COLLECTION_TABS).forEach(collection => {
    out[collection] = spreadsheet ? readTabRecords(spreadsheet, COLLECTION_TABS[collection]) : [];
  });
  return out;
}

// Upserts records by ID. The newer version wins (lastUpdated, else createdDate).
function upsertCollections(payload) {
  const spreadsheet = getRegister(true);
  const result = {};

  Object.keys(COLLECTION_TABS).forEach(collection => {
    const items = Array.isArray(payload[collection]) ? payload[collection] : [];
    if (!items.length) {
      result[collection] = { written: 0, skipped: 0 };
      return;
    }
    const tab = COLLECTION_TABS[collection];
    const sheet = ensureTab(spreadsheet, tab);
    const headers = tabHeaders(tab);
    const width = headers.length;
    const jsonIdx = width - 1;
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];

    const indexById = {};
    rows.forEach((row, i) => { if (row[0]) indexById[String(row[0])] = i; });

    let written = 0;
    let skipped = 0;
    items.forEach(item => {
      if (!item || !item.id) return;
      const id = String(item.id);
      const existingIdx = indexById[id];
      if (existingIdx !== undefined) {
        const existing = recordFromRow(tab, headers, rows[existingIdx], jsonIdx);
        if (stampOf(existing) > stampOf(item)) { skipped += 1; return; }
        rows[existingIdx] = rowFromRecord(tab, item);
      } else {
        indexById[id] = rows.length;
        rows.push(rowFromRecord(tab, item));
      }
      written += 1;
    });

    if (rows.length) sheet.getRange(2, 1, rows.length, width).setValues(rows);
    result[collection] = { written: written, skipped: skipped };
  });

  // Keep the number counters ahead of any number that already exists in the sheet.
  Object.keys(ID_PREFIXES).forEach(kind => bumpCounterToSheetMax(spreadsheet, kind));
  return result;
}

// kinds: { invoice: 1, customer: 1 }, firm: 'AVP' -> { invoice: ['AVP-INV-00012'], customer: ['CUS-00004'] }
// Quotations, invoices and payments are numbered per firm; customers are shared (CUS-...).
// legacyFirm: this firm also owns the older unprefixed numbers (INV-00003), so its count continues them.
function allocateIds(kinds, firm, legacyFirm) {
  const spreadsheet = getRegister(true);
  const props = PropertiesService.getScriptProperties();
  const firmCode = String(firm || '').toUpperCase();
  if (firmCode && !/^[A-Z0-9]{1,6}$/.test(firmCode)) throw new Error('Invalid firm code: ' + firm);
  const out = {};

  Object.keys(kinds).forEach(kind => {
    const prefix = ID_PREFIXES[kind];
    const count = Math.min(Math.max(Number(kinds[kind]) || 0, 0), 20);
    if (!prefix || !count) return;
    const code = kind === 'customer' ? '' : firmCode;
    const base = code ? code + '-' + prefix : prefix;
    let current = bumpCounterToSheetMax(spreadsheet, kind, code, legacyFirm);
    out[kind] = [];
    for (let i = 0; i < count; i += 1) {
      current += 1;
      out[kind].push(base + '-' + String(current).padStart(5, '0'));
    }
    props.setProperty(counterKey(kind, code), String(current));
  });

  return out;
}

function counterKey(kind, firmCode) {
  return PROP_COUNTER_PREFIX + (firmCode ? firmCode + '_' : '') + kind;
}

// Saves a quotation/invoice PDF to Drive: <root>/Quotations|Invoices/<year>/<fileName>.
// With an existing fileId the same file is updated in place (same link; Drive keeps old versions).
// payload: { kind: 'quotation'|'invoice', fileName, base64, fileId?, year? }
function savePdf(payload) {
  const kindFolder = payload.kind === 'invoice' ? 'Invoices' : 'Quotations';
  const fileName = String(payload.fileName || 'document.pdf').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 150);
  if (!payload.base64) throw new Error('No PDF data received.');
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.base64), 'application/pdf', fileName);

  if (payload.fileId) {
    try {
      if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.update) {
        Drive.Files.update({ name: fileName }, payload.fileId, blob);
        return pdfResult(payload.fileId);
      }
      // Drive API not switched on: replace the old file instead (link changes).
      DriveApp.getFileById(payload.fileId).setTrashed(true);
    } catch (error) {
      // The old file is gone or inaccessible: fall through and create a new one.
    }
  }

  const year = String(payload.year || new Date().getFullYear());
  const firmRoot = payload.firmCode ? getFirmRoot(payload.firmCode, payload.firmName, payload.legacyFirm === true) : getDriveRoot();
  const folder = getOrCreateChild(getOrCreateChild(firmRoot, kindFolder), year);
  const file = folder.createFile(blob);
  return pdfResult(file.getId());
}

function pdfResult(fileId) {
  return {
    fileId: fileId,
    fileUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
    savedAt: new Date().toISOString()
  };
}

function getDriveRoot() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty(PROP_DRIVE_ROOT_ID);
  if (storedId) {
    try { return DriveApp.getFolderById(storedId); } catch (error) { /* recreate below */ }
  }
  const iter = DriveApp.getFoldersByName('Arya Vysya Press');
  const root = iter.hasNext() ? iter.next() : DriveApp.createFolder('Arya Vysya Press');
  props.setProperty(PROP_DRIVE_ROOT_ID, root.getId());
  return root;
}

// Each firm has its own top-level Drive folder named after the firm (e.g. "Srujans Gifting").
// The legacy firm keeps the original "Arya Vysya Press" root folder.
function getFirmRoot(firmCode, firmName, legacyFirm) {
  const code = String(firmCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const props = PropertiesService.getScriptProperties();
  const key = 'AVP_FIRM_ROOT_' + code;
  const storedId = props.getProperty(key);
  if (storedId) {
    try { return DriveApp.getFolderById(storedId); } catch (error) { /* recreate below */ }
  }
  let root;
  if (legacyFirm) {
    root = getDriveRoot();
  } else {
    const name = String(firmName || code).replace(/[\\/:*?"<>|]+/g, '-').trim() || code;
    const iter = DriveApp.getFoldersByName(name);
    root = iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
  }
  props.setProperty(key, root.getId());
  return root;
}

function getOrCreateChild(parent, name) {
  const iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getRegister(createIfMissing) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);
  if (!createIfMissing) return null;

  let spreadsheet = null;
  const files = DriveApp.getFilesByName(REGISTER_TITLE);
  while (files.hasNext() && !spreadsheet) {
    const file = files.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) spreadsheet = SpreadsheetApp.openById(file.getId());
  }
  if (!spreadsheet) spreadsheet = SpreadsheetApp.create(REGISTER_TITLE);
  props.setProperty(PROP_SPREADSHEET_ID, spreadsheet.getId());
  return spreadsheet;
}

function tabHeaders(tab) {
  return TAB_COLUMNS[tab].map(col => col[0]).concat([RECORD_JSON_HEADER]);
}

function ensureTab(spreadsheet, tab) {
  return ensureSheet(spreadsheet, tab, tabHeaders(tab));
}

function ensureSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  const current = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0]
    : [];
  const matches = headers.every((h, i) => current[i] === h);
  if (!matches) {
    // New columns are only ever appended, so existing data stays aligned.
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f5f5f5');
    sheet.setFrozenRows(1);
    if (headers[headers.length - 1] === RECORD_JSON_HEADER) sheet.hideColumns(headers.length);
  }
  return sheet;
}

function rowFromRecord(tab, record) {
  const cells = TAB_COLUMNS[tab].map(col => {
    const value = col[2] ? col[2](record) : record[col[1]];
    return value === undefined || value === null ? '' : value;
  });
  const excluded = JSON_EXCLUDED_FIELDS[tab] || [];
  const forJson = {};
  Object.keys(record).forEach(key => { if (excluded.indexOf(key) < 0) forJson[key] = record[key]; });
  cells.push(JSON.stringify(forJson));
  return cells;
}

function recordFromRow(tab, headers, row, jsonIdx) {
  const parsed = safeJsonParse(row[jsonIdx], null);
  if (parsed && typeof parsed === 'object') {
    // Put back the fields kept in their own columns.
    (JSON_EXCLUDED_FIELDS[tab] || []).forEach(field => {
      const idx = TAB_COLUMNS[tab].findIndex(col => col[1] === field);
      if (idx >= 0 && row[idx] !== '') parsed[field] = row[idx];
    });
    return parsed;
  }

  // Rows written before the Record JSON column existed: rebuild from the readable columns.
  const record = {};
  TAB_COLUMNS[tab].forEach((col, i) => {
    let value = row[i];
    if (value instanceof Date) value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    record[col[1]] = col[3] ? col[3](value) : value;
  });
  if (tab === 'Quotations' || tab === 'Invoices') {
    record.gstApplicable = record.taxMode !== 'NON_GST';
    record.items = record.items || [];
  }
  return record;
}

function readTabRecords(spreadsheet, tab) {
  const sheet = spreadsheet.getSheetByName(tab);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = tabHeaders(tab);
  const width = headers.length;
  const jsonIdx = width - 1;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  return rows.filter(row => row[0]).map(row => recordFromRow(tab, headers, row, jsonIdx));
}

function stampOf(record) {
  return String((record && (record.lastUpdated || record.createdDate)) || '');
}

// Raises the stored counter for a kind (and firm) to the highest number already in its tab; returns it.
// For the legacy firm, the older unprefixed numbers (INV-00003) count too, so its series continues.
function bumpCounterToSheetMax(spreadsheet, kind, firmCode, legacyFirm) {
  const props = PropertiesService.getScriptProperties();
  const prefix = ID_PREFIXES[kind];
  const code = firmCode || '';
  let max = Number(props.getProperty(counterKey(kind, code)) || 0);
  if (code && legacyFirm) max = Math.max(max, Number(props.getProperty(counterKey(kind, '')) || 0));

  const patterns = [];
  if (code) patterns.push(new RegExp('^' + code + '-' + prefix + '-(\\d+)$'));
  if (!code || legacyFirm) patterns.push(new RegExp('^' + prefix + '-(\\d+)$'));

  const sheet = spreadsheet.getSheetByName(ID_TABS[kind]);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(r => {
      patterns.forEach(pattern => {
        const m = pattern.exec(String(r[0]));
        if (m) max = Math.max(max, Number(m[1]));
      });
    });
  }
  props.setProperty(counterKey(kind, code), String(max));
  return max;
}

function safeJsonParse(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
