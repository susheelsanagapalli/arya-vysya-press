import { plusDays, toIsoDate } from '../modules/format.js';

export class InvoiceService {
  constructor(getState, saveState, nextId, nowFn, computeTotals) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
    this.computeTotals = computeTotals;
  }

  list() {
    return this.getState().invoices || [];
  }

  getById(invoiceId) {
    return (this.getState().invoices || []).find(invoice => invoice.id === invoiceId) || null;
  }

  recalc(invoice, today) {
    if (!invoice || invoice.status === 'Cancelled') {
      invoice.paymentStatus = 'Cancelled';
      return invoice;
    }
    const total = Number(invoice.grandTotal || 0);
    const paid = Number(invoice.amountPaid || 0);
    invoice.balanceDue = Math.max(0, total - paid);

    if (paid >= total && total > 0) invoice.paymentStatus = 'Paid';
    else if (paid > 0 && paid < total) invoice.paymentStatus = 'Partially Paid';
    else invoice.paymentStatus = 'Unpaid';

    if (invoice.balanceDue > 0 && invoice.dueDate && new Date(invoice.dueDate) < new Date(today || toIsoDate())) {
      invoice.paymentStatus = 'Overdue';
    }

    invoice.lastUpdated = this.nowFn();
    return invoice;
  }

  createFromBuilder(input) {
    const state = this.getState();
    const gstEnabled = input.gstEnabled !== false;
    const totals = this.computeTotals(input.items || [], gstEnabled);
    const id = this.nextId('invoice');
    const invoiceDate = input.invoiceDate || toIsoDate();

    const invoice = {
      id,
      invoiceNumber: id,
      quotationId: input.quotationId || '',
      quotationNumber: input.quotationNumber || '',
      customerId: input.customerId,
      customerName: input.customerName,
      companyName: input.companyName,
      invoiceDate,
      dueDate: input.dueDate || plusDays(invoiceDate, 30),
      letterheadId: input.letterheadId || 'LH-DEFAULT',
      subtotal: totals.subtotal,
      gst: totals.gst,
      grandTotal: totals.total,
      gstApplicable: gstEnabled,
      taxMode: gstEnabled ? 'GST' : 'NON_GST',
      amountPaid: Number(input.amountPaid || 0),
      balanceDue: totals.total,
      paymentStatus: 'Unpaid',
      paymentTerms: input.paymentTerms || '30 Days',
      notes: input.notes || '',
      status: input.status || 'Issued',
      sourceDocumentId: input.sourceDocumentId || '',
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
      driveFileId: input.driveFileId || '',
      driveFileUrl: input.driveFileUrl || '',
      createdBy: input.createdBy || 'Local User',
      items: input.items || []
    };

    this.recalc(invoice, toIsoDate());
    state.invoices.push(invoice);
    this.saveState();
    return invoice;
  }

  update(invoiceId, patch) {
    const invoice = this.getById(invoiceId);
    if (!invoice) return null;

    Object.assign(invoice, {
      ...patch,
      lastUpdated: this.nowFn()
    });

    this.recalc(invoice, toIsoDate());
    this.saveState();
    return invoice;
  }

  duplicateFromExisting(invoiceId, patch = {}) {
    const source = this.getById(invoiceId);
    if (!source) return null;

    return this.createFromBuilder({
      quotationId: patch.quotationId || source.quotationId || '',
      quotationNumber: patch.quotationNumber || source.quotationNumber || '',
      customerId: patch.customerId || source.customerId,
      customerName: patch.customerName || source.customerName,
      companyName: patch.companyName || source.companyName,
      gstEnabled: patch.gstEnabled !== undefined ? patch.gstEnabled : source.gstApplicable,
      invoiceDate: patch.invoiceDate || toIsoDate(),
      dueDate: patch.dueDate || plusDays(patch.invoiceDate || toIsoDate(), 30),
      letterheadId: patch.letterheadId || source.letterheadId,
      paymentTerms: patch.paymentTerms || source.paymentTerms,
      notes: patch.notes || source.notes,
      status: patch.status || 'Draft',
      sourceDocumentId: source.id,
      createdBy: patch.createdBy || source.createdBy,
      items: (source.items || []).map(item => ({ ...item }))
    });
  }
}
