<script setup>
import { ref } from 'vue';

const emit = defineEmits(['goHome']);

const mobileMenuOpen = ref(false);

function closeMenu() {
  mobileMenuOpen.value = false;
}

function goHome(selector = '#top') {
  closeMenu();
  emit('goHome', selector);
}
</script>

<template>
  <header class="site-header" id="top">
    <div class="container">
      <nav class="nav" aria-label="Main navigation">
        <div class="nav__group">
          <a class="nav__link" href="#prizes" @click.prevent="goHome('#prizes')">Prizes</a>
          <a class="nav__link" href="#courses" @click.prevent="goHome('#courses')">Courses</a>
        </div>

        <a
          class="nav__brand"
          href="#top"
          aria-label="BIAI home"
          @click.prevent="goHome('#top')"
        >
          <img
            class="nav__brand-logo"
            src="/biai-logo.png"
            width="40"
            height="40"
            alt=""
          />
          <span>BIAI</span>
        </a>

        <div class="nav__group nav__group--right">
          <a
            class="nav__link"
            href="https://biai.com.bd/"
            target="_blank"
            rel="noopener noreferrer"
          >
            biai.com.bd
          </a>
        </div>

        <div class="nav__mobile-controls">
          <button
            type="button"
            class="btn btn--compact"
            :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
            aria-controls="mobile-nav-drawer"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            {{ mobileMenuOpen ? 'CLOSE' : 'MENU' }}
          </button>
        </div>
      </nav>
    </div>

    <div v-show="mobileMenuOpen" id="mobile-nav-drawer" class="nav__drawer">
      <div class="container nav__drawer-inner">
        <a class="nav__link" href="#prizes" @click.prevent="goHome('#prizes')">Prizes</a>
        <a class="nav__link" href="#courses" @click.prevent="goHome('#courses')">Courses</a>
        <a
          class="nav__link"
          href="https://biai.com.bd/"
          target="_blank"
          rel="noopener noreferrer"
          @click="closeMenu"
        >
          biai.com.bd
        </a>
      </div>
    </div>
  </header>
</template>
