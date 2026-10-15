import { REQUIRED_SHEETS } from '../modules/app-config.js';

export class GoogleSheetsService {
  constructor(postFn) {
    this.postFn = postFn;
  }

  async health() {
    return this.postFn('health', {});
  }

  async initializeBusinessRegister(payload) {
    return this.postFn('initializeBusinessRegister', {
      requiredSheets: REQUIRED_SHEETS,
      ...payload
    });
  }

  // Returns every record of every collection from the sheet.
  async pullAll() {
    return this.postFn('pullAll', {});
  }

  // Upserts the given collections (newer version wins) and returns the full register afterwards.
  async syncAll(collections) {
    return this.postFn('syncAll', collections);
  }

  // kinds: { invoice: 1, customer: 1 } -> data: { invoice: ['INV-00012'], customer: ['CUS-00004'] }
  async allocateIds(kinds) {
    return this.postFn('allocateIds', { kinds });
  }
}
