export const FRAME_THEMES = [
  {
    id: 'gold',
    label: 'Warm Ivory',
    swatch: '#d9a926',
    matBg: '#f6ede0',
    matInner: '#fbf6ee',
    hairline: '#c9971c',
    accent: '#d9a926',
    titleColor: '#1f140e',
    mutedColor: '#5c4435',
    ctaBg: '#1f140e',
    ctaText: '#fff9ef',
    ctaPillBg: '#d9a926',
    ctaPillText: '#1f140e',
    logoCardBg: '#fffaf2',
  },
  {
    id: 'crimson',
    label: 'Velvet Crimson',
    swatch: '#8a1a20',
    matBg: '#6c1319',
    matInner: '#821921',
    hairline: '#f0cf6e',
    accent: '#f0cf6e',
    titleColor: '#fff9ef',
    mutedColor: '#f1d6c5',
    ctaBg: '#410a0e',
    ctaText: '#fff9ef',
    ctaPillBg: '#f0cf6e',
    ctaPillText: '#1f140e',
    logoCardBg: '#fff9ef',
  },
  {
    id: 'navy',
    label: 'Midnight Navy',
    swatch: '#152957',
    matBg: '#0f1f44',
    matInner: '#183068',
    hairline: '#f0cf6e',
    accent: '#f0cf6e',
    titleColor: '#fff9ef',
    mutedColor: '#cad8f2',
    ctaBg: '#09142e',
    ctaText: '#fff9ef',
    ctaPillBg: '#f0cf6e',
    ctaPillText: '#1f140e',
    logoCardBg: '#fff9ef',
  },
];

export function getFrameTheme(id) {
  return FRAME_THEMES.find((theme) => theme.id === id) || FRAME_THEMES[0];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitFontSize(ctx, text, maxWidth, startPx, minPx, family, weight = 800) {
  let size = startPx;
  while (size > minPx) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawFourPointStar(ctx, cx, cy, r, fill) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawCoverPhoto(ctx, source, x, y, w, h, { mirrored = false } = {}) {
  const srcW = source.videoWidth || source.naturalWidth || source.width || w;
  const srcH = source.videoHeight || source.naturalHeight || source.height || h;
  if (!srcW || !srcH) return;

  const targetRatio = w / h;
  const srcRatio = srcW / srcH;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcRatio > targetRatio) {
    sw = srcH * targetRatio;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / targetRatio;
    sy = (srcH - sh) / 2;
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.clip();

  if (mirrored) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
  }

  ctx.restore();
}

const MAX_EXPORT_BYTES = 49 * 1000; // Strict margin below 50 KB (decimal & binary)

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downscaleCanvas(sourceCanvas, width, height) {
  const scaled = document.createElement('canvas');
  scaled.width = width;
  scaled.height = height;
  const sctx = scaled.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(sourceCanvas, 0, 0, width, height);
  return scaled;
}

async function encodeSharpUnderLimit(canvas, maxBytes = MAX_EXPORT_BYTES) {
  const scales = [
    { w: canvas.width, h: canvas.height },
    { w: 600, h: 750 },
    { w: 520, h: 650 },
    { w: 440, h: 550 },
  ];
  const formats = [
    { mime: 'image/webp', qualities: [0.92, 0.86, 0.8, 0.74, 0.66, 0.58, 0.48] },
    { mime: 'image/jpeg', qualities: [0.88, 0.8, 0.72, 0.62, 0.52, 0.42] },
  ];

  let smallest = null;

  for (const scale of scales) {
    const target =
      scale.w === canvas.width ? canvas : downscaleCanvas(canvas, scale.w, scale.h);

    for (const format of formats) {
      for (const quality of format.qualities) {
        const blob = await canvasToBlob(target, format.mime, quality);
        if (!blob || blob.type !== format.mime) break;

        if (!smallest || blob.size < smallest.size) {
          smallest = blob;
        }
        if (blob.size <= maxBytes) {
          return blob;
        }
      }
    }
  }

  return smallest;
}

/**
 * Composite a sharp 4:5 BIAI studio portrait poster under 50 KB for fast DB storage & crisp downloads.
 */
export async function renderFramedWinnerPhoto({
  source,
  mirrored = false,
  themeId = 'gold',
  winnerName = '',
}) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const theme = getFrameTheme(themeId);
  const DESIGN_W = 1080;
  const DESIGN_H = 1350;
  const OUT_W = 720;
  const OUT_H = 900;
  const W = DESIGN_W;
  const H = DESIGN_H;

  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(OUT_W / DESIGN_W, OUT_H / DESIGN_H);

  const displayFont = '"Big Shoulders Display", Impact, sans-serif';
  const bodyFont = '"Golos Text", system-ui, sans-serif';

  // Soft outer gallery mat
  ctx.fillStyle = theme.matBg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow behind center frame
  const glow = ctx.createRadialGradient(W / 2, H * 0.44, 80, W / 2, H * 0.44, 680);
  glow.addColorStop(0, theme.matInner);
  glow.addColorStop(1, theme.matBg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Delicate double hairline gallery frame
  ctx.strokeStyle = theme.hairline;
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 30, 30, W - 60, H - 60, 26);
  ctx.stroke();

  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 1.25;
  drawRoundedRect(ctx, 42, 42, W - 84, H - 84, 20);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Prominent top brand lockup with bigger BIAI logo + marketing tagline
  let logoImg = null;
  try {
    logoImg = await loadImage('/biai-logo.png');
  } catch {
    logoImg = null;
  }

  const headerY = 58;
  const sideInset = 72;
  const logoBoxSize = 94;

  if (logoImg) {
    ctx.save();
    ctx.shadowColor = 'rgba(18, 12, 8, 0.16)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = theme.logoCardBg;
    drawRoundedRect(ctx, sideInset, headerY, logoBoxSize, logoBoxSize, 18);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = theme.hairline;
    ctx.lineWidth = 1.75;
    drawRoundedRect(ctx, sideInset, headerY, logoBoxSize, logoBoxSize, 18);
    ctx.stroke();

    ctx.drawImage(logoImg, sideInset + 8, headerY + 8, logoBoxSize - 16, logoBoxSize - 16);
  }

  const textX = logoImg ? sideInset + logoBoxSize + 20 : sideInset;
  ctx.fillStyle = theme.titleColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 46px ${displayFont}`;
  ctx.fillText('BIAI', textX, headerY + 4);
  const biaiWidth = ctx.measureText('BIAI').width;

  // Accent marketing badge next to BIAI wordmark
  const sloganText = 'RISE ABOVE ALL 10X';
  ctx.font = `700 15px ${bodyFont}`;
  const sloganPillW = ctx.measureText(sloganText).width + 26;
  const sloganPillX = textX + biaiWidth + 14;
  const sloganPillY = headerY + 12;

  ctx.fillStyle = theme.ctaPillBg;
  drawRoundedRect(ctx, sloganPillX, sloganPillY, sloganPillW, 28, 999);
  ctx.fill();

  ctx.fillStyle = theme.ctaPillText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sloganText, sloganPillX + sloganPillW / 2, sloganPillY + 14.5);

  // Full institute name
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.mutedColor;
  ctx.font = `600 19px ${bodyFont}`;
  ctx.fillText('Bangladesh Institute of Artificial Intelligence', textX, headerY + 56);

  // Center unobstructed portrait photo window with soft diffused drop shadow
  const photoX = 72;
  const photoY = 172;
  const photoW = W - 144; // 936
  const photoH = 812;

  ctx.save();
  ctx.shadowColor = 'rgba(18, 12, 8, 0.24)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#141414';
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 20);
  ctx.fill();
  ctx.restore();

  drawCoverPhoto(ctx, source, photoX, photoY, photoW, photoH, { mirrored });

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = theme.hairline;
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 20);
  ctx.stroke();

  // Aesthetic divider with BIAI offering pill
  const divY = 1022;
  const promoLabel = 'LEARN AI  ·  BUILD SYSTEMS  ·  JOIN BOOTCAMPS';
  ctx.font = `700 16px ${bodyFont}`;
  const promoW = ctx.measureText(promoLabel).width + 40;
  const promoX = (W - promoW) / 2;

  ctx.strokeStyle = theme.hairline;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(photoX + 18, divY);
  ctx.lineTo(promoX - 16, divY);
  ctx.moveTo(promoX + promoW + 16, divY);
  ctx.lineTo(W - photoX - 18, divY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawFourPointStar(ctx, photoX + 10, divY, 7, theme.accent);
  drawFourPointStar(ctx, W - photoX - 10, divY, 7, theme.accent);

  ctx.fillStyle = theme.matInner;
  drawRoundedRect(ctx, promoX, divY - 17, promoW, 34, 999);
  ctx.fill();
  ctx.strokeStyle = theme.hairline;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, promoX, divY - 17, promoW, 34, 999);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.titleColor;
  ctx.font = `700 15px ${bodyFont}`;
  ctx.fillText(promoLabel, W / 2, divY + 0.5);

  // Main celebratory headline: CONGRATULATIONS WINNER
  const heroText = 'CONGRATULATIONS WINNER';
  const heroPx = fitFontSize(ctx, heroText, photoW, 88, 54, displayFont, 800);
  ctx.font = `800 ${heroPx}px ${displayFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.titleColor;
  ctx.fillText(heroText, W / 2, 1094);

  // Subtle winner name & event date
  const cleanName = String(winnerName || '').trim();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const subText = [cleanName ? cleanName.toUpperCase() : 'OFFICIAL BIAI EDITION', dateStr].join(
    '   ·   '
  );
  const subPx = fitFontSize(ctx, subText, photoW - 40, 20, 14, bodyFont, 600);
  ctx.font = `600 ${subPx}px ${bodyFont}`;
  ctx.fillStyle = theme.mutedColor;
  ctx.fillText(subText, W / 2, 1158);

  // Bottom BIAI marketing call-to-action strip
  const ctaY = 1198;
  const ctaH = 74;
  ctx.fillStyle = theme.ctaBg;
  drawRoundedRect(ctx, photoX, ctaY, photoW, ctaH, 16);
  ctx.fill();

  ctx.strokeStyle = theme.hairline;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, photoX, ctaY, photoW, ctaH, 16);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.ctaText;
  ctx.font = `600 20px ${bodyFont}`;
  ctx.fillText('AI Bootcamps · Free Masterclasses · Fellowship', photoX + 28, ctaY + ctaH / 2 + 1);

  const siteText = 'biai.com.bd';
  ctx.font = `800 24px ${displayFont}`;
  const sitePillW = Math.max(196, ctx.measureText(siteText).width + 52);
  const sitePillX = photoX + photoW - sitePillW - 14;
  const sitePillY = ctaY + 12;

  ctx.fillStyle = theme.ctaPillBg;
  drawRoundedRect(ctx, sitePillX, sitePillY, sitePillW, ctaH - 24, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.ctaPillText;
  ctx.font = `800 26px ${displayFont}`;
  ctx.fillText(siteText.toUpperCase(), sitePillX + sitePillW / 2, ctaY + ctaH / 2 + 1);

  const blob = await encodeSharpUnderLimit(canvas, MAX_EXPORT_BYTES);
  const mimeType = blob?.type || 'image/jpeg';
  const dataUrl = blob ? await blobToDataUrl(blob) : canvas.toDataURL('image/jpeg', 0.8);

  return {
    blob,
    dataUrl,
    mimeType,
    sizeBytes: blob?.size || Math.ceil((dataUrl.length * 3) / 4),
  };
}
