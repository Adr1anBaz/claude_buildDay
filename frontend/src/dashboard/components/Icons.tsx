// WS-1 · Daniela — Iconografía discreta. SVG en línea: nada de librerías de iconos.
type Props = { size?: number };
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const IconMenu = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const IconChat = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-3.5A7 7 0 0 1 7 5h6a7 7 0 0 1 7 7Z" /></svg>
);
export const IconActivity = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M3 12h4l2.5-6 4 12L16 12h5" /></svg>
);
export const IconTerminal = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M5 8l3 3-3 3M11 14h7" /><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /></svg>
);
export const IconCube = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2l8-4.4Z" /><path d="M4 7.2l8 4.4 8-4.4M12 11.6V21" /></svg>
);
export const IconLab = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M10 20v-5h4v5" /></svg>
);
export const IconClip = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M20 11.5l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4l8.2-8.2a3 3 0 0 1 4.3 4.3l-8.2 8.2a1.5 1.5 0 0 1-2.2-2.2l7.3-7.3" /></svg>
);
export const IconSend = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M4.5 12h15M12.5 5l7 7-7 7" /></svg>
);
export const IconClose = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconRefresh = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M20 11a8 8 0 1 0-2.6 6M20 5v6h-6" /></svg>
);
