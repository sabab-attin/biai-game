<script setup>
defineProps({
  player: {
    type: Object,
    default: null,
  },
});

defineEmits(['quiz', 'wheel', 'switch']);
</script>

<template>
  <section class="choice-screen" aria-labelledby="choice-title">
    <p class="choice-screen__eyebrow">BIAI Carnival</p>
    <h1 id="choice-title" class="choice-screen__title">CHOOSE YOUR GAME.</h1>
    <p class="choice-screen__lead">
      {{
        player
          ? `Signed in as ${player.name}. Pick your next game.`
          : 'Two ways to play. Pick one, then sign in.'
      }}
    </p>

    <div class="choice-grid">
      <button type="button" class="choice-card choice-card--wheel" @click="$emit('wheel')">
        <span class="choice-card__tag">Prize round</span>
        <span class="choice-card__name">SPIN THE WHEEL</span>
        <span class="choice-card__body">
          Take your turn at the carnival wheel and claim the reward it lands on.
        </span>
        <span class="choice-card__cta">START SPINNING →</span>
      </button>

      <button type="button" class="choice-card choice-card--quiz" @click="$emit('quiz')">
        <span class="choice-card__tag">Knowledge round</span>
        <span class="choice-card__name">PLAY QUIZ</span>
        <span class="choice-card__body">
          5 quick AI literacy questions. Instant feedback, score saved automatically.
        </span>
        <span class="choice-card__cta">START QUIZ →</span>
      </button>
    </div>

    <button
      v-if="player"
      type="button"
      class="choice-screen__switch"
      @click="$emit('switch')"
    >
      Not you? Switch player
    </button>
  </section>
</template>
