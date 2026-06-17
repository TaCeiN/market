async function loadDashboard() {
  const user = await getUser();
  if (!user) return null;

  const client = getSupabase();
  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'student';
  const isMentor = role === 'mentor';

  let bookings = [];
  if (isMentor) {
    const { data } = await client
      .from('bookings')
      .select('*, profiles!bookings_student_id_fkey(full_name)')
      .eq('mentor_id', user.id)
      .order('booking_date', { ascending: false });
    bookings = data || [];
  } else {
    const { data } = await client
      .from('bookings')
      .select('*, profiles!bookings_mentor_id_fkey(full_name)')
      .eq('student_id', user.id)
      .order('booking_date', { ascending: false });
    bookings = data || [];
  }

  return { user, profile, role, bookings };
}

function renderDashboard(data, container) {
  if (!data) {
    container.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:60px 0;">Не удалось загрузить данные</p>';
    return;
  }

  const { profile, role, bookings } = data;
  const isMentor = role === 'mentor';
  const name = profile?.full_name || 'Пользователь';
  const avatarChar = name.charAt(0);
  const plan = profile?.subscription || 'free';

  container.innerHTML = `
    <div class="dashboard-grid">
      <aside class="dashboard-sidebar">
        <div class="sidebar-profile">
          <div class="sidebar-profile__avatar">${escapeHtml(avatarChar)}</div>
          <div class="sidebar-profile__name">${escapeHtml(name)}</div>
          <div class="sidebar-profile__role">${isMentor ? 'Ментор' : 'Ученик'}</div>
        </div>
        <nav class="sidebar-nav">
          <a href="dashboard.html" class="active">Мои записи</a>
          ${isMentor ? '<a href="profile.html?id=' + data.user.id + '">Профиль</a>' : ''}
          ${isMentor ? '<a href="#">Расписание</a>' : ''}
        </nav>
        <div class="plan-card ${plan === 'pro' ? 'plan-card--pro' : ''}">
          <div class="plan-card__title">${plan === 'pro' ? 'Pro' : 'Free'}</div>
          <div class="plan-card__desc">${plan === 'pro' ? 'Безлимитные записи и приоритет' : 'Ограниченное количество записей'}</div>
          ${plan === 'free' ? '<button class="btn btn--primary btn--sm" style="width:100%;margin-top:8px;" onclick="upgradeToPro()">Перейти на Pro</button>' : ''}
        </div>
      </aside>
      <main class="dashboard-main">
        <div class="dashboard__header">
          <h1>Привет, ${name.split(' ')[0]}!</h1>
          <p>${isMentor ? 'Управляйте своими записями и расписанием' : 'Ваши записи к менторам'}</p>
        </div>
        <div id="bookings-container"></div>
      </main>
    </div>
  `;

  renderBookings(bookings, document.getElementById('bookings-container'), role);
}

function renderBookings(bookings, container, role) {
  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Пока нет записей</p>
        ${role === 'student' ? '<a href="mentors.html" class="btn btn--primary" style="margin-top:12px;">Найти ментора</a>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const otherName = b.profiles?.full_name || 'Неизвестно';
    const statusClass = b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning';
    const statusText = b.status === 'confirmed' ? 'Подтверждено' : b.status === 'cancelled' ? 'Отменено' : 'Ожидает';
    const isPending = b.status === 'pending';

    return `
      <div class="booking-card">
        <div class="booking-card__info">
          <div class="booking-card__name">${escapeHtml(otherName)}</div>
          <div class="booking-card__meta">${formatDate(b.booking_date)} в ${formatTime(b.time_slot)}</div>
          ${b.description ? `<div class="booking-card__desc">${escapeHtml(b.description)}</div>` : ''}
        </div>
        <div class="booking-card__status">
          <span class="status-badge status-badge--${statusClass}">${statusText}</span>
        </div>
        ${role === 'mentor' && isPending ? `
          <div class="booking-card__actions">
            <button class="btn btn--primary btn--sm" onclick="confirmBooking('${b.id}')">Подтвердить</button>
            <button class="btn btn--danger btn--sm" onclick="cancelBooking('${b.id}')">Отменить</button>
          </div>
        ` : ''}
        ${role === 'mentor' && !isPending ? `
          <div class="booking-card__actions">
            ${b.status !== 'cancelled' ? `<button class="btn btn--danger btn--sm" onclick="cancelBooking('${b.id}')">Отменить</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function confirmBooking(id) {
  const client = getSupabase();
  const { error } = await client
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', id);

  if (error) {
    showToast('Ошибка: ' + error.message, 'error');
    return;
  }

  showToast('Запись подтверждена');
  await reloadDashboard();
}

async function cancelBooking(id) {
  const client = getSupabase();
  const { error } = await client
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    showToast('Ошибка: ' + error.message, 'error');
    return;
  }

  showToast('Запись отменена');
  await reloadDashboard();
}

async function upgradeToPro() {
  showToast('Интеграция с ЮKassa в разработке', 'warning');
}

let dashboardData = null;

async function reloadDashboard() {
  dashboardData = await loadDashboard();
  const container = document.getElementById('dashboard-content');
  if (dashboardData && container) {
    renderDashboard(dashboardData, container);
  }
}
