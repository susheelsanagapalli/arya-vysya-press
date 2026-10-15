export class GoogleDriveService {
  constructor(postFn) {
    this.postFn = postFn;
  }

  async initializeDriveStructure(payload) {
    return this.postFn('initializeDriveStructure', payload);
  }

  // Saves a quotation/invoice PDF to Drive; with fileId the same file is updated in place.
  // payload: { kind, fileName, base64, fileId?, year? } -> data: { fileId, fileUrl, savedAt }
  async savePdf(payload) {
    return this.postFn('savePdf', payload);
  }
}
