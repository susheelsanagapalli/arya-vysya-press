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
    const totals = this.computeTotals(input.items || []);
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
}
