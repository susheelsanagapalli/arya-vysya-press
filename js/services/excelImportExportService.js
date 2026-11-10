// Excel/Word/PDF import and export for quotations and invoices.
// Depends on globals: XLSX (SheetJS), docx, saveAs (FileSaver).

export class ExcelImportExportService {
  constructor({ getState, getFirm, computeTotals, toWords, fmtIN }) {
    this.getState = getState;
    this.getFirm = getFirm;
    this.computeTotals = computeTotals;
    this.toWords = toWords;
    this.fmtIN = fmtIN;
  }

  // ── Template Downloads ──

  downloadQuotationTemplate() {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = [
      'Customer Name', 'Customer GSTIN', 'Subject',
      'Item Description', 'HSN', 'Unit Price', 'Qty', 'GST %',
      'Payment Terms', 'Notes'
    ];
    const sample = [
      'ABC Enterprises, Hyderabad', '36AABCU9603R1ZP', 'Quotation for printing of visiting cards',
      'Visiting Cards (300 GSM)', '4820', 500, 1000, 18,
      '30 Days', 'Thank you for your enquiry.'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map((h, i) => ({ wch: i === 0 || i === 2 || i === 3 ? 30 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');

    const instrHeaders = ['Column', 'Description', 'Required'];
    const instrRows = [
      ['Customer Name', 'Client name and location', 'Yes'],
      ['Customer GSTIN', '15-character GST number', 'No'],
      ['Subject', 'Subject line for the quotation', 'No'],
      ['Item Description', 'Line item description (one row per item)', 'Yes'],
      ['HSN', 'HSN/SAC code', 'No'],
      ['Unit Price', 'Price per unit', 'Yes'],
      ['Qty', 'Quantity', 'Yes'],
      ['GST %', 'GST percentage (default 18)', 'No'],
      ['Payment Terms', 'e.g. 30 Days (same for all rows)', 'No'],
      ['Notes', 'Closing notes (same for all rows)', 'No'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    instrWs['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

    XLSX.writeFile(wb, 'Quotation_Template.xlsx');
  }

  downloadInvoiceTemplate() {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = [
      'Buyer Name', 'Buyer Address', 'Buyer GSTIN',
      'Consignee Name', 'Consignee Address', 'Consignee GSTIN',
      'Invoice Date', 'Place of Supply', 'Terms of Payment',
      'Reference', 'Buyer Order No',
      'Item Description', 'HSN', 'Unit Price', 'Qty', 'GST %'
    ];
    const sample = [
      'ABC Enterprises', 'Plot 42, KPHB Colony, Hyderabad - 500072', '36AABCU9603R1ZP',
      'ABC Enterprises', 'Plot 42, KPHB Colony, Hyderabad - 500072', '36AABCU9603R1ZP',
      '2024-01-15', 'Telangana', '30 Days',
      'QUO-00001', 'PO-2024-100',
      'Visiting Cards (300 GSM)', '4820', 500, 1000, 18
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map((h, i) => ({ wch: [0, 1, 3, 4, 9, 11].includes(i) ? 30 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

    const instrHeaders = ['Column', 'Description', 'Required'];
    const instrRows = [
      ['Buyer Name', 'Bill-to company name', 'Yes'],
      ['Buyer Address', 'Bill-to address', 'No'],
      ['Buyer GSTIN', 'Bill-to GSTIN', 'No'],
      ['Consignee Name', 'Ship-to name (defaults to buyer)', 'No'],
      ['Consignee Address', 'Ship-to address', 'No'],
      ['Consignee GSTIN', 'Ship-to GSTIN', 'No'],
      ['Invoice Date', 'YYYY-MM-DD format', 'No'],
      ['Place of Supply', 'State name', 'No'],
      ['Terms of Payment', 'e.g. 30 Days (same for all rows)', 'No'],
      ['Reference', 'Reference number (same for all rows)', 'No'],
      ['Buyer Order No', 'Purchase order number (same for all rows)', 'No'],
      ['Item Description', 'Line item description (one row per item)', 'Yes'],
      ['HSN', 'HSN/SAC code', 'No'],
      ['Unit Price', 'Price per unit', 'Yes'],
      ['Qty', 'Quantity', 'Yes'],
      ['GST %', 'GST percentage (default 18)', 'No'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    instrWs['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

    XLSX.writeFile(wb, 'Invoice_Template.xlsx');
  }

  // ── Excel Parsing ──

  async parseQuotationExcel(file) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const data = await this._readFile(file);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('The uploaded file has no data rows.');

    const first = rows[0];
    const items = rows
      .filter(r => String(r['Item Description'] || '').trim())
      .map(r => ({
        desc: String(r['Item Description'] || '').trim(),
        hsn: String(r['HSN'] || '').trim(),
        price: Number(r['Unit Price'] || 0),
        qty: Number(r['Qty'] || 1),
        gstPct: r['GST %'] !== '' && r['GST %'] !== undefined ? Number(r['GST %']) : 18,
      }));

    return {
      customerName: String(first['Customer Name'] || '').trim(),
      customerGstin: String(first['Customer GSTIN'] || '').trim(),
      subject: String(first['Subject'] || '').trim(),
      paymentTerms: String(first['Payment Terms'] || '').trim(),
      notes: String(first['Notes'] || '').trim(),
      items,
    };
  }

  async parseInvoiceExcel(file) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const data = await this._readFile(file);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('The uploaded file has no data rows.');

    const first = rows[0];
    const items = rows
      .filter(r => String(r['Item Description'] || '').trim())
      .map(r => ({
        desc: String(r['Item Description'] || '').trim(),
        hsn: String(r['HSN'] || '').trim(),
        price: Number(r['Unit Price'] || 0),
        qty: Number(r['Qty'] || 1),
        gstPct: r['GST %'] !== '' && r['GST %'] !== undefined ? Number(r['GST %']) : 18,
      }));

    return {
      buyerName: String(first['Buyer Name'] || '').trim(),
      buyerAddress: String(first['Buyer Address'] || '').trim(),
      buyerGstin: String(first['Buyer GSTIN'] || '').trim(),
      consigneeName: String(first['Consignee Name'] || '').trim(),
      consigneeAddress: String(first['Consignee Address'] || '').trim(),
      consigneeGstin: String(first['Consignee GSTIN'] || '').trim(),
      invoiceDate: String(first['Invoice Date'] || '').trim(),
      placeOfSupply: String(first['Place of Supply'] || '').trim(),
      paymentTerms: String(first['Terms of Payment'] || '').trim(),
      reference: String(first['Reference'] || '').trim(),
      buyerOrderNo: String(first['Buyer Order No'] || '').trim(),
      items,
    };
  }

  // ── Excel Export ──

  exportQuotationToExcel(quotation, firm) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();

    const gstEnabled = quotation.gstApplicable !== false;
    const headerData = [
      ['Quotation Number', quotation.quotationNumber || quotation.id],
      ['Date', quotation.quotationDate || ''],
      ['Valid Until', quotation.validUntil || ''],
      ['Firm', firm ? firm.name : ''],
      ['GSTIN', firm ? firm.gstin : ''],
      ['Customer', quotation.customerName || ''],
      ['Payment Terms', quotation.paymentTerms || ''],
      ['Status', quotation.status || ''],
      [],
    ];

    const itemHeaders = ['S.No', 'Description', 'HSN', 'Unit Price', 'Qty', 'Sub Total'];
    if (gstEnabled) itemHeaders.push('GST %', 'GST Amount');
    itemHeaders.push('Total');

    const itemRows = (quotation.items || []).map((item, idx) => {
      const sub = Number(item.price || 0) * Number(item.qty || 0);
      const gstPct = gstEnabled ? Number(item.gstPct || 0) : 0;
      const gst = sub * (gstPct / 100);
      const row = [idx + 1, item.desc || '', item.hsn || '', Number(item.price || 0), Number(item.qty || 0), sub];
      if (gstEnabled) row.push(gstPct, gst);
      row.push(sub + gst);
      return row;
    });

    const totals = this.computeTotals(quotation.items || [], gstEnabled);
    const totalRow = ['', '', '', '', '', totals.subtotal];
    if (gstEnabled) totalRow.push('', totals.gst);
    totalRow.push(totals.total);
    totalRow[0] = 'TOTAL';

    const sheetData = [...headerData, itemHeaders, ...itemRows, totalRow, [], ['Grand Total', totals.total], ['Amount in Words', this.toWords(Math.round(totals.total))]];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    XLSX.writeFile(wb, `${quotation.quotationNumber || 'Quotation'}.xlsx`);
  }

  exportInvoiceToExcel(invoice, firm) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();

    const gstEnabled = invoice.gstApplicable !== false;
    const headerData = [
      ['Invoice Number', invoice.invoiceNumber || invoice.id],
      ['Manual No.', invoice.manualInvoiceNumber || ''],
      ['Invoice Date', invoice.invoiceDate || ''],
      ['Due Date', invoice.dueDate || ''],
      ['Firm', firm ? firm.name : ''],
      ['Firm GSTIN', firm ? firm.gstin : ''],
      ['Buyer', invoice.customerName || ''],
      ['Payment Terms', invoice.paymentTerms || ''],
      ['Payment Status', invoice.paymentStatus || ''],
      ['Amount Paid', Number(invoice.amountPaid || 0)],
      ['Balance Due', Number(invoice.balanceDue || 0)],
      [],
    ];

    const itemHeaders = ['S.No', 'Description', 'HSN', 'Unit Price', 'Qty', 'Sub Total'];
    if (gstEnabled) itemHeaders.push('GST %', 'GST Amount');
    itemHeaders.push('Total');

    const itemRows = (invoice.items || []).map((item, idx) => {
      const sub = Number(item.price || 0) * Number(item.qty || 0);
      const gstPct = gstEnabled ? Number(item.gstPct || 0) : 0;
      const gst = sub * (gstPct / 100);
      const row = [idx + 1, item.desc || '', item.hsn || '', Number(item.price || 0), Number(item.qty || 0), sub];
      if (gstEnabled) row.push(gstPct, gst);
      row.push(sub + gst);
      return row;
    });

    const totals = this.computeTotals(invoice.items || [], gstEnabled);
    const totalRow = ['', '', '', '', '', totals.subtotal];
    if (gstEnabled) totalRow.push('', totals.gst);
    totalRow.push(totals.total);
    totalRow[0] = 'TOTAL';

    const sheetData = [...headerData, itemHeaders, ...itemRows, totalRow, [], ['Grand Total', totals.total], ['Amount in Words', this.toWords(Math.round(totals.total))]];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    XLSX.writeFile(wb, `${invoice.invoiceNumber || 'Invoice'}.xlsx`);
  }

  // ── Word Export ──

  async exportQuotationToWord(quotation, firm) {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } = window.docx;
    if (!Document) throw new Error('Word library not loaded.');

    const gstEnabled = quotation.gstApplicable !== false;
    const totals = this.computeTotals(quotation.items || [], gstEnabled);
    const fmtMoney = n => 'Rs ' + this.fmtIN(n);

    const children = [];
    children.push(new Paragraph({ children: [new TextRun({ text: firm ? firm.name : 'Quotation', bold: true, size: 36, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm && firm.tagline) children.push(new Paragraph({ children: [new TextRun({ text: firm.tagline, italics: true, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm && firm.gstin) children.push(new Paragraph({ children: [new TextRun({ text: `GSTIN: ${firm.gstin}`, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm) {
      const addr = [firm.addr1, firm.addr2].filter(Boolean).join(', ');
      if (addr) children.push(new Paragraph({ children: [new TextRun({ text: addr, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
      const contact = [`Phone: ${firm.phone || ''}`, `Email: ${firm.email || ''}`].filter(s => !s.endsWith(': ')).join(' | ');
      if (contact) children.push(new Paragraph({ children: [new TextRun({ text: contact, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    }

    children.push(new Paragraph({ children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Quotation No: ${quotation.quotationNumber || quotation.id}    Date: ${quotation.quotationDate || ''}`, bold: true, size: 20, font: 'Arial' })], alignment: AlignmentType.RIGHT }));
    children.push(new Paragraph({ children: [new TextRun({ text: `To: ${quotation.customerName || ''}`, bold: true, size: 22, font: 'Arial' })] }));

    if (quotation.form && quotation.form['f-q-subject']) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Subject: ${quotation.form['f-q-subject']}`, size: 20, font: 'Arial' })] }));
    }

    children.push(new Paragraph({ children: [] }));

    const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const headerCells = ['S.No', 'Description', 'HSN', 'Unit Price', 'Qty', 'Sub Total'];
    if (gstEnabled) headerCells.push('GST %', 'GST');
    headerCells.push('Total');

    const makeCell = (text, bold = false, width = undefined) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, size: 18, font: 'Arial' })] })],
      borders,
      ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
    });

    const headerRow = new TableRow({ children: headerCells.map(h => makeCell(h, true)) });
    const dataRows = (quotation.items || []).map((item, idx) => {
      const sub = Number(item.price || 0) * Number(item.qty || 0);
      const gstPct = gstEnabled ? Number(item.gstPct || 0) : 0;
      const gst = sub * (gstPct / 100);
      const cells = [makeCell(idx + 1), makeCell(item.desc || ''), makeCell(item.hsn || ''), makeCell(fmtMoney(item.price || 0)), makeCell(item.qty || 0), makeCell(fmtMoney(sub))];
      if (gstEnabled) { cells.push(makeCell(`${gstPct}%`)); cells.push(makeCell(fmtMoney(gst))); }
      cells.push(makeCell(fmtMoney(sub + gst)));
      return new TableRow({ children: cells });
    });

    children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [] }));

    const grandLabel = gstEnabled ? 'Grand Total (Including GST)' : 'Grand Total (Without GST)';
    children.push(new Paragraph({ children: [new TextRun({ text: `${grandLabel}: ${fmtMoney(totals.total)}`, bold: true, size: 22, font: 'Arial' })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Amount in Words: ${this.toWords(Math.round(totals.total))}`, bold: true, size: 20, font: 'Arial' })] }));

    if (quotation.form && quotation.form['f-q-closing']) {
      children.push(new Paragraph({ children: [] }));
      children.push(new Paragraph({ children: [new TextRun({ text: quotation.form['f-q-closing'], size: 20, font: 'Arial' })] }));
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    window.saveAs(blob, `${quotation.quotationNumber || 'Quotation'}.docx`);
  }

  async exportInvoiceToWord(invoice, firm) {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = window.docx;
    if (!Document) throw new Error('Word library not loaded.');

    const gstEnabled = invoice.gstApplicable !== false;
    const totals = this.computeTotals(invoice.items || [], gstEnabled);
    const fmtMoney = n => 'Rs ' + this.fmtIN(n);

    const children = [];
    children.push(new Paragraph({ children: [new TextRun({ text: firm ? firm.name : '', bold: true, size: 36, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm && firm.tagline) children.push(new Paragraph({ children: [new TextRun({ text: firm.tagline, italics: true, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm && firm.gstin) children.push(new Paragraph({ children: [new TextRun({ text: `GSTIN: ${firm.gstin}`, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    if (firm) {
      const addr = [firm.addr1, firm.addr2].filter(Boolean).join(', ');
      if (addr) children.push(new Paragraph({ children: [new TextRun({ text: addr, size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER }));
    }

    children.push(new Paragraph({ children: [] }));
    const title = gstEnabled ? 'TAX INVOICE' : 'INVOICE';
    children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28, font: 'Arial', underline: {} })], alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({ children: [] }));

    children.push(new Paragraph({ children: [new TextRun({ text: `Invoice No: ${invoice.invoiceNumber || invoice.id}`, bold: true, size: 20, font: 'Arial' })] }));
    if (invoice.manualInvoiceNumber) children.push(new Paragraph({ children: [new TextRun({ text: `Manual No: ${invoice.manualInvoiceNumber}`, size: 18, font: 'Arial' })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Date: ${invoice.invoiceDate || ''}    Due: ${invoice.dueDate || ''}`, size: 20, font: 'Arial' })] }));
    children.push(new Paragraph({ children: [] }));

    children.push(new Paragraph({ children: [new TextRun({ text: `Buyer: ${invoice.customerName || ''}`, bold: true, size: 20, font: 'Arial' })] }));
    if (invoice.form) {
      if (invoice.form['f-inv-baddr']) children.push(new Paragraph({ children: [new TextRun({ text: invoice.form['f-inv-baddr'], size: 18, font: 'Arial' })] }));
      if (invoice.form['f-inv-bgst']) children.push(new Paragraph({ children: [new TextRun({ text: `GSTIN: ${invoice.form['f-inv-bgst']}`, size: 18, font: 'Arial' })] }));
    }
    children.push(new Paragraph({ children: [] }));

    const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const makeCell = (text, bold = false) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, size: 18, font: 'Arial' })] })],
      borders,
    });

    const headerCells = ['S.No', 'Description', 'HSN', 'Unit Price', 'Qty', 'Sub Total'];
    if (gstEnabled) headerCells.push('GST %', 'GST');
    headerCells.push('Total');

    const headerRow = new TableRow({ children: headerCells.map(h => makeCell(h, true)) });
    const dataRows = (invoice.items || []).map((item, idx) => {
      const sub = Number(item.price || 0) * Number(item.qty || 0);
      const gstPct = gstEnabled ? Number(item.gstPct || 0) : 0;
      const gst = sub * (gstPct / 100);
      const cells = [makeCell(idx + 1), makeCell(item.desc || ''), makeCell(item.hsn || ''), makeCell(fmtMoney(item.price || 0)), makeCell(item.qty || 0), makeCell(fmtMoney(sub))];
      if (gstEnabled) { cells.push(makeCell(`${gstPct}%`)); cells.push(makeCell(fmtMoney(gst))); }
      cells.push(makeCell(fmtMoney(sub + gst)));
      return new TableRow({ children: cells });
    });

    const totalCells = [makeCell('TOTAL', true), makeCell(''), makeCell(''), makeCell(''), makeCell(''), makeCell(fmtMoney(totals.subtotal), true)];
    if (gstEnabled) { totalCells.push(makeCell('')); totalCells.push(makeCell(fmtMoney(totals.gst), true)); }
    totalCells.push(makeCell(fmtMoney(totals.total), true));
    dataRows.push(new TableRow({ children: totalCells }));

    children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Amount Chargeable (in words): ${this.toWords(Math.round(totals.total))}`, bold: true, size: 20, font: 'Arial' })] }));

    if (firm) {
      children.push(new Paragraph({ children: [] }));
      const bankLines = ['Bank Details:'];
      if (firm.bankAccountName) bankLines.push(`Account Name: ${firm.bankAccountName}`);
      if (firm.bankName) bankLines.push(`Bank: ${firm.bankName}`);
      if (firm.bankAccountNo) bankLines.push(`Account No: ${firm.bankAccountNo}`);
      if (firm.ifsc) bankLines.push(`IFSC: ${firm.ifsc}`);
      bankLines.forEach(line => children.push(new Paragraph({ children: [new TextRun({ text: line, size: 18, font: 'Arial' })] })));
    }

    children.push(new Paragraph({ children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `For ${firm ? firm.name : ''}`, bold: true, size: 20, font: 'Arial' })], alignment: AlignmentType.RIGHT }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Authorized Signatory', size: 18, font: 'Arial' })], alignment: AlignmentType.RIGHT }));

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    window.saveAs(blob, `${invoice.invoiceNumber || 'Invoice'}.docx`);
  }

  // ── PDF Export (local download, not to Drive) ──

  async exportToPdf(buildExportSheet, fileName, { pageSize = 'a4', letterheadDataUrl = '' } = {}) {
    const html2pdf = window.html2pdf;
    if (!html2pdf) throw new Error('PDF library not loaded.');
    const sheet = buildExportSheet();
    if (!sheet) throw new Error('Nothing to export: the document is not ready.');

    const PAGE_SIZES = {
      a4:    { format: 'a4',    width: 780, minHeight: 1103 },
      a3:    { format: 'a3',    width: 1100, minHeight: 1556 },
      legal: { format: 'legal', width: 780, minHeight: 1405 },
    };
    const cfg = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;

    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:0;top:0;width:${cfg.width}px;background:#fff;z-index:-100;pointer-events:none;`;
    sheet.style.boxShadow = 'none';
    sheet.style.width = cfg.width + 'px';
    sheet.style.minHeight = cfg.minHeight + 'px';

    if (letterheadDataUrl && letterheadDataUrl.startsWith('data:image/')) {
      sheet.style.backgroundImage = `url(${letterheadDataUrl})`;
      sheet.style.backgroundSize = '100% 100%';
      sheet.style.backgroundRepeat = 'no-repeat';
    }

    host.appendChild(sheet);
    document.body.appendChild(host);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await html2pdf().set({
        margin: 0,
        filename: fileName || 'Document.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'pt', format: cfg.format, orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(sheet).save();
    } finally {
      host.remove();
    }
  }

  // ── Bulk Export (all quotations or invoices to one Excel) ──

  exportAllQuotationsToExcel(quotations, firms) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = ['Quotation No', 'Date', 'Customer', 'Firm', 'Status', 'Grand Total', 'Payment Terms', 'Valid Until'];
    const rows = (quotations || []).map(q => {
      const firm = firms ? firms.find(f => f.id === (q.firmId || 'AVP')) : null;
      return [q.quotationNumber || q.id, q.quotationDate || '', q.customerName || '', firm ? firm.name : '', q.status || '', Number(q.grandTotal || 0), q.paymentTerms || '', q.validUntil || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Quotations');
    XLSX.writeFile(wb, 'All_Quotations.xlsx');
  }

  exportAllInvoicesToExcel(invoices, firms) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = ['Invoice No', 'Manual No', 'Date', 'Due Date', 'Customer', 'Firm', 'Grand Total', 'Amount Paid', 'Balance Due', 'Payment Status'];
    const rows = (invoices || []).map(inv => {
      const firm = firms ? firms.find(f => f.id === (inv.firmId || 'AVP')) : null;
      return [inv.invoiceNumber || inv.id, inv.manualInvoiceNumber || '', inv.invoiceDate || '', inv.dueDate || '', inv.customerName || '', firm ? firm.name : '', Number(inv.grandTotal || 0), Number(inv.amountPaid || 0), Number(inv.balanceDue || 0), inv.paymentStatus || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, 'All_Invoices.xlsx');
  }

  // ── Receivables Template & Parse ──

  downloadReceivablesTemplate() {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = [
      'Customer Name', 'Customer GSTIN', 'Invoice Number', 'Invoice Date',
      'Due Date', 'Amount', 'GST Amount', 'Amount Received', 'Status', 'Notes'
    ];
    const sample = [
      'ABC Enterprises', '36AABCU9603R1ZP', 'INV-2025-001', '2025-06-15',
      '2025-07-15', 50000, 9000, 0, 'Unpaid', 'Pending follow-up'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Receivables');

    const instrHeaders = ['Column', 'Description', 'Required'];
    const instrRows = [
      ['Customer Name', 'Customer/company name', 'Yes'],
      ['Customer GSTIN', '15-character GST number', 'No'],
      ['Invoice Number', 'Original invoice reference', 'Yes'],
      ['Invoice Date', 'YYYY-MM-DD format', 'Yes'],
      ['Due Date', 'YYYY-MM-DD format', 'No'],
      ['Amount', 'Invoice amount before GST', 'Yes'],
      ['GST Amount', 'GST portion', 'No'],
      ['Amount Received', 'Amount already paid', 'No'],
      ['Status', 'Unpaid / Partially Paid / Paid / Overdue', 'No'],
      ['Notes', 'Any notes', 'No'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    instrWs['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');
    XLSX.writeFile(wb, 'Receivables_Template.xlsx');
  }

  async parseReceivablesExcel(file) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const data = await this._readFile(file);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('The uploaded file has no data rows.');

    return rows
      .filter(r => String(r['Customer Name'] || '').trim() || String(r['Invoice Number'] || '').trim())
      .map(r => ({
        customerName: String(r['Customer Name'] || '').trim(),
        customerGstin: String(r['Customer GSTIN'] || '').trim(),
        invoiceRef: String(r['Invoice Number'] || '').trim(),
        invoiceDate: String(r['Invoice Date'] || '').trim(),
        dueDate: String(r['Due Date'] || '').trim(),
        amount: Number(r['Amount'] || 0),
        gstAmount: Number(r['GST Amount'] || 0),
        amountReceived: Number(r['Amount Received'] || 0),
        status: String(r['Status'] || 'Unpaid').trim(),
        notes: String(r['Notes'] || '').trim(),
      }));
  }

  exportReceivablesToExcel(receivables) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = ['Customer', 'GSTIN', 'Invoice Ref', 'Invoice Date', 'Due Date', 'Amount', 'GST', 'Total', 'Received', 'Balance', 'Status', 'Source', 'Notes'];
    const rows = (receivables || []).map(r => [
      r.customerName, r.customerGstin || '', r.invoiceRef, r.invoiceDate, r.dueDate,
      r.amount, r.gstAmount, r.amount + r.gstAmount, r.amountReceived,
      (r.amount + r.gstAmount) - r.amountReceived, r.status, r.source || 'manual', r.notes || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Receivables');
    XLSX.writeFile(wb, 'Receivables_Register.xlsx');
  }

  // ── Purchases Template & Parse ──

  downloadPurchasesTemplate() {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = [
      'Vendor Name', 'Vendor GSTIN', 'Bill Number', 'Bill Date',
      'Amount', 'CGST', 'SGST', 'IGST', 'Total Amount',
      'Category', 'Bill Type', 'Payment Status', 'Payment Date', 'Payment Mode', 'Notes'
    ];
    const sample = [
      'Paper House Pvt Ltd', '36AADCP1234R1Z5', 'PH/2025/0456', '2025-08-10',
      100000, 9000, 9000, 0, 118000,
      'Raw Materials', 'GST Invoice', 'Paid', '2025-08-20', 'Bank Transfer', ''
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');

    const instrHeaders = ['Column', 'Description', 'Required'];
    const instrRows = [
      ['Vendor Name', 'Supplier/vendor name', 'Yes'],
      ['Vendor GSTIN', 'Vendor GST number', 'No'],
      ['Bill Number', 'Bill/invoice reference', 'Yes'],
      ['Bill Date', 'YYYY-MM-DD format', 'Yes'],
      ['Amount', 'Bill amount before GST', 'Yes'],
      ['CGST', 'Central GST amount', 'No'],
      ['SGST', 'State GST amount', 'No'],
      ['IGST', 'Integrated GST amount', 'No'],
      ['Total Amount', 'Total including GST', 'No'],
      ['Category', 'e.g. Raw Materials, Services, Rent', 'No'],
      ['Bill Type', 'GST Invoice / Non-GST Bill / Expense', 'No'],
      ['Payment Status', 'Paid / Unpaid / Partially Paid', 'No'],
      ['Payment Date', 'YYYY-MM-DD format', 'No'],
      ['Payment Mode', 'Cash / UPI / Bank Transfer / Cheque', 'No'],
      ['Notes', 'Any notes', 'No'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet([instrHeaders, ...instrRows]);
    instrWs['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');
    XLSX.writeFile(wb, 'Purchases_Template.xlsx');
  }

  async parsePurchasesExcel(file) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const data = await this._readFile(file);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) throw new Error('The uploaded file has no data rows.');

    return rows
      .filter(r => String(r['Vendor Name'] || '').trim() || String(r['Bill Number'] || '').trim())
      .map(r => ({
        vendorName: String(r['Vendor Name'] || '').trim(),
        vendorGstin: String(r['Vendor GSTIN'] || '').trim(),
        billNumber: String(r['Bill Number'] || '').trim(),
        billDate: String(r['Bill Date'] || '').trim(),
        amount: Number(r['Amount'] || 0),
        cgst: Number(r['CGST'] || 0),
        sgst: Number(r['SGST'] || 0),
        igst: Number(r['IGST'] || 0),
        totalAmount: Number(r['Total Amount'] || 0),
        category: String(r['Category'] || '').trim(),
        billType: String(r['Bill Type'] || 'GST Invoice').trim(),
        paymentStatus: String(r['Payment Status'] || 'Unpaid').trim(),
        paymentDate: String(r['Payment Date'] || '').trim(),
        paymentMode: String(r['Payment Mode'] || '').trim(),
        notes: String(r['Notes'] || '').trim(),
      }));
  }

  exportPurchasesToExcel(purchases) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();
    const headers = ['Vendor', 'GSTIN', 'Bill No', 'Bill Date', 'Amount', 'CGST', 'SGST', 'IGST', 'Total', 'Category', 'Type', 'Payment Status', 'Payment Date', 'Mode', 'Notes'];
    const rows = (purchases || []).map(p => [
      p.vendorName, p.vendorGstin || '', p.billNumber, p.billDate,
      p.amount, p.cgst || 0, p.sgst || 0, p.igst || 0, p.totalAmount || (p.amount + (p.cgst || 0) + (p.sgst || 0) + (p.igst || 0)),
      p.category || '', p.billType || '', p.paymentStatus || '', p.paymentDate || '', p.paymentMode || '', p.notes || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, 'Purchases_Register.xlsx');
  }

  // ── GST Returns Export ──

  exportGstReturns(data, fy, period) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error('Excel library not loaded.');
    const wb = XLSX.utils.book_new();

    const summaryHeaders = ['Month', 'Output Tax (CGST)', 'Output Tax (SGST)', 'Output Tax (IGST)', 'Total Output', 'Input Tax (CGST)', 'Input Tax (SGST)', 'Input Tax (IGST)', 'Total Input', 'Net Payable'];
    const summaryRows = (data.monthly || []).map(m => [
      m.month, m.outputCgst, m.outputSgst, m.outputIgst, m.totalOutput,
      m.inputCgst, m.inputSgst, m.inputIgst, m.totalInput, m.netPayable
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    ws1['!cols'] = summaryHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'GST Summary');

    if (data.salesDetails) {
      const sHeaders = ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total'];
      const sRows = data.salesDetails.map(s => [s.invoiceNo, s.date, s.customer, s.gstin, s.taxable, s.cgst, s.sgst, s.igst, s.total]);
      const ws2 = XLSX.utils.aoa_to_sheet([sHeaders, ...sRows]);
      ws2['!cols'] = sHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Sales Details');
    }

    if (data.purchaseDetails) {
      const pHeaders = ['Bill No', 'Date', 'Vendor', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total'];
      const pRows = data.purchaseDetails.map(p => [p.billNo, p.date, p.vendor, p.gstin, p.taxable, p.cgst, p.sgst, p.igst, p.total]);
      const ws3 = XLSX.utils.aoa_to_sheet([pHeaders, ...pRows]);
      ws3['!cols'] = pHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws3, 'Purchase Details');
    }

    XLSX.writeFile(wb, `GST_Returns_${fy || 'Report'}_${period || ''}.xlsx`);
  }

  // ── Helpers ──

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(new Uint8Array(e.target.result));
      reader.onerror = () => reject(new Error('Failed to read the file.'));
      reader.readAsArrayBuffer(file);
    });
  }
}
