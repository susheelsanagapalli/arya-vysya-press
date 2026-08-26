import { APP_KEYS } from '../modules/app-config.js';
import { readJson, writeJson } from '../modules/storage.js';

const DEFAULT_STATE = {
  counters: {
    customer: 0,
    quotation: 0,
    invoice: 0,
    payment: 0
  },
  customers: [],
  quotations: [],
  invoices: [],
  payments: [],
  letterheads: [],
  templates: []
};

const prefixes = {
  customer: 'CUS',
  quotation: 'QUO',
  invoice: 'INV',
  payment: 'PAY'
};

export class BusinessStateService {
  constructor() {
    this.state = {
      ...DEFAULT_STATE,
      ...(readJson(APP_KEYS.businessState, DEFAULT_STATE) || {})
    };
  }

  getState() {
    return this.state;
  }

  saveState() {
    writeJson(APP_KEYS.businessState, this.state);
  }

  nextId(kind) {
    const prefix = prefixes[kind];
    if (!prefix) return '';
    const current = Number(this.state.counters[kind] || 0) + 1;
    this.state.counters[kind] = current;
    this.saveState();
    return `${prefix}-${String(current).padStart(5, '0')}`;
  }
}
