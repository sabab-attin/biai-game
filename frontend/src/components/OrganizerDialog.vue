<script setup>
import { ref, watch } from 'vue';
import { downloadAdminCsv, fetchAdminEntries } from '../api/client.js';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close']);

const dialogRef = ref(null);
const passkey = ref('');
const unlocked = ref(false);
const entries = ref([]);
const isLoading = ref(false);
const errorMsg = ref('');

watch(
  () => props.open,
  (isOpen) => {
    const el = dialogRef.value;
    if (!el) return;
    if (isOpen && !el.open) {
      el.showModal();
    } else if (!isOpen && el.open) {
      el.close();
    }
  }
);

function handleClose() {
  emit('close');
}

function handleBackdropClick(event) {
  if (event.target === dialogRef.value) {
    handleClose();
  }
}

async function loadEntries() {
  if (!passkey.value.trim()) {
    errorMsg.value = 'Enter the organizer passkey.';
    return;
  }
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const data = await fetchAdminEntries(passkey.value.trim());
    entries.value = data.entries;
    unlocked.value = true;
  } catch (error) {
    errorMsg.value = error.message || 'Could not load entries.';
  } finally {
    isLoading.value = false;
  }
}

async function handleDownloadCsv() {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    const blob = await downloadAdminCsv(passkey.value.trim());
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carnival-wheel-entries.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    errorMsg.value = error.message || 'Could not export CSV.';
  } finally {
    isLoading.value = false;
  }
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="carnival-dialog"
    aria-labelledby="organizer-dialog-title"
    @close="handleClose"
    @click="handleBackdropClick"
  >
    <div class="dialog__body">
      <div class="dialog__head">
        <h2 id="organizer-dialog-title">ORGANIZER CSV LEDGER</h2>
        <button type="button" class="btn btn--compact" @click="handleClose">CLOSE</button>
      </div>

      <form v-if="!unlocked" class="entry-form" novalidate @submit.prevent="loadEntries">
        <div class="field">
          <label class="field__label" for="admin-passkey">Organizer passkey</label>
          <input
            id="admin-passkey"
            v-model="passkey"
            class="field__input"
            name="passkey"
            type="password"
            autocomplete="current-password"
            placeholder="Enter ADMIN_PASSKEY"
          />
        </div>

        <p class="form-help" :class="{ 'form-help--error': Boolean(errorMsg) }" aria-live="polite">
          {{ errorMsg || 'All player logins and spins are stored in backend/data/entries.csv.' }}
        </p>

        <div class="dialog__actions">
          <button type="submit" class="btn btn--primary" :disabled="isLoading">
            {{ isLoading ? 'LOADING' : 'OPEN LOG' }}
          </button>
        </div>
      </form>

      <template v-else>
        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" :disabled="isLoading" @click="handleDownloadCsv">
            DOWNLOAD CSV
          </button>
          <button type="button" class="btn" :disabled="isLoading" @click="loadEntries">
            REFRESH
          </button>
          <span class="recent-sub">{{ entries.length }} recorded entries</span>
        </div>

        <p v-if="errorMsg" class="form-help form-help--error" aria-live="polite">{{ errorMsg }}</p>

        <div v-if="entries.length" class="table-wrap">
          <table class="entries-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Phone</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Prize</th>
                <th scope="col">Code</th>
                <th scope="col">Entered</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in entries" :key="entry.id">
                <td data-label="Name">{{ entry.name }}</td>
                <td data-label="Phone">{{ entry.phone || '-' }}</td>
                <td data-label="Email">{{ entry.email || '-' }}</td>
                <td data-label="Status">{{ entry.status === 'spun' ? 'Spun' : 'Logged in' }}</td>
                <td data-label="Prize">{{ entry.prizeWon || '-' }}</td>
                <td data-label="Code" class="num">{{ entry.claimCode || '-' }}</td>
                <td data-label="Entered">{{ formatTime(entry.enteredAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-state">No entries recorded yet.</p>
      </template>
    </div>
  </dialog>
</template>
