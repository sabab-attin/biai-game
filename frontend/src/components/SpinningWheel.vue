<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { playPegTick, playWinFanfare } from '../utils/sound.js';

const props = defineProps({
  prizes: {
    type: Array,
    required: true,
  },
  canSpin: {
    type: Boolean,
    default: false,
  },
  isLoggedIn: {
    type: Boolean,
    default: false,
  },
  wonPrizeId: {
    type: String,
    default: '',
  },
  spinTrigger: {
    type: Object,
    default: null,
  },
  isSpinning: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['hubClick', 'spinComplete']);

const canvasRef = ref(null);
const rotation = ref(0);
const pointerTilt = ref(0);
const activeSliceIndex = ref(0);
const soundEnabled = ref(true);

let rafId = null;
let resizeObserver = null;
let pointerResetTimer = null;

function readCssToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getSliceIndexAtPointer(rot, count) {
  if (!count) return 0;
  const slice = (Math.PI * 2) / count;
  const rel = (((-Math.PI / 2 - rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(rel / slice) % count;
}

function drawWheel() {
  const canvas = canvasRef.value;
  if (!canvas || !props.prizes.length) return;

  const rect = canvas.getBoundingClientRect();
  const size = Math.max(240, Math.round(rect.width));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const ink = readCssToken('--color-ink');
  const paper = readCssToken('--color-paper');
  const accent = readCssToken('--color-accent');
  const displayFont = readCssToken('--font-display') || 'Impact, sans-serif';
  const bodyFont = readCssToken('--font-body') || 'system-ui, sans-serif';

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const rimWidth = Math.max(14, Math.round(size * 0.045));
  const wheelR = outerR - rimWidth;
  const count = props.prizes.length;
  const sliceAngle = (Math.PI * 2) / count;

  // Outer Carnival Ink Ring & Cream Rim
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR - 3, 0, Math.PI * 2);
  ctx.fillStyle = paper;
  ctx.fill();

  // Draw prize wedges
  props.prizes.forEach((prize, index) => {
    const start = rotation.value + index * sliceAngle;
    const end = start + sliceAngle;
    const bg = readCssToken(prize.bgToken) || paper;
    const fg = readCssToken(prize.fgToken) || ink;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, wheelR, start, end);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // Label radial outward
    const mid = start + sliceAngle / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);

    const fontSize = Math.max(15, Math.round(size * 0.056));
    const subSize = Math.max(10, Math.round(size * 0.026));
    const textRadius = wheelR * 0.64;

    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${fontSize}px ${displayFont}`;
    ctx.fillText(prize.wheelLabel, textRadius, -subSize * 0.45);

    ctx.font = `500 ${subSize}px ${bodyFont}`;
    ctx.fillText(prize.category, textRadius, fontSize * 0.56);
    ctx.restore();
  });

  // Inner boundary ring
  ctx.beginPath();
  ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // 15 screen-printed perimeter pegs (3 per slice)
  const pegCount = count * 3;
  const pegR = Math.max(3, Math.round(size * 0.01));
  const pegOrbit = wheelR + rimWidth * 0.48;
  for (let i = 0; i < pegCount; i += 1) {
    const angle = rotation.value + (i * Math.PI * 2) / pegCount;
    const px = cx + Math.cos(angle) * pegOrbit;
    const py = cy + Math.sin(angle) * pegOrbit;

    ctx.beginPath();
    ctx.arc(px, py, pegR, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? accent : ink;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

function triggerPegTick() {
  pointerTilt.value = -18;
  if (soundEnabled.value) {
    playPegTick();
  }
  clearTimeout(pointerResetTimer);
  pointerResetTimer = setTimeout(() => {
    pointerTilt.value = 0;
  }, 85);
}

function animateToSegment(targetIndex, resultPayload) {
  if (rafId) cancelAnimationFrame(rafId);

  const count = props.prizes.length;
  const slice = (Math.PI * 2) / count;
  const jitter = (Math.random() - 0.5) * slice * 0.48;
  const twoPi = Math.PI * 2;
  const targetMod = (((-Math.PI / 2 - (targetIndex + 0.5) * slice - jitter) % twoPi) + twoPi) % twoPi;
  const startRot = rotation.value;
  const startMod = ((startRot % twoPi) + twoPi) % twoPi;
  const delta = (targetMod - startMod + twoPi) % twoPi;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    rotation.value = startRot + delta;
    activeSliceIndex.value = getSliceIndexAtPointer(rotation.value, count);
    drawWheel();
    if (soundEnabled.value) playWinFanfare();
    emit('spinComplete', resultPayload);
    return;
  }

  const extraTurns = 6 * twoPi;
  const finalRot = startRot + extraTurns + delta;
  const duration = 4500;
  const startTime = performance.now();
  const pegStep = twoPi / (count * 3);
  let lastPegBucket = Math.floor(startRot / pegStep);

  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    // Quintic ease-out for crisp mechanical deceleration
    const eased = 1 - Math.pow(1 - t, 4.4);
    const current = startRot + (finalRot - startRot) * eased;
    rotation.value = current;
    activeSliceIndex.value = getSliceIndexAtPointer(current, count);

    const pegBucket = Math.floor(current / pegStep);
    if (pegBucket !== lastPegBucket) {
      lastPegBucket = pegBucket;
      triggerPegTick();
    }

    drawWheel();

    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = null;
      pointerTilt.value = 0;
      if (soundEnabled.value) playWinFanfare();
      emit('spinComplete', resultPayload);
    }
  }

  rafId = requestAnimationFrame(frame);
}

watch(
  () => props.spinTrigger,
  (trigger) => {
    if (!trigger) return;
    animateToSegment(trigger.segmentIndex, trigger);
  }
);

watch(
  () => props.prizes,
  () => {
    activeSliceIndex.value = getSliceIndexAtPointer(rotation.value, props.prizes.length);
    drawWheel();
  },
  { deep: true }
);

const pointerLabel = computed(() => {
  if (!props.prizes.length) return '';
  if (props.wonPrizeId) {
    const won = props.prizes.find((p) => p.id === props.wonPrizeId);
    if (won) return `Landed: ${won.title}`;
  }
  const current = props.prizes[activeSliceIndex.value];
  return current ? `Pointer: ${current.title}` : '';
});

const hubText = computed(() => {
  if (props.isSpinning) return 'SPIN';
  if (!props.isLoggedIn) return 'ENTER';
  if (props.canSpin) return 'SPIN';
  return 'DONE';
});

onMounted(async () => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  activeSliceIndex.value = getSliceIndexAtPointer(rotation.value, props.prizes.length);
  drawWheel();

  if (canvasRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => drawWheel());
    resizeObserver.observe(canvasRef.value);
  }
});

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  clearTimeout(pointerResetTimer);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="hero__wheel-col">
    <div class="wheel-stage">
      <svg
        class="wheel-pointer"
        :style="{ '--pointer-tilt': `${pointerTilt}deg` }"
        viewBox="0 0 44 46"
        aria-hidden="true"
      >
        <path
          d="M6 4 H38 L22 42 Z"
          fill="var(--color-accent-2)"
          stroke="var(--color-ink)"
          stroke-width="3"
          stroke-linejoin="round"
        />
        <circle cx="22" cy="12" r="4" fill="var(--color-paper)" stroke="var(--color-ink)" stroke-width="2" />
      </svg>

      <div class="wheel-frame">
        <canvas
          ref="canvasRef"
          class="wheel-canvas"
          role="img"
          aria-label="Prize spinning wheel with five wedges: Free Course, Chocolates, Gift Card, Stickers, and Wristbands"
        ></canvas>

        <button
          type="button"
          class="wheel-hub"
          :disabled="isSpinning || (isLoggedIn && !canSpin)"
          :aria-label="
            isLoggedIn
              ? canSpin
                ? 'Spin the prize wheel'
                : 'Spin complete'
              : 'Focus entry form to sign in before spinning'
          "
          @click="$emit('hubClick')"
        >
          {{ hubText }}
        </button>
      </div>
    </div>

    <div class="wheel-controls">
      <p class="wheel-readout" aria-live="polite">{{ pointerLabel }}</p>

      <button
        type="button"
        class="sound-btn"
        :aria-pressed="soundEnabled ? 'true' : 'false'"
        @click="soundEnabled = !soundEnabled"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path v-if="soundEnabled" d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path v-if="soundEnabled" d="M19 5a10 10 0 0 1 0 14" />
          <line v-if="!soundEnabled" x1="22" y1="9" x2="16" y2="15" />
          <line v-if="!soundEnabled" x1="16" y1="9" x2="22" y2="15" />
        </svg>
        <span>{{ soundEnabled ? 'Sound on' : 'Muted' }}</span>
      </button>
    </div>
  </div>
</template>
