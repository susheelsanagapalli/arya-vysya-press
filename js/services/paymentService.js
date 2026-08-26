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
      id: this.nextId('payment'),
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      quotationId: input.quotationId || '',
      customerId: input.customerId,
      customerName: input.customerName,
      paymentDate: input.paymentDate || toIsoDate(),
      amountReceived: Number(input.amountReceived || 0),
      paymentMode: this.normalizeMode(input.paymentMode || 'Other'),
      transactionReference: input.transactionReference || '',
      bankAccount: input.bankAccount || '',
      notes: input.notes || '',
      recordedBy: input.recordedBy || 'Local User',
      createdDate: this.nowFn()
    };

    state.payments.push(payment);
    this.saveState();
    return payment;
  }
}
