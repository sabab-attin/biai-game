<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';
import WinnerPhotoBooth from './WinnerPhotoBooth.vue';

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  saved: {
    type: Object,
    default: null,
  },
  photoState: {
    type: Object,
    default: null,
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  errorField: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['claim', 'retryPhoto', 'photoUpdated', 'playAgain', 'backToGames']);

const form = reactive({
  name: '',
  phone: '',
  email: '',
});

const hasPrizeReveal = () => Boolean(props.result?.prizeTitle);
const isWheel = () => props.result?.game === 'wheel';

const step = ref(hasPrizeReveal() ? 'reveal' : 'form');
const photoDraft = ref(null);
const postClaimBoothOpen = ref(false);
const localError = ref('');
const localField = ref(null);

const nameInputRef = ref(null);
const phoneInputRef = ref(null);
const emailInputRef = ref(null);
const claimCtaRef = ref(null);

function focusActiveControl() {
  if (props.saved || step.value === 'booth') return;
  if (hasPrizeReveal() && step.value === 'reveal') {
    claimCtaRef.value?.focus();
  } else {
    nameInputRef.value?.focus();
  }
}

watch(
  () => props.result,
  async (val) => {
    step.value = val?.prizeTitle ? 'reveal' : 'form';
    photoDraft.value = null;
    postClaimBoothOpen.value = false;
    localError.value = '';
    localField.value = null;
    await nextTick();
    focusActiveControl();
  }
);

watch(
  () => props.error,
  (val) => {
    localError.value = val || '';
  }
);

watch(
  () => props.errorField,
  (val) => {
    localField.value = val || null;
    if (val === 'name') nameInputRef.value?.focus();
    if (val === 'phone') phoneInputRef.value?.focus();
    if (val === 'email') emailInputRef.value?.focus();
  }
);

onMounted(async () => {
  await nextTick();
  focusActiveControl();
});

function openCameraBeforeClaim() {
  step.value = 'booth';
  localError.value = '';
  localField.value = null;
}

function handleBoothContinue(draft) {
  photoDraft.value = draft || null;
  step.value = 'form';
  localError.value = '';
  localField.value = null;
}

function downloadSavedPhoto() {
  const dataUrl = props.photoState?.dataUrl;
  if (!dataUrl) return;
  const mime = props.photoState?.mimeType || 'image/webp';
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `biai-congratulations-winner.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function handleSubmit() {
  const name = form.name.trim();
  const phone = form.phone.trim();
  const email = form.email.trim();

  if (name.length < 2) {
    localField.value = 'name';
    localError.value = 'Enter your full name (at least 2 characters).';
    nameInputRef.value?.focus();
    return;
  }

  if (!phone) {
    localField.value = 'phone';
    localError.value = 'Enter your phone number.';
    phoneInputRef.value?.focus();
    return;
  }

  const cleaned = phone.replace(/[\s().-]/g, '');
  if (!/^01[3-9]\d{8}$/.test(cleaned) && !/^\+8801[3-9]\d{8}$/.test(cleaned)) {
    localField.value = 'phone';
    localError.value = 'Enter an 11-digit Bangladesh mobile number starting with 01, or use +880.';
    phoneInputRef.value?.focus();
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    localField.value = 'email';
    localError.value = 'That email address looks incomplete. Write it as name@example.com.';
    emailInputRef.value?.focus();
    return;
  }

  localError.value = '';
  localField.value = null;
  emit('claim', { name, phone, email, photoDraft: photoDraft.value });
}

function clearFieldError(field) {
  if (localField.value === field) {
    localField.value = null;
    localError.value = '';
  }
}
</script>

<template>
  <div class="claim-overlay">
    <Transition name="panel-swap" mode="out-in" @after-enter="focusActiveControl">
      <WinnerPhotoBooth
        v-if="saved && postClaimBoothOpen"
        key="post-claim-booth"
        mode="after-claim"
        :play-id="result.playId"
        :game="result.game"
        :prize-title="saved.prizeTitle || result.prizeTitle || ''"
        :score="saved.score ?? result.score ?? null"
        :total="saved.total ?? result.total ?? null"
        :winner-name="saved.record?.name || saved.player?.name || 'BIAI Winner'"
        @close="postClaimBoothOpen = false"
        @photo-saved="emit('photoUpdated', $event)"
        @play-again="emit('playAgain')"
      />

      <section
        v-else-if="saved"
        key="saved"
        class="claim-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-saved-title"
      >
        <p class="claim-panel__eyebrow">{{ hasPrizeReveal() ? 'Prize claimed' : 'Score saved' }}</p>
        <h2 id="claim-saved-title" class="claim-panel__title">
          {{ hasPrizeReveal() ? 'YOU’RE IN.' : 'NICE WORK.' }}
        </h2>
        <p class="claim-panel__lead">
          {{
            hasPrizeReveal()
              ? 'Your prize is saved. Show this confirmation at the BIAI booth to collect it.'
              : 'Your quiz result is saved. We will contact you if you qualify for a prize.'
          }}
        </p>

        <dl class="player-meta claim-meta">
          <div class="player-meta__item">
            <dt>Name</dt>
            <dd>{{ saved.record?.name || saved.player?.name || '—' }}</dd>
          </div>
          <div class="player-meta__item">
            <dt>Phone</dt>
            <dd>{{ saved.record?.phone || saved.player?.phone || '—' }}</dd>
          </div>
          <div v-if="!isWheel()" class="player-meta__item">
            <dt>Quiz score</dt>
            <dd>{{ `${saved.score ?? result.score}/${saved.total ?? result.total}` }}</dd>
          </div>
          <div v-if="hasPrizeReveal()" class="player-meta__item">
            <dt>Prize</dt>
            <dd>{{ saved.prizeTitle || saved.record?.reward || result.prizeTitle || '—' }}</dd>
          </div>
        </dl>

        <div v-if="photoState?.dataUrl" class="booth-saved-card">
          <img
            :src="photoState.dataUrl"
            :alt="`BIAI Winner Photo for ${saved.record?.name || 'Winner'}`"
            class="booth-saved-card__thumb"
          />
          <div class="booth-saved-card__body">
            <p
              class="booth-save-status"
              :class="`booth-save-status--${photoState.status}`"
              aria-live="polite"
            >
              <span>{{ photoState.message }}</span>
              <button
                v-if="photoState.status === 'error'"
                type="button"
                class="booth-link-btn"
                @click="emit('retryPhoto')"
              >
                Retry
              </button>
            </p>
            <div class="booth-saved-card__actions">
              <button type="button" class="booth-chip-btn booth-chip-btn--solid" @click="downloadSavedPhoto">
                Download photo
              </button>
              <button type="button" class="booth-chip-btn" @click="postClaimBoothOpen = true">
                Retake / edit frame
              </button>
            </div>
          </div>
        </div>

        <div v-else class="booth-invite">
          <div class="booth-invite__copy">
            <strong>Capture your BIAI Winner Photo Frame</strong>
            <span>
              Snap a webcam selfie inside a branded BIAI congratulations frame celebrating your win!
            </span>
          </div>
          <button type="button" class="btn btn--primary" @click="postClaimBoothOpen = true">
            TAKE WINNER PHOTO
          </button>
        </div>

        <div class="btn-pair">
          <button type="button" class="btn" @click="emit('playAgain')">
            PLAY AGAIN
          </button>
          <button type="button" class="btn" @click="emit('backToGames')">
            BACK TO GAMES
          </button>
        </div>
      </section>

      <section
        v-else-if="hasPrizeReveal() && step === 'reveal'"
        key="reveal"
        class="claim-panel claim-panel--reveal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-reveal-title"
      >
        <span class="claim-panel__shockwave" aria-hidden="true"></span>
        <p class="claim-panel__eyebrow">
          {{
            isWheel()
              ? 'Congratulations · Prize unlocked'
              : `Quiz score ${result.score}/${result.total} · Prize unlocked`
          }}
        </p>
        <h2 id="claim-reveal-title" class="claim-panel__title">YOU WON!</h2>

        <div class="claim-prize-card">
          <span v-if="result.prizeCategory" class="claim-prize-card__tag">
            {{ result.prizeCategory }}
          </span>
          <p class="claim-prize-card__name">{{ result.prizeTitle }}</p>
          <p v-if="result.prizeDescription" class="claim-prize-card__desc">
            {{ result.prizeDescription }}
          </p>
        </div>

        <p class="claim-panel__lead">
          <template v-if="isWheel()">
            Your spin landed on <strong>{{ result.prizeTitle }}</strong>! Snap your BIAI winner
            photo next, then enter your details at the end to claim.
          </template>
          <template v-else>
            You got <strong>{{ result.score }}/{{ result.total }}</strong> right and unlocked
            <strong>{{ result.prizeTitle }}</strong>! Snap your BIAI winner photo next, then enter
            your details at the end to claim.
          </template>
        </p>

        <div class="btn-pair">
          <button
            ref="claimCtaRef"
            type="button"
            class="btn btn--primary"
            @click="openCameraBeforeClaim"
          >
            OPEN CAMERA &amp; FRAME WIN →
          </button>
          <button type="button" class="btn" @click="handleBoothContinue(null)">
            SKIP CAMERA &amp; CLAIM
          </button>
        </div>

        <button type="button" class="booth-link-btn" @click="emit('backToGames')">
          Back to games
        </button>
      </section>

      <WinnerPhotoBooth
        v-else-if="hasPrizeReveal() && step === 'booth'"
        key="pre-claim-booth"
        mode="before-claim"
        :play-id="result.playId"
        :game="result.game"
        :prize-title="result.prizeTitle"
        :score="result.score ?? null"
        :total="result.total ?? null"
        :initial-draft="photoDraft"
        @back="step = 'reveal'"
        @continue="handleBoothContinue"
        @close="emit('backToGames')"
        @play-again="emit('playAgain')"
      />

      <section
        v-else
        key="form"
        class="claim-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
      >
        <p class="claim-panel__eyebrow">
          {{
            hasPrizeReveal()
              ? isWheel()
                ? 'Final step · Claim your prize'
                : `Quiz score ${result.score}/${result.total} · Final step`
              : 'Winner check-in'
          }}
        </p>
        <h2 id="claim-title" class="claim-panel__title">
          <template v-if="hasPrizeReveal()">CLAIM {{ result.prizeTitle }}.</template>
          <template v-else>YOU SCORED {{ result.score }}/{{ result.total }}.</template>
        </h2>
        <p class="claim-panel__lead">
          {{
            hasPrizeReveal()
              ? 'Add your details so we can save your prize and photo.'
              : 'Add your details so we can save your score and contact you about quiz prizes.'
          }}
        </p>

        <div v-if="photoDraft?.dataUrl" class="claim-photo-pill">
          <div class="claim-photo-pill__left">
            <img
              :src="photoDraft.dataUrl"
              alt="Captured BIAI winner frame preview"
              class="claim-photo-pill__thumb"
            />
            <div class="claim-photo-pill__copy">
              <strong>Winner photo ready ({{ (photoDraft.sizeBytes / 1024).toFixed(1) }} KB)</strong>
              <span>Your name will be stamped onto the frame when you submit.</span>
            </div>
          </div>
          <button type="button" class="booth-chip-btn" @click="openCameraBeforeClaim">
            Retake
          </button>
        </div>

        <div v-else-if="hasPrizeReveal()" class="claim-photo-pill claim-photo-pill--empty">
          <div class="claim-photo-pill__copy">
            <strong>No winner photo taken yet</strong>
            <span>Want a framed keepsake before claiming?</span>
          </div>
          <button type="button" class="booth-chip-btn" @click="openCameraBeforeClaim">
            Open camera
          </button>
        </div>

        <form class="entry-form" novalidate @submit.prevent="handleSubmit">
          <div class="field">
            <label class="field__label" for="claim-name">
              Full name <span class="field__req">(required)</span>
            </label>
            <input
              id="claim-name"
              ref="nameInputRef"
              v-model="form.name"
              class="field__input"
              name="name"
              type="text"
              autocomplete="name"
              placeholder="Amina Rahman"
              aria-required="true"
              :aria-invalid="localField === 'name' ? 'true' : undefined"
              :aria-describedby="localError ? 'claim-help' : undefined"
              @input="clearFieldError('name')"
            />
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="claim-phone">
                Phone number <span class="field__req">(required)</span>
              </label>
              <input
                id="claim-phone"
                ref="phoneInputRef"
                v-model="form.phone"
                class="field__input"
                name="phone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="+880 1711-000000"
                aria-required="true"
                :aria-invalid="localField === 'phone' ? 'true' : undefined"
                :aria-describedby="localError ? 'claim-help' : undefined"
                @input="clearFieldError('phone')"
              />
            </div>

            <div class="field">
              <label class="field__label" for="claim-email">
                Email address <span class="field__optional">(optional)</span>
              </label>
              <input
                id="claim-email"
                ref="emailInputRef"
                v-model="form.email"
                class="field__input"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                :aria-invalid="localField === 'email' ? 'true' : undefined"
                :aria-describedby="localError ? 'claim-help' : undefined"
                @input="clearFieldError('email')"
              />
            </div>
          </div>

          <p
            id="claim-help"
            class="form-help"
            :class="{ 'form-help--error': Boolean(localError) }"
            aria-live="polite"
          >
            {{ localError || 'Nothing is saved until you submit. We only use these details to arrange your prize.' }}
          </p>

          <p class="form-consent">
            Your name and phone number are used only to run this event and arrange prize collection.
            Email is optional. We never sell your details.
          </p>

          <div class="btn-pair">
            <button
              type="submit"
              class="btn btn--primary"
              :disabled="isSubmitting"
              :aria-busy="isSubmitting ? 'true' : 'false'"
            >
              {{
                isSubmitting
                  ? 'SAVING'
                  : hasPrizeReveal()
                    ? 'CLAIM MY PRIZE'
                    : 'SAVE MY SCORE'
              }}
            </button>

            <button
              type="button"
              class="btn"
              :disabled="isSubmitting"
              @click="emit('backToGames')"
            >
              NOT NOW
            </button>
          </div>
        </form>
      </section>
    </Transition>
  </div>
</template>
