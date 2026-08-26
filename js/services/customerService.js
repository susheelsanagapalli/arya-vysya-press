export class CustomerService {
  constructor(getState, saveState, nextId, nowFn) {
    this.getState = getState;
    this.saveState = saveState;
    this.nextId = nextId;
    this.nowFn = nowFn;
  }

  list() {
    return this.getState().customers || [];
  }

  upsertFromBuilder(input) {
    const state = this.getState();
    const now = this.nowFn();

    const existing = (state.customers || []).find(c => {
      if (input.gstin && c.gstin && c.gstin === input.gstin) return true;
      return c.customerName === input.customerName && c.companyName === input.companyName;
    });

    if (existing) {
      existing.lastUpdated = now;
      this.saveState();
      return existing;
    }

    const customer = {
      id: this.nextId('customer'),
      customerName: input.customerName,
      companyName: input.companyName,
      contactPerson: input.contactPerson || input.customerName,
      phone: input.phone || '',
      email: input.email || '',
      billingAddress: input.billingAddress || '',
      shippingAddress: input.shippingAddress || '',
      gstin: input.gstin || '',
      pan: input.pan || '',
      state: input.state || '',
      stateCode: input.stateCode || '',
      pincode: input.pincode || '',
      customerType: input.customerType || 'Business',
      notes: input.notes || '',
      driveFolderId: input.driveFolderId || '',
      createdDate: now,
      lastUpdated: now,
      status: input.status || 'Active'
    };

    state.customers.push(customer);
    this.saveState();
    return customer;
  }
}
