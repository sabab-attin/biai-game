import { createApp } from 'vue';
import '../styles/main.css';
import App from '../App.vue';

export function mountPublic() {
  createApp(App).mount('#app');
}
