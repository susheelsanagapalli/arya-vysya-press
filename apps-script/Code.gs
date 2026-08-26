const SHEET_HEADERS = {
  Customers: [
    'Customer ID','Customer Name','Company Name','Contact Person','Phone','Email','Billing Address','Shipping Address',
    'GSTIN','PAN','State','State Code','Pincode','Customer Type','Notes','Drive Folder ID','Created Date','Last Updated','Status'
  ],
  Quotations: [
    'Quotation ID','Quotation Number','Customer ID','Customer Name','Company Name','Quotation Date','Valid Until','Letterhead ID',
    'Subtotal','GST','Grand Total','Currency','Payment Terms','Notes','Status','Source Document ID','Created Date','Last Updated',
    'Drive File ID','Drive File URL','Created By','Converted Invoice ID','Tax Mode'
  ],
  Invoices: [
    'Invoice ID','Invoice Number','Quotation ID','Quotation Number','Customer ID','Customer Name','Company Name','Invoice Date','Due Date',
    'Letterhead ID','Subtotal','GST','Grand Total','Amount Paid','Balance Due','Payment Status','Payment Terms','Notes','Status',
    'Source Document ID','Created Date','Last Updated','Drive File ID','Drive File URL','Created By','Tax Mode'
  ],
  Payments: [
    'Payment ID','Invoice ID','Invoice Number','Quotation ID','Customer ID','Customer Name','Payment Date','Amount Received',
    'Payment Mode','Credited To','Transferred To','Transaction Reference','Bank / Account','Payment Details','Notes','Recorded By','Created Date'
  ],
  'Document Register': [
    'Document ID','Document Type','Document Number','Customer ID','Customer Name','Document Date','Amount','Status','Drive File ID','Drive URL',
    'Source Quotation ID','Source Invoice ID','Created Date','Last Updated'
  ],
  Letterheads: [
    'Letterhead ID','Letterhead Name','Company Name','Tagline','GSTIN','Address','Phone','Email','Website','Footer','Terms','Brand Style',
    'Logo Drive File ID','Logo Drive URL','Created Date','Last Updated','Default','Status'
  ],
  Templates: [
    'Template ID','Template Name','GST %','Payment Terms','Notes','Letterhead ID','Line Items JSON','Created Date','Last Updated','Status'
  ],
  Settings: ['Key','Value','Updated Date']
};

const DRIVE_STRUCTURE = {
  Customers: [],
  Quotations: ['2026'],
  Invoices: ['2026'],
  Letterheads: [],
  Logos: [],
  Templates: []
};

const DRIVE_ROOT_PROPERTY_KEY = 'AVP_DRIVE_ROOT_FOLDER_ID';

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = req.action;
    const payload = req.payload || {};
    const config = req.config || {};

    let data = {};

    switch (action) {
      case 'health':
        data = health(config);
        break;
      case 'initializeBusinessRegister':
        data = initializeBusinessRegister(payload, config);
        break;
      case 'initializeDriveStructure':
        data = initializeDriveStructure(payload, config);
        break;
      case 'upsertCustomers':
        data = upsertRows('Customers', payload.customers || [], 'Customer ID', config);
        break;
      case 'upsertQuotations':
        data = upsertRows('Quotations', payload.quotations || [], 'Quotation ID', config);
        break;
      case 'upsertInvoices':
        data = upsertRows('Invoices', payload.invoices || [], 'Invoice ID', config);
        break;
      case 'upsertPayments':
        data = upsertRows('Payments', payload.payments || [], 'Payment ID', config);
        break;
      case 'upsertDocumentHistory':
        data = upsertRows('Document Register', payload.documentHistory || [], 'Document ID', config);
        break;
      case 'upsertLetterheads':
        data = upsertRows('Letterheads', payload.letterheads || [], 'Letterhead ID', config);
        break;
      case 'upsertTemplates':
        data = upsertRows('Templates', payload.templates || [], 'Template ID', config);
        break;
      default:
        throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse({ ok: true, data: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function health(config) {
  const spreadsheet = resolveSpreadsheet(config.spreadsheetId);
  return {
    accountEmail: Session.getActiveUser().getEmail() || '',
    spreadsheetId: spreadsheet ? spreadsheet.getId() : '',
    spreadsheetName: spreadsheet ? spreadsheet.getName() : '',
    driveRootId: config.driveRootId || ''
  };
}

function initializeBusinessRegister(payload, config) {
  const title = payload.title || 'Arya Vysya Press - Business Register';
  const requiredSheets = payload.requiredSheets || Object.keys(SHEET_HEADERS);
  const spreadsheet = resolveSpreadsheet(config.spreadsheetId, title);

  requiredSheets.forEach(name => {
    const headers = SHEET_HEADERS[name] || [];
    ensureSheet(spreadsheet, name, headers);
  });

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName()
  };
}

function initializeDriveStructure(payload, config) {
  const rootFolderName = payload.rootFolderName || 'Arya Vysya Press';
  const root = resolveRootFolder(config.driveRootId || payload.rootFolderId, rootFolderName);

  Object.keys(DRIVE_STRUCTURE).forEach(folderName => {
    const child = getOrCreateFolder(root, folderName);
    const nested = DRIVE_STRUCTURE[folderName] || [];
    let current = child;
    nested.forEach(sub => {
      current = getOrCreateFolder(current, sub);
    });
  });

  return {
    rootFolderId: root.getId(),
    rootFolderName: root.getName()
  };
}

function upsertRows(sheetName, items, keyHeader, config) {
  const spreadsheet = resolveSpreadsheet(config.spreadsheetId);
  if (!spreadsheet) {
    throw new Error('Spreadsheet not found. Initialize workspace first.');
  }

  const headers = SHEET_HEADERS[sheetName] || [];
  const sheet = ensureSheet(spreadsheet, sheetName, headers);
  const keyIdx = headers.indexOf(keyHeader);
  if (keyIdx < 0) throw new Error('Key header not found for ' + sheetName);

  const existing = readSheetMap(sheet, keyIdx);
  const rowsToAppend = [];
  const rowsToUpdate = [];

  items.forEach(item => {
    const row = mapItemToRow(sheetName, item, headers);
    const key = row[keyIdx];
    if (!key) return;

    if (existing[key]) {
      rowsToUpdate.push({ rowNumber: existing[key], values: row });
    } else {
      rowsToAppend.push(row);
    }
  });

  rowsToUpdate.forEach(entry => {
    sheet.getRange(entry.rowNumber, 1, 1, headers.length).setValues([entry.values]);
  });

  if (rowsToAppend.length) {
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }

  return {
    sheet: sheetName,
    appended: rowsToAppend.length,
    updated: rowsToUpdate.length,
    total: items.length
  };
}

function mapItemToRow(sheetName, item, headers) {
  const map = {
    Customers: {
      'Customer ID': item.id,
      'Customer Name': item.customerName,
      'Company Name': item.companyName,
      'Contact Person': item.contactPerson,
      'Phone': item.phone,
      'Email': item.email,
      'Billing Address': item.billingAddress,
      'Shipping Address': item.shippingAddress,
      'GSTIN': item.gstin,
      'PAN': item.pan,
      'State': item.state,
      'State Code': item.stateCode,
      'Pincode': item.pincode,
      'Customer Type': item.customerType,
      'Notes': item.notes,
      'Drive Folder ID': item.driveFolderId,
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated,
      'Status': item.status
    },
    Quotations: {
      'Quotation ID': item.id,
      'Quotation Number': item.quotationNumber,
      'Customer ID': item.customerId,
      'Customer Name': item.customerName,
      'Company Name': item.companyName,
      'Quotation Date': item.quotationDate,
      'Valid Until': item.validUntil,
      'Letterhead ID': item.letterheadId,
      'Subtotal': item.subtotal,
      'GST': item.gst,
      'Grand Total': item.grandTotal,
      'Currency': item.currency,
      'Payment Terms': item.paymentTerms,
      'Notes': item.notes,
      'Status': item.status,
      'Source Document ID': item.sourceDocumentId,
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated,
      'Drive File ID': item.driveFileId,
      'Drive File URL': item.driveFileUrl,
      'Created By': item.createdBy,
      'Converted Invoice ID': item.convertedInvoiceId,
      'Tax Mode': item.taxMode || (item.gstApplicable === false ? 'NON_GST' : 'GST')
    },
    Invoices: {
      'Invoice ID': item.id,
      'Invoice Number': item.invoiceNumber,
      'Quotation ID': item.quotationId,
      'Quotation Number': item.quotationNumber,
      'Customer ID': item.customerId,
      'Customer Name': item.customerName,
      'Company Name': item.companyName,
      'Invoice Date': item.invoiceDate,
      'Due Date': item.dueDate,
      'Letterhead ID': item.letterheadId,
      'Subtotal': item.subtotal,
      'GST': item.gst,
      'Grand Total': item.grandTotal,
      'Amount Paid': item.amountPaid,
      'Balance Due': item.balanceDue,
      'Payment Status': item.paymentStatus,
      'Payment Terms': item.paymentTerms,
      'Notes': item.notes,
      'Status': item.status,
      'Source Document ID': item.sourceDocumentId,
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated,
      'Drive File ID': item.driveFileId,
      'Drive File URL': item.driveFileUrl,
      'Created By': item.createdBy,
      'Tax Mode': item.taxMode || (item.gstApplicable === false ? 'NON_GST' : 'GST')
    },
    Payments: {
      'Payment ID': item.id,
      'Invoice ID': item.invoiceId,
      'Invoice Number': item.invoiceNumber,
      'Quotation ID': item.quotationId,
      'Customer ID': item.customerId,
      'Customer Name': item.customerName,
      'Payment Date': item.paymentDate,
      'Amount Received': item.amountReceived,
      'Payment Mode': item.paymentMode,
      'Credited To': item.creditedTo,
      'Transferred To': item.transferredTo,
      'Transaction Reference': item.transactionReference,
      'Bank / Account': item.bankAccount,
      'Payment Details': item.paymentDetails,
      'Notes': item.notes,
      'Recorded By': item.recordedBy,
      'Created Date': item.createdDate
    },
    'Document Register': {
      'Document ID': item.id,
      'Document Type': item.documentType,
      'Document Number': item.documentNumber,
      'Customer ID': item.customerId,
      'Customer Name': item.customerName,
      'Document Date': item.documentDate,
      'Amount': item.amount,
      'Status': item.status,
      'Drive File ID': item.driveFileId,
      'Drive URL': item.driveFileUrl,
      'Source Quotation ID': item.sourceQuotationId,
      'Source Invoice ID': item.sourceInvoiceId,
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated
    },
    Letterheads: {
      'Letterhead ID': item.id,
      'Letterhead Name': item.letterheadName,
      'Company Name': item.companyName,
      'Tagline': item.tagline,
      'GSTIN': item.gstin,
      'Address': item.address,
      'Phone': item.phone,
      'Email': item.email,
      'Website': item.website,
      'Footer': item.footer,
      'Terms': item.terms,
      'Brand Style': item.brandStyle,
      'Logo Drive File ID': item.logoDriveFileId,
      'Logo Drive URL': item.logoDriveUrl,
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated,
      'Default': item.isDefault ? 'Yes' : 'No',
      'Status': item.status || 'Active'
    },
    Templates: {
      'Template ID': item.id,
      'Template Name': item.templateName,
      'GST %': item.gstPct,
      'Payment Terms': item.paymentTerms,
      'Notes': item.notes,
      'Letterhead ID': item.letterheadId,
      'Line Items JSON': JSON.stringify(item.lineItems || []),
      'Created Date': item.createdDate,
      'Last Updated': item.lastUpdated,
      'Status': item.status || 'Active'
    }
  };

  const source = map[sheetName] || {};
  return headers.map(h => source[h] !== undefined ? source[h] : '');
}

function resolveSpreadsheet(spreadsheetId, title) {
  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      // Fall through to create logic.
    }
  }

  if (title) {
    const fileIter = DriveApp.getFilesByName(title);
    while (fileIter.hasNext()) {
      const file = fileIter.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return SpreadsheetApp.openById(file.getId());
      }
    }

    return SpreadsheetApp.create(title);
  }

  return null;
}

function resolveRootFolder(folderId, folderName) {
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      properties.setProperty(DRIVE_ROOT_PROPERTY_KEY, folder.getId());
      return folder;
    } catch (error) {
      // Fall through to the shared root lookup.
    }
  }

  const storedFolderId = properties.getProperty(DRIVE_ROOT_PROPERTY_KEY);
  if (storedFolderId) {
    try {
      return DriveApp.getFolderById(storedFolderId);
    } catch (error) {
      properties.deleteProperty(DRIVE_ROOT_PROPERTY_KEY);
    }
  }

  lock.waitLock(30000);
  try {
    const latestFolderId = properties.getProperty(DRIVE_ROOT_PROPERTY_KEY);
    if (latestFolderId) {
      try {
        return DriveApp.getFolderById(latestFolderId);
      } catch (error) {
        properties.deleteProperty(DRIVE_ROOT_PROPERTY_KEY);
      }
    }

    const iter = DriveApp.getFoldersByName(folderName);
    const folder = iter.hasNext() ? iter.next() : DriveApp.createFolder(folderName);
    properties.setProperty(DRIVE_ROOT_PROPERTY_KEY, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateFolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

function ensureSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader(sheet, headers.length);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    let mismatch = false;
    headers.forEach((h, idx) => {
      if (firstRow[idx] !== h) mismatch = true;
    });
    if (mismatch) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      styleHeader(sheet, headers.length);
    }
  }

  return sheet;
}

function styleHeader(sheet, width) {
  const headerRange = sheet.getRange(1, 1, 1, width);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f5f5f5');
  sheet.setFrozenRows(1);
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, Math.max(2, sheet.getLastRow()), width).createFilter();
  for (let i = 1; i <= width; i += 1) {
    sheet.autoResizeColumn(i);
  }
}

function readSheetMap(sheet, keyIdx) {
  const map = {};
  const last = sheet.getLastRow();
  if (last < 2) return map;
  const values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  values.forEach((row, idx) => {
    const key = row[keyIdx];
    if (key) map[key] = idx + 2;
  });
  return map;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
