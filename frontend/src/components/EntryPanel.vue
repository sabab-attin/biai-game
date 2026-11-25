<script setup>
import { reactive, ref, watch } from 'vue';

const props = defineProps({
  player: {
    type: Object,
    default: null,
  },
  isSubmittingEntry: {
    type: Boolean,
    default: false,
  },
  isSpinning: {
    type: Boolean,
    default: false,
  },
  spinAgain: {
    type: Boolean,
    default: false,
  },
  entryError: {
    type: String,
    default: '',
  },
  entryErrorField: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['enter', 'guest', 'spin', 'switchPlayer']);

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

watch(
  () => props.entryError,
  (val) => {
    localError.value = val || '';
  }
);

watch(
  () => props.entryErrorField,
  (val) => {
    localField.value = val || null;
    if (val === 'name') nameInputRef.value?.focus();
    if (val === 'phone') phoneInputRef.value?.focus();
    if (val === 'email') emailInputRef.value?.focus();
  }
);

function focusNameInput() {
  nameInputRef.value?.focus();
}

defineExpose({ focusNameInput });

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
  emit('enter', { name, phone, email });
}

function clearFieldError(field) {
  if (localField.value === field) {
    localField.value = null;
    localError.value = '';
  }
}

async function copyCode() {
  if (!props.player?.claimCode || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(props.player.claimCode);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard fallback ignored if blocked
  }
}

function handleSwitch() {
  form.name = '';
  form.phone = '';
  form.email = '';
  localError.value = '';
  localField.value = null;
  copied.value = false;
  emit('switchPlayer');
}
</script>

<template>
  <section class="well" aria-label="Player check-in and prize status">
    <Transition name="panel-swap" mode="out-in">
      <form
        v-if="!player"
        key="entry-form"
        class="entry-form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="field">
          <label class="field__label" for="player-name">
            Full name <span class="field__req">(required)</span>
          </label>
          <input
            id="player-name"
            ref="nameInputRef"
            v-model="form.name"
            class="field__input"
            name="name"
            type="text"
            autocomplete="name"
            placeholder="Amina Rahman"
            aria-required="true"
            :aria-invalid="localField === 'name' ? 'true' : undefined"
            :aria-describedby="localError ? 'entry-help' : undefined"
            @input="clearFieldError('name')"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="player-phone">
              Phone number <span class="field__req">(required)</span>
            </label>
            <input
              id="player-phone"
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
              :aria-describedby="localError ? 'entry-help' : undefined"
              @input="clearFieldError('phone')"
            />
          </div>

          <div class="field">
            <label class="field__label" for="player-email">
              Email address <span class="field__optional">(optional)</span>
            </label>
            <input
              id="player-email"
              ref="emailInputRef"
              v-model="form.email"
              class="field__input"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              :aria-invalid="localField === 'email' ? 'true' : undefined"
              :aria-describedby="localError ? 'entry-help' : undefined"
              @input="clearFieldError('email')"
            />
          </div>
        </div>

        <p
          id="entry-help"
          class="form-help"
          :class="{ 'form-help--error': Boolean(localError) }"
          aria-live="polite"
        >
          {{ localError || 'Phone number is required. Email is optional — add it if you want prize updates.' }}
        </p>

        <p class="form-consent">
          Your name and phone number are used only to run this event and arrange prize collection.
          Email is optional. We never sell your details.
        </p>

        <div class="btn-pair">
          <button
            type="submit"
            class="btn btn--primary"
            :disabled="isSubmittingEntry"
            :aria-busy="isSubmittingEntry ? 'true' : 'false'"
          >
            {{ isSubmittingEntry ? 'SAVING' : 'SAVE & PLAY' }}
          </button>

          <button
            type="button"
            class="btn"
            :disabled="isSubmittingEntry"
            @click="emit('guest')"
          >
            CONTINUE AS GUEST
          </button>
        </div>
      </form>

      <div v-else-if="player.spinsRemaining > 0" key="ready-ticket" class="player-summary">
        <dl class="player-meta">
          <div class="player-meta__item">
            <dt>Player</dt>
            <dd>{{ player.name }}</dd>
          </div>
          <div class="player-meta__item">
            <dt>Contact</dt>
            <dd>{{ player.contactLabel }}</dd>
          </div>
        </dl>

        <p v-if="spinAgain" class="form-help form-help--success" aria-live="polite">
          Spin Again! You have another turn.
        </p>

        <div class="btn-pair">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="isSpinning"
            :aria-busy="isSpinning ? 'true' : 'false'"
            @click="$emit('spin')"
          >
            {{ isSpinning ? 'SPINNING' : 'SPIN WHEEL' }}
          </button>

          <button
            type="button"
            class="btn"
            :disabled="isSpinning"
            @click="handleSwitch"
          >
            SWITCH PLAYER
          </button>
        </div>
      </div>

      <div v-else key="won-ticket" class="player-summary">
        <dl class="player-meta">
          <div class="player-meta__item">
            <dt>Winner</dt>
            <dd>{{ player.name }}</dd>
          </div>
          <div class="player-meta__item">
            <dt>Contact</dt>
            <dd>{{ player.contactLabel }}</dd>
          </div>
        </dl>

        <div>
          <p class="ticket-code__label">Winning prize</p>
          <p class="ticket-prize">{{ player.prizeTitle }}</p>
        </div>

        <div class="ticket-code-row">
          <div>
            <span class="ticket-code__label">Claim code</span>
            <span class="ticket-code__value">{{ player.claimCode }}</span>
          </div>
          <button type="button" class="btn btn--compact" @click="copyCode">
            {{ copied ? 'COPIED' : 'COPY CODE' }}
          </button>
        </div>

        <div class="btn-pair">
          <button type="button" class="btn btn--primary" @click="handleSwitch">
            PLAY NEXT GUEST
          </button>
          <a
            class="btn"
            href="https://biai.com.bd/courses"
            target="_blank"
            rel="noopener noreferrer"
          >
            BIAI COURSES
          </a>
        </div>
      </div>
    </Transition>
  </section>
</template>
