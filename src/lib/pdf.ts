/**
 * Creates a minimal, clean, valid PDF containing a QR code image and title.
 * Used for importing directly into banking apps (e.g., George, Bank Austria) via file upload / Scan & Pay.
 */
export function createQrPdfBlob(pngDataUrl: string, title: string = 'SEPA Banking QR Code'): Blob {
  // Convert Data URL to binary Uint8Array
  const base64 = pngDataUrl.split(',')[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const pngBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    pngBytes[i] = binaryString.charCodeAt(i);
  }

  // Parse width & height from PNG IHDR (bytes 16..23)
  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  const imgWidth = view.getUint32(16, false);
  const imgHeight = view.getUint32(20, false);

  // Extract IDAT chunks
  let pos = 8;
  const idatParts: Uint8Array[] = [];
  let totalIdatLen = 0;

  while (pos < pngBytes.length) {
    const chunkLen = view.getUint32(pos, false);
    const chunkType = String.fromCharCode(
      pngBytes[pos + 4],
      pngBytes[pos + 5],
      pngBytes[pos + 6],
      pngBytes[pos + 7]
    );

    if (chunkType === 'IDAT') {
      const part = pngBytes.subarray(pos + 8, pos + 8 + chunkLen);
      idatParts.push(part);
      totalIdatLen += chunkLen;
    }
    pos += 12 + chunkLen;
  }

  const idatCombined = new Uint8Array(totalIdatLen);
  let idatOffset = 0;
  for (const part of idatParts) {
    idatCombined.set(part, idatOffset);
    idatOffset += part.length;
  }

  // PDF Page Size: 400 x 480 points
  const pageWidth = 400;
  const pageHeight = 480;
  const imgSize = 280;
  const imgX = (pageWidth - imgSize) / 2;
  const imgY = 110;

  // Escape PDF string
  const cleanTitle = title.replace(/[()\\]/g, '');

  const contentStreamStr =
    'BT\n' +
    '/F1 16 Tf\n' +
    `1 0 0 1 ${imgX} 430 Tm\n` +
    `(${cleanTitle}) Tj\n` +
    '/F1 10 Tf\n' +
    `1 0 0 1 ${imgX} 412 Tm\n` +
    '(SEPA Credit Transfer / EPC QR Code) Tj\n' +
    'ET\n' +
    'q\n' +
    `${imgSize} 0 0 ${imgSize} ${imgX} ${imgY} cm\n` +
    '/Im1 Do\n' +
    'Q\n' +
    'BT\n' +
    '/F1 9 Tf\n' +
    `1 0 0 1 ${imgX} 80 Tm\n` +
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
      '/Contents 4 0 R /Resources << /Font << /F1 6 0 R >> /XObject << /Im1 5 0 R >> >> >>'
  );
  // 4: Contents
  addObj(
    concatBuffers([
      encoder.encode(`<< /Length ${contentStreamBytes.length} >>\nstream\n`),
      contentStreamBytes,
      encoder.encode('\nendstream'),
    ])
  );

  // 5: Image XObject (FlateDecode uses standard PNG IDAT deflate stream)
  const imgHeader = encoder.encode(
    `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} ` +
      '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ' +
      `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${imgWidth} >> ` +
      `/Length ${idatCombined.length} >>\nstream\n`
  );
  const imgFooter = encoder.encode('\nendstream');
  addObj(concatBuffers([imgHeader, idatCombined, imgFooter]));

  // 6: Base14 Standard Font: Helvetica
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  // Build PDF document with xref table
  let pdfHead = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
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
