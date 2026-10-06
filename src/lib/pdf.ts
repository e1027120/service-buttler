import QRCode from 'qrcode';

/**
 * Creates a crystal-clear, 100% vector PDF containing the SEPA EPC QR code.
 * Directly outputs vector rectangles (`re f`), completely immune to PNG compression artifacts,
 * color space issues, or raster scaling problems in banking apps.
 */
export function createQrPdfBlob(qrText: string, title: string = 'SEPA Banking QR Code'): Blob {
  // Generate QR matrix using QRCode.create
  const qr = QRCode.create(qrText, { errorCorrectionLevel: 'M' });
  const modCount = qr.modules.size;
  const modData = qr.modules.data;

  // PDF Page Size: 420 x 520 points (~A5 portrait)
  const pageWidth = 420;
  const pageHeight = 520;
  const qrBoxSize = 280;
  const qrX = (pageWidth - qrBoxSize) / 2;
  const qrY = 120; // Y distance from bottom in PDF coordinates
  const cellSize = qrBoxSize / modCount;

  // Build PDF path operations for each dark module
  let pathOps = '0 g\n'; // Set fill color to black (0 gray)
  for (let r = 0; r < modCount; r++) {
    for (let c = 0; c < modCount; c++) {
      if (modData[r * modCount + c]) {
        // In PDF coordinates, Y=0 is bottom
        // Row 0 of QR code is top
        const x = (qrX + c * cellSize).toFixed(2);
        const y = (qrY + (modCount - 1 - r) * cellSize).toFixed(2);
        // Small 0.05 overlap prevents anti-aliasing hairline gaps between modules
        const w = (cellSize + 0.05).toFixed(2);
        const h = (cellSize + 0.05).toFixed(2);
        pathOps += `${x} ${y} ${w} ${h} re\n`;
      }
    }
  }
  pathOps += 'f\n'; // Fill all rectangles

  // Clean title for standard PDF string
  const cleanTitle = title.replace(/[()\\\r\n]/g, ' ').slice(0, 80);

  const contentStreamStr =
    'BT\n' +
    '/F1 15 Tf\n' +
    `1 0 0 1 50 460 Tm\n` +
    `(${cleanTitle}) Tj\n` +
    '/F1 10 Tf\n' +
    `1 0 0 1 50 440 Tm\n` +
    '(SEPA Credit Transfer / EPC QR Code) Tj\n' +
    'ET\n' +
    pathOps +
    'BT\n' +
    '/F1 9 Tf\n' +
    `1 0 0 1 50 80 Tm\n` +
    '(Upload this PDF in your banking app under Scan & Pay / File Upload) Tj\n' +
    'ET\n';

  const encoder = new TextEncoder();
  const contentStreamBytes = encoder.encode(contentStreamStr);

  const objects: Uint8Array[] = [];
  function addObj(strOrBytes: string | Uint8Array) {
    if (typeof strOrBytes === 'string') {
      objects.push(encoder.encode(strOrBytes));
    } else {
      objects.push(strOrBytes);
    }
  }

  // 1: Catalog
  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  // 2: Pages
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  // 3: Page
  addObj(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      '/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
  );
  // 4: Contents
  addObj(
    concatBuffers([
      encoder.encode(`<< /Length ${contentStreamBytes.length} >>\nstream\n`),
      contentStreamBytes,
      encoder.encode('\nendstream'),
    ])
  );
  // 5: Font Helvetica
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  // Build document with xref table
  const pdfHead = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const headBytes = encoder.encode(pdfHead);
  const parts: Uint8Array[] = [headBytes];
  let curOffset = headBytes.length;

  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(curOffset);
    const objNumStr = `${i + 1} 0 obj\n`;
    const objEndStr = '\nendobj\n';
    const objNumBytes = encoder.encode(objNumStr);
    const objEndBytes = encoder.encode(objEndStr);

    parts.push(objNumBytes);
    parts.push(objects[i]);
    parts.push(objEndBytes);

    curOffset += objNumBytes.length + objects[i].length + objEndBytes.length;
  }

  const xrefOffset = curOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const o = String(offsets[i]).padStart(10, '0');
    xrefStr += `${o} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  parts.push(encoder.encode(xrefStr));

  return new Blob(parts, { type: 'application/pdf' });
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const b of buffers) totalLen += b.length;
  const res = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of buffers) {
    res.set(b, offset);
    offset += b.length;
  }
  return res;
}
