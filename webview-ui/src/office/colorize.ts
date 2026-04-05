export function colorizeCanvas(
  source: ImageBitmap,
  hue: number,
  saturation: number,
  brightness: number
): ImageBitmap {
  const canvas = new OffscreenCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    
    // Convert RGB to HSB
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    
    const s = max === 0 ? 0 : delta / max;
    const br = max;
    
    // Apply new HSB
    const newH = (h + hue) % 360;
    const newS = Math.min(1, s * saturation);
    const newBr = Math.min(1, br * brightness);
    
    // Convert back to RGB
    const c = newBr * newS;
    const x = c * (1 - Math.abs((newH / 60) % 2 - 1));
    const m = newBr - c;
    
    let newR = 0, newG = 0, newB = 0;
    if (newH < 60) { newR = c; newG = x; newB = 0; }
    else if (newH < 120) { newR = x; newG = c; newB = 0; }
    else if (newH < 180) { newR = 0; newG = c; newB = x; }
    else if (newH < 240) { newR = 0; newG = x; newB = c; }
    else if (newH < 300) { newR = x; newG = 0; newB = c; }
    else { newR = c; newG = 0; newB = x; }
    
    data[i] = Math.round((newR + m) * 255);
    data[i + 1] = Math.round((newG + m) * 255);
    data[i + 2] = Math.round((newB + m) * 255);
    // Alpha channel preserved
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.transferToImageBitmap();
}
