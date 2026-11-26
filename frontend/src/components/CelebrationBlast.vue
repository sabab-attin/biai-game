<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  trigger: {
    type: Number,
    default: 0,
  },
});

const canvasRef = ref(null);
const active = ref(false);

let rafId = null;
let resizeObserver = null;
let waves = [];
let particles = [];
let flashAlpha = 0;

function readCssToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function createBurst(originX, originY, count, palette, speedScale = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (4.5 + Math.random() * 14) * speedScale;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5 * speedScale,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.28,
      w: 8 + Math.random() * 10,
      h: 5 + Math.random() * 7,
      shape: i % 5 === 0 ? 'diamond' : i % 3 === 0 ? 'circle' : 'rect',
      color: palette[i % palette.length],
      alpha: 1,
      life: 0,
      maxLife: 110 + Math.random() * 55,
    });
  }
}

function launchBlast() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = canvasRef.value;
  if (!canvas) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const palette = [
    readCssToken('--color-accent'),
    readCssToken('--color-accent-2'),
    readCssToken('--color-navy'),
    readCssToken('--color-paper-bright'),
    readCssToken('--color-biai-mark'),
  ].filter(Boolean);

  const ink = readCssToken('--color-ink') || '#1b0f0a';
  const accent = readCssToken('--color-accent') || '#e6b800';
  const red = readCssToken('--color-accent-2') || '#a61c1c';

  active.value = true;
  particles = [];
  waves = [
    { x: w * 0.5, y: h * 0.48, radius: 12, maxRadius: Math.hypot(w, h) * 0.52, color: accent, alpha: 0.9 },
    { x: w * 0.5, y: h * 0.48, radius: 4, maxRadius: Math.hypot(w, h) * 0.42, color: red, alpha: 0.75 },
  ];
  flashAlpha = 0.22;

  // Center main blast
  createBurst(w * 0.5, h * 0.48, 95, palette, 1.15);

  // Staggered side cannons for full-screen celebratory feel
  const t1 = setTimeout(() => {
    if (!active.value) return;
    createBurst(w * 0.16, h * 0.84, 50, palette, 1.25);
    createBurst(w * 0.84, h * 0.84, 50, palette, 1.25);
    waves.push({
      x: w * 0.5,
      y: h * 0.5,
      radius: 16,
      maxRadius: Math.hypot(w, h) * 0.46,
      color: accent,
      alpha: 0.65,
    });
  }, 190);

  const t2 = setTimeout(() => {
    if (!active.value) return;
    createBurst(w * 0.5, h * 0.34, 60, palette, 0.95);
  }, 420);

  if (rafId) cancelAnimationFrame(rafId);

  function frame() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currW = window.innerWidth;
    const currH = window.innerHeight;
    if (canvas.width !== currW * dpr || canvas.height !== currH * dpr) {
      canvas.width = currW * dpr;
      canvas.height = currH * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, currW, currH);

    if (flashAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, currW, currH);
      ctx.restore();
      flashAlpha *= 0.84;
    }

    for (let i = waves.length - 1; i >= 0; i -= 1) {
      const wave = waves[i];
      wave.radius += (wave.maxRadius - wave.radius) * 0.11 + 8;
      wave.alpha *= 0.91;
      if (wave.alpha <= 0.02 || wave.radius >= wave.maxRadius) {
        waves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.globalAlpha = wave.alpha;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.vx *= 0.985;
      p.rot += p.vrot;
      const remaining = 1 - p.life / p.maxLife;
      p.alpha = remaining < 0.28 ? Math.max(0, remaining / 0.28) : 1;

      if (p.life >= p.maxLife || p.y > currH + 40) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -p.w * 0.65);
        ctx.lineTo(p.w * 0.55, 0);
        ctx.lineTo(0, p.w * 0.65);
        ctx.lineTo(-p.w * 0.55, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
    }

    if (particles.length || waves.length || flashAlpha > 0.01) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = null;
      active.value = false;
      ctx.clearRect(0, 0, currW, currH);
    }
  }

  rafId = requestAnimationFrame(frame);

  cleanupTimers.push(t1, t2);
}

const cleanupTimers = [];

function clearTimers() {
  while (cleanupTimers.length) {
    clearTimeout(cleanupTimers.pop());
  }
}

watch(
  () => props.trigger,
  (val) => {
    if (!val) return;
    clearTimers();
    launchBlast();
  }
);

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {});
    resizeObserver.observe(canvasRef.value);
  }
});

onBeforeUnmount(() => {
  clearTimers();
  if (rafId) cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="celebration-blast-canvas"
    :class="{ 'celebration-blast-canvas--active': active }"
    aria-hidden="true"
  ></canvas>
</template>
