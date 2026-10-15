import { APP_KEYS, LEGACY_FIRM_ID } from '../modules/app-config.js';
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
  templates: [],
  firms: []
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

// Quotations, invoices and payments are numbered per firm (AVP-INV-00001); customers are shared.
const firmNumbered = kind => kind !== 'customer';

export class BusinessStateService {
  constructor() {
    this.state = {
      ...DEFAULT_STATE,
      ...(readJson(APP_KEYS.businessState, DEFAULT_STATE) || {})
    };
    if (!Array.isArray(this.state.firms)) this.state.firms = [];
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

  // Queues server-issued numbers, e.g. { invoice: ['AVP-INV-00012'] }, for the next nextId calls.
  reserveIds(idsByKind) {
    Object.keys(idsByKind || {}).forEach(kind => {
      this.reserved[kind] = (this.reserved[kind] || []).concat(idsByKind[kind] || []);
    });
  }

  clearReservedIds() {
    this.reserved = {};
  }

  counterKey(kind, firmId) {
    return firmNumbered(kind) && firmId ? `${firmId}:${kind}` : kind;
  }

  nextId(kind, firmId) {
    const prefix = prefixes[kind];
    if (!prefix) return '';
    const firm = firmNumbered(kind) ? String(firmId || '').toUpperCase() : '';
    const key = this.counterKey(kind, firm);

    const queued = this.reserved[kind];
    if (queued && queued.length) {
      const id = queued.shift();
      const number = Number(String(id).split('-').pop()) || 0;
      this.state.counters[key] = Math.max(Number(this.state.counters[key] || 0), number);
      this.saveState();
      return id;
    }

    // Offline / no sync: number from this device's counter for the firm. The legacy firm
    // continues the older unprefixed count.
    let current = Number(this.state.counters[key] || 0);
    if (firm && firm === LEGACY_FIRM_ID) current = Math.max(current, Number(this.state.counters[kind] || 0));
    current += 1;
    this.state.counters[key] = current;
    this.saveState();
    return `${firm ? `${firm}-` : ''}${prefix}-${String(current).padStart(5, '0')}`;
  }

  // Raises each local counter to the highest number present in the records (e.g. after a sync),
  // so locally generated numbers never fall behind ones created on another device.
  reconcileCounters() {
    if (!this.state.counters) this.state.counters = { ...DEFAULT_STATE.counters };
    Object.keys(prefixes).forEach(kind => {
      const pattern = new RegExp(`^(?:([A-Z0-9]{1,6})-)?${prefixes[kind]}-(\\d+)$`);
      (this.state[collectionForKind[kind]] || []).forEach(record => {
        const match = pattern.exec(String(record && record.id));
        if (!match) return;
        const firm = match[1] || '';
        const key = firm ? this.counterKey(kind, firm) : kind;
        this.state.counters[key] = Math.max(Number(this.state.counters[key] || 0), Number(match[2]));
      });
    });
  }
}
