<script setup>
defineProps({
  size: {
    type: Number,
    default: 28,
  },
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    class="biai-mark"
  >
    <defs>
      <clipPath id="biai-wheel-clip">
        <circle cx="50" cy="50" r="48" />
      </clipPath>
      <mask id="biai-wheel-mask">
        <rect width="100" height="100" fill="white" />
        <circle cx="50" cy="50" r="13" fill="black" />
      </mask>
    </defs>
    <g clip-path="url(#biai-wheel-clip)" mask="url(#biai-wheel-mask)" fill="var(--color-biai-mark)">
      <g transform="rotate(45 50 50)">
        <rect x="-12" y="26.5" width="124" height="11" rx="5.5" />
        <rect x="-12" y="44.5" width="124" height="11" rx="5.5" />
        <rect x="-12" y="62.5" width="124" height="11" rx="5.5" />
      </g>
      <g transform="rotate(-45 50 50)">
        <rect x="-12" y="26.5" width="124" height="11" rx="5.5" />
        <rect x="-12" y="44.5" width="124" height="11" rx="5.5" />
        <rect x="-12" y="62.5" width="124" height="11" rx="5.5" />
      </g>
    </g>
    <circle cx="50" cy="50" r="7" fill="var(--color-biai-mark)" />
  </svg>
</template>
