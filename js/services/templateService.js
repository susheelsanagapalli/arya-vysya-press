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

  getById(templateId) {
    return (this.getState().templates || []).find(template => template.id === templateId) || null;
  }

  nextTemplateId() {
    const state = this.getState();
    const list = Array.isArray(state.templates) ? state.templates : [];
    const max = list.reduce((acc, item) => {
      const match = String(item.id || '').match(/^TPL-(\d{5})$/);
      if (!match) return acc;
      return Math.max(acc, Number(match[1] || 0));
    }, 0);
    return `TPL-${String(max + 1).padStart(5, '0')}`;
  }

  create(input) {
    const state = this.getState();
    if (!Array.isArray(state.templates)) state.templates = [];

    const item = {
      id: this.nextTemplateId(),
      templateName: input.templateName || 'Untitled Template',
      gstPct: Number(input.gstPct || 0),
      paymentTerms: input.paymentTerms || '30 Days',
      notes: input.notes || '',
      letterheadId: input.letterheadId || 'LH-DEFAULT',
      lineItems: Array.isArray(input.lineItems) ? input.lineItems : [],
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      status: input.status || 'Active'
    };

    state.templates.push(item);
    this.saveState();
    return item;
  }

  update(templateId, patch) {
    const item = this.getById(templateId);
    if (!item) return null;

    Object.assign(item, {
      ...patch,
      lastUpdated: this.nowFn()
    });

    this.saveState();
    return item;
  }

  archive(templateId, archived = true) {
    return this.update(templateId, { status: archived ? 'Archived' : 'Active' });
  }

  duplicate(templateId) {
    const source = this.getById(templateId);
    if (!source) return null;

    return this.create({
      ...source,
      templateName: `${source.templateName || 'Template'} Copy`,
      lineItems: (source.lineItems || []).map(item => ({ ...item })),
      status: 'Active'
    });
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
      lastUpdated: this.nowFn(),
      status: 'Active'
    }));

    this.saveState();
  }
}
