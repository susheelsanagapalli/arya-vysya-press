export class GoogleDriveService {
  constructor(postFn) {
    this.postFn = postFn;
  }

  async initializeDriveStructure(payload) {
    return this.postFn('initializeDriveStructure', payload);
  }

  async uploadDocument(payload) {
    return this.postFn('uploadDocument', payload);
  }

  async uploadLogo(payload) {
    return this.postFn('uploadLogo', payload);
  }
}
