<script setup>
import { computed, onMounted, ref } from 'vue';
import { answerQuiz, finishQuiz, startQuiz } from '../api/client.js';

const props = defineProps({
  token: {
    type: String,
    required: true,
  },
});

defineEmits(['back']);

const questions = ref([]);
const quizToken = ref('');
const currentIndex = ref(0);
const selectedOptionId = ref(null);
const feedback = ref(null);
const answers = ref([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMsg = ref('');
const finalScore = ref(null);
const total = ref(5);

const currentQuestion = computed(() => questions.value[currentIndex.value] || null);
const progressLabel = computed(() =>
  questions.value.length ? `Question ${currentIndex.value + 1} of ${questions.value.length}` : ''
);
const isLastQuestion = computed(
  () => currentIndex.value === questions.value.length - 1
);

async function loadQuiz() {
  isLoading.value = true;
  errorMsg.value = '';
  finalScore.value = null;
  questions.value = [];
  currentIndex.value = 0;
  selectedOptionId.value = null;
  feedback.value = null;
  answers.value = [];

  try {
    const data = await startQuiz(props.token);
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
    const result = await answerQuiz(props.token, {
      token: quizToken.value,
      questionId: currentQuestion.value.id,
      optionId: option.id,
    });

    feedback.value = result;
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
    const result = await finishQuiz(props.token, {
      token: quizToken.value,
      answers: answers.value,
    });
    finalScore.value = result.score;
    total.value = result.total;
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
        <h1 id="quiz-title" class="quiz-panel__title">PLAY QUIZ.</h1>
      </div>
      <button type="button" class="btn btn--compact" @click="$emit('back')">BACK</button>
    </div>

    <div v-if="isLoading" class="quiz-state">
      <p>Loading your 5 questions…</p>
    </div>

    <div v-else-if="finalScore !== null" class="quiz-result" aria-live="polite">
      <p class="quiz-result__label">Final score</p>
      <p class="quiz-result__score">{{ finalScore }}<span>/{{ total }}</span></p>
      <p class="quiz-result__body">
        Your result has been saved. Thanks for testing your AI literacy.
      </p>
      <div class="quiz-result__actions">
        <button type="button" class="btn btn--primary" @click="loadQuiz">PLAY AGAIN</button>
        <button type="button" class="btn" @click="$emit('back')">BACK TO GAMES</button>
      </div>
    </div>

    <div v-else-if="currentQuestion" class="quiz-card">
      <div class="quiz-progress">
        <span>{{ progressLabel }}</span>
        <span class="quiz-progress__track">
          <span
            class="quiz-progress__bar"
            :style="{ width: `${((currentIndex + 1) / questions.length) * 100}%` }"
          ></span>
        </span>
      </div>

      <h2 class="quiz-question">{{ currentQuestion.prompt }}</h2>

      <div class="quiz-options">
        <button
          v-for="option in currentQuestion.options"
          :key="option.id"
          type="button"
          class="quiz-option"
          :class="optionClass(option)"
          :disabled="Boolean(feedback) || isSubmitting"
          @click="chooseOption(option)"
        >
          {{ option.label }}
        </button>
      </div>

      <p
        v-if="feedback"
        class="quiz-feedback"
        :class="feedback.correct ? 'quiz-feedback--correct' : 'quiz-feedback--wrong'"
        aria-live="polite"
      >
        {{ feedback.correct ? 'Correct!' : 'Not quite — the highlighted answer is correct.' }}
      </p>

      <p v-if="errorMsg" class="form-help form-help--error" aria-live="polite">
        {{ errorMsg }}
      </p>

      <div class="quiz-actions">
        <button
          v-if="feedback"
          type="button"
          class="btn btn--primary"
          :disabled="isSubmitting"
          @click="nextQuestion"
        >
          {{ isSubmitting ? 'SAVING' : isLastQuestion ? 'SEE MY SCORE' : 'NEXT QUESTION' }}
        </button>
      </div>
    </div>

    <div v-else class="quiz-state">
      <p class="form-help form-help--error">{{ errorMsg || 'Quiz could not be loaded.' }}</p>
      <button type="button" class="btn btn--primary" @click="loadQuiz">TRY AGAIN</button>
    </div>
  </section>
</template>
