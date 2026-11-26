<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  saved: {
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

const emit = defineEmits(['claim', 'playAgain', 'backToGames']);

const form = reactive({
  name: '',
  phone: '',
  email: '',
});

const hasPrizeReveal = () => Boolean(props.result?.prizeTitle);
const isWheel = () => props.result?.game === 'wheel';

const step = ref(hasPrizeReveal() ? 'reveal' : 'form');
const localError = ref('');
const localField = ref(null);

const nameInputRef = ref(null);
const phoneInputRef = ref(null);
const emailInputRef = ref(null);
const claimCtaRef = ref(null);

function focusActiveControl() {
  if (props.saved) return;
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

function openClaimForm() {
  step.value = 'form';
  localError.value = '';
  localField.value = null;
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
  emit('claim', { name, phone, email });
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
      <section
        v-if="saved"
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

        <div class="btn-pair">
          <button type="button" class="btn btn--primary" @click="emit('playAgain')">
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
            Your spin landed on <strong>{{ result.prizeTitle }}</strong>! Tap below to enter your
            details and claim this gift.
          </template>
          <template v-else>
            You got <strong>{{ result.score }}/{{ result.total }}</strong> right and unlocked
            <strong>{{ result.prizeTitle }}</strong>! Tap below to enter your details and claim this gift.
          </template>
        </p>

        <div class="btn-pair">
          <button
            ref="claimCtaRef"
            type="button"
            class="btn btn--primary"
            @click="openClaimForm"
          >
            CLAIM YOUR PRIZE →
          </button>
          <button type="button" class="btn" @click="emit('backToGames')">
            BACK TO GAMES
          </button>
        </div>
      </section>

      <section
        v-else
        key="form"
        class="claim-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
      >
        <p class="claim-panel__eyebrow">
          {{ hasPrizeReveal() ? 'Claim your gift' : 'Winner check-in' }}
        </p>
        <h2 id="claim-title" class="claim-panel__title">
          <template v-if="hasPrizeReveal()">CLAIM {{ result.prizeTitle }}.</template>
          <template v-else>YOU SCORED {{ result.score }}/{{ result.total }}.</template>
        </h2>
        <p class="claim-panel__lead">
          {{
            hasPrizeReveal()
              ? 'Add your details so we can save your gift and arrange collection.'
              : 'Add your details so we can save your score and contact you about quiz prizes.'
          }}
        </p>

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
                  : isWheel()
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
