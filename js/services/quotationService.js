import { plusDays, toIsoDate } from '../modules/format.js';

export class QuotationService {
  constructor(getState, saveState, nextId, nowFn, computeTotals) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
    this.computeTotals = computeTotals;
  }

  list() {
    return this.getState().quotations || [];
  }

  getById(quotationId) {
    return (this.getState().quotations || []).find(quotation => quotation.id === quotationId) || null;
  }

  createFromBuilder(input) {
    const state = this.getState();
    const gstEnabled = input.gstEnabled !== false;
    const totals = this.computeTotals(input.items || [], gstEnabled);
    const id = this.nextId('quotation');
    const quotationDate = input.quotationDate || toIsoDate();

    const quotation = {
      id,
      quotationNumber: id,
      customerId: input.customerId,
      customerName: input.customerName,
      companyName: input.companyName,
      quotationDate,
      validUntil: input.validUntil || plusDays(quotationDate, 15),
      letterheadId: input.letterheadId || 'LH-DEFAULT',
      subtotal: totals.subtotal,
      gst: totals.gst,
      grandTotal: totals.total,
      gstApplicable: gstEnabled,
      taxMode: gstEnabled ? 'GST' : 'NON_GST',
      currency: input.currency || 'INR',
      paymentTerms: input.paymentTerms || '30 Days',
      notes: input.notes || '',
      status: input.status || 'Issued',
      sourceDocumentId: input.sourceDocumentId || '',
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      driveFileId: input.driveFileId || '',
      driveFileUrl: input.driveFileUrl || '',
      createdBy: input.createdBy || 'Local User',
      convertedInvoiceId: '',
      items: input.items || []
    };

    state.quotations.push(quotation);
    this.saveState();
    return quotation;
  }

  update(quotationId, patch) {
    const quotation = this.getById(quotationId);
    if (!quotation) return null;

    Object.assign(quotation, {
      ...patch,
      lastUpdated: this.nowFn()
    });

    this.saveState();
    return quotation;
  }

  duplicateFromExisting(quotationId, patch = {}) {
    const source = this.getById(quotationId);
    if (!source) return null;

    return this.createFromBuilder({
      customerId: source.customerId,
      customerName: source.customerName,
      companyName: source.companyName,
      quotationDate: patch.quotationDate || toIsoDate(),
      validUntil: patch.validUntil || plusDays(patch.quotationDate || toIsoDate(), 15),
      letterheadId: patch.letterheadId || source.letterheadId,
      gstEnabled: patch.gstEnabled !== undefined ? patch.gstEnabled : source.gstApplicable,
      currency: patch.currency || source.currency,
      paymentTerms: patch.paymentTerms || source.paymentTerms,
      notes: patch.notes || source.notes,
      status: patch.status || 'Draft',
      sourceDocumentId: source.id,
      createdBy: patch.createdBy || source.createdBy,
      items: (source.items || []).map(item => ({ ...item }))
    });
  }

  markConverted(quotationId, invoiceId) {
    const state = this.getState();
    const quote = (state.quotations || []).find(q => q.id === quotationId);
    if (!quote) return null;
    quote.status = 'Converted';
    quote.convertedInvoiceId = invoiceId;
    quote.lastUpdated = this.nowFn();
    this.saveState();
    return quote;
  }
}
