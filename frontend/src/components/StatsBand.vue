<script setup>
defineProps({
  prizeCount: {
    type: Number,
    default: 5,
  },
  stats: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <section class="band-crimson" aria-label="BIAI wheel and institute overview">
    <div class="band-crimson__halftone" aria-hidden="true"></div>
    <div class="container band-crimson__inner">
      <h2>BIAI AT A GLANCE.</h2>

      <div class="stats-grid">
        <div class="stats-cell">
          <b class="stats-cell__value">{{ prizeCount }}</b>
          <span class="stats-cell__label">BIAI prize types</span>
        </div>

        <div class="stats-cell">
          <b class="stats-cell__value">{{ stats.totalSpins }}</b>
          <span class="stats-cell__label">Spins recorded</span>
        </div>

        <div class="stats-cell">
          <b class="stats-cell__value">3 HRS</b>
          <span class="stats-cell__label">Free AI masterclass</span>
        </div>

        <div class="stats-cell">
          <b class="stats-cell__value">DAY 1</b>
          <span class="stats-cell__label">Build-first cohorts</span>
        </div>
      </div>
    </div>
  </section>
</template>
