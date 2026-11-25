<script setup>
defineProps({
  prizes: {
    type: Array,
    required: true,
  },
  prizeCounts: {
    type: Object,
    default: () => ({}),
  },
  wonPrizeId: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <section id="prizes" class="section-block" aria-labelledby="prizes-heading">
    <div class="container">
      <div class="section-head">
        <h2 id="prizes-heading">FIVE PRIZES TO CLAIM.</h2>
        <p class="lead section-head__lead">
          Every signed-in player gets one spin across these five carnival rewards.
        </p>
      </div>

      <ul class="prize-rows">
        <li
          v-for="prize in prizes"
          :key="prize.id"
          class="prize-row"
          :class="{ 'prize-row--won': wonPrizeId === prize.id }"
        >
          <div class="prize-row__title-wrap">
            <span
              class="prize-swatch"
              :style="{ backgroundColor: `var(${prize.bgToken})` }"
              aria-hidden="true"
            ></span>
            <h3 class="prize-row__name">{{ prize.title }}</h3>
          </div>

          <p class="prize-row__desc">{{ prize.description }}</p>

          <div class="prize-row__meta">
            <span class="prize-row__count">{{ prizeCounts[prize.id] ?? 0 }} claimed</span>
            <span class="prize-row__tag">
              {{ wonPrizeId === prize.id ? 'Your winning prize' : prize.category }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
