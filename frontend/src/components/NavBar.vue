<script setup>
import { ref } from 'vue';

const mobileMenuOpen = ref(false);

function closeMenu() {
  mobileMenuOpen.value = false;
}
</script>

<template>
  <header class="site-header" id="top">
    <div class="container">
      <nav class="nav" aria-label="Main navigation">
        <div class="nav__group">
          <a class="nav__link" href="#prizes">Prizes</a>
        </div>

        <a class="nav__brand" href="#top" aria-label="BIAI home">
          <img
            class="nav__brand-logo"
            src="/biai-logo.png"
            width="28"
            height="28"
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
        <a class="nav__link" href="#prizes" @click="closeMenu">Prizes</a>
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
