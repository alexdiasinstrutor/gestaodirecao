/** Keep receipt signatures legible without exhausting the browser's synchronous storage. */
export async function prepareSignatureImage(dataUrl: string): Promise<string> {
  if (!dataUrl) return '';
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl)) throw new Error('Use uma assinatura PNG, JPG ou WEBP.');
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = payload.length * 3 / 4 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  if (bytes > 2 * 1024 * 1024) throw new Error('A assinatura deve ter no máximo 2 MB.');
  const limit = 240 * 1024;
  if (dataUrl.length <= limit) return dataUrl;
  const source = new Image();
  await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error('Não foi possível ler a imagem da assinatura.')); source.src = dataUrl; });
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / source.naturalWidth, 500 / source.naturalHeight);
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a assinatura.');
  // Receipts are white; a white backing keeps transparent ink visible in JPEG/PDF.
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const result = canvas.toDataURL('image/jpeg', quality);
    if (result.length <= limit) return result;
  }
  throw new Error('A imagem é muito complexa. Use uma foto recortada apenas da assinatura.');
}
