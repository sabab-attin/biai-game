<script setup>
defineProps({
  prizes: {
    type: Array,
    required: true,
  },
  wonPrizeId: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <section id="prizes" class="section-block section-block--compact" aria-labelledby="prizes-heading">
    <div class="container">
      <div class="section-head section-head--compact">
        <h2 id="prizes-heading">PRIZES TO CLAIM.</h2>
        <p class="lead section-head__lead">
          One spin per player across these carnival rewards.
        </p>
      </div>

      <ul class="prize-grid">
        <li
          v-for="prize in prizes"
          :key="prize.id"
          class="prize-card"
          :class="{ 'prize-card--won': wonPrizeId === prize.id }"
        >
          <div class="prize-card__title">
            <span
              class="prize-swatch"
              :style="{ backgroundColor: `var(${prize.bgToken})` }"
              aria-hidden="true"
            ></span>
            <h3 class="prize-card__name">{{ prize.title }}</h3>
          </div>
          <p class="prize-card__desc">{{ prize.description }}</p>
          <span class="prize-card__tag">
            {{ wonPrizeId === prize.id ? 'Your winning prize' : prize.category }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
