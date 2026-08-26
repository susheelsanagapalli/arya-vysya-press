export const APP_KEYS = {
  googleConfig: 'avp_google_config_v1',
  businessState: 'avp_business_register_v1',
  builderState: 'avp_document_state_v1'
};

export const DEFAULT_GOOGLE_CONFIG = {
  clientId: '',
  appsScriptUrl: '',
  spreadsheetId: '',
  driveRootId: ''
};

export const REQUIRED_SHEETS = [
  'Customers',
  'Quotations',
  'Invoices',
  'Payments',
  'Letterheads',
  'Templates',
  'Settings'
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
