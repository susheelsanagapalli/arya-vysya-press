import { DEFAULT_GOOGLE_CONFIG } from '../modules/app-config.js';
import { readJson, writeJson } from '../modules/storage.js';
import { APP_KEYS } from '../modules/app-config.js';
import { GoogleSheetsService } from './googleSheetsService.js';
import { GoogleDriveService } from './googleDriveService.js';

export class GoogleIntegrationService {
  constructor() {
    const saved = readJson(APP_KEYS.googleConfig, {}) || {};
    this.config = { ...DEFAULT_GOOGLE_CONFIG };
    Object.keys(DEFAULT_GOOGLE_CONFIG).forEach(key => {
      const value = saved[key];
      if (typeof DEFAULT_GOOGLE_CONFIG[key] === 'boolean') {
        this.config[key] = typeof value === 'boolean' ? value : DEFAULT_GOOGLE_CONFIG[key];
      } else {
        this.config[key] = (value === undefined || value === null || String(value).trim() === '')
          ? DEFAULT_GOOGLE_CONFIG[key]
          : value;
      }
    });
    this.sheets = new GoogleSheetsService(this.post.bind(this));
    this.drive = new GoogleDriveService(this.post.bind(this));
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(patch) {
    this.config = { ...this.config, ...(patch || {}) };
    if (patch && 'apiKey' in patch) this.passwordSessionOnly = false;
    this.persistConfig();
    return this.getConfig();
  }

  // The business password is kept in browser storage only when "remember on this device" is on.
  persistConfig() {
    const stored = this.passwordSessionOnly ? { ...this.config, apiKey: '' } : this.config;
    writeJson(APP_KEYS.googleConfig, stored);
  }

  setPassword(password, remember) {
    this.config = { ...this.config, apiKey: String(password || '').trim() };
    this.passwordSessionOnly = !remember;
    this.persistConfig();
  }

  hasEndpoint() {
    return !!this.config.appsScriptUrl;
  }

  // Confirms a password with the server without changing the saved configuration.
  async verifyPassword(password) {
    const previous = this.config.apiKey;
    this.config.apiKey = String(password || '').trim();
    try {
      return await this.sheets.health();
    } finally {
      this.config.apiKey = previous;
    }
  }

  // Sync runs only when both the endpoint and the API key are configured.
  canCallApi() {
    return !!this.config.appsScriptUrl && !!String(this.config.apiKey || '').trim();
  }

  async post(action, payload) {
    if (!this.config.appsScriptUrl) {
      throw new Error('Apps Script URL is missing. Configure it in Settings.');
    }
    if (!String(this.config.apiKey || '').trim()) {
      throw new Error('Not signed in. Enter the business password.');
    }

    // text/plain keeps this a "simple" CORS request: Apps Script web apps don't answer the
    // preflight that application/json triggers. Code.gs parses the body as JSON either way.
    const response = await fetch(this.config.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        apiKey: String(this.config.apiKey).trim(),
        config: { spreadsheetId: this.config.spreadsheetId || '', driveRootId: this.config.driveRootId || '' },
        payload
      })
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
      this.setConfig({
        spreadsheetId: register.data.spreadsheetId,
        spreadsheetUrl: register.data.spreadsheetUrl || ''
      });
    }

    if (drive?.data?.rootFolderId) {
      this.setConfig({
        driveRootId: drive.data.rootFolderId,
        driveRootUrl: drive.data.rootFolderUrl || '',
        quotationsFolderId: drive.data.quotationsFolderId || '',
        quotationsFolderUrl: drive.data.quotationsFolderUrl || '',
        invoicesFolderId: drive.data.invoicesFolderId || '',
        invoicesFolderUrl: drive.data.invoicesFolderUrl || ''
      });
    }

    return {
      register: register.data || {},
      drive: drive.data || {}
    };
  }

  // Two-way sync in one locked call: pushes the changed local records (newer version wins on the
  // server) and returns the records changed on the server since `since` (its syncMark from the
  // last sync; 0 = everything), which the caller merges back into local state.
  async syncBusinessRegister(collections, since) {
    const response = await this.sheets.syncAll({ ...(collections || {}), since: Number(since) || 0 });
    return response.data || {};
  }

  async pullAll() {
    const response = await this.sheets.pullAll();
    return response.data || {};
  }

  async savePdf(payload) {
    const response = await this.drive.savePdf(payload);
    return response.data || {};
  }

  // Server-issued record numbers for a firm, e.g. ({ invoice: 1 }, 'AVP') -> { invoice: ['AVP-INV-00012'] }.
  async allocateIds(kinds, firm, legacyFirm) {
    const response = await this.sheets.allocateIds(kinds || {}, firm || '', !!legacyFirm);
    return response.data || {};
  }
}
