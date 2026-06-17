let supabaseClient = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function getUser() {
  const client = getSupabase();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function getUserRole() {
  const user = await getUser();
  if (!user) return null;
  const client = getSupabase();
  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role || null;
}

async function setUserRole(role) {
  const user = await getUser();
  if (!user) return;
  const client = getSupabase();
  await client
    .from('profiles')
    .update({ role })
    .eq('id', user.id);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  return timeStr.slice(0, 5);
}

async function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const user = await getUser();
  const role = user ? await getUserRole() : null;

  let links = `
    <a href="index.html" class="navbar__logo">MentorHub</a>
    <a href="mentors.html" class="navbar__link">Менторы</a>
  `;

  if (user) {
    links += `<a href="dashboard.html" class="navbar__link">Кабинет</a>`;
    links += `<button onclick="logout()" class="btn btn--outline btn--sm">Выйти</button>`;
  } else {
    links += `<a href="login.html" class="btn btn--primary btn--sm">Войти</a>`;
  }

  nav.innerHTML = `
    <div class="container navbar">
      ${links}
    </div>
  `;
}

async function logout() {
  const client = getSupabase();
  await client.auth.signOut();
  window.location.href = 'index.html';
}

function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="container footer">
      <p>&copy; 2025 MentorHub. Все права защищены.</p>
      <div class="footer__links">
        <a href="mentors.html">Менторы</a>
        <a href="#">О нас</a>
        <a href="#">Контакты</a>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();
});
