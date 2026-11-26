<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminDashboard from './AdminDashboard.vue';
import AdminLogin from './AdminLogin.vue';
import { fetchAdminSession, logoutAdmin } from './api.js';
import { ADMIN_HASH_BASE, ADMIN_LOGIN_HASH } from './path.js';
import {
  clearAdminMarkers,
  hasActiveAdminTab,
  hasSignedInMarker,
  isBackForwardNavigation,
  markAdminLoggedIn,
} from './session.js';

const admin = ref(null);
const isChecking = ref(true);
const authError = ref('');

function setHash(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash.replace(/^#/, '');
  }
}

async function forceLogoutNotice(message) {
  if (hasSignedInMarker()) {
    try {
      await logoutAdmin();
    } catch {
      // Ignore if cookie already expired.
    }
  }
  clearAdminMarkers();
  admin.value = null;
  authError.value = message;
  setHash(ADMIN_LOGIN_HASH);
}

async function checkSession() {
  isChecking.value = true;
  try {
    if (!hasActiveAdminTab() || isBackForwardNavigation()) {
      if (hasSignedInMarker()) {
        await logoutAdmin().catch(() => {});
      }
      clearAdminMarkers();
      admin.value = null;
      return;
    }

    const data = await fetchAdminSession();
    markAdminLoggedIn();
    admin.value = data.admin;
  } catch {
    clearAdminMarkers();
    admin.value = null;
  } finally {
    isChecking.value = false;
  }
}

function handleLoggedIn(nextAdmin) {
  authError.value = '';
  markAdminLoggedIn();
  admin.value = nextAdmin;
  setHash(ADMIN_HASH_BASE);
}

async function handleLogout() {
  try {
    await logoutAdmin();
  } catch {
    // Clearing local state is enough; the cookie is httpOnly and expires on its own.
  }
  clearAdminMarkers();
  admin.value = null;
  authError.value = 'You have signed out.';
  setHash(ADMIN_LOGIN_HASH);
}

function handleExpired() {
  clearAdminMarkers();
  admin.value = null;
  authError.value = 'Your admin session expired. Sign in again.';
  setHash(ADMIN_LOGIN_HASH);
}

function handlePageShow(event) {
  if (event.persisted && admin.value) {
    forceLogoutNotice('Signed out after leaving the admin page.');
  }
}

onMounted(() => {
  window.addEventListener('pageshow', handlePageShow);
  checkSession();
});

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', handlePageShow);
});
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
