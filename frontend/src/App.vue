<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  enterPlayer,
  fetchCurrentPlayer,
  fetchPrizes,
  fetchRecentSpins,
  fetchStats,
  spinWheel,
} from './api/client.js';
import BiaiMark from './components/BiaiMark.vue';
import BiaiShowcase from './components/BiaiShowcase.vue';
import EntryPanel from './components/EntryPanel.vue';
import HowAndRecent from './components/HowAndRecent.vue';
import NavBar from './components/NavBar.vue';
import OrganizerDialog from './components/OrganizerDialog.vue';
import PrizeLedger from './components/PrizeLedger.vue';
import SpinningWheel from './components/SpinningWheel.vue';
import StatsBand from './components/StatsBand.vue';

const TOKEN_KEY = 'carnival_wheel_token';

const FALLBACK_PRIZES = [
  {
    id: 'free-courses',
    title: 'Free Course',
    wheelLabel: 'FREE COURSE',
    category: 'BIAI pass',
    description: 'Complimentary seat in a live BIAI applied AI workshop or cohort session.',
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: 'chocolates',
    title: 'Chocolates',
    wheelLabel: 'CHOCOLATES',
    category: 'Booth treat',
    description: 'Hand-packed dark and milk chocolate box waiting at the BIAI event desk.',
    bgToken: '--color-accent',
    fgToken: '--color-accent-ink',
  },
  {
    id: 'gift-cards',
    title: 'Gift Card',
    wheelLabel: 'GIFT CARD',
    category: 'BIAI voucher',
    description: 'Prepaid BIAI reward voucher toward bootcamps, workshops, or shop gear.',
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
  {
    id: 'stickers',
    title: 'Stickers',
    wheelLabel: 'STICKERS',
    category: 'Builder pack',
    description: 'Die-cut screen-printed BIAI builder sticker sheet from this edition.',
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: 'wristbands',
    title: 'Wristbands',
    wheelLabel: 'WRISTBANDS',
    category: 'Event band',
    description: 'Woven BIAI festival wristband with brass clasp from the carnival booth.',
    bgToken: '--color-paper-3',
    fgToken: '--color-ink',
  },
];

const prizes = ref(FALLBACK_PRIZES);
const stats = ref({
  totalEntries: 0,
  totalSpins: 0,
  maxSpinsPerPlayer: 1,
  prizeCounts: {},
});
const recentSpins = ref([]);
const player = ref(null);
const sessionToken = ref('');

const isSubmittingEntry = ref(false);
const isSpinning = ref(false);
const entryError = ref('');
const entryErrorField = ref(null);
const spinTrigger = ref(null);
const adminOpen = ref(false);
const entryPanelRef = ref(null);
let revealObserver = null;

async function refreshPublicData() {
  try {
    const [statsData, recentData] = await Promise.all([fetchStats(), fetchRecentSpins()]);
    stats.value = statsData;
    recentSpins.value = recentData.recent || [];
  } catch {
    // Keep existing snapshot if temporary network issue occurs
  }
}

onMounted(async () => {
  const revealTargets = document.querySelectorAll('[data-reveal]');
  if (typeof IntersectionObserver !== 'undefined') {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  }

  try {
    const prizeData = await fetchPrizes();
    if (Array.isArray(prizeData?.prizes) && prizeData.prizes.length) {
      prizes.value = prizeData.prizes;
    }
  } catch {
    // Fallback prizes keep the wheel rendered cleanly
  }

  await refreshPublicData();

  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    try {
      const me = await fetchCurrentPlayer(savedToken);
      sessionToken.value = savedToken;
      player.value = me.player;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
});

onBeforeUnmount(() => {
  revealObserver?.disconnect();
});

async function handleEnter(formData) {
  isSubmittingEntry.value = true;
  entryError.value = '';
  entryErrorField.value = null;

  try {
    const data = await enterPlayer(formData);
    sessionToken.value = data.token;
    localStorage.setItem(TOKEN_KEY, data.token);
    player.value = data.player;
    await refreshPublicData();
  } catch (error) {
    entryError.value = error.message || 'Could not save entry.';
    entryErrorField.value = error.field || null;
  } finally {
    isSubmittingEntry.value = false;
  }
}

async function handleSpin() {
  if (!player.value || player.value.spinsRemaining <= 0 || isSpinning.value) return;

  isSpinning.value = true;
  entryError.value = '';

  try {
    const result = await spinWheel(sessionToken.value);
    spinTrigger.value = { ...result, nonce: Date.now() };
  } catch (error) {
    isSpinning.value = false;
    if (error.payload?.player) {
      player.value = error.payload.player;
    } else {
      entryError.value = error.message || 'Spin could not be completed.';
    }
  }
}

function handleHubClick() {
  if (!player.value) {
    entryPanelRef.value?.focusNameInput();
    return;
  }
  if (player.value.spinsRemaining > 0 && !isSpinning.value) {
    handleSpin();
  }
}

async function handleSpinComplete(result) {
  player.value = result.player;
  isSpinning.value = false;
  await refreshPublicData();
}

function handleSwitchPlayer() {
  localStorage.removeItem(TOKEN_KEY);
  sessionToken.value = '';
  player.value = null;
  spinTrigger.value = null;
  entryError.value = '';
  entryErrorField.value = null;
}
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>

  <NavBar @open-admin="adminOpen = true" />

  <main id="main">
    <section class="hero" aria-label="BIAI prize wheel login and game">
      <div class="container hero__grid">
        <div class="hero__copy">
          <h1>SPIN WITH BIAI.<br />CLAIM YOUR PRIZE.</h1>
          <p class="lead hero__lead">
            Bangladesh’s first applied AI institute. Enter your details to play.
          </p>

          <EntryPanel
            ref="entryPanelRef"
            :player="player"
            :is-submitting-entry="isSubmittingEntry"
            :is-spinning="isSpinning"
            :entry-error="entryError"
            :entry-error-field="entryErrorField"
            @enter="handleEnter"
            @spin="handleSpin"
            @switch-player="handleSwitchPlayer"
          />
        </div>

        <SpinningWheel
          :prizes="prizes"
          :is-logged-in="Boolean(player)"
          :can-spin="Boolean(player && player.spinsRemaining > 0)"
          :won-prize-id="player?.prizeId || ''"
          :spin-trigger="spinTrigger"
          :is-spinning="isSpinning"
          @hub-click="handleHubClick"
          @spin-complete="handleSpinComplete"
        />
      </div>
    </section>

    <StatsBand :prize-count="prizes.length" :stats="stats" />

    <PrizeLedger
      :prizes="prizes"
      :prize-counts="stats.prizeCounts"
      :won-prize-id="player?.prizeId || ''"
    />

    <BiaiShowcase />

    <HowAndRecent :recent-spins="recentSpins" />
  </main>

  <footer class="site-footer">
    <div class="container footer__inner">
      <div>
        <div class="footer__brand">
          <BiaiMark :size="24" />
          <span>BIAI PRIZE WHEEL</span>
        </div>
        <p class="footer__note">
          Bangladesh Institute of Artificial Intelligence, Bijoy Rakeen City, Mirpur, Dhaka-1216.
        </p>
      </div>

      <div class="footer__links">
        <a
          class="nav__link"
          href="https://biai.com.bd/"
          target="_blank"
          rel="noopener noreferrer"
        >
          biai.com.bd
        </a>
        <a
          class="nav__link"
          href="https://biai.com.bd/courses"
          target="_blank"
          rel="noopener noreferrer"
        >
          Courses
        </a>
        <a class="nav__link" href="mailto:support@biai.com.bd">
          support@biai.com.bd
        </a>
        <button type="button" class="nav__link" @click="adminOpen = true">
          Organizer CSV
        </button>
      </div>
    </div>
  </footer>

  <OrganizerDialog :open="adminOpen" @close="adminOpen = false" />
</template>
