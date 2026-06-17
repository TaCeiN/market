# Mentoring Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mentoring marketplace MVP — profiles, search, booking, subscriptions — using vanilla HTML/CSS/JS + Supabase.

**Architecture:** Multi-page static site served from root. Supabase handles auth, database, storage, and edge functions. Each page is a standalone HTML file that imports shared CSS/JS modules.

**Tech Stack:** HTML5, CSS3 (custom properties, mobile-first), vanilla JavaScript (ES modules), Supabase (Auth, Database, Storage, Edge Functions)

---

## File Structure

```
D:\сайт\
├── index.html              # Landing page with hero + featured mentors
├── mentors.html            # Catalog with search and filters
├── profile.html            # Single mentor profile + booking form
├── login.html              # Auth: login + register
├── dashboard.html          # User dashboard (mentor/student views)
├── booking.html            # Booking confirmation page
├── css/
│   ├── reset.css           # CSS reset/normalize
│   └── styles.css          # Main styles + components + responsive
├── js/
│   ├── config.js           # Supabase config (URL, anon key)
│   ├── api.js              # Supabase client + DB queries
│   ├── auth.js             # Auth helpers (login, register, session)
│   ├── search.js           # Search/filter logic for mentors.html
│   ├── profile.js          # Profile page logic (load mentor, reviews)
│   ├── dashboard.js        # Dashboard logic (my bookings, my profile)
│   └── app.js              # Shared UI helpers (navbar, footer, toasts)
├── supabase/
│   └── schema.sql          # Database schema (tables, RLS, indexes)
└── docs/
    └── compose/
        └── plans/
            └── 2026-06-17-mentoring-marketplace.md
```

---

### Task 1: Project Scaffolding + Supabase Setup

**Covers:** [S1]

**Files:**
- Create: `D:\сайт\supabase\schema.sql`
- Create: `D:\сайт\css\reset.css`
- Create: `D:\сайт\css\styles.css`
- Create: `D:\сайт\js\config.js`
- Create: `D:\сайт\js\app.js`
- Create: `D:\сайт\index.html`

- [ ] **Step 1: Create Supabase schema**

Run this SQL in Supabase SQL Editor:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
  bio TEXT DEFAULT '',
  subjects TEXT[] DEFAULT '{}',
  price_per_hour NUMERIC DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES profiles(id) NOT NULL,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, owner can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Bookings: participants can view, student can create
CREATE POLICY "Booking participants can view" ON bookings FOR SELECT
  USING (auth.uid() = mentor_id OR auth.uid() = student_id);
CREATE POLICY "Students can create bookings" ON bookings FOR INSERT
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Mentors can update bookings" ON bookings FOR UPDATE
  USING (auth.uid() = mentor_id);

-- Reviews: anyone can read, booking participant can insert
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Participants can insert reviews" ON reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND (bookings.mentor_id = auth.uid() OR bookings.student_id = auth.uid())
      AND bookings.status = 'confirmed'
    )
  );

-- Indexes for performance
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_subjects ON profiles USING GIN(subjects);
CREATE INDEX idx_bookings_mentor ON bookings(mentor_id);
CREATE INDEX idx_bookings_student ON bookings(student_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);

-- Function to update mentor rating
CREATE OR REPLACE FUNCTION update_mentor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET rating = (
    SELECT COALESCE(AVG(r.rating), 0)
    FROM reviews r
    JOIN bookings b ON r.booking_id = b.id
    WHERE b.mentor_id = NEW.mentor_id
  )
  WHERE id = NEW.mentor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_mentor_rating();
```

- [ ] **Step 2: Create CSS reset**

```css
/* D:\сайт\css\reset.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #1a1a2e;
  background: #fafafa;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

button, input, select, textarea {
  font: inherit;
}

ul, ol {
  list-style: none;
}
```

- [ ] **Step 3: Create main styles**

```css
/* D:\сайт\css\styles.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --secondary: #0f172a;
  --accent: #3b82f6;
  --bg: #fafafa;
  --card-bg: #ffffff;
  --text: #1a1a2e;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --radius: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
  --max-width: 1200px;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1rem;
}

/* Navbar */
.navbar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.navbar-links {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.navbar-links a {
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.navbar-links a:hover {
  color: var(--primary);
}

.navbar-auth {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

/* Hero */
.hero {
  padding: 5rem 0;
  text-align: center;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.hero p {
  font-size: 1.25rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto 2rem;
}

/* Cards */
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* Mentor Card */
.mentor-card {
  cursor: pointer;
}

.mentor-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.mentor-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
}

.mentor-name {
  font-size: 1.125rem;
  font-weight: 600;
}

.mentor-rating {
  color: var(--warning);
  font-size: 0.875rem;
}

.mentor-subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag {
  background: #eff6ff;
  color: var(--primary);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.mentor-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.mentor-price span {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-secondary);
}

/* Search */
.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.search-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  min-width: 180px;
}

/* Forms */
.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-error {
  color: var(--error);
  font-size: 0.8125rem;
  margin-top: 0.25rem;
}

/* Auth card */
.auth-card {
  max-width: 420px;
  margin: 4rem auto;
  padding: 2.5rem;
}

.auth-card h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.auth-card p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: var(--secondary);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

.toast-success { border-left: 4px solid var(--success); }
.toast-error { border-left: 4px solid var(--error); }

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Dashboard */
.dashboard-header {
  padding: 2rem 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.dashboard-sidebar {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
}

.sidebar-nav a {
  display: block;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.sidebar-nav a:hover,
.sidebar-nav a.active {
  background: #eff6ff;
  color: var(--primary);
}

/* Booking */
.booking-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.time-slot {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  font-size: 0.875rem;
}

.time-slot:hover {
  border-color: var(--primary);
}

.time-slot.selected {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.time-slot.disabled {
  background: var(--bg);
  color: var(--text-secondary);
  cursor: not-allowed;
}

/* Footer */
.footer {
  background: var(--secondary);
  color: #94a3b8;
  padding: 3rem 0 1.5rem;
  margin-top: 5rem;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer h4 {
  color: white;
  margin-bottom: 1rem;
}

.footer a {
  display: block;
  padding: 0.25rem 0;
  transition: color 0.2s;
}

.footer a:hover {
  color: white;
}

.footer-bottom {
  border-top: 1px solid #334155;
  padding-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .hero h1 { font-size: 2rem; }
  .dashboard-grid { grid-template-columns: 1fr; }
  .navbar-links { display: none; }
  .search-bar { flex-direction: column; }
}
```

- [ ] **Step 4: Create Supabase config**

```javascript
// D:\сайт\js\config.js
export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

- [ ] **Step 5: Create app.js with shared helpers**

```javascript
// D:\сайт\js\app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    document.head.appendChild(script);
  }
  return window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function getUser() {
  const data = localStorage.getItem('supabase.auth.token');
  return data ? JSON.parse(data)?.user : null;
}

export function getUserRole() {
  return localStorage.getItem('user_role') || 'student';
}

export function setUserRole(role) {
  localStorage.setItem('user_role', role);
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function formatTime(time) {
  return time.substring(0, 5);
}

export function renderNavbar() {
  const user = getUser();
  const nav = document.querySelector('.navbar');
  if (!nav) return;

  nav.innerHTML = `
    <div class="container">
      <a href="index.html" class="navbar-logo">MentorHub</a>
      <nav class="navbar-links">
        <a href="mentors.html">Менторы</a>
        <a href="index.html">О нас</a>
      </nav>
      <div class="navbar-auth">
        ${user
          ? `<a href="dashboard.html" class="btn btn-secondary btn-sm">Кабинет</a>
             <button onclick="logout()" class="btn btn-primary btn-sm">Выйти</button>`
          : `<a href="login.html" class="btn btn-secondary btn-sm">Войти</a>
             <a href="login.html?mode=register" class="btn btn-primary btn-sm">Регистрация</a>`
        }
      </div>
    </div>
  `;
}

export async function logout() {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
  localStorage.removeItem('user_role');
  window.location.href = 'index.html';
}

export function renderFooter() {
  const footer = document.querySelector('.footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>MentorHub</h4>
          <p>Платформа для поиска менторов и развития навыков</p>
        </div>
        <div>
          <h4>Навигация</h4>
          <a href="mentors.html">Найти ментора</a>
          <a href="login.html">Стать ментором</a>
        </div>
        <div>
          <h4>Контакты</h4>
          <a href="mailto:info@mentorhub.ru">info@mentorhub.ru</a>
        </div>
      </div>
      <div class="footer-bottom">
        © 2026 MentorHub. Все права защищены.
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
});
```

- [ ] **Step 6: Create landing page**

```html
<!-- D:\сайт\index.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MentorHub — Найди своего ментора</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="navbar"></header>

  <main>
    <section class="hero container">
      <h1>Найди ментора<br>для роста</h1>
      <p>Профессиональные менторы по программированию, дизайну, бизнесу и другим навыкам</p>
      <a href="mentors.html" class="btn btn-primary">Найти ментора</a>
    </section>

    <section class="container">
      <h2 style="text-align:center; margin-bottom:2rem;">Популярные менторы</h2>
      <div class="card-grid" id="featured-mentors"></div>
    </section>
  </main>

  <footer class="footer"></footer>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { getSupabase } from './js/app.js';

    async function loadFeatured() {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'mentor')
        .order('rating', { ascending: false })
        .limit(6);

      const container = document.getElementById('featured-mentors');
      if (!data?.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">Пока нет менторов. Будь первым!</p>';
        return;
      }

      container.innerHTML = data.map(m => `
        <a href="profile.html?id=${m.id}" class="card mentor-card">
          <div class="mentor-card-header">
            <div class="mentor-avatar">${m.full_name?.charAt(0) || '?'}</div>
            <div>
              <div class="mentor-name">${m.full_name}</div>
              <div class="mentor-rating">${'★'.repeat(Math.round(m.rating))} ${m.rating.toFixed(1)}</div>
            </div>
          </div>
          <div class="mentor-subjects">
            ${m.subjects?.map(s => `<span class="tag">${s}</span>`).join('') || ''}
          </div>
          <div class="mentor-price">${m.price_per_hour} ₽ <span>/ час</span></div>
        </a>
      `).join('');
    }

    loadFeatured();
  </script>
</body>
</html>
```

- [ ] **Step 7: Test the landing page**

Open `index.html` in browser. Verify:
- Navbar renders with logo and links
- Hero section displays
- Featured mentors section shows placeholder or empty state
- Footer renders

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffolding + CSS + landing page"
```

---

### Task 2: Auth System (Login + Register)

**Covers:** [S3]

**Files:**
- Create: `D:\сайт\login.html`
- Create: `D:\сайт\js\auth.js`

- [ ] **Step 1: Create auth.js**

```javascript
// D:\сайт\js\auth.js
import { getSupabase, showToast } from './app.js';

export async function login(email, password) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function register(email, password, fullName, role) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, full_name: fullName, role });

    if (profileError) throw profileError;

    localStorage.setItem('user_role', role);
  }
  return data;
}

export async function loginWithGoogle() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) throw error;
}

export function initAuthForm() {
  const params = new URLSearchParams(window.location.search);
  const isRegister = params.get('mode') === 'register';
  const form = document.getElementById('auth-form');
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit');
  const toggleLink = document.getElementById('auth-toggle');
  const nameGroup = document.getElementById('name-group');
  const roleGroup = document.getElementById('role-group');

  function updateForm() {
    const mode = isRegister ? 'register' : 'login';
    title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
    submitBtn.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
    toggleLink.innerHTML = mode === 'register'
      ? 'Уже есть аккаунт? <a href="login.html">Войти</a>'
      : 'Нет аккаунта? <a href="login.html?mode=register">Зарегистрироваться</a>';
    nameGroup.style.display = mode === 'register' ? 'block' : 'none';
    roleGroup.style.display = mode === 'register' ? 'block' : 'none';
  }

  updateForm();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value;
    const password = form.password.value;

    try {
      if (isRegister) {
        const fullName = form.full_name.value;
        const role = form.role.value;
        await register(email, password, fullName, role);
        showToast('Аккаунт создан! Проверьте почту для подтверждения.');
      } else {
        await login(email, password);
        showToast('Добро пожаловать!');
      }
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
```

- [ ] **Step 2: Create login.html**

```html
<!-- D:\сайт\login.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Вход — MentorHub</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="navbar"></header>

  <main class="container">
    <div class="card auth-card">
      <h2 id="auth-title">Вход</h2>
      <p>Войдите в свой аккаунт</p>

      <button onclick="import('./js/auth.js').then(m => m.loginWithGoogle())"
              class="btn btn-secondary" style="width:100%; margin-bottom:1rem;">
        Войти через Google
      </button>

      <div class="auth-divider">или</div>

      <form id="auth-form">
        <div class="form-group" id="name-group" style="display:none;">
          <label class="form-label" for="full_name">Имя</label>
          <input class="form-input" type="text" id="full_name" name="full_name" required>
        </div>

        <div class="form-group" id="role-group" style="display:none;">
          <label class="form-label" for="role">Я хочу быть</label>
          <select class="form-input" id="role" name="role">
            <option value="student">Учеником</option>
            <option value="mentor">Ментором</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Email</label>
          <input class="form-input" type="email" id="email" name="email" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="password">Пароль</label>
          <input class="form-input" type="password" id="password" name="password" required minlength="6">
        </div>

        <button type="submit" id="auth-submit" class="btn btn-primary" style="width:100%;">Войти</button>
      </form>

      <p id="auth-toggle" style="text-align:center; margin-top:1.5rem; font-size:0.875rem;">
        Нет аккаунта? <a href="login.html?mode=register">Зарегистрироваться</a>
      </p>
    </div>
  </main>

  <footer class="footer"></footer>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { initAuthForm } from './js/auth.js';
    initAuthForm();
  </script>
</body>
</html>
```

- [ ] **Step 3: Test auth flow**

Open `login.html`:
1. Click "Зарегистрироваться" — form expands with name + role fields
2. Register as mentor → verify redirect to dashboard
3. Logout → login again with same credentials
4. Test Google OAuth (requires Supabase Google provider configured)

- [ ] **Step 4: Commit**

```bash
git add login.html js/auth.js
git commit -m "feat: auth system (login, register, Google OAuth)"
```

---

### Task 3: Mentor Catalog + Search

**Covers:** [S2, S5]

**Files:**
- Create: `D:\сайт\mentors.html`
- Create: `D:\сайт\js\search.js`

- [ ] **Step 1: Create search.js**

```javascript
// D:\сайт\js\search.js
import { getSupabase } from './app.js';

let currentFilters = {
  search: '',
  subject: '',
  minPrice: 0,
  maxPrice: 10000,
  sortBy: 'rating'
};

export async function loadMentors() {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'mentor');

  if (currentFilters.search) {
    query = query.or(`full_name.ilike.%${currentFilters.search}%,subjects.cs.{${currentFilters.search}}`);
  }

  if (currentFilters.subject) {
    query = query.contains('subjects', [currentFilters.subject]);
  }

  query = query
    .gte('price_per_hour', currentFilters.minPrice)
    .lte('price_per_hour', currentFilters.maxPrice);

  switch (currentFilters.sortBy) {
    case 'rating':
      query = query.order('rating', { ascending: false });
      break;
    case 'price_asc':
      query = query.order('price_per_hour', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price_per_hour', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data } = await query;
  return data || [];
}

export function setFilter(key, value) {
  currentFilters[key] = value;
}

export function getFilters() {
  return { ...currentFilters };
}

export function renderMentorCards(mentors, container) {
  if (!mentors.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem; color:var(--text-secondary);">
        <p style="font-size:1.25rem; margin-bottom:0.5rem;">Менторы не найдены</p>
        <p>Попробуйте изменить фильтры</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mentors.map(m => `
    <a href="profile.html?id=${m.id}" class="card mentor-card">
      <div class="mentor-card-header">
        <div class="mentor-avatar">${m.full_name?.charAt(0) || '?'}</div>
        <div>
          <div class="mentor-name">${m.full_name}</div>
          <div class="mentor-rating">${'★'.repeat(Math.round(m.rating))} ${m.rating.toFixed(1)}</div>
        </div>
      </div>
      <div class="mentor-subjects">
        ${m.subjects?.map(s => `<span class="tag">${s}</span>`).join('') || ''}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="mentor-price">${m.price_per_hour} ₽ <span>/ час</span></div>
        ${m.subscription_plan === 'pro' ? '<span class="tag" style="background:#fef3c7; color:#d97706;">PRO</span>' : ''}
      </div>
    </a>
  `).join('');
}
```

- [ ] **Step 2: Create mentors.html**

```html
<!-- D:\сайт\mentors.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Менторы — MentorHub</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="navbar"></header>

  <main class="container" style="padding-top:2rem; padding-bottom:2rem;">
    <h1 style="margin-bottom:1.5rem;">Найти ментора</h1>

    <div class="search-bar">
      <input type="text" class="search-input" id="search-input"
             placeholder="Поиск по имени или теме...">

      <select class="search-select" id="filter-subject">
        <option value="">Все темы</option>
        <option value="Программирование">Программирование</option>
        <option value="Дизайн">Дизайн</option>
        <option value="Маркетинг">Маркетинг</option>
        <option value="Бизнес">Бизнес</option>
        <option value="Математика">Математика</option>
        <option value="Языки">Языки</option>
        <option value="Музыка">Музыка</option>
      </select>

      <select class="search-select" id="filter-sort">
        <option value="rating">По рейтингу</option>
        <option value="price_asc">Дешевле</option>
        <option value="price_desc">Дороже</option>
        <option value="newest">Новые</option>
      </select>
    </div>

    <div class="card-grid" id="mentors-grid"></div>
  </main>

  <footer class="footer"></footer>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { loadMentors, setFilter, renderMentorCards } from './js/search.js';

    async function render() {
      const mentors = await loadMentors();
      renderMentorCards(mentors, document.getElementById('mentors-grid'));
    }

    document.getElementById('search-input').addEventListener('input', (e) => {
      setFilter('search', e.target.value);
      render();
    });

    document.getElementById('filter-subject').addEventListener('change', (e) => {
      setFilter('subject', e.target.value);
      render();
    });

    document.getElementById('filter-sort').addEventListener('change', (e) => {
      setFilter('sortBy', e.target.value);
      render();
    });

    render();
  </script>
</body>
</html>
```

- [ ] **Step 3: Test search**

1. Open `mentors.html`
2. Verify search input filters by name/subject
3. Test subject dropdown filters
4. Test sort options (rating, price, newest)
5. Verify empty state shows when no results

- [ ] **Step 4: Commit**

```bash
git add mentors.html js/search.js
git commit -m "feat: mentor catalog with search and filters"
```

---

### Task 4: Mentor Profile + Reviews

**Covers:** [S2]

**Files:**
- Create: `D:\сайт\profile.html`
- Create: `D:\сайт\js\profile.js`

- [ ] **Step 1: Create profile.js**

```javascript
// D:\сайт\js\profile.js
import { getSupabase, formatDate } from './app.js';

export async function loadProfile(id) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  return data;
}

export async function loadReviews(mentorId) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from('reviews')
    .select('*, bookings!inner(mentor_id, student_id, profiles!bookings_student_id_fkey(full_name))')
    .eq('bookings.mentor_id', mentorId)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getAvailableSlots(mentorId, date) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: booked } = await supabase
    .from('bookings')
    .select('booking_time')
    .eq('mentor_id', mentorId)
    .eq('booking_date', date)
    .neq('status', 'cancelled');

  const bookedTimes = booked?.map(b => b.booking_time) || [];

  const allSlots = [
    '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00',
    '17:00', '18:00', '19:00', '20:00'
  ];

  return allSlots.map(time => ({
    time,
    available: !bookedTimes.includes(time)
  }));
}

export function renderProfile(mentor, container) {
  if (!mentor) {
    container.innerHTML = '<p style="text-align:center;padding:3rem;">Ментор не найден</p>';
    return;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 350px; gap:2rem;">
      <div>
        <div class="card" style="margin-bottom:1.5rem;">
          <div class="mentor-card-header" style="margin-bottom:1.5rem;">
            <div class="mentor-avatar" style="width:80px;height:80px;font-size:2rem;">
              ${mentor.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <div class="mentor-name" style="font-size:1.5rem;">${mentor.full_name}</div>
              <div class="mentor-rating" style="font-size:1rem;">
                ${'★'.repeat(Math.round(mentor.rating))} ${mentor.rating.toFixed(1)}
              </div>
              ${mentor.subscription_plan === 'pro'
                ? '<span class="tag" style="background:#fef3c7; color:#d97706;">PRO МЕНТОР</span>'
                : ''}
            </div>
          </div>

          <div class="mentor-subjects" style="margin-bottom:1.5rem;">
            ${mentor.subjects?.map(s => `<span class="tag">${s}</span>`).join('') || ''}
          </div>

          <div style="margin-bottom:1.5rem;">
            <h3 style="margin-bottom:0.5rem;">О себе</h3>
            <p style="color:var(--text-secondary);">${mentor.bio || 'Пока нет описания'}</p>
          </div>

          <div class="mentor-price" style="font-size:1.5rem;">
            ${mentor.price_per_hour} ₽ <span style="font-size:1rem;">/ час</span>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:1rem;">Отзывы</h3>
          <div id="reviews-list"></div>
        </div>
      </div>

      <div class="card" style="position:sticky; top:6rem; height:fit-content;">
        <h3 style="margin-bottom:1rem;">Записаться на встречу</h3>
        <form id="booking-form">
          <div class="form-group">
            <label class="form-label">Дата</label>
            <input type="date" class="form-input" id="booking-date" required
                   min="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Доступное время</label>
            <div class="booking-slots" id="time-slots"></div>
            <input type="hidden" id="booking-time" required>
          </div>
          <div class="form-group">
            <label class="form-label">Опишите ваш запрос</label>
            <textarea class="form-input" id="booking-desc" rows="3"
                      placeholder="Чем могу помочь?"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">
            Записаться — ${mentor.price_per_hour} ₽
          </button>
        </form>
      </div>
    </div>
  `;
}

export function renderReviews(reviews, container) {
  if (!reviews.length) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Пока нет отзывов</p>';
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div style="border-bottom:1px solid var(--border); padding:1rem 0;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <strong>${r.profiles?.full_name || 'Ученик'}</strong>
        <span style="color:var(--warning);">${'★'.repeat(r.rating)}</span>
      </div>
      <p style="color:var(--text-secondary); font-size:0.875rem;">${r.comment}</p>
    </div>
  `).join('');
}

export function renderTimeSlots(slots, container) {
  container.innerHTML = slots.map(s => `
    <div class="time-slot ${s.available ? '' : 'disabled'}"
         data-time="${s.time}" ${s.available ? '' : 'data-disabled'}>
      ${s.time}
    </div>
  `).join('');

  container.querySelectorAll('.time-slot:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('booking-time').value = el.dataset.time;
    });
  });
}
```

- [ ] **Step 2: Create profile.html**

```html
<!-- D:\сайт\profile.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Профиль ментора — MentorHub</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="navbar"></header>

  <main class="container" style="padding-top:2rem; padding-bottom:2rem;">
    <div id="profile-content">
      <p style="text-align:center;padding:3rem;">Загрузка...</p>
    </div>
  </main>

  <footer class="footer"></footer>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { loadProfile, loadReviews, getAvailableSlots,
             renderProfile, renderReviews, renderTimeSlots } from './js/profile.js';
    import { getSupabase, getUser, showToast } from './js/app.js';

    const params = new URLSearchParams(window.location.search);
    const mentorId = params.get('id');

    async function init() {
      if (!mentorId) {
        document.getElementById('profile-content').innerHTML =
          '<p style="text-align:center;padding:3rem;">Ментор не указан</p>';
        return;
      }

      const mentor = await loadProfile(mentorId);
      renderProfile(mentor, document.getElementById('profile-content'));

      const reviews = await loadReviews(mentorId);
      renderReviews(reviews, document.getElementById('reviews-list'));

      const dateInput = document.getElementById('booking-date');
      dateInput.addEventListener('change', async () => {
        const slots = await getAvailableSlots(mentorId, dateInput.value);
        renderTimeSlots(slots, document.getElementById('time-slots'));
      });

      document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getUser();
        if (!user) {
          showToast('Войдите, чтобы записаться', 'error');
          window.location.href = 'login.html';
          return;
        }

        const supabase = getSupabase();
        const { error } = await supabase.from('bookings').insert({
          mentor_id: mentorId,
          student_id: user.id,
          booking_date: dateInput.value,
          booking_time: document.getElementById('booking-time').value,
          description: document.getElementById('booking-desc').value
        });

        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Заявка отправлена! Ментор подтвердит встречу.');
          setTimeout(() => window.location.href = 'dashboard.html', 1500);
        }
      });
    }

    init();
  </script>
</body>
</html>
```

- [ ] **Step 3: Test profile page**

1. Navigate to `profile.html?id=SOME_MENTOR_ID`
2. Verify mentor info displays (name, rating, subjects, bio, price)
3. Select a date → available time slots appear
4. Click a time slot → it highlights
5. Submit booking form → verify success toast
6. Check reviews section renders

- [ ] **Step 4: Commit**

```bash
git add profile.html js/profile.js
git commit -m "feat: mentor profile page with booking and reviews"
```

---

### Task 5: Dashboard (Mentor + Student Views)

**Covers:** [S4]

**Files:**
- Create: `D:\сайт\dashboard.html`
- Create: `D:\сайт\js\dashboard.js`

- [ ] **Step 1: Create dashboard.js**

```javascript
// D:\сайт\js\dashboard.js
import { getSupabase, getUser, getUserRole, formatDate, formatTime, showToast } from './app.js';

export async function loadDashboard() {
  const user = getUser();
  if (!user) return null;

  const supabase = getSupabase();
  const role = getUserRole();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  let bookings = [];
  if (role === 'mentor') {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_student_id_fkey(full_name, avatar_url)')
      .eq('mentor_id', user.id)
      .order('booking_date', { ascending: true });
    bookings = data || [];
  } else {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_mentor_id_fkey(full_name, avatar_url, price_per_hour)')
      .eq('student_id', user.id)
      .order('booking_date', { ascending: true });
    bookings = data || [];
  }

  return { profile, bookings, role };
}

export function renderDashboard(data, container) {
  if (!data) return;

  const { profile, bookings, role } = data;

  container.innerHTML = `
    <div class="dashboard-header">
      <h1>Привет, ${profile?.full_name || 'Пользователь'}!</h1>
      <p style="color:var(--text-secondary);">${role === 'mentor' ? 'Панель ментора' : 'Мои записи'}</p>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-sidebar">
        <div style="text-align:center; margin-bottom:1.5rem;">
          <div class="mentor-avatar" style="width:80px;height:80px;font-size:2rem;margin:0 auto 0.5rem;">
            ${profile?.full_name?.charAt(0) || '?'}
          </div>
          <strong>${profile?.full_name}</strong>
          <div style="color:var(--text-secondary); font-size:0.875rem;">${role === 'mentor' ? 'Ментор' : 'Ученик'}</div>
        </div>
        <nav class="sidebar-nav">
          <a href="#" class="active">Мои записи</a>
          ${role === 'mentor' ? '<a href="#" id="edit-profile-link">Редактировать профиль</a>' : ''}
          ${role === 'mentor'
            ? `<div style="margin-top:1rem; padding:1rem; background:var(--bg); border-radius:8px;">
                <div style="font-size:0.8125rem; color:var(--text-secondary);">План</div>
                <div style="font-weight:700; font-size:1.25rem;">${profile?.subscription_plan === 'pro' ? 'PRO' : 'Free'}</div>
                ${profile?.subscription_plan !== 'pro'
                  ? '<button class="btn btn-primary btn-sm" style="width:100%; margin-top:0.5rem;" onclick="upgradeToPro()">Upgrade to PRO</button>'
                  : ''}
              </div>`
            : ''}
        </nav>
      </div>

      <div>
        <h2 style="margin-bottom:1rem;">Записи</h2>
        <div id="bookings-list"></div>
      </div>
    </div>
  `;
}

export function renderBookings(bookings, container, role) {
  if (!bookings.length) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Пока нет записей</p>';
    return;
  }

  container.innerHTML = bookings.map(b => {
    const otherPerson = role === 'mentor' ? b.profiles?.full_name : b.profiles?.full_name;
    const statusColors = {
      pending: 'background:#fef3c7; color:#d97706;',
      confirmed: 'background:#dcfce7; color:#16a34a;',
      cancelled: 'background:#fee2e2; color:#dc2626;'
    };
    const statusText = {
      pending: 'Ожидает',
      confirmed: 'Подтверждена',
      cancelled: 'Отменена'
    };

    return `
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div>
            <div style="font-weight:600; margin-bottom:0.25rem;">
              ${role === 'mentor' ? 'Ученик: ' : 'Ментор: '}${otherPerson}
            </div>
            <div style="color:var(--text-secondary); font-size:0.875rem;">
              ${formatDate(b.booking_date)} в ${formatTime(b.booking_time)}
            </div>
            ${b.description ? `<div style="margin-top:0.5rem; color:var(--text-secondary);">${b.description}</div>` : ''}
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span style="padding:0.25rem 0.75rem; border-radius:999px; font-size:0.8125rem; font-weight:500; ${statusColors[b.status]}">
              ${statusText[b.status]}
            </span>
            ${role === 'mentor' && b.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="confirmBooking('${b.id}')">Подтвердить</button>
              <button class="btn btn-secondary btn-sm" onclick="cancelBooking('${b.id}')">Отклонить</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export async function confirmBooking(id) {
  const supabase = getSupabase();
  await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
  showToast('Встреча подтверждена!');
  location.reload();
}

export async function cancelBooking(id) {
  const supabase = getSupabase();
  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
  showToast('Встреча отменена');
  location.reload();
}

export async function upgradeToPro() {
  showToast('Интеграция с ЮKassa в разработке');
}
```

- [ ] **Step 2: Create dashboard.html**

```html
<!-- D:\сайт\dashboard.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Кабинет — MentorHub</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="navbar"></header>

  <main class="container" style="padding-bottom:2rem;">
    <div id="dashboard-content">
      <p style="text-align:center;padding:3rem;">Загрузка...</p>
    </div>
  </main>

  <footer class="footer"></footer>

  <script type="module" src="js/app.js"></script>
  <script type="module">
    import { loadDashboard, renderDashboard, renderBookings,
             confirmBooking, cancelBooking, upgradeToPro } from './js/dashboard.js';
    import { getUser } from './js/app.js';

    window.confirmBooking = confirmBooking;
    window.cancelBooking = cancelBooking;
    window.upgradeToPro = upgradeToPro;

    async function init() {
      if (!getUser()) {
        window.location.href = 'login.html';
        return;
      }

      const data = await loadDashboard();
      renderDashboard(data, document.getElementById('dashboard-content'));
      renderBookings(data?.bookings || [], document.getElementById('bookings-list'), data?.role);
    }

    init();
  </script>
</body>
</html>
```

- [ ] **Step 3: Test dashboard**

1. Login as student → verify "Мои записи" shows bookings
2. Login as mentor → verify bookings list + confirm/cancel buttons
3. Confirm a booking → status changes to "Подтверждена"
4. Cancel a booking → status changes to "Отменена"

- [ ] **Step 4: Commit**

```bash
git add dashboard.html js/dashboard.js
git commit -m "feat: dashboard with mentor and student views"
```

---

### Task 6: Final Integration + Testing

**Covers:** [S1-S6]

**Files:** All files

- [ ] **Step 1: Test complete user flow**

Test as Student:
1. Register → login → browse mentors → search → filter
2. Open mentor profile → select date/time → book
3. View booking in dashboard

Test as Mentor:
1. Register as mentor → login → edit profile
2. View incoming bookings → confirm/cancel
3. Receive reviews after completed sessions

- [ ] **Step 2: Test responsive design**

1. Open on mobile viewport (375px)
2. Verify navbar collapses
3. Verify cards stack vertically
4. Verify forms are usable

- [ ] **Step 3: Test edge cases**

1. Empty states (no mentors, no bookings)
2. Error handling (network failure, invalid data)
3. Auth guards (redirect to login when unauthorized)

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: mentoring marketplace MVP complete"
```

---

## Deployment

1. Create Supabase project at supabase.com
2. Run `supabase/schema.sql` in SQL Editor
3. Update `js/config.js` with your Supabase URL and anon key
4. Deploy static files to Vercel/Netlify/Cloudflare Pages
5. Configure OAuth redirects in Supabase dashboard

---

## Notes

- **No payment integration yet** — upgradeToPro() shows placeholder
- **Email notifications** — Supabase Edge Functions can send emails on booking status changes
- **Image uploads** — Supabase Storage for mentor avatars
- **Admin panel** — not in MVP scope
