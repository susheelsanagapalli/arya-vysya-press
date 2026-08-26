import { DEFAULT_GOOGLE_CONFIG } from '../modules/app-config.js';
import { readJson, writeJson } from '../modules/storage.js';
import { APP_KEYS } from '../modules/app-config.js';
import { GoogleSheetsService } from './googleSheetsService.js';
import { GoogleDriveService } from './googleDriveService.js';

export class GoogleIntegrationService {
  constructor() {
    this.config = { ...DEFAULT_GOOGLE_CONFIG, ...(readJson(APP_KEYS.googleConfig, {}) || {}) };
    this.sheets = new GoogleSheetsService(this.post.bind(this));
    this.drive = new GoogleDriveService(this.post.bind(this));
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(patch) {
    this.config = { ...this.config, ...(patch || {}) };
    writeJson(APP_KEYS.googleConfig, this.config);
    return this.getConfig();
  }

  canCallApi() {
    return !!this.config.appsScriptUrl;
  }

  async post(action, payload) {
    if (!this.config.appsScriptUrl) {
      throw new Error('Apps Script URL is missing. Configure it in Settings.');
    }

    const response = await fetch(this.config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, config: this.config, payload })
    });

    if (!response.ok) {
      throw new Error(`Google integration request failed with ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || 'Google integration returned an error.');
    }

    return result;
  }

  async testConnection() {
    return this.sheets.health();
  }

  async initializeWorkspace() {
    const register = await this.sheets.initializeBusinessRegister({
      spreadsheetId: this.config.spreadsheetId || '',
      title: 'Arya Vysya Press - Business Register'
    });

    const drive = await this.drive.initializeDriveStructure({
      rootFolderId: this.config.driveRootId || '',
      rootFolderName: 'Arya Vysya Press'
    });

    if (register?.data?.spreadsheetId) {
      this.setConfig({ spreadsheetId: register.data.spreadsheetId });
    }

    if (drive?.data?.rootFolderId) {
      this.setConfig({ driveRootId: drive.data.rootFolderId });
    }

    return {
      register: register.data || {},
      drive: drive.data || {}
    };
  }

  async syncBusinessRegister(payload) {
    const [customers, quotations, invoices, payments, letterheads, templates] = await Promise.all([
      this.sheets.upsertCustomers(payload.customers || []),
      this.sheets.upsertQuotations(payload.quotations || []),
      this.sheets.upsertInvoices(payload.invoices || []),
      this.sheets.upsertPayments(payload.payments || []),
      this.sheets.upsertLetterheads(payload.letterheads || []),
      this.sheets.upsertTemplates(payload.templates || [])
    ]);

    return {
      customers: customers.data || {},
      quotations: quotations.data || {},
      invoices: invoices.data || {},
      payments: payments.data || {},
      letterheads: letterheads.data || {},
      templates: templates.data || {}
    };
  }
}
