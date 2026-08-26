export class TemplateService {
  constructor(getState, saveState, nextId, nowFn) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
  }

  list() {
    return this.getState().templates || [];
  }

  ensureSeedTemplates() {
    const state = this.getState();
    if (!Array.isArray(state.templates)) state.templates = [];
    if (state.templates.length > 0) return;

    const names = [
      'Standard Printing',
      'T-Shirt Printing',
      'Flex Printing',
      'Business Cards',
      'Wedding Cards',
      'General Quotation'
    ];

    state.templates = names.map((name, idx) => ({
      id: `TPL-${String(idx + 1).padStart(5, '0')}`,
      templateName: name,
      gstPct: 18,
      paymentTerms: '30 Days',
      notes: '',
      letterheadId: 'LH-DEFAULT',
      lineItems: [],
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn()
    }));

    this.saveState();
  }
}
