<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { claimPlay, fetchPrizes, spinWheel } from './api/client.js';
import { ADMIN_HASH_BASE } from './admin/path.js';
import ChoiceScreen from './components/ChoiceScreen.vue';
import ClaimPanel from './components/ClaimPanel.vue';
import NavBar from './components/NavBar.vue';
import PrizeLedger from './components/PrizeLedger.vue';
import QuizPanel from './components/QuizPanel.vue';
import SpinningWheel from './components/SpinningWheel.vue';

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
const stage = ref('landing');
const chosenGame = ref('');
const quizKey = ref(0);

const isSpinning = ref(false);
const spinTrigger = ref(null);
const wheelNotice = ref(null);
const wheelLandedPrizeId = ref('');

const claimResult = ref(null);
const claimSaved = ref(null);
const claimSubmitting = ref(false);
const claimError = ref('');
const claimErrorField = ref(null);

let revealObserver = null;

const canSpin = computed(
  () => stage.value === 'wheel' && !isSpinning.value && !claimResult.value
);

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
});

onBeforeUnmount(() => {
  revealObserver?.disconnect();
  document.body.style.overflow = '';
});

watch(claimResult, (value) => {
  document.body.style.overflow = value ? 'hidden' : '';
});

function resetClaim() {
  claimResult.value = null;
  claimSaved.value = null;
  claimSubmitting.value = false;
  claimError.value = '';
  claimErrorField.value = null;
}

function resetRound() {
  spinTrigger.value = null;
  wheelNotice.value = null;
  wheelLandedPrizeId.value = '';
  isSpinning.value = false;
  resetClaim();
}

function startGame(game) {
  chosenGame.value = game;
  resetRound();
  if (game === 'quiz') {
    quizKey.value += 1;
    stage.value = 'quiz';
    return;
  }
  stage.value = 'wheel';
}

function handleBackToGames() {
  resetRound();
  stage.value = 'landing';
  chosenGame.value = '';
}

async function handleSpin() {
  if (!canSpin.value) return;

  isSpinning.value = true;
  spinTrigger.value = null;
  wheelNotice.value = null;
  wheelLandedPrizeId.value = '';
  resetClaim();

  try {
    const result = await spinWheel();
    spinTrigger.value = { ...result, nonce: Date.now() };
  } catch (error) {
    isSpinning.value = false;
    wheelNotice.value = {
      tone: 'error',
      text: error.message || 'The wheel could not spin. Please try again.',
    };
  }
}

function handleSpinComplete(result) {
  if (stage.value !== 'wheel') return;

  isSpinning.value = false;

  if (result.claimable) {
    wheelLandedPrizeId.value = result.prize?.id || '';
    claimResult.value = {
      game: 'wheel',
      playId: result.playId,
      prizeId: result.prize?.id || '',
      prizeTitle: result.prize?.title || 'a prize',
      claimCode: result.claimCode || '',
      segmentIndex: result.segmentIndex,
    };
    return;
  }

  wheelLandedPrizeId.value = '';

  if (result.spinAgain) {
    wheelNotice.value = {
      tone: 'again',
      text: 'Spin Again! You get another free turn.',
    };
    return;
  }

  wheelNotice.value = {
    tone: 'none',
    text: 'No prize this time. Give it another spin.',
  };
}

function handleQuizFinished(result) {
  if (stage.value !== 'quiz') return;

  claimResult.value = {
    game: 'quiz',
    playId: result.playId,
    score: result.score,
    total: result.total,
  };
}

async function handleClaim(payload) {
  if (!claimResult.value || claimSubmitting.value) return;

  claimSubmitting.value = true;
  claimError.value = '';
  claimErrorField.value = null;

  try {
    const saved = await claimPlay({
      playId: claimResult.value.playId,
      ...payload,
    });
    claimSaved.value = saved;
  } catch (error) {
    claimError.value = error.message || 'Could not save your details. Please try again.';
    claimErrorField.value = error.field || null;
  } finally {
    claimSubmitting.value = false;
  }
}

function handlePlayAgain() {
  const game = chosenGame.value || claimResult.value?.game || 'wheel';
  startGame(game);
}

function handleHubClick() {
  if (stage.value !== 'wheel') return;
  handleSpin();
}
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>

  <NavBar />

  <main id="main">
    <section v-if="stage === 'landing'" class="landing-section" aria-label="Choose a game">
      <div class="container">
        <ChoiceScreen
          @quiz="startGame('quiz')"
          @wheel="startGame('wheel')"
        />
      </div>
    </section>

    <section v-else-if="stage === 'quiz'" class="quiz-section" aria-label="AI literacy quiz">
      <div class="container">
        <QuizPanel
          :key="quizKey"
          @back="handleBackToGames"
          @finished="handleQuizFinished"
        />
      </div>
    </section>

    <section v-else class="hero" aria-label="BIAI prize wheel game">
      <div class="container hero__grid">
        <div class="hero__copy">
          <p class="entry-section__eyebrow">Prize round</p>
          <h1>SPIN WITH BIAI.<br />CLAIM YOUR PRIZE.</h1>
          <p class="lead hero__lead">
            No sign-up needed. Take your spin first — we only ask for your details if you win.
          </p>

          <div class="btn-pair">
            <button
              type="button"
              class="btn btn--primary"
              :disabled="!canSpin"
              :aria-busy="isSpinning ? 'true' : 'false'"
              @click="handleSpin"
            >
              {{ isSpinning ? 'SPINNING…' : 'SPIN THE WHEEL' }}
            </button>
            <button type="button" class="btn" @click="handleBackToGames">
              BACK TO GAMES
            </button>
          </div>

          <p
            v-if="wheelNotice"
            class="wheel-notice"
            :class="`wheel-notice--${wheelNotice.tone}`"
            aria-live="polite"
          >
            {{ wheelNotice.text }}
          </p>

          <p class="form-consent">
            Play first. Share your name and phone number only after you win so we can arrange
            your prize. Email is optional.
          </p>
        </div>

        <SpinningWheel
          :prizes="prizes"
          :can-spin="canSpin"
          :won-prize-id="wheelLandedPrizeId"
          :spin-trigger="spinTrigger"
          :is-spinning="isSpinning"
          @hub-click="handleHubClick"
          @spin-complete="handleSpinComplete"
        />
      </div>
    </section>

    <ClaimPanel
      v-if="claimResult"
      :result="claimResult"
      :saved="claimSaved"
      :is-submitting="claimSubmitting"
      :error="claimError"
      :error-field="claimErrorField"
      @claim="handleClaim"
      @play-again="handlePlayAgain"
      @back-to-games="handleBackToGames"
    />

    <PrizeLedger :prizes="prizes" :won-prize-id="wheelLandedPrizeId" />
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
