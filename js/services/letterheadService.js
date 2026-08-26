export class LetterheadService {
  constructor(getState, saveState, nextId, nowFn) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
  }

  list() {
    return this.getState().letterheads || [];
  }

  getById(letterheadId) {
    return (this.getState().letterheads || []).find(letterhead => letterhead.id === letterheadId) || null;
  }

  nextLetterheadId() {
    const state = this.getState();
    const list = Array.isArray(state.letterheads) ? state.letterheads : [];
    const max = list.reduce((acc, item) => {
      const match = String(item.id || '').match(/^LH-(\d{5})$/);
      if (!match) return acc;
      return Math.max(acc, Number(match[1] || 0));
    }, 0);
    return `LH-${String(max + 1).padStart(5, '0')}`;
  }

  create(input) {
    const state = this.getState();
    if (!Array.isArray(state.letterheads)) state.letterheads = [];

    const item = {
      id: this.nextLetterheadId(),
      letterheadName: input.letterheadName || 'Untitled Letterhead',
      companyName: input.companyName || '',
      tagline: input.tagline || '',
      gstin: input.gstin || '',
      address: input.address || '',
      phone: input.phone || '',
      email: input.email || '',
      website: input.website || '',
      footer: input.footer || '',
      terms: input.terms || '',
      brandStyle: input.brandStyle || '',
      logoDriveFileId: input.logoDriveFileId || '',
      logoDriveUrl: input.logoDriveUrl || '',
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      isDefault: !!input.isDefault,
      status: input.status || 'Active'
    };

    if (item.isDefault) {
      state.letterheads.forEach(existing => {
        existing.isDefault = false;
        existing.lastUpdated = this.nowFn();
      });
    }

    state.letterheads.push(item);
    this.saveState();
    return item;
  }

  update(letterheadId, patch) {
    const state = this.getState();
    const item = this.getById(letterheadId);
    if (!item) return null;

    Object.assign(item, {
      ...patch,
      lastUpdated: this.nowFn()
    });

    if (item.isDefault) {
      (state.letterheads || []).forEach(existing => {
        if (existing.id === item.id) return;
        existing.isDefault = false;
      });
    }

    this.saveState();
    return item;
  }

  setDefault(letterheadId) {
    const state = this.getState();
    const item = this.getById(letterheadId);
    if (!item) return null;

    (state.letterheads || []).forEach(existing => {
      existing.isDefault = existing.id === letterheadId;
      existing.lastUpdated = this.nowFn();
    });

    this.saveState();
    return item;
  }

  archive(letterheadId, archived = true) {
    return this.update(letterheadId, { status: archived ? 'Archived' : 'Active' });
  }

  duplicate(letterheadId) {
    const source = this.getById(letterheadId);
    if (!source) return null;

    return this.create({
      ...source,
      letterheadName: `${source.letterheadName || 'Letterhead'} Copy`,
      isDefault: false,
      status: 'Active'
    });
  }

  ensureDefault(letterhead) {
    const state = this.getState();
    if (!Array.isArray(state.letterheads)) state.letterheads = [];
    if (state.letterheads.length) return state.letterheads[0];

    const id = 'LH-DEFAULT';
    const defaultItem = {
      id,
      letterheadName: 'Arya Vysya Press - Main',
      companyName: letterhead.companyName || 'Arya Vysya Press',
      tagline: letterhead.tagline || 'Quality Printers & Binders',
      gstin: letterhead.gstin || '',
      address: `${letterhead.addr1 || ''} ${letterhead.addr2 || ''}`.trim(),
      phone: letterhead.phone || '',
      email: letterhead.email || '',
      website: '',
      footer: '',
      terms: '',
      brandStyle: '',
      logoDriveFileId: '',
      logoDriveUrl: '',
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      isDefault: true,
      status: 'Active'
    };

    state.letterheads.push(defaultItem);
    this.saveState();
    return defaultItem;
  }
}
