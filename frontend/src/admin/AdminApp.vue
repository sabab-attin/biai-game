<script setup>
import { onMounted, ref } from 'vue';
import AdminDashboard from './AdminDashboard.vue';
import AdminLogin from './AdminLogin.vue';
import { fetchAdminSession, logoutAdmin } from './api.js';
import { ADMIN_HASH_BASE, ADMIN_LOGIN_HASH } from './path.js';

const admin = ref(null);
const isChecking = ref(true);
const authError = ref('');

function setHash(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash.replace(/^#/, '');
  }
}

async function checkSession() {
  isChecking.value = true;
  try {
    const data = await fetchAdminSession();
    admin.value = data.admin;
  } catch {
    admin.value = null;
  } finally {
    isChecking.value = false;
  }
}

function handleLoggedIn(nextAdmin) {
  authError.value = '';
  admin.value = nextAdmin;
  setHash(ADMIN_HASH_BASE);
}

async function handleLogout() {
  try {
    await logoutAdmin();
  } catch {
    // Clearing local state is enough; the cookie is httpOnly and expires on its own.
  }
  admin.value = null;
  authError.value = 'You have signed out.';
  setHash(ADMIN_LOGIN_HASH);
}

function handleExpired() {
  admin.value = null;
  authError.value = 'Your admin session expired. Sign in again.';
  setHash(ADMIN_LOGIN_HASH);
}

onMounted(checkSession);
</script>

<template>
  <div v-if="isChecking" class="admin-boot" aria-live="polite">
    <p>Checking admin session…</p>
  </div>

  <AdminDashboard
    v-else-if="admin"
    :admin="admin"
    @logout="handleLogout"
    @expired="handleExpired"
  />

  <AdminLogin v-else :notice="authError" @success="handleLoggedIn" />
</template>
