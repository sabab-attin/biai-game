<script setup>
import { ref } from 'vue';
import { smoothScrollTo } from '../utils/scroll.js';
import BiaiMark from './BiaiMark.vue';

defineEmits(['openAdmin']);

const mobileMenuOpen = ref(false);

function closeMenu() {
  mobileMenuOpen.value = false;
}

function navigateTo(hash) {
  closeMenu();
  smoothScrollTo(hash);
}
</script>

<template>
  <header class="site-header" id="top">
    <div class="container">
      <nav class="nav" aria-label="Main navigation">
        <div class="nav__group">
          <a class="nav__link" href="#prizes" @click.prevent="navigateTo('#prizes')">Prizes</a>
          <a class="nav__link" href="#biai-programs" @click.prevent="navigateTo('#biai-programs')">
            BIAI Programs
          </a>
          <a class="nav__link" href="#rules" @click.prevent="navigateTo('#rules')">Rules</a>
        </div>

        <a
          class="nav__brand"
          href="#top"
          aria-label="BIAI Prize Wheel home"
          @click.prevent="navigateTo('#top')"
        >
          <BiaiMark :size="26" />
          <span>BIAI PRIZE WHEEL</span>
        </a>

        <div class="nav__group nav__group--right">
          <a class="nav__link" href="#recent" @click.prevent="navigateTo('#recent')">Recent wins</a>
          <a
            class="nav__link"
            href="https://biai.com.bd/"
            target="_blank"
            rel="noopener noreferrer"
          >
            biai.com.bd
          </a>
          <button type="button" class="nav__link" @click="$emit('openAdmin')">
            Organizer CSV
          </button>
        </div>

        <div class="nav__mobile-controls">
          <a class="nav__link" href="#biai-programs" @click.prevent="navigateTo('#biai-programs')">
            BIAI
          </a>
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
        <a class="nav__link" href="#prizes" @click.prevent="navigateTo('#prizes')">Prizes</a>
        <a class="nav__link" href="#biai-programs" @click.prevent="navigateTo('#biai-programs')">
          BIAI Programs
        </a>
        <a class="nav__link" href="#rules" @click.prevent="navigateTo('#rules')">Rules</a>
        <a class="nav__link" href="#recent" @click.prevent="navigateTo('#recent')">Recent wins</a>
        <a
          class="nav__link"
          href="https://biai.com.bd/"
          target="_blank"
          rel="noopener noreferrer"
          @click="closeMenu"
        >
          biai.com.bd
        </a>
        <button
          type="button"
          class="nav__link"
          @click="
            closeMenu();
            $emit('openAdmin');
          "
        >
          Organizer CSV
        </button>
      </div>
    </div>
  </header>
</template>
