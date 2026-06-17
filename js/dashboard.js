async function loadDashboard() {
  const user = await getUser();
  if (!user) return null;

  const client = getSupabase();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Profile error:', profileError);
    return { user, profile: null, role: 'student', bookings: [] };
  }

  const role = profile?.role || 'student';
  const isMentor = role === 'mentor';

  let bookings = [];
  if (isMentor) {
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('mentor_id', user.id)
      .order('booking_date', { ascending: false });
    
    if (!error && data) {
      const studentIds = [...new Set(data.map(b => b.student_id))];
      if (studentIds.length > 0) {
        const { data: students } = await client
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);
        
        const studentsMap = {};
        (students || []).forEach(s => studentsMap[s.id] = s.full_name);
        
        bookings = data.map(b => ({
          ...b,
          profiles: { full_name: studentsMap[b.student_id] || 'Неизвестно' }
        }));
      }
    }
  } else {
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('student_id', user.id)
      .order('booking_date', { ascending: false });
    
    if (!error && data) {
      const mentorIds = [...new Set(data.map(b => b.mentor_id))];
      if (mentorIds.length > 0) {
        const { data: mentors } = await client
          .from('profiles')
          .select('id, full_name')
          .in('id', mentorIds);
        
        const mentorsMap = {};
        (mentors || []).forEach(m => mentorsMap[m.id] = m.full_name);
        
        bookings = data.map(b => ({
          ...b,
          profiles: { full_name: mentorsMap[b.mentor_id] || 'Неизвестно' }
        }));
      }
    }
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
  const avatarChar = escapeHtml(name.charAt(0));
  const plan = profile?.subscription || 'free';

  container.innerHTML = `
    <div class="dashboard-grid">
      <aside class="dashboard-sidebar">
        <div class="sidebar-profile">
          <div class="sidebar-profile__avatar">${avatarChar}</div>
          <div class="sidebar-profile__name">${escapeHtml(name)}</div>
          <div class="sidebar-profile__role">${isMentor ? 'Ментор' : 'Ученик'}</div>
        </div>
        <nav class="sidebar-nav">
          <a href="dashboard.html" class="active">Мои записи</a>
          ${isMentor ? `<a href="profile.html?id=${data.user.id}">Мой профиль</a>` : ''}
          ${isMentor ? '<a href="#">Расписание</a>' : ''}
          ${!isMentor ? '<a href="mentors.html">Найти ментора</a>' : ''}
        </nav>
        <div class="plan-card ${plan === 'pro' ? 'plan-card--pro' : ''}">
          <div class="plan-card__title">${plan === 'pro' ? 'Pro' : 'Free'}</div>
          <div class="plan-card__desc">${plan === 'pro' ? 'Безлимитные записи и приоритет в поиске' : 'До 3 активных записей'}</div>
          ${plan === 'free' ? '<button class="btn btn--primary btn--sm" style="width:100%;" onclick="upgradeToPro()">Перейти на Pro</button>' : ''}
        </div>
      </aside>
      <main class="dashboard-main">
        <div class="dashboard__header">
          <h1>Привет, ${escapeHtml(name.split(' ')[0])}!</h1>
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
        <div class="empty-state__icon">📅</div>
        <div class="empty-state__text">Пока нет записей</div>
        ${role === 'student' ? '<a href="mentors.html" class="btn btn--primary">Найти ментора</a>' : ''}
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
      <div class="booking-item">
        <div class="booking-item__avatar">${escapeHtml(otherName.charAt(0))}</div>
        <div class="booking-item__info">
          <div class="booking-item__name">${escapeHtml(otherName)}</div>
          <div class="booking-item__meta">
            <span>📅 ${formatDate(b.booking_date)}</span>
            <span>🕐 ${formatTime(b.time_slot)}</span>
          </div>
          ${b.description ? `<div class="booking-item__desc">${escapeHtml(b.description)}</div>` : ''}
          ${role === 'mentor' ? `
            <div class="booking-item__actions">
              ${isPending ? `
                <button class="btn btn--primary btn--sm" onclick="confirmBooking('${b.id}')">Подтвердить</button>
                <button class="btn btn--danger btn--sm" onclick="cancelBooking('${b.id}')">Отклонить</button>
              ` : ''}
              ${!isPending && b.status !== 'cancelled' ? `
                <button class="btn btn--ghost btn--sm" onclick="cancelBooking('${b.id}')">Отменить</button>
              ` : ''}
            </div>
          ` : ''}
        </div>
        <div class="booking-item__status">
          <span class="status-badge status-badge--${statusClass}">${statusText}</span>
        </div>
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

  showToast('Запись подтверждена!');
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

async function reloadDashboard() {
  const data = await loadDashboard();
  const container = document.getElementById('dashboard-content');
  if (data && container) {
    renderDashboard(data, container);
  }
}
