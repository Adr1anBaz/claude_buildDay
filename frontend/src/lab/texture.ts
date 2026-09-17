// WS-2 · Elías — Lab 3D. Genera texturas de números grandes (canvas) para P1/P2 y los cajones,
// así se distinguen "sin leer texto" (E3) sin depender de una fuente/modelo 3D de texto.
import { CanvasTexture, SRGBColorSpace } from 'three';

/** Textura cuadrada con un dígito/etiqueta grande centrado, fondo transparente. */
export function numberTexture(label: string, color: string): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `bold ${size * 0.72}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + size * 0.03);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
