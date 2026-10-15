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
  documentHistory: [],
  letterheads: [],
  templates: []
};

const prefixes = {
  customer: 'CUS',
  quotation: 'QUO',
  invoice: 'INV',
  payment: 'PAY'
};

const collectionForKind = {
  customer: 'customers',
  quotation: 'quotations',
  invoice: 'invoices',
  payment: 'payments'
};

export class BusinessStateService {
  constructor() {
    this.state = {
      ...DEFAULT_STATE,
      ...(readJson(APP_KEYS.businessState, DEFAULT_STATE) || {})
    };
    // Numbers issued by the server for the next records of each kind (see reserveIds).
    this.reserved = {};
    // Called after every save; the app uses it to schedule a cloud sync.
    this.onSave = null;
  }

  getState() {
    return this.state;
  }

  saveState() {
    writeJson(APP_KEYS.businessState, this.state);
    if (typeof this.onSave === 'function') this.onSave();
  }

  // Queues server-issued numbers, e.g. { invoice: ['INV-00012'] }, for the next nextId calls.
  reserveIds(idsByKind) {
    Object.keys(idsByKind || {}).forEach(kind => {
      this.reserved[kind] = (this.reserved[kind] || []).concat(idsByKind[kind] || []);
    });
  }

  clearReservedIds() {
    this.reserved = {};
  }

  nextId(kind) {
    const prefix = prefixes[kind];
    if (!prefix) return '';

    const queued = this.reserved[kind];
    if (queued && queued.length) {
      const id = queued.shift();
      const number = Number(String(id).split('-').pop()) || 0;
      this.state.counters[kind] = Math.max(Number(this.state.counters[kind] || 0), number);
      this.saveState();
      return id;
    }

    const current = Number(this.state.counters[kind] || 0) + 1;
    this.state.counters[kind] = current;
    this.saveState();
    return `${prefix}-${String(current).padStart(5, '0')}`;
  }

  // Raises each local counter to the highest number present in the records (e.g. after a sync),
  // so locally generated numbers never fall behind ones created on another device.
  reconcileCounters() {
    if (!this.state.counters) this.state.counters = { ...DEFAULT_STATE.counters };
    Object.keys(prefixes).forEach(kind => {
      const pattern = new RegExp(`^${prefixes[kind]}-(\\d+)$`);
      const max = (this.state[collectionForKind[kind]] || []).reduce((acc, record) => {
        const match = pattern.exec(String(record && record.id));
        return match ? Math.max(acc, Number(match[1])) : acc;
      }, 0);
      this.state.counters[kind] = Math.max(Number(this.state.counters[kind] || 0), max);
    });
  }
}
