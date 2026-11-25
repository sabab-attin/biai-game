<script setup>
const PROGRAMS = [
  {
    name: 'Free AI Masterclass',
    schedule: '3-hour live online session',
    summary: 'Open to anyone in Bangladesh. Build hands-on from minute one in a single live afternoon.',
    href: 'https://biai.com.bd/courses',
    cta: 'View masterclass',
  },
  {
    name: '3-Day Generative AI Bootcamp',
    schedule: 'Monthly live cohorts',
    summary: 'Ship four real deliverables: a deployed web app, an AI agent, a custom assistant, and an ad film.',
    href: 'https://biai.com.bd/enroll',
    cta: 'Check next cohort',
  },
  {
    name: 'AI Generalist Fellowship',
    schedule: '12-month hybrid program',
    summary: 'Structured full-stack AI training with practitioner mentors and a production capstone.',
    href: 'https://biai.com.bd/courses',
    cta: 'Explore fellowship',
  },
  {
    name: 'Dhaka In-Person & Corporate',
    schedule: 'Mirpur campus and teams',
    summary: 'On-site cohorts pitching real AI solutions plus department-wide corporate workflow training.',
    href: 'https://biai.com.bd/for-business',
    cta: 'See business programs',
  },
];
</script>

<template>
  <section id="biai-programs" class="biai-section" aria-labelledby="biai-heading">
    <div class="container">
      <div class="section-head">
        <h2 id="biai-heading">BUILD WITH BIAI FROM DAY 1.</h2>
        <p class="lead section-head__lead">
          Bangladesh Institute of Artificial Intelligence trains builders across Dhaka and live online.
        </p>
      </div>

      <div class="programs-grid">
        <article v-for="program in PROGRAMS" :key="program.name" class="program-card">
          <div class="program-card__head">
            <h3>{{ program.name }}</h3>
            <span class="program-card__meta">{{ program.schedule }}</span>
          </div>
          <p class="program-card__desc">{{ program.summary }}</p>
          <a
            class="program-card__link"
            :href="program.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ program.cta }}
          </a>
        </article>
      </div>

      <div class="biai-callout">
        <div class="biai-callout__text">
          <h3>READY TO START LEARNING?</h3>
          <p>
            Join our free 3-hour live AI masterclass or message the BIAI admissions desk on WhatsApp.
          </p>
        </div>

        <div class="btn-pair">
          <a
            class="btn"
            href="https://biai.com.bd/courses"
            target="_blank"
            rel="noopener noreferrer"
          >
            BIAI COURSES
          </a>
          <a
            class="btn"
            href="https://wa.me/8801328446600"
            target="_blank"
            rel="noopener noreferrer"
          >
            WHATSAPP DESK
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
