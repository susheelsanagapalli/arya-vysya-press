export const APP_KEYS = {
  googleConfig: 'avp_google_config_v1',
  businessState: 'avp_business_register_v1',
  builderState: 'avp_document_state_v1'
};

export const DEFAULT_GOOGLE_CONFIG = {
  clientId: '908002559329-fqjvqhbn8ktc7s6sif7te1s98eabbrqg.apps.googleusercontent.com',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwvKObpGZqbFXEuNpVdiJskTK_FTVbYPyq_8BRFxiJPBe0IUyGo4PYeRd8TSaFHNQPL/exec',
  spreadsheetId: '',
  spreadsheetUrl: '',
  driveRootId: '',
  driveRootUrl: '',
  quotationsFolderId: '',
  quotationsFolderUrl: '',
  invoicesFolderId: '',
  invoicesFolderUrl: '',
  autoCreateRoot: true,
  // Business password checked by the Apps Script backend. Entered once per device on the sign-in
  // screen and kept only in that browser; it never ships in the code. Sync stays off until set.
  apiKey: ''
};

// Business register collections that are synced with the Google Sheet.
export const SYNC_COLLECTIONS = [
  'customers',
  'quotations',
  'invoices',
  'payments',
  'documentHistory',
  'letterheads',
  'templates'
];

export const REQUIRED_SHEETS = [
  'Customers',
  'Quotations',
  'Invoices',
  'Payments',
  'Document Register',
  'Letterheads',
  'Templates',
  'Settings'
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
