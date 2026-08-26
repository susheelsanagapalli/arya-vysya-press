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
      logoDriveFileId: '',
      logoDriveUrl: '',
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      isDefault: true
    };

    state.letterheads.push(defaultItem);
    this.saveState();
    return defaultItem;
  }
}
