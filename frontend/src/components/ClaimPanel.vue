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

const localError = ref('');
const localField = ref(null);
const copied = ref(false);

const nameInputRef = ref(null);
const phoneInputRef = ref(null);
const emailInputRef = ref(null);

const isWheel = () => props.result?.game === 'wheel';

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

watch(
  () => props.saved,
  async (val) => {
    if (val) return;
    await nextTick();
    nameInputRef.value?.focus();
  }
);

onMounted(async () => {
  await nextTick();
  nameInputRef.value?.focus();
});

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

async function copyCode() {
  const code = props.saved?.claimCode || props.result?.claimCode;
  if (!code || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard fallback ignored if blocked
  }
}
</script>

<template>
  <div class="claim-overlay">
    <section
      class="claim-panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="saved ? 'claim-saved-title' : 'claim-title'"
    >
      <template v-if="saved">
        <p class="claim-panel__eyebrow">{{ isWheel() ? 'Prize claimed' : 'Score saved' }}</p>
        <h2 id="claim-saved-title" class="claim-panel__title">
          {{ isWheel() ? 'YOU’RE IN.' : 'NICE WORK.' }}
        </h2>
        <p class="claim-panel__lead">
          {{
            isWheel()
              ? 'Your prize is saved. Keep this code handy when you collect it.'
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
          <div class="player-meta__item">
            <dt>{{ isWheel() ? 'Prize' : 'Score' }}</dt>
            <dd>
              {{
                isWheel()
                  ? saved.record?.reward || result.prizeTitle || '—'
                  : `${saved.score ?? result.score}/${saved.total ?? result.total}`
              }}
            </dd>
          </div>
          <div v-if="isWheel()" class="player-meta__item">
            <dt>Claim code</dt>
            <dd class="claim-code">{{ saved.claimCode || result.claimCode || '—' }}</dd>
          </div>
        </dl>

        <p v-if="isWheel()" class="form-help">
          Screenshot this code or copy it before you close this window.
        </p>

        <div class="btn-pair">
          <button
            v-if="isWheel()"
            type="button"
            class="btn btn--compact"
            @click="copyCode"
          >
            {{ copied ? 'COPIED' : 'COPY CODE' }}
          </button>
          <button type="button" class="btn btn--primary" @click="emit('playAgain')">
            PLAY AGAIN
          </button>
          <button type="button" class="btn" @click="emit('backToGames')">
            BACK TO GAMES
          </button>
        </div>
      </template>

      <template v-else>
        <p class="claim-panel__eyebrow">Winner check-in</p>
        <h2 id="claim-title" class="claim-panel__title">
          <template v-if="isWheel()">YOU WON {{ result.prizeTitle }}.</template>
          <template v-else>YOU SCORED {{ result.score }}/{{ result.total }}.</template>
        </h2>
        <p class="claim-panel__lead">
          {{
            isWheel()
              ? 'Add your details so we can save this prize and tell you how to collect it.'
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
      </template>
    </section>
  </div>
</template>
