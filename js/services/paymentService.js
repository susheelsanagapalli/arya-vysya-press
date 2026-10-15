import { PAYMENT_MODES } from '../modules/app-config.js';
import { toIsoDate } from '../modules/format.js';

export class PaymentService {
  constructor(getState, saveState, nextId, nowFn) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
  }

  list() {
    return this.getState().payments || [];
  }

  normalizeMode(mode) {
    return PAYMENT_MODES.includes(mode) ? mode : 'Other';
  }

  record(input) {
    const state = this.getState();
    const payment = {
      id: this.nextId('payment', input.firmId),
      firmId: input.firmId || '',
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      quotationId: input.quotationId || '',
      customerId: input.customerId,
      customerName: input.customerName,
      paymentDate: input.paymentDate || toIsoDate(),
      amountReceived: Number(input.amountReceived || 0),
      paymentMode: this.normalizeMode(input.paymentMode || 'Other'),
      creditedTo: input.creditedTo || '',
      transferredTo: input.transferredTo || '',
      transactionReference: input.transactionReference || '',
      bankAccount: input.bankAccount || '',
      paymentDetails: input.paymentDetails || '',
      notes: input.notes || '',
      recordedBy: input.recordedBy || 'Local User',
      createdDate: this.nowFn()
    };

    state.payments.push(payment);
    this.saveState();
    return payment;
  }

  // Edits a payment (or marks it deleted with { deleted: true }). Payments gain lastUpdated
  // on change so the newer version wins when devices sync.
  update(paymentId, patch) {
    const payment = (this.getState().payments || []).find(item => item.id === paymentId);
    if (!payment) return null;
    Object.assign(payment, patch || {}, { lastUpdated: this.nowFn() });
    this.saveState();
    return payment;
  }
}
