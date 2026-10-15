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

  getById(customerId) {
    return (this.getState().customers || []).find(customer => customer.id === customerId) || null;
  }

  // The existing customer that `input` refers to, or null if it would be a new customer.
  // Checked in order across all customers: GSTIN, then phone/email, then name. A customer with a
  // different GSTIN is never matched by name, since it is a different business.
  findMatch(input) {
    const customers = (this.getState().customers || []).filter(c => !c.deleted);
    const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const gstin = norm(input.gstin);
    const phone = norm(input.phone).replace(/[^\d+]/g, '');
    const email = norm(input.email);
    const names = [norm(input.customerName), norm(input.companyName)].filter(Boolean);

    if (gstin) {
      const byGstin = customers.find(c => norm(c.gstin) === gstin);
      if (byGstin) return byGstin;
    }
    if (phone) {
      const byPhone = customers.find(c => norm(c.phone).replace(/[^\d+]/g, '') === phone);
      if (byPhone) return byPhone;
    }
    if (email) {
      const byEmail = customers.find(c => norm(c.email) === email);
      if (byEmail) return byEmail;
    }
    return customers.find(c => {
      if (gstin && norm(c.gstin) && norm(c.gstin) !== gstin) return false;
      return [norm(c.customerName), norm(c.companyName)].some(n => n && names.includes(n));
    }) || null;
  }

  upsertFromBuilder(input) {
    const state = this.getState();
    const now = this.nowFn();

    const existing = this.findMatch(input);

    if (existing) {
      // Keep the customer's details current: fill in or update anything the document provides.
      ['gstin', 'phone', 'email', 'billingAddress', 'shippingAddress'].forEach(field => {
        const value = String(input[field] || '').trim();
        if (value) existing[field] = value;
      });
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

  update(customerId, patch) {
    const customer = this.getById(customerId);
    if (!customer) return null;

    Object.assign(customer, {
      ...patch,
      lastUpdated: this.nowFn()
    });

    this.saveState();
    return customer;
  }

  archive(customerId, archived = true) {
    return this.update(customerId, { status: archived ? 'Archived' : 'Active' });
  }
}
