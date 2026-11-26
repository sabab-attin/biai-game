<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  createDartRecord,
  deleteAdminRecord,
  deleteDartRecord,
  downloadAdminCsv,
  fetchAdminCsv,
  fetchAdminRecords,
  fetchAuditLog,
  fetchDartRecords,
  importRecordsCsv,
  rebuildAdminCsv,
  updateDartRecord,
} from './api.js';

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
const csvText = ref('');
const auditEntries = ref([]);
const recordSource = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const isRebuilding = ref(false);
const isDownloading = ref(false);
const isImporting = ref(false);
const busyDeleteId = ref('');
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

const filteredRecords = computed(() => {
  if (!recordSource.value) return records.value;
  return records.value.filter((record) => record.source === recordSource.value);
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
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function sourceLabel(source) {
  return { wheel: 'Wheel', quiz: 'Quiz', dart: 'Manual' }[source] || source;
}

function displayName(record) {
  return record.name || '—';
}

async function refreshAll({ quiet = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  if (!quiet) isLoading.value = true;
  if (!quiet) errorMsg.value = '';

  try {
    const [recordsData, dartData, csv, auditData] = await Promise.all([
      fetchAdminRecords({ limit: 250 }),
      fetchDartRecords(),
      fetchAdminCsv(),
      fetchAuditLog(),
    ]);

    records.value = recordsData.records;
    dartRecords.value = dartData.records;
    csvText.value = typeof csv === 'string' ? csv : '';
    auditEntries.value = auditData.entries;
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

onMounted(async () => {
  await refreshAll();
  refreshTimer = setInterval(() => refreshAll({ quiet: true }), 15000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <main class="admin-shell">
    <header class="admin-shell__head">
      <div>
        <p class="admin-shell__eyebrow">BIAI event operations</p>
        <h1 class="admin-shell__title">ADMIN CONSOLE</h1>
        <p class="admin-shell__sub">
          Signed in as <strong>{{ admin.username }}</strong>
          <span class="admin-live">Live</span>
        </p>
      </div>

      <div class="dialog__actions">
        <button type="button" class="btn btn--compact" :disabled="isLoading" @click="refreshAll()">
          {{ isLoading ? 'REFRESHING' : 'REFRESH' }}
        </button>
        <button type="button" class="btn btn--compact" @click="logout">LOG OUT</button>
      </div>
    </header>

    <p v-if="errorMsg" class="form-help form-help--error" aria-live="polite">{{ errorMsg }}</p>
    <p v-if="successMsg" class="form-help form-help--success" aria-live="polite">
      {{ successMsg }}
    </p>

    <nav class="admin-tabs" role="tablist" aria-label="Admin sections">
      <button
        v-for="tab in [
          { key: 'records', label: 'RECORDS' },
          { key: 'dart', label: 'MANUAL ENTRY' },
          { key: 'audit', label: 'AUDIT LOG' },
        ]"
        :key="tab.key"
        type="button"
        role="tab"
        class="admin-tab"
        :class="{ 'admin-tab--active': activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'records'" class="admin-panel" aria-label="All records">
      <div class="admin-toolbar">
        <div class="field admin-filter">
          <label class="field__label" for="record-source">Filter by source</label>
          <select id="record-source" v-model="recordSource" class="field__input">
            <option value="">All sources</option>
            <option value="wheel">Wheel</option>
            <option value="quiz">Quiz</option>
            <option value="dart">Manual entry</option>
          </select>
        </div>
        <span class="recent-sub">{{ filteredRecords.length }} shown</span>
      </div>

      <div v-if="filteredRecords.length" class="table-wrap">
        <table class="entries-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Name</th>
              <th scope="col">Phone</th>
              <th scope="col">Email</th>
              <th scope="col">Reward</th>
              <th scope="col">Game</th>
              <th scope="col">Timestamp</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in filteredRecords" :key="record.recordId">
              <td data-label="Source"><span class="source-badge" :class="`source-badge--${record.source}`">{{ sourceLabel(record.source) }}</span></td>
              <td data-label="Name">{{ displayName(record) }}</td>
              <td data-label="Phone">{{ record.phone || '—' }}</td>
              <td data-label="Email">{{ record.email || '—' }}</td>
              <td data-label="Reward">{{ record.reward || record.result || '—' }}</td>
              <td data-label="Game">{{ record.game || '—' }}</td>
              <td data-label="Timestamp">{{ formatTime(record.timestamp) }}</td>
              <td data-label="Action">
                <button
                  type="button"
                  class="btn btn--compact btn--danger"
                  :disabled="busyDeleteId === record.recordId"
                  @click="removeRecord(record)"
                >
                  {{ busyDeleteId === record.recordId ? 'DELETING' : 'DELETE' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">No records match this filter.</p>
    </section>

    <section v-else-if="activeTab === 'dart'" class="admin-panel" aria-label="Manual entry logger">
      <div class="admin-dart-grid">
        <form class="admin-dart-form" novalidate @submit.prevent="saveDart">
          <h2 class="admin-subhead">{{ editingRecordId ? 'EDIT MANUAL ENTRY' : 'LOG A MANUAL RESULT' }}</h2>

          <div class="field">
            <label class="field__label" for="dart-name">Player name <span class="field__req">(required)</span></label>
            <input id="dart-name" v-model="dartForm.name" class="field__input" type="text" />
          </div>

          <div class="field">
            <label class="field__label" for="dart-game">Game <span class="field__req">(required)</span></label>
            <input
              id="dart-game"
              v-model="dartForm.game"
              class="field__input"
              type="text"
              placeholder="e.g. Darts, Quiz, Wheel"
              aria-required="true"
            />
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="dart-phone">Phone <span class="field__optional">(optional)</span></label>
              <input id="dart-phone" v-model="dartForm.phone" class="field__input" type="tel" />
            </div>
            <div class="field">
              <label class="field__label" for="dart-email">Email <span class="field__optional">(optional)</span></label>
              <input id="dart-email" v-model="dartForm.email" class="field__input" type="email" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="dart-result">Score / result</label>
              <input id="dart-result" v-model="dartForm.result" class="field__input" type="text" placeholder="e.g. 42 points" />
            </div>
            <div class="field">
              <label class="field__label" for="dart-reward">Reward</label>
              <input id="dart-reward" v-model="dartForm.reward" class="field__input" type="text" placeholder="e.g. Stickers" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="dart-timestamp">Timestamp</label>
            <input id="dart-timestamp" v-model="dartForm.timestamp" class="field__input" type="datetime-local" />
          </div>

          <div class="dialog__actions">
            <button type="submit" class="btn btn--primary" :disabled="isSaving">
              {{ isSaving ? 'SAVING' : editingRecordId ? 'SAVE CHANGES' : 'SAVE MANUAL ENTRY' }}
            </button>
            <button v-if="editingRecordId" type="button" class="btn" :disabled="isSaving" @click="resetDartForm">
              CANCEL
            </button>
          </div>
        </form>

        <div>
          <h2 class="admin-subhead">RECENT MANUAL ENTRIES</h2>
          <div v-if="dartRecords.length" class="table-wrap">
            <table class="entries-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Game</th>
                  <th scope="col">Result</th>
                  <th scope="col">Reward</th>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in dartRecords" :key="record.recordId">
                  <td data-label="Name">{{ displayName(record) }}</td>
                  <td data-label="Game">{{ record.game || '—' }}</td>
                  <td data-label="Result">{{ record.result || '—' }}</td>
                  <td data-label="Reward">{{ record.reward || '—' }}</td>
                  <td data-label="Timestamp">{{ formatTime(record.timestamp) }}</td>
                  <td data-label="Actions">
                    <div class="admin-row-actions">
                      <button type="button" class="btn btn--compact" @click="startEdit(record)">EDIT</button>
                      <button
                        type="button"
                        class="btn btn--compact btn--danger"
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
          </div>
          <p v-else class="empty-state">No manual entries yet.</p>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'csv'" class="admin-panel" aria-label="CSV and backup">
      <div class="admin-panel__head">
        <h2 class="admin-subhead">CSV / BACKUP</h2>
        <button type="button" class="btn btn--compact" @click="activeTab = 'records'">
          BACK TO RECORDS
        </button>
      </div>

      <div class="admin-toolbar">
        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" :disabled="isRebuilding" @click="rebuildCsv">
            {{ isRebuilding ? 'REBUILDING' : 'RESTORE / REBUILD CSV NOW' }}
          </button>
          <button type="button" class="btn" :disabled="isDownloading" @click="downloadCsv">
            {{ isDownloading ? 'PREPARING' : 'DOWNLOAD CSV' }}
          </button>
          <button type="button" class="btn" :disabled="isLoading" @click="refreshAll()">REFRESH</button>
        </div>
        <span class="recent-sub">MongoDB → records.csv → timestamped snapshots</span>
      </div>

      <pre class="admin-csv">{{ csvText || 'No records yet.' }}</pre>

      <details class="admin-import">
        <summary>Import records from CSV</summary>
        <div class="field">
          <label class="field__label" for="admin-import-file">CSV file</label>
          <input
            id="admin-import-file"
            ref="importInputRef"
            type="file"
            accept=".csv,text/csv"
            class="field__input admin-file"
          />
        </div>
        <div class="field">
          <label class="field__label" for="admin-import-text">Or paste CSV text</label>
          <textarea
            id="admin-import-text"
            v-model="importText"
            class="field__input admin-textarea"
            rows="6"
            placeholder="name,phone,email,reward,timestamp,source"
          ></textarea>
        </div>
        <p class="form-help">Expected header: name,phone,email,reward,timestamp,source</p>
        <p v-if="importMsg" class="form-help" aria-live="polite">{{ importMsg }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn" :disabled="isImporting" @click="importCsv">
            {{ isImporting ? 'IMPORTING' : 'IMPORT CSV' }}
          </button>
        </div>
      </details>
    </section>

    <section v-else-if="activeTab === 'audit'" class="admin-panel" aria-label="Admin audit log">
      <ul v-if="auditEntries.length" class="admin-recent">
        <li v-for="entry in auditEntries" :key="entry.id">
          <span>{{ entry.action }}</span>
          <span>{{ entry.details?.name || entry.details?.recordId || entry.details?.username || '—' }}</span>
          <time :datetime="entry.timestamp">{{ formatTime(entry.timestamp) }}</time>
        </li>
      </ul>
      <p v-else class="empty-state">No admin actions logged yet.</p>
    </section>

    <button
      type="button"
      class="admin-csv-fab"
      :class="{ 'admin-csv-fab--active': activeTab === 'csv' }"
      aria-label="Open CSV and backup"
      @click="toggleCsvPanel"
    >
      CSV<br />BACKUP
    </button>
  </main>
</template>
