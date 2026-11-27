<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  createDartRecord,
  deleteAdminPhoto,
  deleteAdminRecord,
  deleteDartRecord,
  downloadAdminCsv,
  downloadAdminPhoto,
  fetchAdminCsv,
  fetchAdminPhotoBlobUrl,
  fetchAdminPhotos,
  fetchAdminRecords,
  fetchAuditLog,
  fetchDartRecords,
  fetchWheelOdds,
  importRecordsCsv,
  logoutAdmin,
  rebuildAdminCsv,
  resetWheelOdds,
  updateDartRecord,
  updateWheelOdds,
} from './api.js';
import { clearAdminMarkers } from './session.js';

const props = defineProps({
  admin: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['logout', 'expired']);

const activeTab = ref('records');
const records = ref([]);
const dartRecords = ref([]);
const winnerPhotos = ref([]);
const csvText = ref('');
const auditEntries = ref([]);
const wheelOdds = ref([]);
const oddsDraft = reactive({});
const oddsDirty = ref(false);
const isSavingOdds = ref(false);
const recordSource = ref('');
const searchQuery = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const isRebuilding = ref(false);
const isDownloading = ref(false);
const isImporting = ref(false);
const busyDeleteId = ref('');
const busyPhotoId = ref('');
const previewPhoto = ref(null);
const errorMsg = ref('');
const successMsg = ref('');
const importMsg = ref('');
const importText = ref('');
const importInputRef = ref(null);
const editingRecordId = ref('');

let refreshTimer = null;
let refreshing = false;

const dartForm = reactive({
  name: '',
  game: '',
  phone: '',
  email: '',
  result: '',
  reward: '',
  timestamp: toLocalInput(new Date()),
});

const sourceCounts = computed(() => {
  const counts = { all: records.value.length, wheel: 0, quiz: 0, dart: 0 };
  for (const record of records.value) {
    if (record.source in counts) {
      counts[record.source] += 1;
    }
  }
  return counts;
});

const sourceOptions = computed(() => [
  { value: '', label: 'All sources', count: sourceCounts.value.all },
  { value: 'wheel', label: 'Wheel', count: sourceCounts.value.wheel },
  { value: 'quiz', label: 'Quiz', count: sourceCounts.value.quiz },
  { value: 'dart', label: 'Manual entry', count: sourceCounts.value.dart },
]);

const filteredRecords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return records.value.filter((record) => {
    if (recordSource.value && record.source !== recordSource.value) return false;
    if (!q) return true;
    const haystack = [
      record.name,
      record.phone,
      record.email,
      record.reward,
      record.result,
      record.game,
      sourceLabel(record.source),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sourceLabel(source) {
  return { wheel: 'Wheel', quiz: 'Quiz', dart: 'Manual' }[source] || source;
}

function displayName(record) {
  return record.name || '—';
}

function resetFilters() {
  recordSource.value = '';
  searchQuery.value = '';
}

async function refreshAll({ quiet = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  if (!quiet) isLoading.value = true;
  if (!quiet) errorMsg.value = '';

  try {
    const [recordsData, dartData, photosData, csv, auditData, oddsData] = await Promise.all([
      fetchAdminRecords({ limit: 250 }),
      fetchDartRecords(),
      fetchAdminPhotos({ limit: 150 }),
      fetchAdminCsv(),
      fetchAuditLog(),
      fetchWheelOdds(),
    ]);

    records.value = recordsData.records;
    dartRecords.value = dartData.records;
    winnerPhotos.value = photosData.photos || [];
    void syncPhotoBlobUrls(winnerPhotos.value);
    csvText.value = typeof csv === 'string' ? csv : '';
    auditEntries.value = auditData.entries;
    applyWheelOddsPayload(oddsData, { preserveDraft: oddsDirty.value });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not refresh admin data.';
  } finally {
    refreshing = false;
    isLoading.value = false;
  }
}

function applyWheelOddsPayload(payload, { preserveDraft = false } = {}) {
  const list = Array.isArray(payload?.prizes) ? payload.prizes : [];
  wheelOdds.value = list;
  if (!preserveDraft) {
    for (const item of list) {
      oddsDraft[item.id] = item.weight;
    }
    oddsDirty.value = false;
  }
}

const draftTotalWeight = computed(() =>
  wheelOdds.value.reduce((sum, item) => {
    const val = Number(oddsDraft[item.id]);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0)
);

const activeOddsCount = computed(
  () => wheelOdds.value.filter((item) => Number(item.weight) > 0).length
);

function draftPercent(id) {
  const total = draftTotalWeight.value;
  if (total <= 0) return '0.0%';
  const val = Number(oddsDraft[id]);
  if (!Number.isFinite(val) || val <= 0) return '0.0%';
  return `${((val / total) * 100).toFixed(1)}%`;
}

async function saveOdds() {
  if (isSavingOdds.value || draftTotalWeight.value <= 0) return;
  isSavingOdds.value = true;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    const weights = {};
    for (const item of wheelOdds.value) {
      const val = Number(oddsDraft[item.id]);
      weights[item.id] = Number.isFinite(val) && val >= 0 ? val : 0;
    }
    const updated = await updateWheelOdds(weights);
    applyWheelOddsPayload(updated, { preserveDraft: false });
    successMsg.value = 'Wheel odds updated — live for the next spin.';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not update wheel odds.';
  } finally {
    isSavingOdds.value = false;
  }
}

async function resetOdds() {
  if (isSavingOdds.value) return;
  isSavingOdds.value = true;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    const reset = await resetWheelOdds();
    applyWheelOddsPayload(reset, { preserveDraft: false });
    successMsg.value = 'Wheel odds reset to defaults.';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not reset wheel odds.';
  } finally {
    isSavingOdds.value = false;
  }
}

function resetDartForm() {
  editingRecordId.value = '';
  dartForm.name = '';
  dartForm.game = '';
  dartForm.phone = '';
  dartForm.email = '';
  dartForm.result = '';
  dartForm.reward = '';
  dartForm.timestamp = toLocalInput(new Date());
}

function startEdit(record) {
  editingRecordId.value = record.recordId;
  dartForm.name = record.name || '';
  dartForm.game = record.game || '';
  dartForm.phone = record.phone || '';
  dartForm.email = record.email || '';
  dartForm.result = record.result || '';
  dartForm.reward = record.reward || '';
  dartForm.timestamp = toLocalInput(record.timestamp);
  errorMsg.value = '';
  successMsg.value = '';
  activeTab.value = 'dart';
}

async function saveDart() {
  if (isSaving.value) return;

  const name = dartForm.name.trim();
  if (name.length < 2) {
    errorMsg.value = 'Player name is required (at least 2 characters).';
    return;
  }

  const game = dartForm.game.trim();
  if (!game) {
    errorMsg.value = 'Game is required.';
    return;
  }

  const timestamp = dartForm.timestamp ? new Date(dartForm.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    errorMsg.value = 'Enter a valid timestamp.';
    return;
  }

  isSaving.value = true;
  errorMsg.value = '';
  successMsg.value = '';

  const payload = {
    name,
    game,
    phone: dartForm.phone.trim(),
    email: dartForm.email.trim(),
    result: dartForm.result.trim(),
    reward: dartForm.reward.trim(),
    timestamp: timestamp.toISOString(),
  };

  try {
    if (editingRecordId.value) {
      await updateDartRecord(editingRecordId.value, payload);
      successMsg.value = 'Manual entry updated.';
    } else {
      await createDartRecord(payload);
      successMsg.value = 'Manual entry saved.';
    }
    resetDartForm();
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not save the manual entry.';
  } finally {
    isSaving.value = false;
  }
}

async function removeDart(record) {
  if (busyDeleteId.value) return;
  if (!window.confirm(`Delete the manual entry for "${displayName(record)}"? This cannot be undone.`)) {
    return;
  }

  busyDeleteId.value = record.recordId;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    await deleteDartRecord(record.recordId);
    successMsg.value = 'Manual entry deleted.';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not delete the manual entry.';
  } finally {
    busyDeleteId.value = '';
  }
}

async function removeRecord(record) {
  if (busyDeleteId.value) return;
  if (!window.confirm(`Delete this ${sourceLabel(record.source)} record? This cannot be undone.`)) {
    return;
  }

  busyDeleteId.value = record.recordId;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    await deleteAdminRecord(record.recordId);
    successMsg.value = 'Record deleted.';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not delete the record.';
  } finally {
    busyDeleteId.value = '';
  }
}

async function rebuildCsv() {
  if (isRebuilding.value) return;
  isRebuilding.value = true;
  errorMsg.value = '';
  successMsg.value = '';

  try {
    const result = await rebuildAdminCsv();
    const restored = result.restoredFromLog
      ? ` Restored ${result.restoredFromLog} from the JSONL backup first.`
      : '';
    successMsg.value = `CSV rebuilt with ${result.count} records.${restored}`;
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not rebuild the CSV.';
  } finally {
    isRebuilding.value = false;
  }
}

async function downloadCsv() {
  if (isDownloading.value) return;
  isDownloading.value = true;
  errorMsg.value = '';

  try {
    const blob = await downloadAdminCsv();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biai-records.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not download the CSV.';
  } finally {
    isDownloading.value = false;
  }
}

async function importCsv() {
  if (isImporting.value) return;

  let csv = importText.value.trim();
  if (!csv && importInputRef.value?.files?.[0]) {
    csv = await importInputRef.value.files[0].text();
  }
  if (!csv) {
    importMsg.value = 'Choose a CSV file or paste CSV text first.';
    return;
  }

  isImporting.value = true;
  importMsg.value = '';
  try {
    const result = await importRecordsCsv(csv);
    importMsg.value = `Imported ${result.imported}, skipped ${result.skipped}.`;
    if (result.errors?.length) importMsg.value += ` First issue: ${result.errors[0]}`;
    importText.value = '';
    if (importInputRef.value) importInputRef.value.value = '';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    importMsg.value = error.message || 'Import failed.';
  } finally {
    isImporting.value = false;
  }
}

function toggleCsvPanel() {
  activeTab.value = activeTab.value === 'csv' ? 'records' : 'csv';
}

async function logout() {
  emit('logout');
}

async function leaveToSite() {
  try {
    await logoutAdmin();
  } catch {
    // Ensure leaving the admin page still wipes client session markers.
  }
  clearAdminMarkers();
  window.location.assign('/');
}

function formatPhotoSize(bytes) {
  if (!bytes) return '—';
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const photoBlobUrls = reactive({});
let dashboardUnmounted = false;

function photoCacheKey(photo) {
  return `${photo.photoId}:${photo.capturedAt || ''}`;
}

async function syncPhotoBlobUrls(list) {
  const activeKeys = new Set(list.map(photoCacheKey));
  for (const key of Object.keys(photoBlobUrls)) {
    if (!activeKeys.has(key)) {
      URL.revokeObjectURL(photoBlobUrls[key]);
      delete photoBlobUrls[key];
    }
  }

  const missing = list.filter((photo) => !photoBlobUrls[photoCacheKey(photo)]);
  if (!missing.length) return;

  await Promise.allSettled(
    missing.map(async (photo) => {
      const key = photoCacheKey(photo);
      const url = await fetchAdminPhotoBlobUrl(photo.photoId);
      if (dashboardUnmounted) {
        URL.revokeObjectURL(url);
        return;
      }
      photoBlobUrls[key] = url;
    })
  );
}

function photoImageSrc(photo) {
  return photoBlobUrls[photoCacheKey(photo)] || '';
}

async function savePhotoFile(photo) {
  if (busyPhotoId.value) return;
  busyPhotoId.value = photo.photoId;
  errorMsg.value = '';
  try {
    const { blob, filename } = await downloadAdminPhoto(photo);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not download winner photo.';
  } finally {
    busyPhotoId.value = '';
  }
}

async function removePhoto(photo) {
  if (busyPhotoId.value) return;
  if (!window.confirm(`Delete the photo for "${photo.winnerName}"? This cannot be undone.`)) {
    return;
  }

  busyPhotoId.value = photo.photoId;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    await deleteAdminPhoto(photo.photoId);
    if (previewPhoto.value?.photoId === photo.photoId) {
      previewPhoto.value = null;
    }
    successMsg.value = 'Winner photo deleted.';
    await refreshAll({ quiet: true });
  } catch (error) {
    if (error.status === 404) {
      emit('expired');
      return;
    }
    errorMsg.value = error.message || 'Could not delete the winner photo.';
  } finally {
    busyPhotoId.value = '';
  }
}

onMounted(async () => {
  await refreshAll();
  refreshTimer = setInterval(() => refreshAll({ quiet: true }), 15000);
});

onBeforeUnmount(() => {
  dashboardUnmounted = true;
  if (refreshTimer) clearInterval(refreshTimer);
  for (const key of Object.keys(photoBlobUrls)) {
    URL.revokeObjectURL(photoBlobUrls[key]);
    delete photoBlobUrls[key];
  }
});
</script>

<template>
  <main class="admin-shell">
    <header class="admin-shell__head">
      <div class="admin-shell__identity">
        <div class="admin-shell__kicker">
          <p class="admin-shell__eyebrow">BIAI event operations</p>
          <span class="admin-live">Live</span>
        </div>
        <div class="admin-shell__title-row">
          <h1 class="admin-shell__title">ADMIN CONSOLE</h1>
          <p class="admin-shell__sub">
            <span>Signed in as</span>
            <strong class="admin-user-pill">{{ admin.username }}</strong>
            <span class="admin-shell__meta-sep" aria-hidden="true">·</span>
            <span>Auto-sync 15s</span>
          </p>
        </div>
      </div>

      <div class="admin-head-actions">
        <button
          type="button"
          class="btn btn--compact admin-csv-btn"
          :class="{ 'admin-csv-btn--active': activeTab === 'csv' }"
          aria-label="Open CSV and backup"
          @click="toggleCsvPanel"
        >
          CSV / BACKUP
        </button>
        <button type="button" class="btn btn--compact admin-ghost-btn" @click="leaveToSite">
          EVENT SITE
        </button>
        <button
          type="button"
          class="btn btn--compact admin-ghost-btn"
          :disabled="isLoading"
          @click="refreshAll()"
        >
          {{ isLoading ? 'REFRESHING…' : 'REFRESH' }}
        </button>
        <button type="button" class="btn btn--compact btn--danger admin-logout-btn" @click="logout">
          LOG OUT
        </button>
      </div>
    </header>

    <div class="admin-nav-row">
      <nav class="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          v-for="tab in [
            { key: 'records', label: 'RECORDS', count: records.length },
            { key: 'photos', label: 'WINNER PHOTOS', count: winnerPhotos.length },
            { key: 'dart', label: 'MANUAL ENTRY', count: dartRecords.length },
            { key: 'odds', label: 'WHEEL ODDS', count: activeOddsCount },
            { key: 'audit', label: 'AUDIT LOG', count: auditEntries.length },
          ]"
          :key="tab.key"
          type="button"
          role="tab"
          class="admin-tab"
          :class="{ 'admin-tab--active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          <span>{{ tab.label }}</span>
          <span class="admin-tab__count num">{{ tab.count }}</span>
        </button>
      </nav>

      <Transition name="panel-swap">
        <div v-if="errorMsg || successMsg" class="admin-status-banners" aria-live="polite">
          <p v-if="errorMsg" class="admin-banner admin-banner--error">{{ errorMsg }}</p>
          <p v-if="successMsg" class="admin-banner admin-banner--success">{{ successMsg }}</p>
        </div>
      </Transition>
    </div>

    <section
      v-if="activeTab === 'records'"
      key="records"
      class="admin-panel admin-panel--single admin-panel--records"
      aria-label="All records"
    >
      <div class="admin-toolbar">
        <div class="admin-source-pills" role="group" aria-label="Filter by source">
          <button
            v-for="option in sourceOptions"
            :key="option.value || 'all'"
            type="button"
            class="admin-source-pill"
            :class="{ 'admin-source-pill--active': recordSource === option.value }"
            :aria-pressed="recordSource === option.value"
            @click="recordSource = option.value"
          >
            <span>{{ option.label }}</span>
            <span class="admin-source-pill__count num">{{ option.count }}</span>
          </button>
        </div>

        <div class="admin-toolbar__right">
          <label class="visually-hidden" for="record-search">Search records</label>
          <input
            id="record-search"
            v-model="searchQuery"
            type="search"
            class="field__input admin-search-input"
            placeholder="Search name, phone, reward…"
          />
          <span class="admin-count-chip num">
            {{ filteredRecords.length }} {{ filteredRecords.length === 1 ? 'record' : 'records' }}
          </span>
        </div>
      </div>

      <div class="admin-stage" tabindex="0" aria-label="Scrollable records list">
        <table v-if="filteredRecords.length" class="entries-table admin-table--fixed">
          <thead>
            <tr>
              <th scope="col" class="col-source">Source</th>
              <th scope="col" class="col-name">Name</th>
              <th scope="col" class="col-phone">Phone</th>
              <th scope="col" class="col-email">Email</th>
              <th scope="col" class="col-reward">Reward</th>
              <th scope="col" class="col-game">Game</th>
              <th scope="col" class="col-time">Timestamp</th>
              <th scope="col" class="col-action">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record.recordId">
              <td data-label="Source">
                <span class="source-badge" :class="`source-badge--${record.source}`">
                  {{ sourceLabel(record.source) }}
                </span>
              </td>
              <td data-label="Name" class="cell-strong" :title="displayName(record)">
                {{ displayName(record) }}
              </td>
              <td data-label="Phone" class="num" :title="record.phone || '—'">
                {{ record.phone || '—' }}
              </td>
              <td data-label="Email" class="cell-muted" :title="record.email || '—'">
                {{ record.email || '—' }}
              </td>
              <td data-label="Reward" :title="record.reward || record.result || '—'">
                {{ record.reward || record.result || '—' }}
              </td>
              <td data-label="Game" :title="record.game || '—'">{{ record.game || '—' }}</td>
              <td data-label="Timestamp" class="num cell-muted" :title="formatTime(record.timestamp)">
                {{ formatTime(record.timestamp) }}
              </td>
              <td data-label="Action" class="cell-action">
                <button
                  type="button"
                  class="btn btn--mini btn--danger"
                  :disabled="busyDeleteId === record.recordId"
                  @click="removeRecord(record)"
                >
                  {{ busyDeleteId === record.recordId ? 'DELETING' : 'DELETE' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="admin-empty">
          <p class="empty-state">No records match this filter.</p>
          <button v-if="recordSource || searchQuery" type="button" class="btn btn--mini" @click="resetFilters">
            SHOW ALL RECORDS
          </button>
        </div>
      </div>
    </section>

    <section
      v-else-if="activeTab === 'dart'"
      key="dart"
      class="admin-panel admin-panel--single admin-panel--dart"
      aria-label="Manual entry logger"
    >
      <div class="admin-dart-grid">
        <form class="admin-dart-form" novalidate @submit.prevent="saveDart">
          <h2 class="admin-subhead admin-subhead--flush">
            {{ editingRecordId ? 'EDIT MANUAL ENTRY' : 'LOG A MANUAL RESULT' }}
          </h2>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="dart-name">Player name <span class="field__req">*</span></label>
              <input id="dart-name" v-model="dartForm.name" class="field__input field__input--dense" type="text" />
            </div>
            <div class="field">
              <label class="field__label" for="dart-game">Game <span class="field__req">*</span></label>
              <input
                id="dart-game"
                v-model="dartForm.game"
                class="field__input field__input--dense"
                type="text"
                placeholder="e.g. Darts, Quiz, Wheel"
                aria-required="true"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="dart-phone">Phone <span class="field__optional">(optional)</span></label>
              <input id="dart-phone" v-model="dartForm.phone" class="field__input field__input--dense" type="tel" />
            </div>
            <div class="field">
              <label class="field__label" for="dart-email">Email <span class="field__optional">(optional)</span></label>
              <input id="dart-email" v-model="dartForm.email" class="field__input field__input--dense" type="email" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="dart-result">Score / result</label>
              <input id="dart-result" v-model="dartForm.result" class="field__input field__input--dense" type="text" placeholder="e.g. 42 points" />
            </div>
            <div class="field">
              <label class="field__label" for="dart-reward">Reward</label>
              <input id="dart-reward" v-model="dartForm.reward" class="field__input field__input--dense" type="text" placeholder="e.g. Stickers" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="dart-timestamp">Timestamp</label>
            <input id="dart-timestamp" v-model="dartForm.timestamp" class="field__input field__input--dense" type="datetime-local" />
          </div>

          <div class="dialog__actions">
            <button type="submit" class="btn btn--compact btn--primary" :disabled="isSaving">
              {{ isSaving ? 'SAVING' : editingRecordId ? 'SAVE CHANGES' : 'SAVE MANUAL ENTRY' }}
            </button>
            <button v-if="editingRecordId" type="button" class="btn btn--compact" :disabled="isSaving" @click="resetDartForm">
              CANCEL
            </button>
          </div>
        </form>

        <div class="admin-panel admin-panel--records admin-subpanel">
          <div class="admin-toolbar">
            <h2 class="admin-subhead admin-subhead--flush">RECENT MANUAL ENTRIES</h2>
            <span class="admin-count-chip num">{{ dartRecords.length }} total</span>
          </div>

          <div class="admin-stage" tabindex="0" aria-label="Scrollable manual entries">
            <table v-if="dartRecords.length" class="entries-table admin-table--fixed">
              <thead>
                <tr>
                  <th scope="col" class="col-name">Name</th>
                  <th scope="col" class="col-game">Game</th>
                  <th scope="col" class="col-reward">Result / Reward</th>
                  <th scope="col" class="col-time">Timestamp</th>
                  <th scope="col" class="col-action-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in dartRecords" :key="record.recordId">
                  <td data-label="Name" class="cell-strong" :title="displayName(record)">
                    {{ displayName(record) }}
                  </td>
                  <td data-label="Game" :title="record.game || '—'">{{ record.game || '—' }}</td>
                  <td
                    data-label="Result / Reward"
                    :title="[record.result, record.reward].filter(Boolean).join(' · ') || '—'"
                  >
                    {{ [record.result, record.reward].filter(Boolean).join(' · ') || '—' }}
                  </td>
                  <td data-label="Timestamp" class="num cell-muted">{{ formatTime(record.timestamp) }}</td>
                  <td data-label="Actions" class="cell-action">
                    <div class="admin-row-actions">
                      <button type="button" class="btn btn--mini" @click="startEdit(record)">EDIT</button>
                      <button
                        type="button"
                        class="btn btn--mini btn--danger"
                        :disabled="busyDeleteId === record.recordId"
                        @click="removeDart(record)"
                      >
                        {{ busyDeleteId === record.recordId ? 'DELETING' : 'DELETE' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="empty-state admin-empty">No manual entries yet.</p>
          </div>
        </div>
      </div>
    </section>

    <section
      v-else-if="activeTab === 'csv'"
      key="csv"
      class="admin-panel admin-panel--single admin-panel--csv"
      aria-label="CSV and backup"
    >
      <div class="admin-toolbar">
        <div class="dialog__actions">
          <button type="button" class="btn btn--compact btn--primary" :disabled="isRebuilding" @click="rebuildCsv">
            {{ isRebuilding ? 'REBUILDING' : 'RESTORE / REBUILD CSV NOW' }}
          </button>
          <button type="button" class="btn btn--compact" :disabled="isDownloading" @click="downloadCsv">
            {{ isDownloading ? 'PREPARING' : 'DOWNLOAD CSV' }}
          </button>
          <button type="button" class="btn btn--compact" @click="activeTab = 'records'">
            BACK TO RECORDS
          </button>
        </div>
        <span class="recent-sub">MongoDB → records.csv → snapshots</span>
      </div>

      <div class="admin-csv-split">
        <pre class="admin-csv admin-csv--fill">{{ csvText || 'No records yet.' }}</pre>

        <div class="admin-dart-form admin-import">
          <h2 class="admin-subhead admin-subhead--flush">IMPORT RECORDS FROM CSV</h2>
          <div class="field">
            <label class="field__label" for="admin-import-file">CSV file</label>
            <input
              id="admin-import-file"
              ref="importInputRef"
              type="file"
              accept=".csv,text/csv"
              class="field__input field__input--dense admin-file"
            />
          </div>
          <div class="field">
            <label class="field__label" for="admin-import-text">Or paste CSV text</label>
            <textarea
              id="admin-import-text"
              v-model="importText"
              class="field__input admin-textarea"
              rows="5"
              placeholder="name,phone,email,reward,timestamp,source"
            ></textarea>
          </div>
          <p class="form-help">Expected header: name,phone,email,reward,timestamp,source</p>
          <p v-if="importMsg" class="form-help form-help--success" aria-live="polite">{{ importMsg }}</p>
          <div class="dialog__actions">
            <button type="button" class="btn btn--compact btn--primary" :disabled="isImporting" @click="importCsv">
              {{ isImporting ? 'IMPORTING' : 'IMPORT CSV' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section
      v-else-if="activeTab === 'audit'"
      key="audit"
      class="admin-panel admin-panel--single admin-panel--records"
      aria-label="Admin audit log"
    >
      <div class="admin-toolbar">
        <h2 class="admin-subhead admin-subhead--flush">ADMIN AUDIT LOG</h2>
        <span class="admin-count-chip num">{{ auditEntries.length }} events</span>
      </div>

      <div class="admin-stage" tabindex="0" aria-label="Scrollable audit log">
        <ul v-if="auditEntries.length" class="admin-recent admin-recent--padded">
          <li v-for="entry in auditEntries" :key="entry.id">
            <span class="admin-audit-action">{{ entry.action }}</span>
            <span>{{ entry.details?.name || entry.details?.recordId || entry.details?.username || '—' }}</span>
            <time class="num" :datetime="entry.timestamp">{{ formatTime(entry.timestamp) }}</time>
          </li>
        </ul>
        <p v-else class="empty-state admin-empty">No admin actions logged yet.</p>
      </div>
    </section>

    <section
      v-else-if="activeTab === 'photos'"
      key="photos"
      class="admin-panel admin-panel--single admin-panel--records"
      aria-label="Winner photos gallery"
    >
      <div class="admin-toolbar">
        <h2 class="admin-subhead admin-subhead--flush">WINNER PHOTO GALLERY</h2>
        <span class="admin-count-chip num">
          {{ winnerPhotos.length }} {{ winnerPhotos.length === 1 ? 'photo' : 'photos' }} · ≤ 50 KB each
        </span>
      </div>

      <div class="admin-stage" tabindex="0" aria-label="Scrollable winner photo gallery">
        <div v-if="winnerPhotos.length" class="admin-photo-grid">
          <article v-for="photo in winnerPhotos" :key="photo.photoId" class="admin-photo-card">
            <button
              type="button"
              class="admin-photo-card__media"
              :aria-label="`Preview photo for ${photo.winnerName}`"
              @click="previewPhoto = photo"
            >
              <img
                v-if="photoImageSrc(photo)"
                :src="photoImageSrc(photo)"
                :alt="`BIAI winner photo of ${photo.winnerName}`"
                loading="lazy"
              />
              <span class="admin-photo-card__size num">{{ formatPhotoSize(photo.sizeBytes) }}</span>
            </button>

            <div class="admin-photo-card__body">
              <strong class="admin-photo-card__name" :title="photo.winnerName">{{ photo.winnerName }}</strong>
              <span class="admin-photo-card__meta">
                {{ [photo.game, photo.prizeTitle].filter(Boolean).join(' · ') || 'Winner' }}
              </span>
              <time class="admin-photo-card__time num" :datetime="photo.capturedAt">
                {{ formatTime(photo.capturedAt) }}
              </time>

              <div class="admin-photo-card__actions">
                <button
                  type="button"
                  class="btn btn--mini btn--primary"
                  :disabled="busyPhotoId === photo.photoId"
                  @click="savePhotoFile(photo)"
                >
                  {{ busyPhotoId === photo.photoId ? 'SAVING…' : 'DOWNLOAD' }}
                </button>
                <button
                  type="button"
                  class="btn btn--mini btn--danger"
                  :disabled="busyPhotoId === photo.photoId"
                  @click="removePhoto(photo)"
                >
                  DELETE
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="empty-state admin-empty">No winner photos saved yet.</p>
      </div>
    </section>

    <section v-else-if="activeTab === 'odds'" class="admin-panel">
      <div class="admin-toolbar">
        <div class="admin-toolbar__filters">
          <span class="admin-toolbar__summary">
            Live wheel weights · Total: <strong class="num">{{ draftTotalWeight }}</strong>
          </span>
        </div>
        <div class="admin-row-actions">
          <button
            type="button"
            class="btn btn--compact"
            :disabled="isSavingOdds"
            @click="resetOdds"
          >
            RESET DEFAULTS
          </button>
          <button
            type="button"
            class="btn btn--compact btn--primary"
            :disabled="isSavingOdds || draftTotalWeight <= 0"
            @click="saveOdds"
          >
            {{ isSavingOdds ? 'SAVING…' : 'SAVE ODDS' }}
          </button>
        </div>
      </div>

      <div class="admin-table-wrap admin-stage" tabindex="0">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Wheel Option</th>
              <th>Category</th>
              <th>Weight</th>
              <th>Live Chance</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in wheelOdds" :key="item.id">
              <td><strong>{{ item.title }}</strong></td>
              <td>{{ item.category }}</td>
              <td>
                <input
                  v-model.number="oddsDraft[item.id]"
                  type="number"
                  min="0"
                  step="1"
                  class="field__input"
                  style="max-width: 100px; padding: 6px 10px;"
                  :aria-label="`Weight for ${item.title}`"
                  @input="oddsDirty = true"
                />
              </td>
              <td class="num"><strong>{{ draftPercent(item.id) }}</strong></td>
              <td class="num">{{ item.defaultWeight }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="previewPhoto"
      class="admin-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="`Winner photo preview for ${previewPhoto.winnerName}`"
      @click.self="previewPhoto = null"
    >
      <div class="admin-lightbox__card">
        <img
          v-if="photoImageSrc(previewPhoto)"
          :src="photoImageSrc(previewPhoto)"
          :alt="`Full preview of ${previewPhoto.winnerName}`"
          class="admin-lightbox__img"
        />
        <div class="admin-lightbox__bar">
          <div>
            <strong>{{ previewPhoto.winnerName }}</strong>
            <span>{{ formatPhotoSize(previewPhoto.sizeBytes) }} · {{ formatTime(previewPhoto.capturedAt) }}</span>
          </div>
          <div class="admin-row-actions">
            <button type="button" class="btn btn--mini btn--primary" @click="savePhotoFile(previewPhoto)">
              DOWNLOAD
            </button>
            <button type="button" class="btn btn--mini" @click="previewPhoto = null">
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
