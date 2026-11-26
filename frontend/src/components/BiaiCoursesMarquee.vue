<script setup>
import { ref } from 'vue';

const COURSES = [
  {
    id: 'free-masterclass',
    title: 'Free AI Masterclass',
    schedule: 'Online, live, 3 hours',
    price: 'Free',
    status: 'Registration open',
    summary: 'A working AI system you can start using immediately.',
    href: 'https://biai.com.bd/courses',
    cta: 'Register free',
    badgeToken: '--color-accent-2',
    badgeInkToken: '--color-paper-bright',
  },
  {
    id: 'genai-bootcamp',
    title: '3-Day Generative AI Bootcamp',
    schedule: 'Online, live, 3 days (20 hours)',
    price: '৳9,999',
    status: 'Registration open',
    summary: 'A deployed web app, an AI agent, a custom assistant, and an ad film built by you.',
    href: 'https://biai.com.bd/enroll',
    cta: 'Enroll now',
    badgeToken: '--color-accent',
    badgeInkToken: '--color-accent-ink',
  },
  {
    id: 'ai-fellowship',
    title: 'AI Generalist Fellowship',
    schedule: 'Hybrid, 12 months (6 + 6)',
    price: 'Fellowship',
    status: 'Next intake by enquiry',
    summary: 'A full-stack AI generalist with a real capstone project.',
    href: 'https://biai.com.bd/courses',
    cta: 'Talk to us',
    badgeToken: '--color-navy',
    badgeInkToken: '--color-paper-bright',
  },
  {
    id: 'in-person-cohort',
    title: 'In-Person Cohort',
    schedule: 'In person, Dhaka',
    price: 'Dhaka',
    status: 'Next intake by enquiry',
    summary: 'Graduate by pitching a real AI solution to a corporate partner.',
    href: 'https://biai.com.bd/courses',
    cta: 'Talk to us',
    badgeToken: '--color-biai-mark',
    badgeInkToken: '--color-paper-bright',
  },
];

const isPaused = ref(false);
</script>

<template>
  <section id="courses" class="courses-section" aria-labelledby="courses-heading">
    <div class="container">
      <div class="courses-section__head">
        <div>
          <h2 id="courses-heading">BIAI COURSES.</h2>
          <p class="lead courses-section__lead">
            Four applied AI programs offered by BIAI. Hover or pause any card to explore.
          </p>
        </div>

        <div class="courses-section__controls">
          <button
            type="button"
            class="btn btn--compact courses-toggle"
            :aria-pressed="isPaused ? 'true' : 'false'"
            @click="isPaused = !isPaused"
          >
            {{ isPaused ? 'PLAY' : 'PAUSE' }}
          </button>
          <a
            class="btn btn--compact btn--primary"
            href="https://biai.com.bd/courses"
            target="_blank"
            rel="noopener noreferrer"
          >
            ALL COURSES
          </a>
        </div>
      </div>
    </div>

    <div
      class="courses-marquee"
      :class="{ 'courses-marquee--paused': isPaused }"
      role="region"
      aria-label="BIAI courses showcase"
    >
      <div class="courses-marquee__track keep-motion">
        <div
          v-for="groupIdx in 3"
          :key="groupIdx"
          class="courses-marquee__group"
          :aria-hidden="groupIdx > 1 ? 'true' : undefined"
        >
          <article
            v-for="course in COURSES"
            :key="`${groupIdx}-${course.id}`"
            class="course-card"
          >
            <div class="course-card__top">
              <span
                class="course-card__badge"
                :style="{
                  backgroundColor: `var(${course.badgeToken})`,
                  color: `var(${course.badgeInkToken})`,
                }"
              >
                {{ course.price }}
              </span>
              <span class="course-card__status">{{ course.status }}</span>
            </div>

            <h3 class="course-card__title">{{ course.title }}</h3>
            <p class="course-card__schedule">{{ course.schedule }}</p>
            <p class="course-card__desc">{{ course.summary }}</p>

            <div class="course-card__foot">
              <a
                class="course-card__link"
                :href="course.href"
                :tabindex="groupIdx > 1 ? -1 : undefined"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ course.cta }}
              </a>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
