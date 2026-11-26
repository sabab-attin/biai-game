<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { saveWinnerPhoto } from '../api/client.js';
import { FRAME_THEMES, renderFramedWinnerPhoto } from '../utils/photoFrame.js';
import { playCountdownTick, playShutterChime, unlockAudio } from '../utils/sound.js';

const props = defineProps({
  playId: {
    type: String,
    default: '',
  },
  winnerName: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'after-claim', // 'before-claim' | 'after-claim'
  },
  game: {
    type: String,
    default: '',
  },
  prizeTitle: {
    type: String,
    default: '',
  },
  score: {
    type: Number,
    default: null,
  },
  total: {
    type: Number,
    default: null,
  },
  initialDraft: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close', 'back', 'continue', 'photoSaved', 'playAgain']);

const videoRef = ref(null);
const uploadInputRef = ref(null);

const selectedTheme = ref('gold');
const cameraState = ref('starting'); // 'starting' | 'ready' | 'error'
const cameraError = ref('');
const countdown = ref(0);
const flashActive = ref(false);
const isRendering = ref(false);

const capturedUrl = ref('');
const capturedBlob = ref(null);
const capturedDataUrl = ref('');
const capturedMimeType = ref('image/webp');
const capturedSizeBytes = ref(0);
const saveStatus = ref('idle'); // 'idle' | 'saving' | 'saved' | 'error'
const saveMessage = ref('');
const rawSnapshot = ref(null);
const videoDevices = ref([]);
const currentDeviceIndex = ref(0);
const canShareImage = ref(false);
const shareNotice = ref('');

let activeStream = null;
let countdownTimer = null;
let flashTimer = null;
let cameraRequestId = 0;
let renderRequestId = 0;
let unmounted = false;

const isBeforeClaim = computed(() => props.mode === 'before-claim');

const winKickerText = computed(() => {
  if (props.prizeTitle) {
    if (props.game === 'quiz' && props.score !== null && props.total) {
      return `Quiz ${props.score}/${props.total} · Won ${props.prizeTitle}`;
    }
    return `You won ${props.prizeTitle}`;
  }
  return 'BIAI Photo Studio';
});

const claimActionLabel = computed(() =>
  props.prizeTitle ? `NEXT: CLAIM ${props.prizeTitle.toUpperCase()} →` : 'NEXT: CLAIM PRIZE →'
);

const formattedDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date());

const footerSignature = computed(() => {
  const cleanName = String(props.winnerName || '').trim().toUpperCase();
  return [cleanName || 'OFFICIAL BIAI EDITION', formattedDate].join(' · ');
});

const downloadFilename = computed(() => {
  const ext =
    capturedMimeType.value === 'image/webp'
      ? 'webp'
      : capturedMimeType.value === 'image/png'
        ? 'png'
        : 'jpg';
  return `biai-congratulations-winner.${ext}`;
});

const sizeBadgeLabel = computed(() => {
  if (!capturedSizeBytes.value) return '';
  return `${(capturedSizeBytes.value / 1024).toFixed(1)} KB`;
});

function stopCamera() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdown.value = 0;

  if (activeStream) {
    for (const track of activeStream.getTracks()) {
      track.stop();
    }
    activeStream = null;
  }

  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
}

function revokeCaptured() {
  if (capturedUrl.value) {
    URL.revokeObjectURL(capturedUrl.value);
    capturedUrl.value = '';
  }
  capturedBlob.value = null;
}

async function refreshVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices.value = devices.filter((device) => device.kind === 'videoinput');
  } catch {
    videoDevices.value = [];
  }
}

async function startCamera(deviceId = '') {
  const reqId = ++cameraRequestId;
  stopCamera();
  shareNotice.value = '';
  cameraError.value = '';

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    cameraState.value = 'error';
    cameraError.value =
      'Live webcam access requires HTTPS or localhost. You can still upload a photo below.';
    return;
  }

  cameraState.value = 'starting';

  const videoConstraint = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 } }
    : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraint,
      audio: false,
    });

    if (unmounted || reqId !== cameraRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    activeStream = stream;
    await nextTick();
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play().catch(() => {});
    }
    await refreshVideoDevices();
    cameraState.value = 'ready';
  } catch (error) {
    if (unmounted || reqId !== cameraRequestId) return;
    cameraState.value = 'error';
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      cameraError.value = 'Camera access was denied. Allow permission or upload a photo.';
    } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      cameraError.value = 'No webcam found on this device. Upload a photo instead.';
    } else {
      cameraError.value = 'Could not open webcam preview. Retry or upload a photo.';
    }
  }
}

async function switchCamera() {
  if (videoDevices.value.length < 2) return;
  currentDeviceIndex.value = (currentDeviceIndex.value + 1) % videoDevices.value.length;
  const nextDevice = videoDevices.value[currentDeviceIndex.value];
  await startCamera(nextDevice?.deviceId || '');
}

async function persistPhotoToDatabase() {
  if (isBeforeClaim.value || !props.playId || !capturedDataUrl.value) return;

  saveStatus.value = 'saving';
  saveMessage.value = 'Saving photo…';
  try {
    await saveWinnerPhoto({
      playId: props.playId,
      themeId: selectedTheme.value,
      imageDataUrl: capturedDataUrl.value,
    });
    saveStatus.value = 'saved';
    saveMessage.value = `Saved to BIAI gallery (${sizeBadgeLabel.value})`;
    emit('photoSaved', {
      status: 'saved',
      dataUrl: capturedDataUrl.value,
      mimeType: capturedMimeType.value,
      sizeBytes: capturedSizeBytes.value,
      themeId: selectedTheme.value,
      rawSnapshot: rawSnapshot.value,
      message: saveMessage.value,
    });
  } catch (error) {
    saveStatus.value = 'error';
    saveMessage.value = error?.message || 'Could not save photo to gallery.';
  }
}

async function buildFramedOutput() {
  if (!rawSnapshot.value) return;
  const reqId = ++renderRequestId;
  isRendering.value = true;
  shareNotice.value = '';
  saveStatus.value = 'idle';
  saveMessage.value = '';

  try {
    const { blob, dataUrl, mimeType, sizeBytes } = await renderFramedWinnerPhoto({
      source: rawSnapshot.value.source,
      mirrored: rawSnapshot.value.mirrored,
      themeId: selectedTheme.value,
      winnerName: props.winnerName,
    });

    if (unmounted || reqId !== renderRequestId) return;

    revokeCaptured();
    capturedDataUrl.value = dataUrl;
    capturedMimeType.value = mimeType || 'image/webp';
    capturedSizeBytes.value = sizeBytes || 0;

    if (blob) {
      capturedBlob.value = blob;
      capturedUrl.value = URL.createObjectURL(blob);
      if (typeof File !== 'undefined' && navigator.canShare) {
        const testFile = new File([blob], downloadFilename.value, { type: capturedMimeType.value });
        canShareImage.value = navigator.canShare({ files: [testFile] });
      }
    } else {
      capturedUrl.value = dataUrl;
    }

    if (isBeforeClaim.value) {
      saveStatus.value = 'saved';
      saveMessage.value = `Photo ready (${sizeBadgeLabel.value}) · Next step saves to gallery`;
    } else {
      await persistPhotoToDatabase();
    }
  } finally {
    if (!unmounted && reqId === renderRequestId) {
      isRendering.value = false;
    }
  }
}

function triggerFlash() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  flashActive.value = true;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashActive.value = false;
  }, 260);
}

async function captureFromWebcam() {
  const video = videoRef.value;
  if (!video || !video.videoWidth || !video.videoHeight) return;

  triggerFlash();
  playShutterChime();

  const snapshotCanvas = document.createElement('canvas');
  snapshotCanvas.width = video.videoWidth;
  snapshotCanvas.height = video.videoHeight;
  snapshotCanvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  rawSnapshot.value = { source: snapshotCanvas, mirrored: true };
  stopCamera();
  await buildFramedOutput();
}

function startTimedCapture() {
  if (cameraState.value !== 'ready' || countdown.value > 0 || isRendering.value) return;
  unlockAudio();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    captureFromWebcam();
    return;
  }

  countdown.value = 3;
  playCountdownTick(3);

  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value > 0) {
      playCountdownTick(countdown.value);
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      captureFromWebcam();
    }
  }, 900);
}

async function instantCapture() {
  if (cameraState.value !== 'ready' || isRendering.value) return;
  unlockAudio();
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdown.value = 0;
  }
  await captureFromWebcam();
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    URL.revokeObjectURL(objectUrl);
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = Math.max(1, Math.round((img.naturalWidth || 720) * scale));
    snapshotCanvas.height = Math.max(1, Math.round((img.naturalHeight || 900) * scale));
    snapshotCanvas.getContext('2d').drawImage(img, 0, 0, snapshotCanvas.width, snapshotCanvas.height);

    rawSnapshot.value = { source: snapshotCanvas, mirrored: false };
    stopCamera();
    playShutterChime();
    await buildFramedOutput();
    if (uploadInputRef.value) uploadInputRef.value.value = '';
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    cameraError.value = 'Could not read that image file. Try a PNG or JPG photo.';
  };
  img.src = objectUrl;
}

function openUploadPicker() {
  uploadInputRef.value?.click();
}

async function retakePhoto() {
  rawSnapshot.value = null;
  capturedDataUrl.value = '';
  capturedSizeBytes.value = 0;
  saveStatus.value = 'idle';
  saveMessage.value = '';
  revokeCaptured();
  await startCamera(videoDevices.value[currentDeviceIndex.value]?.deviceId || '');
}

function downloadPhoto() {
  if (!capturedUrl.value) return;
  const link = document.createElement('a');
  link.href = capturedUrl.value;
  link.download = downloadFilename.value;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function sharePhoto() {
  if (!capturedBlob.value || !navigator.share) return;
  try {
    const file = new File([capturedBlob.value], downloadFilename.value, {
      type: capturedMimeType.value,
    });
    await navigator.share({
      title: 'Congratulations Winner · BIAI',
      text: 'Celebrating my win with BIAI (Bangladesh Institute of Artificial Intelligence)!',
      files: [file],
    });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      shareNotice.value = 'Sharing unavailable here — tap Download Photo to save.';
    }
  }
}

function continueToClaim() {
  stopCamera();
  const draft = rawSnapshot.value
    ? {
        rawSnapshot: rawSnapshot.value,
        themeId: selectedTheme.value,
        dataUrl: capturedDataUrl.value,
        mimeType: capturedMimeType.value,
        sizeBytes: capturedSizeBytes.value,
      }
    : null;
  revokeCaptured();
  emit('continue', draft);
}

function skipToClaim() {
  stopCamera();
  revokeCaptured();
  emit('continue', null);
}

function handleBack() {
  stopCamera();
  revokeCaptured();
  if (isBeforeClaim.value) {
    emit('back');
  } else {
    emit('close');
  }
}

function handlePlayAgain() {
  stopCamera();
  revokeCaptured();
  emit('playAgain');
}

watch(selectedTheme, () => {
  if (rawSnapshot.value) {
    buildFramedOutput();
  }
});

onMounted(() => {
  if (props.initialDraft?.rawSnapshot) {
    selectedTheme.value = props.initialDraft.themeId || 'gold';
    rawSnapshot.value = props.initialDraft.rawSnapshot;
    cameraState.value = 'ready';
    buildFramedOutput();
  } else {
    startCamera();
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  clearTimeout(flashTimer);
  stopCamera();
  revokeCaptured();
});
</script>

<template>
  <section
    class="claim-panel claim-panel--booth"
    role="dialog"
    aria-modal="true"
    aria-labelledby="booth-title"
  >
    <div class="booth-layout">
      <div class="booth-preview-col">
        <div v-if="capturedUrl" class="booth-captured-wrap">
          <img
            :src="capturedUrl"
            :alt="`BIAI Congratulations Winner photo frame for ${winnerName}`"
            class="booth-captured-img"
          />
          <div v-if="isRendering" class="booth-busy-overlay" aria-live="polite">
            <span>Applying style…</span>
          </div>
        </div>

        <div
          v-else
          class="booth-live-frame"
          :class="`booth-live-frame--${selectedTheme}`"
        >
          <div class="booth-live-frame__head">
            <div class="booth-live-frame__brand">
              <div class="booth-live-frame__logo-wrap">
                <img
                  src="/biai-logo.png"
                  width="46"
                  height="46"
                  alt=""
                  class="booth-live-frame__logo"
                />
              </div>
              <div class="booth-live-frame__titles">
                <div class="booth-live-frame__brand-row">
                  <strong>BIAI</strong>
                  <span class="booth-live-frame__slogan">RISE ABOVE ALL 10X</span>
                </div>
                <span class="booth-live-frame__institute">Bangladesh Institute of Artificial Intelligence</span>
              </div>
            </div>
          </div>

          <div class="booth-live-frame__viewport">
            <video
              v-show="cameraState === 'ready'"
              ref="videoRef"
              class="booth-video"
              autoplay
              muted
              playsinline
            ></video>

            <div v-if="cameraState === 'ready'" class="booth-guides" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>

            <div v-if="countdown > 0" class="booth-countdown" aria-live="assertive">
              <span>{{ countdown }}</span>
            </div>

            <div v-if="flashActive" class="booth-flash" aria-hidden="true"></div>

            <div v-if="cameraState === 'starting'" class="booth-camera-fallback">
              <p>Opening camera…</p>
            </div>

            <div v-else-if="cameraState === 'error'" class="booth-camera-fallback">
              <p class="booth-camera-fallback__title">Webcam unavailable</p>
              <p>{{ cameraError }}</p>
              <div class="booth-camera-fallback__actions">
                <button type="button" class="booth-chip-btn" @click="startCamera()">
                  Retry camera
                </button>
                <button type="button" class="booth-chip-btn booth-chip-btn--solid" @click="openUploadPicker">
                  Upload photo
                </button>
                <button
                  v-if="isBeforeClaim"
                  type="button"
                  class="booth-chip-btn"
                  @click="skipToClaim"
                >
                  Skip &amp; claim →
                </button>
              </div>
            </div>
          </div>

          <div class="booth-live-frame__footer">
            <div class="booth-live-frame__rule" aria-hidden="true">
              <span></span>
              <b class="booth-live-frame__pill-rule">LEARN AI · BUILD SYSTEMS · BOOTCAMPS</b>
              <span></span>
            </div>
            <strong class="booth-live-frame__headline">CONGRATULATIONS WINNER</strong>
            <span class="booth-live-frame__sub">{{ footerSignature }}</span>
            <div class="booth-live-frame__cta">
              <span class="booth-live-frame__cta-text">AI Bootcamps · Masterclasses · Fellowship</span>
              <strong class="booth-live-frame__domain">BIAI.COM.BD</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="booth-controls-col">
        <div class="booth-topbar">
          <span v-if="prizeTitle" class="booth-win-pill">{{ winKickerText }}</span>
          <span v-else class="booth-kicker">BIAI Photo Studio</span>

          <button type="button" class="booth-link-btn" @click="handleBack">
            ← Back
          </button>
        </div>

        <div class="booth-header">
          <h2 id="booth-title" class="booth-title">FRAME YOUR WIN.</h2>
          <p class="booth-lead">
            <template v-if="capturedUrl">
              {{
                isBeforeClaim
                  ? 'Looking sharp! Proceed to enter your details and claim your prize.'
                  : 'Looks great! Switch frame style or download your keepsake.'
              }}
            </template>
            <template v-else>
              {{
                isBeforeClaim
                  ? `You unlocked ${prizeTitle || 'a prize'}! Capture your celebration photo, then claim at the end.`
                  : 'Pick a frame style, smile for the camera, and capture the moment.'
              }}
            </template>
          </p>
        </div>

        <div class="booth-theme-picker" role="group" aria-label="Choose BIAI frame style">
          <button
            v-for="theme in FRAME_THEMES"
            :key="theme.id"
            type="button"
            class="booth-theme-pill"
            :class="{ 'booth-theme-pill--active': selectedTheme === theme.id }"
            :aria-pressed="selectedTheme === theme.id"
            @click="selectedTheme = theme.id"
          >
            <span class="booth-theme-swatch" :style="{ backgroundColor: theme.swatch }" aria-hidden="true"></span>
            <span>{{ theme.label }}</span>
          </button>
        </div>

        <input
          ref="uploadInputRef"
          type="file"
          accept="image/*"
          capture="user"
          class="visually-hidden"
          @change="handleFileUpload"
        />

        <div v-if="!capturedUrl" class="booth-cta-stack">
          <button
            type="button"
            class="btn btn--primary booth-primary-cta"
            :disabled="cameraState !== 'ready' || countdown > 0 || isRendering"
            @click="startTimedCapture"
          >
            {{ countdown > 0 ? `SMILE (${countdown})…` : 'TAKE PHOTO (3S)' }}
          </button>

          <div class="booth-secondary-row">
            <button
              type="button"
              class="booth-chip-btn"
              :disabled="cameraState !== 'ready' || countdown > 0 || isRendering"
              @click="instantCapture"
            >
              Instant snap
            </button>
            <button
              v-if="videoDevices.length > 1"
              type="button"
              class="booth-chip-btn"
              :disabled="countdown > 0"
              @click="switchCamera"
            >
              Flip camera
            </button>
            <button
              type="button"
              class="booth-chip-btn"
              :disabled="countdown > 0 || isRendering"
              @click="openUploadPicker"
            >
              Upload photo
            </button>
          </div>
        </div>

        <div v-else class="booth-cta-stack">
          <button
            v-if="isBeforeClaim"
            type="button"
            class="btn btn--primary booth-primary-cta"
            :disabled="isRendering"
            @click="continueToClaim"
          >
            {{ claimActionLabel }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn--primary booth-primary-cta"
            :disabled="isRendering"
            @click="downloadPhoto"
          >
            DOWNLOAD PHOTO
          </button>

          <div class="booth-secondary-row">
            <button
              v-if="isBeforeClaim"
              type="button"
              class="booth-chip-btn booth-chip-btn--solid"
              :disabled="isRendering"
              @click="downloadPhoto"
            >
              Download
            </button>
            <button
              v-if="canShareImage"
              type="button"
              class="booth-chip-btn"
              :class="{ 'booth-chip-btn--solid': !isBeforeClaim }"
              :disabled="isRendering"
              @click="sharePhoto"
            >
              Share
            </button>
            <button type="button" class="booth-chip-btn" :disabled="isRendering" @click="retakePhoto">
              Retake
            </button>
            <button type="button" class="booth-chip-btn" :disabled="isRendering" @click="openUploadPicker">
              Change photo
            </button>
          </div>
        </div>

        <p v-if="saveMessage" class="booth-save-status" :class="`booth-save-status--${saveStatus}`" aria-live="polite">
          <span>{{ saveMessage }}</span>
          <button
            v-if="!isBeforeClaim && saveStatus === 'error'"
            type="button"
            class="booth-link-btn"
            @click="persistPhotoToDatabase"
          >
            Retry
          </button>
        </p>

        <p v-if="shareNotice" class="form-help" aria-live="polite">{{ shareNotice }}</p>

        <div v-if="isBeforeClaim && !capturedUrl" class="booth-quiet-foot">
          <button type="button" class="booth-link-btn" @click="skipToClaim">
            Skip camera &amp; claim prize →
          </button>
        </div>

        <div v-else-if="!isBeforeClaim" class="booth-quiet-foot">
          <button type="button" class="booth-link-btn" @click="handlePlayAgain">
            Play again →
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
