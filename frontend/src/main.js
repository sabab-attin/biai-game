import { ADMIN_HASH_BASE, isAdminHash } from './admin/path.js';
import { hasActiveAdminTab, logoutAdminKeepalive } from './admin/session.js';

function renderNotFound() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <main class="not-found">
      <p class="not-found__code">404</p>
      <h1>Not Found</h1>
      <p>The page you requested does not exist.</p>
      <a class="btn" href="/">Back to the event</a>
    </main>
  `;
}

async function boot() {
  const hash = window.location.hash || '';

  if (isAdminHash(hash)) {
    const { mountAdmin } = await import('./admin/main.js');
    mountAdmin();
    return;
  }

  if (hasActiveAdminTab()) {
    await logoutAdminKeepalive();
  }

  const { mountPublic } = await import('./public/main.js');
  mountPublic();
}

// The footer admin link changes only the hash, so reload when the visitor switches
// between the public event and the admin console. In-admin hash changes (login/base)
// stay on the same surface and are handled by AdminApp. Leaving the admin page logs out first.
const bootedHash = window.location.hash || '';

window.addEventListener('hashchange', async () => {
  const nextIsAdmin = isAdminHash(window.location.hash || '');
  if (nextIsAdmin !== isAdminHash(bootedHash)) {
    if (isAdminHash(bootedHash) && !nextIsAdmin && hasActiveAdminTab()) {
      await logoutAdminKeepalive();
    }
    window.location.reload();
  }
});

boot().catch((error) => {
  console.error('App failed to start:', error);
  renderNotFound();
});

export { ADMIN_HASH_BASE };
