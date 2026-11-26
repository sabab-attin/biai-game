<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  enterAsGuest,
  enterPlayer,
  fetchCurrentPlayer,
  fetchPrizes,
  spinWheel,
} from './api/client.js';
import { ADMIN_HASH_BASE } from './admin/path.js';
import BiaiCoursesMarquee from './components/BiaiCoursesMarquee.vue';
import ChoiceScreen from './components/ChoiceScreen.vue';
import EntryPanel from './components/EntryPanel.vue';
import NavBar from './components/NavBar.vue';
import PrizeLedger from './components/PrizeLedger.vue';
import QuizPanel from './components/QuizPanel.vue';
import SpinningWheel from './components/SpinningWheel.vue';

const TOKEN_KEY = 'carnival_wheel_token';

const FALLBACK_PRIZES = [
  {
    id: 'spin-again',
    title: 'Spin Again',
    wheelLabel: 'SPIN AGAIN',
    category: 'Bonus turn',
    description: 'One more turn at the wheel — the carnival gives you another go.',
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
  {
    id: 'nothing',
    title: 'Nothing',
    wheelLabel: 'NOTHING',
    category: 'Try again',
    description: 'A dry spin. No prize this time.',
    bgToken: '--color-paper-3',
    fgToken: '--color-ink',
  },
  {
    id: '80-off',
    title: '80% Off',
    wheelLabel: '80% OFF',
    category: 'BIAI discount',
    description: '80% off any BIAI course or bootcamp enrollment.',
    bgToken: '--color-accent-2',
    fgToken: '--color-paper',
  },
  {
    id: '10-off',
    title: '10% Off',
    wheelLabel: '10% OFF',
    category: 'BIAI discount',
    description: '10% off a BIAI course enrollment.',
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: '25-off',
    title: '25% Off',
    wheelLabel: '25% OFF',
    category: 'BIAI discount',
    description: '25% off a BIAI course enrollment.',
    bgToken: '--color-accent',
    fgToken: '--color-accent-ink',
  },
  {
    id: '50-off',
    title: '50% Off',
    wheelLabel: '50% OFF',
    category: 'BIAI discount',
    description: '50% off a BIAI course enrollment.',
    bgToken: '--color-navy',
    fgToken: '--color-paper',
  },
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
    id: 'stickers',
    title: 'Stickers',
    wheelLabel: 'STICKERS',
    category: 'Builder pack',
    description: 'Die-cut screen-printed BIAI builder sticker sheet from this edition.',
    bgToken: '--color-paper',
    fgToken: '--color-ink',
  },
  {
    id: 'notebook',
    title: 'Notebook',
    wheelLabel: 'NOTEBOOK',
    category: 'Stationery',
    description: 'BIAI carnival notebook for your next build.',
    bgToken: '--color-paper-3',
    fgToken: '--color-ink',
  },
];

const prizes = ref(FALLBACK_PRIZES);
const player = ref(null);
const sessionToken = ref('');
const stage = ref('landing');
const selectedIntent = ref('wheel');

const isSubmittingEntry = ref(false);
const isSpinning = ref(false);
const spinAgain = ref(false);
const entryError = ref('');
const entryErrorField = ref(null);
const spinTrigger = ref(null);
const entryPanelRef = ref(null);
let revealObserver = null;

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

  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    try {
      const me = await fetchCurrentPlayer(savedToken);
      sessionToken.value = savedToken;
      player.value = me.player;
      stage.value = 'landing';
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
    spinAgain.value = false;
    stage.value = selectedIntent.value || 'wheel';
  } catch (error) {
    entryError.value = error.message || 'Could not save entry.';
    entryErrorField.value = error.field || null;
  } finally {
    isSubmittingEntry.value = false;
  }
}

async function handleGuest() {
  isSubmittingEntry.value = true;
  entryError.value = '';
  entryErrorField.value = null;

  try {
    const data = await enterAsGuest();
    sessionToken.value = data.token;
    localStorage.setItem(TOKEN_KEY, data.token);
    player.value = data.player;
    spinAgain.value = false;
    stage.value = selectedIntent.value || 'wheel';
  } catch (error) {
    entryError.value = error.message || 'Could not start a guest session.';
  } finally {
    isSubmittingEntry.value = false;
  }
}

function handleSelectGame(game) {
  selectedIntent.value = game;
  entryError.value = '';
  entryErrorField.value = null;

  if (player.value) {
    stage.value = game;
    return;
  }
  stage.value = 'entry';
}

async function handleGoHome(selector = '') {
  entryError.value = '';
  entryErrorField.value = null;
  stage.value = 'landing';
  await nextTick();
  if (selector && selector !== '#top') {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function handleBackToLanding() {
  entryError.value = '';
  entryErrorField.value = null;
  stage.value = 'landing';
}

async function handleSpin() {
  if (!player.value || player.value.spinsRemaining <= 0 || isSpinning.value) return;

  isSpinning.value = true;
  spinAgain.value = false;
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
  if (stage.value !== 'wheel') {
    stage.value = 'wheel';
    return;
  }
  if (player.value.spinsRemaining > 0 && !isSpinning.value) {
    handleSpin();
  }
}

function handleSpinComplete(result) {
  player.value = result.player;
  isSpinning.value = false;
  spinAgain.value = Boolean(result.spinAgain);
}

function handleSwitchPlayer() {
  localStorage.removeItem(TOKEN_KEY);
  sessionToken.value = '';
  player.value = null;
  spinTrigger.value = null;
  spinAgain.value = false;
  selectedIntent.value = 'wheel';
  stage.value = 'landing';
  entryError.value = '';
  entryErrorField.value = null;
}
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>

  <NavBar @go-home="handleGoHome" />

  <main id="main">
    <section v-if="stage === 'landing'" class="landing-section" aria-label="Choose a game">
      <div class="container">
        <ChoiceScreen
          :player="player"
          @quiz="handleSelectGame('quiz')"
          @wheel="handleSelectGame('wheel')"
          @switch="handleSwitchPlayer"
        />
      </div>
    </section>

    <section v-else-if="stage === 'entry'" class="entry-section" aria-label="Player sign in">
      <div class="container entry-section__inner">
        <button
          type="button"
          class="btn btn--compact entry-section__back"
          @click="handleBackToLanding"
        >
          ← BACK TO GAMES
        </button>

        <p class="entry-section__eyebrow">
          {{ selectedIntent === 'quiz' ? 'Quiz entry' : 'Wheel entry' }}
        </p>
        <h1 class="entry-section__title">
          {{ selectedIntent === 'quiz' ? 'SIGN IN TO PLAY.' : 'SIGN IN TO SPIN.' }}
        </h1>
        <p class="entry-section__lead">
          {{
            selectedIntent === 'quiz'
              ? 'Enter your details to start the five-question AI literacy quiz.'
              : 'Enter your details to unlock your turn at the prize wheel.'
          }}
        </p>

        <EntryPanel
          ref="entryPanelRef"
          :player="player"
          :is-submitting-entry="isSubmittingEntry"
          :is-spinning="isSpinning"
          :spin-again="spinAgain"
          :entry-error="entryError"
          :entry-error-field="entryErrorField"
          @enter="handleEnter"
          @guest="handleGuest"
          @spin="handleSpin"
          @switch-player="handleSwitchPlayer"
        />
      </div>
    </section>

    <section v-else-if="stage === 'quiz'" class="quiz-section" aria-label="AI literacy quiz">
      <div class="container">
        <QuizPanel :token="sessionToken" @back="handleBackToLanding" />
      </div>
    </section>

    <section
      v-else
      class="hero"
      :class="{ 'hero--entered': stage === 'wheel' && player }"
      aria-label="BIAI prize wheel game"
    >
      <div class="container hero__grid">
        <div class="hero__copy">
          <h1>SPIN WITH BIAI.<br />CLAIM YOUR PRIZE.</h1>
          <p class="lead hero__lead">
            Bangladesh’s first applied AI institute. Your ticket is ready.
          </p>

          <EntryPanel
            ref="entryPanelRef"
            :player="player"
            :is-submitting-entry="isSubmittingEntry"
            :is-spinning="isSpinning"
            :spin-again="spinAgain"
            :entry-error="entryError"
            :entry-error-field="entryErrorField"
            @enter="handleEnter"
            @guest="handleGuest"
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

    <button
      v-if="stage === 'wheel' && player"
      type="button"
      class="btn btn--compact game-home-fab"
      @click="handleBackToLanding"
    >
      ← GAMES
    </button>

    <PrizeLedger
      v-if="stage === 'landing'"
      :prizes="prizes"
      :won-prize-id="player?.prizeId || ''"
    />

    <BiaiCoursesMarquee v-if="stage === 'landing'" />
  </main>

  <footer class="site-footer">
    <div class="container footer__inner">
      <div>
        <div class="footer__brand">
          <img
            class="footer__brand-logo"
            src="/biai-logo.png"
            width="24"
            height="24"
            alt=""
          />
          <span>BIAI</span>
        </div>
        <p class="footer__note">
          Bangladesh Institute of Artificial Intelligence, Bijoy Rakeen City, Mirpur, Dhaka-1216.
        </p>
      </div>

      <div class="footer__links">
        <a class="nav__link footer__admin" :href="ADMIN_HASH_BASE">admin</a>
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
      </div>
    </div>
  </footer>
</template>
