import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
} from 'three';
import {
  DUO_OS,
  DUO_OS_PALETTE,
  coverCanvasSize,
  innerCanvasSize,
  type CanvasSize,
} from '../../domain/duo-os';

/**
 * Runtime Duo OS artwork (Ticket 05, §3.3).
 *
 * Both screens are drawn in logical coordinates at 2x into a canvas, then
 * uploaded as mipmapped sRGB textures. There are no downloaded bitmaps and no
 * font files: the type uses the platform UI stack, and every glyph, icon and
 * aurora ribbon is procedural. All randomness is seeded, so `?test=1` frames
 * are identical between runs.
 */

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

const INNER = innerCanvasSize();
const COVER = coverCanvasSize();

export function createDuoOsScreens(): {
  readonly inner: CanvasTexture;
  readonly cover: CanvasTexture;
} {
  return {
    inner: createTexture(paintInnerScreen()),
    cover: createTexture(paintCoverScreen()),
  };
}

function createTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createCanvas(size: CanvasSize): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size.pixelWidth;
  canvas.height = size.pixelHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for the Duo OS artwork');
  context.scale(size.pixelWidth / size.logicalWidth, size.pixelHeight / size.logicalHeight);
  return { canvas, context };
}

/** Deterministic PRNG so evidence frames never change between captures. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function rounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

interface TextStyle {
  readonly size: number;
  readonly weight?: number;
  readonly color?: string;
  readonly align?: CanvasTextAlign;
  readonly alpha?: number;
  readonly baseline?: CanvasTextBaseline;
}

function text(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  style: TextStyle,
): void {
  context.save();
  context.font = `${style.weight ?? 400} ${style.size}px ${FONT_STACK}`;
  context.fillStyle = style.color ?? DUO_OS_PALETTE.ink;
  context.textAlign = style.align ?? 'left';
  context.textBaseline = style.baseline ?? 'alphabetic';
  context.globalAlpha = style.alpha ?? 1;
  context.fillText(value, x, y);
  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Wallpaper                                                                   */
/* -------------------------------------------------------------------------- */

function paintAurora(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  variant: 'inner' | 'cover',
): void {
  const random = seeded(seed);

  const base = context.createLinearGradient(0, 0, width * 0.2, height);
  base.addColorStop(0, '#060a16');
  base.addColorStop(0.45, '#040711');
  base.addColorStop(1, '#020308');
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  // Deep colour fields, screened so they lift the black like a backlit panel.
  context.save();
  context.globalCompositeOperation = 'screen';
  const fields: Array<[number, number, number, string, number]> = [
    [width * 0.18, height * 0.1, width * 0.72, '#0f4a63', 0.55],
    [width * 0.86, height * 0.3, width * 0.55, '#2a1f6b', 0.62],
    [width * 0.5, height * 0.62, width * 0.68, '#0b3b45', 0.46],
    [width * 0.14, height * 0.88, width * 0.5, '#5a1d47', 0.4],
  ];
  if (variant === 'cover') {
    fields[0] = [width * 0.55, height * 0.14, width * 0.85, '#0f4a63', 0.7];
    fields[2] = [width * 0.18, height * 0.55, width * 0.8, '#173d65', 0.55];
    fields[3] = [width * 0.72, height * 0.82, width * 0.55, '#561d44', 0.5];
  }
  for (const [x, y, radius, color, alpha] of fields) {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(0.5, `${color}66`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.globalAlpha = alpha;
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }
  context.restore();

  // Three broad aurora curtains. Wide, blurred strokes read as depth rather
  // than as a flat sticker.
  context.save();
  context.globalCompositeOperation = 'screen';
  const ribbons = [
    {
      y0: height * (variant === 'cover' ? 0.24 : 0.3),
      amp: height * 0.16,
      phase: 0.4,
      width: width * (variant === 'cover' ? 0.2 : 0.18),
      from: DUO_OS_PALETTE.aurora[0],
      to: DUO_OS_PALETTE.aurora[4],
      alpha: 0.28,
    },
    {
      y0: height * (variant === 'cover' ? 0.45 : 0.48),
      amp: height * 0.11,
      phase: 2.1,
      width: width * 0.14,
      from: DUO_OS_PALETTE.aurora[2],
      to: DUO_OS_PALETTE.aurora[3],
      alpha: 0.26,
    },
    {
      y0: height * (variant === 'cover' ? 0.68 : 0.7),
      amp: height * 0.09,
      phase: 4.4,
      width: width * 0.1,
      from: DUO_OS_PALETTE.aurora[1],
      to: DUO_OS_PALETTE.aurora[2],
      alpha: 0.18,
    },
  ];

  for (const ribbon of ribbons) {
    const gradient = context.createLinearGradient(0, ribbon.y0 - height * 0.2, width, ribbon.y0 + height * 0.2);
    gradient.addColorStop(0, ribbon.from);
    gradient.addColorStop(0.5, ribbon.to);
    gradient.addColorStop(1, ribbon.from);
    context.strokeStyle = gradient;
    context.globalAlpha = ribbon.alpha;
    context.lineWidth = ribbon.width;
    context.lineCap = 'round';
    context.filter = `blur(${Math.round(width * 0.035)}px)`;
    context.beginPath();
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const x = t * width;
      const y =
        ribbon.y0 +
        Math.sin(t * Math.PI * 2.2 + ribbon.phase) * ribbon.amp +
        Math.sin(t * Math.PI * 5.1 + ribbon.phase * 0.6) * ribbon.amp * 0.22;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.filter = 'none';
  context.restore();

  // A warm horizon low in the frame gives the lock screen its depth cue.
  context.save();
  context.globalCompositeOperation = 'screen';
  const horizon = context.createRadialGradient(
    width * 0.5,
    height * 0.94,
    0,
    width * 0.5,
    height * 0.94,
    width * 0.7,
  );
  horizon.addColorStop(0, 'rgba(255, 168, 118, 0.16)');
  horizon.addColorStop(0.45, 'rgba(255, 120, 160, 0.06)');
  horizon.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = horizon;
  context.fillRect(0, 0, width, height);
  context.restore();

  // Inner home only: a vertical light column through the composition centre.
  // It is deliberately wider than the 10 mm bridge, so the flexible strip has
  // real aurora colour across it instead of reading as a black gap. The extra
  // warm core is what keeps the wallpaper flowing across the fold rather than
  // leaving the crease as the darkest part of the frame.
  if (variant === 'inner') {
    context.save();
    context.globalCompositeOperation = 'screen';
    const core = context.createRadialGradient(
      width * 0.5,
      height * 0.46,
      0,
      width * 0.5,
      height * 0.46,
      width * 0.26,
    );
    core.addColorStop(0, 'rgba(96, 132, 210, 0.34)');
    core.addColorStop(0.5, 'rgba(56, 92, 178, 0.16)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = core;
    context.fillRect(0, 0, width, height);

    const spine = context.createLinearGradient(width * 0.5 - width * 0.1, 0, width * 0.5 + width * 0.1, 0);
    spine.addColorStop(0, 'rgba(45, 226, 200, 0)');
    spine.addColorStop(0.3, 'rgba(74, 168, 255, 0.24)');
    spine.addColorStop(0.5, 'rgba(198, 224, 255, 0.44)');
    spine.addColorStop(0.7, 'rgba(139, 125, 255, 0.24)');
    spine.addColorStop(1, 'rgba(139, 125, 255, 0)');
    context.fillStyle = spine;
    context.filter = `blur(${Math.round(width * 0.014)}px)`;
    context.fillRect(width * 0.5 - width * 0.1, 0, width * 0.2, height);
    context.filter = 'none';
    context.restore();
  }

  // Fine dust. Deterministic, sparse, and only in the upper two thirds.
  context.save();
  for (let index = 0; index < 220; index += 1) {
    const x = random() * width;
    const y = random() * height * 0.75;
    const radius = 0.4 + random() * 1.1;
    context.globalAlpha = 0.06 + random() * 0.24;
    context.fillStyle = random() > 0.7 ? '#bfe8ff' : DUO_OS_PALETTE.ink;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  // Optical vignette: glass on a curved body never reflects perfectly evenly.
  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.46,
    width * 0.18,
    width * 0.5,
    height * 0.46,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.7, 'rgba(0, 0, 0, 0.18)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

/* -------------------------------------------------------------------------- */
/* Shared chrome                                                               */
/* -------------------------------------------------------------------------- */

function glassCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  tint?: string,
): void {
  context.save();
  rounded(context, x, y, width, height, radius);
  const fill = context.createLinearGradient(x, y, x + width * 0.4, y + height);
  fill.addColorStop(0, 'rgba(5, 11, 22, 0.66)');
  fill.addColorStop(0.5, 'rgba(6, 13, 26, 0.5)');
  fill.addColorStop(1, 'rgba(8, 16, 30, 0.4)');
  context.fillStyle = tint ?? fill;
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.17)';
  context.lineWidth = 1;
  context.stroke();

  // Top-edge sheen.
  const sheen = context.createLinearGradient(x, y, x, y + height * 0.4);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  rounded(context, x, y, width, height, radius);
  context.fillStyle = sheen;
  context.fill();
  context.restore();
}

function sunIcon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  const glow = context.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.1);
  glow.addColorStop(0, 'rgba(255, 224, 156, 0.9)');
  glow.addColorStop(0.45, 'rgba(255, 190, 110, 0.24)');
  glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, radius * 2.1, 0, Math.PI * 2);
  context.fill();

  const disc = context.createLinearGradient(-radius, -radius, radius, radius);
  disc.addColorStop(0, '#fff4cf');
  disc.addColorStop(1, '#ffc873');
  context.fillStyle = disc;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(255, 224, 166, 0.8)';
  context.lineWidth = Math.max(1.4, radius * 0.1);
  context.lineCap = 'round';
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = (ray / 8) * Math.PI * 2 + Math.PI / 8;
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 1.35);
    context.lineTo(Math.cos(angle) * radius * 1.62, Math.sin(angle) * radius * 1.62);
    context.stroke();
  }
  context.restore();
}

/* -------------------------------------------------------------------------- */
/* Cover lock screen                                                           */
/* -------------------------------------------------------------------------- */

function paintCoverScreen(): HTMLCanvasElement {
  const { canvas, context } = createCanvas(COVER);
  const width = COVER.logicalWidth;
  const height = COVER.logicalHeight;
  const center = width / 2;

  paintAurora(context, width, height, 0x0d0a05, 'cover');

  // Pill cutout: 24.0 × 7.5 mm, 4.2 mm below the visible active top.
  const mm = width / 62.8;
  const pillWidth = 24.0 * mm;
  const pillHeight = 7.5 * mm;
  const pillX = center - pillWidth / 2;
  const pillY = 4.2 * mm;
  context.save();
  rounded(context, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  context.fillStyle = '#000000';
  context.fill();
  const rim = context.createLinearGradient(pillX, pillY, pillX, pillY + pillHeight);
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.strokeStyle = rim;
  context.lineWidth = 1;
  context.stroke();
  // Front camera under the cover glass.
  context.fillStyle = 'rgba(10, 16, 28, 0.95)';
  context.beginPath();
  context.arc(pillX + pillWidth * 0.78, pillY + pillHeight / 2, pillHeight * 0.26, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(90, 130, 190, 0.5)';
  context.beginPath();
  context.arc(pillX + pillWidth * 0.78 - 0.6, pillY + pillHeight / 2 - 0.6, pillHeight * 0.08, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // A quiet lock glyph occupies the empty upper third without becoming a logo.
  context.save();
  context.strokeStyle = 'rgba(247, 241, 230, 0.42)';
  context.lineWidth = 2;
  rounded(context, center - 9, 146, 18, 15, 4);
  context.stroke();
  context.beginPath();
  context.arc(center, 146, 7, Math.PI, Math.PI * 2);
  context.stroke();
  context.fillStyle = 'rgba(247, 241, 230, 0.46)';
  context.beginPath();
  context.arc(center, 153, 2.2, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // 09:41, optically centred and optically weighted above the weather line.
  text(context, DUO_OS.cover.time, center, 300, {
    size: 118,
    weight: 300,
    align: 'center',
    baseline: 'alphabetic',
    color: '#fbf4e7',
  });

  text(context, DUO_OS.cover.date, center, 344, {
    size: 23,
    weight: 500,
    align: 'center',
    color: DUO_OS_PALETTE.ink,
    alpha: 0.82,
  });

  // Weather capsule.
  const capsuleWidth = Math.min(width - 90, 280);
  const capsuleX = center - capsuleWidth / 2;
  const capsuleY = 368;
  glassCard(context, capsuleX, capsuleY, capsuleWidth, 52, 26);
  sunIcon(context, capsuleX + 38, capsuleY + 26, 11, 0.95);
  text(context, DUO_OS.cover.weather.temperature, capsuleX + 66, capsuleY + 35, {
    size: 26,
    weight: 500,
    color: '#fff8ec',
  });
  text(context, DUO_OS.cover.weather.condition, capsuleX + 130, capsuleY + 34, {
    size: 18,
    weight: 450,
    alpha: 0.84,
  });
  text(context, DUO_OS.cover.weather.highLow, capsuleX + capsuleWidth - 18, capsuleY + 32, {
    size: 13,
    weight: 450,
    align: 'right',
    alpha: 0.56,
  });

  // Two stacked notifications, 92 px tall with a 16 px gap.
  const cardWidth = width - 72;
  const cardX = 36;
  let cardY = 448;
  for (const item of DUO_OS.cover.notifications) {
    glassCard(context, cardX, cardY, cardWidth, 94, 28);
    context.save();
    rounded(context, cardX + 16, cardY + 18, 58, 58, 16);
    const iconFill = context.createLinearGradient(cardX + 16, cardY + 18, cardX + 74, cardY + 76);
    iconFill.addColorStop(0, item.tone);
    iconFill.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
    context.fillStyle = iconFill;
    context.fill();
    context.restore();

    if (item.icon === 'messages') {
      context.save();
      context.fillStyle = 'rgba(4, 10, 18, 0.82)';
      rounded(context, cardX + 32, cardY + 34, 27, 21, 8);
      context.fill();
      context.beginPath();
      context.moveTo(cardX + 37, cardY + 54);
      context.lineTo(cardX + 34, cardY + 61);
      context.lineTo(cardX + 43, cardY + 55);
      context.closePath();
      context.fill();
      for (let dot = 0; dot < 3; dot += 1) {
        context.beginPath();
        context.arc(cardX + 38 + dot * 7, cardY + 44.5, 1.6, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255, 255, 255, 0.85)';
        context.fill();
      }
      context.restore();
    } else {
      context.save();
      context.fillStyle = 'rgba(4, 10, 18, 0.8)';
      rounded(context, cardX + 32, cardY + 32, 26, 27, 6);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.fillRect(cardX + 32, cardY + 32, 26, 7);
      text(context, '24', cardX + 45, cardY + 53, {
        size: 13,
        weight: 700,
        align: 'center',
        color: 'rgba(255, 255, 255, 0.94)',
      });
      context.restore();
    }

    text(context, item.app.toUpperCase(), cardX + 88, cardY + 30, {
      size: 12,
      weight: 650,
      alpha: 0.6,
      color: '#f7f1e6',
    });
    text(context, item.title, cardX + 88, cardY + 55, {
      size: 20,
      weight: 620,
      color: '#fffaf0',
    });
    text(context, item.body, cardX + 88, cardY + 78, {
      size: 15.5,
      weight: 420,
      alpha: 0.7,
    });
    text(context, item.time, cardX + cardWidth - 20, cardY + 30, {
      size: 13,
      weight: 500,
      align: 'right',
      alpha: 0.6,
    });
    cardY += 110;
  }

  // Home indicator, warm white at low alpha.
  context.save();
  rounded(context, center - 70, height - 18, 140, 5, 2.5);
  context.fillStyle = 'rgba(247, 241, 230, 0.5)';
  context.fill();
  context.restore();

  return canvas;
}

/* -------------------------------------------------------------------------- */
/* Inner home screen                                                           */
/* -------------------------------------------------------------------------- */

const HOME = {
  margin: 36,
  gutter: 72,
  cardHeight: 232,
  rowGap: 22,
  top: 82,
} as const;

function paintInnerScreen(): HTMLCanvasElement {
  const { canvas, context } = createCanvas(INNER);
  const width = INNER.logicalWidth;
  const height = INNER.logicalHeight;

  paintAurora(context, width, height, 0x51a7e1, 'inner');
  paintStatusBar(context, width);
  paintPages(context, width);

  const cardWidth = (width - HOME.margin * 2 - HOME.gutter) / 2;
  const leftX = HOME.margin;
  const rightX = width - HOME.margin - cardWidth;
  const rowY = [HOME.top, HOME.top + HOME.cardHeight + HOME.rowGap, HOME.top + (HOME.cardHeight + HOME.rowGap) * 2];

  paintWeatherWidget(context, leftX, rowY[0]!, cardWidth, HOME.cardHeight);
  paintCalendarWidget(context, rightX, rowY[0]!, cardWidth, HOME.cardHeight);
  paintMusicWidget(context, leftX, rowY[1]!, cardWidth, HOME.cardHeight);
  paintPhotosWidget(context, rightX, rowY[1]!, cardWidth, HOME.cardHeight);
  paintBatteryWidget(context, leftX, rowY[2]!, cardWidth, HOME.cardHeight);
  paintNotesWidget(context, rightX, rowY[2]!, cardWidth, HOME.cardHeight);

  paintDock(context, width, height);
  return canvas;
}

function paintStatusBar(context: CanvasRenderingContext2D, width: number): void {
  text(context, DUO_OS.inner.status.time, HOME.margin, 44, {
    size: 15,
    weight: 650,
    color: '#fffaf0',
  });

  const right = width - HOME.margin;
  // Battery: outline, 76% fill and a terminal nub.
  const batteryX = right - 34;
  const batteryY = 31;
  context.save();
  context.strokeStyle = 'rgba(255, 250, 240, 0.72)';
  context.lineWidth = 1.4;
  rounded(context, batteryX, batteryY, 28, 13, 3.5);
  context.stroke();
  context.fillStyle = 'rgba(255, 250, 240, 0.86)';
  rounded(context, batteryX + 2.2, batteryY + 2.2, 23.6 * 0.76, 8.6, 2);
  context.fill();
  context.fillStyle = 'rgba(255, 250, 240, 0.6)';
  rounded(context, batteryX + 29, batteryY + 4.5, 2.2, 4, 1);
  context.fill();
  context.restore();

  // Cellular: four rising bars.
  context.save();
  for (let bar = 0; bar < 4; bar += 1) {
    const barHeight = 3.5 + bar * 2.4;
    context.fillStyle = `rgba(255, 250, 240, ${bar < 3 ? 0.82 : 0.32})`;
    rounded(context, right - 76 + bar * 5.5, 44 - barHeight, 3.4, barHeight, 1.2);
    context.fill();
  }
  context.restore();

  // Wi-Fi arcs.
  context.save();
  context.strokeStyle = 'rgba(255, 250, 240, 0.82)';
  context.lineCap = 'round';
  const wifiX = right - 112;
  const wifiY = 44;
  for (let arc = 0; arc < 3; arc += 1) {
    context.lineWidth = 2.2;
    context.beginPath();
    context.arc(wifiX, wifiY, 4.5 + arc * 5, -Math.PI * 0.76, -Math.PI * 0.24);
    context.stroke();
  }
  context.fillStyle = 'rgba(255, 250, 240, 0.9)';
  context.beginPath();
  context.arc(wifiX, wifiY, 1.6, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Under-display camera: a tiny centred aperture in the status bar, original
  // to Duo OS and deliberately not a copied Dynamic Island.
  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.55)';
  context.beginPath();
  context.arc(width / 2, 34, 3.2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(160, 200, 255, 0.16)';
  context.lineWidth = 0.8;
  context.stroke();
  context.restore();
}

function paintPages(context: CanvasRenderingContext2D, width: number): void {
  const y = 886;
  const gap = 18;
  const total = (DUO_OS.inner.pages - 1) * gap;
  for (let page = 0; page < DUO_OS.inner.pages; page += 1) {
    context.beginPath();
    context.arc(width / 2 - total / 2 + page * gap, y, page === DUO_OS.inner.page ? 3.6 : 2.5, 0, Math.PI * 2);
    context.fillStyle =
      page === DUO_OS.inner.page
        ? 'rgba(255, 250, 240, 0.9)'
        : 'rgba(255, 250, 240, 0.32)';
    context.fill();
  }
}

function cardLabel(context: CanvasRenderingContext2D, value: string, x: number, y: number): void {
  text(context, value.toUpperCase(), x, y, {
    size: 11.5,
    weight: 650,
    alpha: 0.55,
    color: '#fff8ec',
  });
}

function paintWeatherWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30);
  const wash = context.createLinearGradient(x, y, x + width, y + height);
  wash.addColorStop(0, 'rgba(48, 128, 176, 0.22)');
  wash.addColorStop(1, 'rgba(14, 22, 42, 0)');
  rounded(context, x, y, width, height, 30);
  context.fillStyle = wash;
  context.fill();

  cardLabel(context, 'Weather', x + 24, y + 32);
  text(context, DUO_OS.cover.weather.temperature, x + 24, y + 118, {
    size: 72,
    weight: 280,
    color: '#fffaf0',
  });
  text(context, DUO_OS.cover.weather.condition, x + 26, y + 150, {
    size: 18,
    weight: 500,
    alpha: 0.84,
  });
  text(context, DUO_OS.cover.weather.location, x + 26, y + 178, {
    size: 13,
    weight: 450,
    alpha: 0.56,
  });
  text(context, DUO_OS.cover.weather.highLow, x + 26, y + 202, {
    size: 13,
    weight: 450,
    alpha: 0.62,
  });
  sunIcon(context, x + width - 86, y + 96, 32, 0.95);
}

function paintCalendarWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30);
  cardLabel(context, 'Calendar', x + 24, y + 32);
  text(context, '24', x + 24, y + 120, {
    size: 72,
    weight: 300,
    color: '#fffaf0',
  });
  text(context, 'October', x + 26, y + 150, {
    size: 16,
    weight: 500,
    alpha: 0.78,
  });

  const accentX = x + 150;
  const rows = [
    { time: '10:30', title: 'Design review', tone: DUO_OS_PALETTE.calendar },
    { time: '14:00', title: 'Studio sync', tone: DUO_OS_PALETTE.message },
    { time: '17:30', title: 'Launch film', tone: DUO_OS_PALETTE.music },
  ];
  rows.forEach((row, index) => {
    const rowY = y + 62 + index * 48;
    context.save();
    rounded(context, accentX, rowY, 3.5, 28, 2);
    context.fillStyle = row.tone;
    context.globalAlpha = 0.9;
    context.fill();
    context.restore();
    text(context, row.time, accentX + 14, rowY + 12, {
      size: 11,
      weight: 600,
      alpha: 0.6,
    });
    text(context, row.title, accentX + 14, rowY + 31, {
      size: 15,
      weight: 500,
      alpha: 0.94,
    });
  });
}

function paintMusicWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30);

  // Original album tile: a miniature of the aurora language.
  context.save();
  rounded(context, x + 22, y + 24, 134, 134, 22);
  const album = context.createLinearGradient(x + 22, y + 24, x + 156, y + 158);
  album.addColorStop(0, '#102c52');
  album.addColorStop(0.45, '#2c5f8f');
  album.addColorStop(1, '#1a153a');
  context.fillStyle = album;
  context.fill();
  context.clip();
  const ribbon = context.createLinearGradient(x + 22, y + 120, x + 156, y + 40);
  ribbon.addColorStop(0, DUO_OS_PALETTE.aurora[0]);
  ribbon.addColorStop(0.5, DUO_OS_PALETTE.aurora[2]);
  ribbon.addColorStop(1, DUO_OS_PALETTE.aurora[3]);
  context.strokeStyle = ribbon;
  context.lineWidth = 22;
  context.lineCap = 'round';
  context.globalAlpha = 0.85;
  context.beginPath();
  context.moveTo(x + 30, y + 122);
  context.bezierCurveTo(x + 68, y + 42, x + 108, y + 144, x + 152, y + 52);
  context.stroke();
  context.globalAlpha = 0.5;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(x + 30, y + 92);
  context.bezierCurveTo(x + 74, y + 34, x + 116, y + 118, x + 152, y + 34);
  context.stroke();
  context.restore();

  text(context, 'Aurora Drift', x + 176, y + 66, {
    size: 19,
    weight: 600,
    color: '#fffaf0',
  });
  text(context, 'Duo Sessions', x + 176, y + 90, {
    size: 13.5,
    weight: 450,
    alpha: 0.6,
  });

  const barX = x + 176;
  const barWidth = width - 200;
  context.save();
  rounded(context, barX, y + 116, barWidth, 3, 1.5);
  context.fillStyle = 'rgba(255, 250, 240, 0.2)';
  context.fill();
  rounded(context, barX, y + 116, barWidth * 0.42, 3, 1.5);
  context.fillStyle = 'rgba(255, 250, 240, 0.85)';
  context.fill();
  context.restore();
  text(context, '1:12', barX, y + 136, { size: 11, weight: 500, alpha: 0.45 });
  text(context, '2:54', barX + barWidth, y + 136, {
    size: 11,
    weight: 500,
    alpha: 0.45,
    align: 'right',
  });

  // Play control.
  context.save();
  context.fillStyle = 'rgba(255, 250, 240, 0.92)';
  context.beginPath();
  context.moveTo(barX + 4, y + 186);
  context.lineTo(barX + 22, y + 196);
  context.lineTo(barX + 4, y + 206);
  context.closePath();
  context.fill();
  context.restore();
  text(context, 'Aurora mix · 42 min', barX + 34, y + 202, {
    size: 12,
    weight: 500,
    alpha: 0.55,
  });
}

function paintPhotosWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30);
  const innerX = x + 14;
  const innerY = y + 14;
  const innerWidth = width - 28;
  const innerHeight = height - 28;
  context.save();
  rounded(context, innerX, innerY, innerWidth, innerHeight, 22);
  context.clip();

  const tiles = [
    { x: innerX, y: innerY, sky: '#152b57', glow: '#ff8f9e', horizon: '#24123b' },
    { x: innerX + innerWidth / 2, y: innerY, sky: '#0d2b40', glow: '#5ce0c0', horizon: '#0a1a2c' },
    { x: innerX, y: innerY + innerHeight / 2, sky: '#1b163f', glow: '#8b7dff', horizon: '#090a18' },
    { x: innerX + innerWidth / 2, y: innerY + innerHeight / 2, sky: '#3b1838', glow: '#ffab72', horizon: '#160814' },
  ];
  for (const [index, tile] of tiles.entries()) {
    const tileWidth = innerWidth / 2;
    const tileHeight = innerHeight / 2;
    const sky = context.createLinearGradient(tile.x, tile.y, tile.x, tile.y + tileHeight);
    sky.addColorStop(0, tile.sky);
    sky.addColorStop(1, tile.horizon);
    context.fillStyle = sky;
    context.fillRect(tile.x, tile.y, tileWidth, tileHeight);

    const glow = context.createRadialGradient(
      tile.x + tileWidth * (index % 2 === 0 ? 0.32 : 0.68),
      tile.y + tileHeight * 0.52,
      0,
      tile.x + tileWidth * (index % 2 === 0 ? 0.32 : 0.68),
      tile.y + tileHeight * 0.52,
      tileWidth * 0.55,
    );
    glow.addColorStop(0, tile.glow);
    glow.addColorStop(0.35, `${tile.glow}88`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.globalAlpha = 0.65;
    context.fillStyle = glow;
    context.fillRect(tile.x, tile.y, tileWidth, tileHeight);
    context.globalAlpha = 1;

    // Silhouette ridge.
    context.fillStyle = 'rgba(3, 6, 12, 0.72)';
    context.beginPath();
    context.moveTo(tile.x, tile.y + tileHeight);
    context.lineTo(tile.x, tile.y + tileHeight * 0.66);
    context.lineTo(tile.x + tileWidth * 0.26, tile.y + tileHeight * 0.48);
    context.lineTo(tile.x + tileWidth * 0.45, tile.y + tileHeight * 0.7);
    context.lineTo(tile.x + tileWidth * 0.64, tile.y + tileHeight * 0.52);
    context.lineTo(tile.x + tileWidth, tile.y + tileHeight * 0.78);
    context.lineTo(tile.x + tileWidth, tile.y + tileHeight);
    context.closePath();
    context.fill();
  }
  context.restore();

  const overlay = context.createLinearGradient(x, y + height * 0.56, x, y + height);
  overlay.addColorStop(0, 'rgba(2, 4, 10, 0)');
  overlay.addColorStop(1, 'rgba(2, 4, 10, 0.8)');
  rounded(context, x, y, width, height, 30);
  context.fillStyle = overlay;
  context.fill();
  text(context, 'Photos', x + 24, y + height - 32, {
    size: 18,
    weight: 600,
    color: '#fffaf0',
  });
  text(context, '24 Oct', x + width - 24, y + height - 32, {
    size: 12,
    weight: 500,
    alpha: 0.62,
    align: 'right',
  });
}

function paintBatteryWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30);
  cardLabel(context, 'Battery', x + 24, y + 32);

  const ringX = x + 108;
  const ringY = y + 132;
  const radius = 60;
  context.save();
  context.lineCap = 'round';
  context.lineWidth = 12;
  context.strokeStyle = 'rgba(255, 250, 240, 0.12)';
  context.beginPath();
  context.arc(ringX, ringY, radius, 0, Math.PI * 2);
  context.stroke();
  const charge = context.createLinearGradient(ringX - radius, ringY, ringX + radius, ringY);
  charge.addColorStop(0, DUO_OS_PALETTE.aurora[0]);
  charge.addColorStop(1, DUO_OS_PALETTE.aurora[4]);
  context.strokeStyle = charge;
  context.beginPath();
  context.arc(ringX, ringY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.76);
  context.stroke();
  context.restore();

  text(context, '76%', ringX, ringY + 10, {
    size: 32,
    weight: 500,
    align: 'center',
    color: '#fffaf0',
  });

  text(context, 'All-day', x + 196, y + 100, {
    size: 20,
    weight: 600,
    color: '#fffaf0',
  });
  text(context, 'Low power at 20%', x + 196, y + 128, {
    size: 12,
    weight: 450,
    alpha: 0.55,
  });
  context.save();
  rounded(context, x + 196, y + 152, 64, 22, 11);
  context.fillStyle = 'rgba(182, 255, 158, 0.16)';
  context.fill();
  context.restore();
  text(context, 'Optimised', x + 228, y + 167, {
    size: 11,
    weight: 600,
    align: 'center',
    color: DUO_OS_PALETTE.aurora[4],
  });
  text(context, 'Last charge 08:10', x + 196, y + 198, {
    size: 12,
    weight: 450,
    alpha: 0.5,
  });
}

function paintNotesWidget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  glassCard(context, x, y, width, height, 30, 'rgba(255, 212, 121, 0.09)');
  cardLabel(context, 'Notes', x + 24, y + 32);
  text(context, 'Launch film ideas', x + 24, y + 68, {
    size: 18,
    weight: 600,
    color: '#fffaf0',
  });

  context.save();
  context.strokeStyle = 'rgba(255, 212, 121, 0.22)';
  context.lineWidth = 1;
  for (let line = 0; line < 3; line += 1) {
    const lineY = y + 94 + line * 30;
    context.beginPath();
    context.moveTo(x + 24, lineY);
    context.lineTo(x + width - 24, lineY);
    context.stroke();
  }
  context.restore();

  const lines = [
    'Open on the hinge, not the logo.',
    'Let the aurora move with the fold.',
    'Close on the cover clock.',
  ];
  lines.forEach((line, index) => {
    text(context, line, x + 30, y + 89 + index * 30, {
      size: 13.5,
      weight: 450,
      color: 'rgba(255, 247, 228, 0.78)',
    });
  });
  text(context, 'Today · 2 notes', x + 24, y + height - 20, {
    size: 11,
    weight: 500,
    alpha: 0.45,
  });
}

function paintDock(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const dockWidth = width - 84;
  const dockX = 42;
  const dockY = height - 172;
  const dockHeight = 132;
  context.save();
  rounded(context, dockX, dockY, dockWidth, dockHeight, 44);
  const fill = context.createLinearGradient(dockX, dockY, dockX, dockY + dockHeight);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.17)');
  fill.addColorStop(1, 'rgba(255, 255, 255, 0.07)');
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  const slot = dockWidth / DUO_OS.inner.dock.length;
  DUO_OS.inner.dock.forEach((icon, index) => {
    const centreX = dockX + slot * (index + 0.5);
    drawAppIcon(context, icon, centreX, dockY + 44);
  });

  context.save();
  rounded(context, width / 2 - 68, height - 18, 136, 5, 2.5);
  context.fillStyle = 'rgba(247, 241, 230, 0.46)';
  context.fill();
  context.restore();
}

function drawAppIcon(
  context: CanvasRenderingContext2D,
  icon: string,
  centreX: number,
  top: number,
): void {
  const size = 78;
  const x = centreX - size / 2;
  const radius = 22;

  const palettes: Record<string, readonly [string, string]> = {
    phone: ['#57e08f', '#1fae68'],
    messages: ['#4ee6cf', '#17a99b'],
    camera: ['#3b4250', '#141821'],
    music: ['#ff8fb9', '#c73f86'],
  };
  const [from, to] = palettes[icon] ?? ['#8b7dff', '#3f3a99'];

  context.save();
  rounded(context, x, top, size, size, radius);
  const fill = context.createLinearGradient(x, top, x + size, top + size);
  fill.addColorStop(0, from);
  fill.addColorStop(1, to);
  context.fillStyle = fill;
  context.fill();

  // Glass bevel.
  const bevel = context.createLinearGradient(x, top, x, top + size * 0.55);
  bevel.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  bevel.addColorStop(1, 'rgba(255, 255, 255, 0)');
  rounded(context, x, top, size, size, radius);
  context.fillStyle = bevel;
  context.fill();

  context.translate(centreX, top + size / 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.94)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.94)';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (icon === 'phone') {
    context.save();
    context.rotate(-0.42);
    rounded(context, -13, -15, 26, 12, 5);
    context.fill();
    rounded(context, -13, 3, 26, 12, 5);
    context.fill();
    context.restore();
    context.fillRect(-13, -9, 7, 18);
  } else if (icon === 'messages') {
    rounded(context, -17, -14, 34, 24, 10);
    context.fill();
    context.beginPath();
    context.moveTo(-6, 10);
    context.lineTo(-11, 18);
    context.lineTo(2, 11);
    context.closePath();
    context.fill();
    for (let dot = 0; dot < 3; dot += 1) {
      context.beginPath();
      context.arc(-8 + dot * 8, 0, 2, 0, Math.PI * 2);
      context.fillStyle = 'rgba(15, 26, 38, 0.82)';
      context.fill();
    }
  } else if (icon === 'camera') {
    context.lineWidth = 3;
    rounded(context, -18, -12, 36, 26, 8);
    context.stroke();
    context.beginPath();
    context.arc(0, 1, 8.5, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 1, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-9, -17, 12, 4);
  } else {
    context.beginPath();
    context.ellipse(-8, 10, 7, 5.5, -0.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(9, 5, 7, 5.5, -0.4, 0, Math.PI * 2);
    context.fill();
    context.fillRect(3, -16, 3.5, 23);
    context.fillRect(13, -19, 3.5, 26);
    context.fillRect(3, -19, 13.5, 4);
  }

  context.restore();
}
