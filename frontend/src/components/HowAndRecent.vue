<script setup>
defineProps({
  recentSpins: {
    type: Array,
    default: () => [],
  },
});

function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
</script>

<template>
  <section class="rules-section" aria-label="Game rules and recent winners">
    <div class="container">
      <div class="rules-grid">
        <div id="rules">
          <h2>HOW IT WORKS.</h2>
          <ol class="steps-list">
            <li class="steps-list__item" data-reveal style="--i: 0">
              <div>
                <h3 class="steps-list__title">SIGN IN WITH NAME AND CONTACT</h3>
                <p class="steps-list__body">
                  Enter your full name alongside a phone number or email. Your entry writes directly to MongoDB and our backend CSV file.
                </p>
              </div>
            </li>
            <li class="steps-list__item" data-reveal style="--i: 1">
              <div>
                <h3 class="steps-list__title">SPIN THE PRIZE WHEEL</h3>
                <p class="steps-list__body">
                  Hit spin on the wheel hub or ticket box. The server selects one of the five prizes and updates your CSV row.
                </p>
              </div>
            </li>
            <li class="steps-list__item" data-reveal style="--i: 2">
              <div>
                <h3 class="steps-list__title">CLAIM WITH YOUR CODE</h3>
                <p class="steps-list__body">
                  Your winning ticket stays tied to your contact details with a unique code for pickup or fulfillment.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div id="recent" class="well" data-reveal style="--i: 1">
          <div class="recent-head">
            <h3>RECENT WINNERS</h3>
            <span class="recent-sub">Live database feed</span>
          </div>

          <TransitionGroup v-if="recentSpins.length" name="winner-list" tag="ul" class="recent-list">
            <li v-for="item in recentSpins" :key="item.id" class="recent-item">
              <span class="recent-item__name">{{ item.firstName }}</span>
              <span class="recent-item__prize">{{ item.prizeTitle }}</span>
              <time class="recent-item__time" :datetime="item.spunAt">
                {{ formatTimestamp(item.spunAt) }}
              </time>
            </li>
          </TransitionGroup>

          <p v-else class="empty-state">
            No spins recorded yet. Enter your details above to take the first spin.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
