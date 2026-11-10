// Product catalog: reusable inventory items with standard + user-defined custom fields.

export class ProductCatalogService {
  constructor(getState, saveState, nowFn) {
    this.getState = getState;
    this.saveState = saveState;
    this.nowFn = nowFn;
  }

  _ensureList() {
    const state = this.getState();
    if (!Array.isArray(state.products)) state.products = [];
    if (!Array.isArray(state.productCustomFields)) state.productCustomFields = [];
    return state;
  }

  // ── Custom field definitions ──

  listCustomFields() {
    return this._ensureList().productCustomFields;
  }

  addCustomField(field) {
    const state = this._ensureList();
    const id = 'pcf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const entry = {
      id,
      name: String(field.name || '').trim(),
      type: field.type || 'text',
      createdDate: this.nowFn(),
    };
    state.productCustomFields.push(entry);
    this.saveState();
    return entry;
  }

  removeCustomField(fieldId) {
    const state = this._ensureList();
    state.productCustomFields = state.productCustomFields.filter(f => f.id !== fieldId);
    (state.products || []).forEach(p => { delete (p.custom || {})[fieldId]; });
    this.saveState();
  }

  // ── Products ──

  list() {
    return (this._ensureList().products || []).filter(p => !p.deleted);
  }

  getById(productId) {
    return (this._ensureList().products || []).find(p => p.id === productId && !p.deleted) || null;
  }

  search(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return this.list();
    return this.list().filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.specification || '').toLowerCase().includes(q) ||
      (p.hsn || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }

  create(input) {
    const state = this._ensureList();
    const id = 'PRD-' + String(Date.now()).slice(-8) + '-' + Math.random().toString(36).slice(2, 6);
    const product = {
      id,
      name: String(input.name || '').trim(),
      specification: String(input.specification || '').trim(),
      price: Number(input.price || 0),
      hsn: String(input.hsn || '').trim(),
      gstPct: input.gstPct !== undefined ? Number(input.gstPct) : 18,
      unit: String(input.unit || 'pcs').trim(),
      size: String(input.size || '').trim(),
      color: String(input.color || '').trim(),
      material: String(input.material || '').trim(),
      category: String(input.category || '').trim(),
      custom: input.custom || {},
      createdDate: this.nowFn(),
      lastUpdated: this.nowFn(),
    };
    state.products.push(product);
    this.saveState();
    return product;
  }

  update(productId, patch) {
    const product = this.getById(productId);
    if (!product) return null;
    const { custom: customPatch, ...rest } = patch;
    Object.assign(product, rest, { lastUpdated: this.nowFn() });
    if (customPatch) product.custom = { ...(product.custom || {}), ...customPatch };
    this.saveState();
    return product;
  }

  remove(productId) {
    const product = (this._ensureList().products || []).find(p => p.id === productId);
    if (!product) return null;
    product.deleted = true;
    product.lastUpdated = this.nowFn();
    this.saveState();
    return product;
  }

  listCategories() {
    const cats = new Set();
    this.list().forEach(p => { if (p.category) cats.add(p.category); });
    return [...cats].sort();
  }
}
