<script setup>
defineEmits(['quiz', 'wheel']);
</script>

<template>
  <section class="choice-screen" aria-labelledby="choice-title">
    <p class="choice-screen__eyebrow">RISE ABOVE ALL 10X - BIAI</p>
    <h1 id="choice-title" class="choice-screen__title">PLAY. PROGRESS. PROSPER.</h1>

    <div class="choice-grid">
      <button type="button" class="choice-card choice-card--wheel" @click="$emit('wheel')">
        <span class="choice-card__tag">Prize round</span>
        <span class="choice-card__name">SPIN THE WHEEL</span>
        <span class="choice-card__body">
          Take your turn at the carnival wheel. Land a prize and claim it in a few seconds.
        </span>
        <span class="choice-card__cta">START SPINNING →</span>
      </button>

      <button type="button" class="choice-card choice-card--quiz" @click="$emit('quiz')">
        <span class="choice-card__tag">Knowledge round</span>
        <span class="choice-card__name">PLAY QUIZ</span>
        <span class="choice-card__body">
          5 quick AI literacy questions. Instant feedback, then save your score only if you want the prize.
        </span>
        <span class="choice-card__cta">START QUIZ →</span>
      </button>
    </div>
  </section>
</template>

