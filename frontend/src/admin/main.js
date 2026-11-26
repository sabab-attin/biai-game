import { createApp } from 'vue';
import '../styles/main.css';
import AdminApp from './AdminApp.vue';

export function mountAdmin() {
  const target = document.getElementById('app');
  if (!target) return;

  const app = createApp(AdminApp);
  app.config.errorHandler = (error) => {
    console.error('[admin] Unhandled UI error:', error);
  };
  app.mount(target);
}
