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
  entryError: {
    type: String,
    default: '',
  },
  entryErrorField: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['enter', 'spin', 'switchPlayer']);

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

  if (!phone && !email) {
    localField.value = 'phone';
    localError.value = 'Enter a phone number, an email address, or both.';
    phoneInputRef.value?.focus();
    return;
  }

  if (phone) {
    const cleaned = phone.replace(/[\s().-]/g, '');
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      localField.value = 'phone';
      localError.value = 'Phone number must be 7 to 15 digits.';
      phoneInputRef.value?.focus();
      return;
    }
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
    <form v-if="!player" class="entry-form" novalidate @submit.prevent="handleSubmit">
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
          <label class="field__label" for="player-phone">Phone number</label>
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
            :aria-invalid="localField === 'phone' ? 'true' : undefined"
            :aria-describedby="localError ? 'entry-help' : undefined"
            @input="clearFieldError('phone')"
          />
        </div>

        <div class="field">
          <label class="field__label" for="player-email">Email address</label>
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
        {{ localError || 'Provide a phone number, an email address, or both.' }}
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
      </div>
    </form>

    <div v-else-if="player.spinsRemaining > 0" class="player-summary">
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

      <p class="form-help" aria-live="polite">
        Entry recorded in MongoDB and CSV. One spin is ready for your ticket.
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

    <div v-else class="player-summary">
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
          {{ copied ? 'COPIED' : 'COPY' }}
        </button>
      </div>

      <p class="form-help" aria-live="polite">
        Prize saved to MongoDB and backend CSV. Show your code at the BIAI desk.
      </p>

      <p class="ticket-promo">
        Build real AI tools from Day 1 with Bangladesh Institute of Artificial Intelligence.
      </p>

      <div class="btn-pair">
        <a
          class="btn btn--primary"
          href="https://biai.com.bd/courses"
          target="_blank"
          rel="noopener noreferrer"
        >
          EXPLORE BIAI COURSES
        </a>
        <button type="button" class="btn" @click="handleSwitch">
          PLAY NEXT GUEST
        </button>
      </div>
    </div>
  </section>
</template>
