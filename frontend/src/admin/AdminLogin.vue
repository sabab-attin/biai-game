<script setup>
import { ref } from 'vue';
import { loginAdmin } from './api.js';

defineProps({
  notice: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['success']);

const username = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

async function submit() {
  if (isLoading.value) return;

  if (!username.value.trim() || !password.value) {
    errorMsg.value = 'Enter your admin username and password.';
    return;
  }

  isLoading.value = true;
  errorMsg.value = '';

  try {
    const data = await loginAdmin(username.value.trim(), password.value);
    password.value = '';
    emit('success', data.admin);
  } catch (error) {
    if (error.status === 404) {
      errorMsg.value = 'Invalid username or password.';
    } else {
      errorMsg.value = error.message || 'Could not sign in.';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <main class="admin-auth">
    <section class="admin-auth__card" aria-labelledby="admin-login-title">
      <p class="admin-auth__eyebrow">Restricted area</p>
      <h1 id="admin-login-title" class="admin-auth__title">ADMIN LOGIN</h1>
      <p class="admin-auth__lead">
        Sign in to manage records, the dart game, and CSV backups.
      </p>

      <p v-if="notice" class="form-help" aria-live="polite">{{ notice }}</p>

      <form class="entry-form" novalidate @submit.prevent="submit">
        <div class="field">
          <label class="field__label" for="admin-username">Username</label>
          <input
            id="admin-username"
            v-model="username"
            class="field__input"
            name="username"
            type="text"
            autocomplete="username"
            required
          />
        </div>

        <div class="field">
          <label class="field__label" for="admin-password">Password</label>
          <input
            id="admin-password"
            v-model="password"
            class="field__input"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <p
          v-if="errorMsg"
          class="form-help form-help--error"
          aria-live="polite"
        >
          {{ errorMsg }}
        </p>

        <div class="dialog__actions">
          <button type="submit" class="btn btn--primary" :disabled="isLoading">
            {{ isLoading ? 'SIGNING IN' : 'SIGN IN' }}
          </button>
          <a class="btn" href="/">BACK TO EVENT</a>
        </div>
      </form>
    </section>
  </main>
</template>
