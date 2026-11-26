<script setup>
import { computed, onMounted, ref } from 'vue';
import { answerQuiz, finishQuiz, startQuiz } from '../api/client.js';

const emit = defineEmits(['back', 'finished']);

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const QUIZ_REWARD_TIERS = [
  { score: 1, title: 'Stickers' },
  { score: 2, title: '10% Off' },
  { score: 3, title: '25% Off' },
  { score: 4, title: '50% Off' },
  { score: 5, title: 'Free Course' },
];

const questions = ref([]);
const quizToken = ref('');
const currentIndex = ref(0);
const selectedOptionId = ref(null);
const feedback = ref(null);
const answers = ref([]);
const runningScore = ref(0);
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMsg = ref('');
const finalScore = ref(null);
const wonPrize = ref(null);
const total = ref(5);

const currentQuestion = computed(() => questions.value[currentIndex.value] || null);
const isLastQuestion = computed(
  () => currentIndex.value === questions.value.length - 1
);

async function loadQuiz() {
  isLoading.value = true;
  errorMsg.value = '';
  finalScore.value = null;
  wonPrize.value = null;
  questions.value = [];
  currentIndex.value = 0;
  selectedOptionId.value = null;
  feedback.value = null;
  answers.value = [];
  runningScore.value = 0;

  try {
    const data = await startQuiz();
    questions.value = data.questions;
    quizToken.value = data.token;
    total.value = data.total || data.questions.length;
  } catch (error) {
    errorMsg.value = error.message || 'Could not start the quiz.';
  } finally {
    isLoading.value = false;
  }
}

async function chooseOption(option) {
  if (feedback.value || isSubmitting.value || !currentQuestion.value) return;

  selectedOptionId.value = option.id;
  isSubmitting.value = true;
  errorMsg.value = '';

  try {
    const result = await answerQuiz({
      token: quizToken.value,
      questionId: currentQuestion.value.id,
      optionId: option.id,
    });

    feedback.value = result;
    if (result.correct) {
      runningScore.value += 1;
    }
    answers.value = [
      ...answers.value,
      { questionId: currentQuestion.value.id, optionId: option.id },
    ];
  } catch (error) {
    selectedOptionId.value = null;
    errorMsg.value = error.message || 'Could not check that answer.';
  } finally {
    isSubmitting.value = false;
  }
}

async function nextQuestion() {
  if (!feedback.value || isSubmitting.value) return;

  if (!isLastQuestion.value) {
    currentIndex.value += 1;
    selectedOptionId.value = null;
    feedback.value = null;
    errorMsg.value = '';
    return;
  }

  isSubmitting.value = true;
  errorMsg.value = '';

  try {
    const result = await finishQuiz({
      token: quizToken.value,
      answers: answers.value,
    });
    finalScore.value = result.score;
    total.value = result.total;
    wonPrize.value = result.prize || null;
    emit('finished', result);
  } catch (error) {
    errorMsg.value = error.message || 'Could not save your quiz score.';
  } finally {
    isSubmitting.value = false;
  }
}

function optionClass(option) {
  if (!feedback.value) {
    return { 'quiz-option--selected': selectedOptionId.value === option.id };
  }
  if (option.id === feedback.value.correctOptionId) {
    return { 'quiz-option--correct': true };
  }
  if (option.id === selectedOptionId.value && !feedback.value.correct) {
    return { 'quiz-option--wrong': true };
  }
  return {};
}

onMounted(loadQuiz);
</script>

<template>
  <section class="quiz-panel" aria-labelledby="quiz-title">
    <div class="quiz-panel__head">
      <div>
        <p class="quiz-panel__eyebrow">AI literacy challenge</p>
        <h1 id="quiz-title" class="quiz-panel__title">
          PLAY QUIZ<span class="quiz-panel__dot">.</span>
        </h1>
      </div>
      <button type="button" class="btn btn--compact quiz-back-btn" @click="$emit('back')">
        ← BACK
      </button>
    </div>

    <div v-if="isLoading" class="quiz-state" role="status">
      <p>Loading your 5 questions…</p>
    </div>

    <div v-else-if="finalScore !== null" class="quiz-result" aria-live="polite">
      <div class="quiz-card__top">
        <span class="quiz-counter"><strong>QUIZ COMPLETE</strong></span>
        <span class="quiz-score-badge">SCORE {{ finalScore }} / {{ total }}</span>
      </div>
      <div class="quiz-segments" aria-hidden="true">
        <span
          v-for="n in total"
          :key="n"
          class="quiz-segment quiz-segment--active"
        ></span>
      </div>
      <p class="quiz-result__score">{{ finalScore }}<span>/{{ total }}</span></p>
      <p v-if="wonPrize" class="quiz-result__body">
        Gift unlocked: <strong>{{ wonPrize.title }}</strong>. View your win, snap your BIAI photo, then claim your prize!
      </p>
      <p v-else class="quiz-result__body">
        No gift unlocked this round. Play again — get 1 correct for Stickers up to 5/5 for a Free Course!
      </p>
      <div class="quiz-result__actions">
        <button v-if="finalScore === 0" type="button" class="btn btn--primary" @click="loadQuiz">
          PLAY AGAIN
        </button>
        <button type="button" class="btn quiz-back-btn" @click="$emit('back')">BACK TO GAMES</button>
      </div>
    </div>

    <div v-else-if="currentQuestion" class="quiz-card">
      <div class="quiz-card__top">
        <span class="quiz-counter">
          <strong>QUESTION {{ currentIndex + 1 }}</strong>
          <span class="quiz-counter__total"> / {{ questions.length }}</span>
        </span>
        <span class="quiz-score-badge" aria-live="polite">SCORE {{ runningScore }}</span>
      </div>

      <div
        class="quiz-segments"
        role="progressbar"
        :aria-valuenow="currentIndex + 1"
        aria-valuemin="1"
        :aria-valuemax="questions.length"
        :aria-label="`Question ${currentIndex + 1} of ${questions.length}`"
      >
        <span
          v-for="(q, idx) in questions"
          :key="q.id"
          class="quiz-segment"
          :class="{ 'quiz-segment--active': idx <= currentIndex }"
        ></span>
      </div>

      <ul class="quiz-reward-ladder" aria-label="Quiz prize tiers by correct answers">
        <li
          v-for="tier in QUIZ_REWARD_TIERS"
          :key="tier.score"
          class="quiz-reward-tier"
          :class="{
            'quiz-reward-tier--unlocked': runningScore >= tier.score,
            'quiz-reward-tier--current': runningScore === tier.score,
          }"
        >
          <span class="quiz-reward-tier__score">{{ tier.score }}/{{ total }}</span>
          <span class="quiz-reward-tier__name">{{ tier.title }}</span>
        </li>
      </ul>

      <div class="quiz-question-block">
        <div class="quiz-question-block__meta">
          <span class="quiz-question-badge">Q{{ currentIndex + 1 }}</span>
          <span class="quiz-topic-badge">{{ currentQuestion.category || 'Core concepts' }}</span>
        </div>
        <h2 class="quiz-question">{{ currentQuestion.prompt }}</h2>
      </div>

      <div class="quiz-options">
        <button
          v-for="(option, idx) in currentQuestion.options"
          :key="option.id"
          type="button"
          class="quiz-option"
          :class="optionClass(option)"
          :disabled="Boolean(feedback) || isSubmitting"
          @click="chooseOption(option)"
        >
          <span class="quiz-option__letter" aria-hidden="true">
            {{ OPTION_LETTERS[idx] || idx + 1 }}
          </span>
          <span class="quiz-option__text">{{ option.label }}</span>
        </button>
      </div>

      <p
        v-if="feedback"
        class="quiz-feedback"
        :class="feedback.correct ? 'quiz-feedback--correct' : 'quiz-feedback--wrong'"
        aria-live="polite"
      >
        {{ feedback.correct ? 'Correct! Point added to your score.' : 'Not quite — the highlighted answer is correct.' }}
      </p>

      <p v-if="errorMsg" class="form-help form-help--error" aria-live="polite">
        {{ errorMsg }}
      </p>

      <div v-if="feedback" class="quiz-actions">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="isSubmitting"
          @click="nextQuestion"
        >
          {{ isSubmitting ? 'CHECKING' : isLastQuestion ? 'SEE MY SCORE' : 'NEXT QUESTION' }}
        </button>
      </div>
    </div>

    <div v-else class="quiz-state">
      <p class="form-help form-help--error">{{ errorMsg || 'Quiz could not be loaded.' }}</p>
      <button type="button" class="btn btn--primary" @click="loadQuiz">TRY AGAIN</button>
    </div>
  </section>
</template>
