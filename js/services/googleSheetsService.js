import { REQUIRED_SHEETS } from '../modules/app-config.js';

export class GoogleSheetsService {
  constructor(postFn) {
    this.postFn = postFn;
  }

  async health() {
    return this.postFn('health', {});
  }

  async initializeBusinessRegister(payload) {
    return this.postFn('initializeBusinessRegister', {
      requiredSheets: REQUIRED_SHEETS,
      ...payload
    });
  }

  async upsertCustomers(customers) {
    return this.postFn('upsertCustomers', { customers });
  }

  async upsertQuotations(quotations) {
    return this.postFn('upsertQuotations', { quotations });
  }

  async upsertInvoices(invoices) {
    return this.postFn('upsertInvoices', { invoices });
  }

  async upsertPayments(payments) {
    return this.postFn('upsertPayments', { payments });
  }

  async upsertLetterheads(letterheads) {
    return this.postFn('upsertLetterheads', { letterheads });
  }

  async upsertTemplates(templates) {
    return this.postFn('upsertTemplates', { templates });
  }
}
