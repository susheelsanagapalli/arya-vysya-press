export const APP_KEYS = {
  googleConfig: 'avp_google_config_v1',
  businessState: 'avp_business_register_v1',
  builderState: 'avp_document_state_v1'
};

export const DEFAULT_GOOGLE_CONFIG = {
  clientId: '908002559329-fqjvqhbn8ktc7s6sif7te1s98eabbrqg.apps.googleusercontent.com',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycby7S5PKZ14rlsPsKDESUX1WKfeTzxro6HBfSHiQlHL-TRY4lvDtqf2H6vrMBX8fcUUt/exec',
  spreadsheetId: '',
  spreadsheetUrl: '',
  driveRootId: '',
  driveRootUrl: '',
  quotationsFolderId: '',
  quotationsFolderUrl: '',
  invoicesFolderId: '',
  invoicesFolderUrl: '',
  autoCreateRoot: true
};

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
