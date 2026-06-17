async function loadProfile(id) {
  const client = getSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function loadReviews(mentorId) {
  const client = getSupabase();
  const { data, error } = await client
    .from('reviews')
    .select('*')
    .eq('mentor_id', mentorId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!data || data.length === 0) return [];

  const studentIds = [...new Set(data.map(r => r.student_id))];
  const { data: students } = await client
    .from('profiles')
    .select('id, full_name')
    .in('id', studentIds);

  const studentsMap = {};
  (students || []).forEach(s => studentsMap[s.id] = s.full_name);

  return data.map(r => ({
    ...r,
    profiles: { full_name: studentsMap[r.student_id] || 'Ученик' }
  }));
}

async function getAvailableSlots(mentorId, date) {
  const client = getSupabase();
  const d = new Date(date);
  const dayOfWeek = d.getDay();

  const { data: schedule } = await client
    .from('schedule')
    .select('*')
    .eq('mentor_id', mentorId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true);

  if (!schedule || schedule.length === 0) {
    const defaultSlots = [];
    for (let h = 9; h <= 20; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00:00`;
      const display = `${String(h).padStart(2, '0')}:00`;
      defaultSlots.push({ time: timeStr, display, booked: false });
    }
    return defaultSlots;
  }

  const { data: bookings } = await client
    .from('bookings')
    .select('time_slot')
    .eq('mentor_id', mentorId)
    .eq('booking_date', date)
    .neq('status', 'cancelled');

  const booked = new Set((bookings || []).map(b => b.time_slot));
  const slots = [];

  for (const s of schedule) {
    let [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    while (sh < eh || (sh === eh && sm < em)) {
      const timeStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
      const display = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      slots.push({ time: timeStr, display, booked: booked.has(timeStr) });
      sm += 60;
      if (sm >= 60) { sh++; sm -= 60; }
    }
  }
  return slots;
}

function renderProfile(mentor, container) {
  const name = escapeHtml(mentor.full_name || 'Ментор');
  const avatar = name.charAt(0);
  const topics = (mentor.topics || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const today = new Date().toISOString().split('T')[0];
  const rating = mentor.rating || 0;
  const stars = renderStars(rating);

  container.innerHTML = `
    <div class="profile-layout">
      <div class="profile-main">
        <div class="profile-card">
          <div class="profile-header">
            <div class="profile-header__avatar">${avatar}</div>
            <div class="profile-header__info">
              <h1>${name}</h1>
              <div class="profile-header__rating">
                <span class="stars">${stars} ${rating.toFixed(1)}</span>
                <span class="count">(${mentor.reviews_count || 0} отзывов)</span>
              </div>
            </div>
          </div>
          <div class="profile-topics">${topics}</div>
          ${mentor.bio ? `<p class="profile-bio">${escapeHtml(mentor.bio)}</p>` : ''}
          <div class="profile-price">
            <strong>${mentor.price_per_hour || '—'} ₽</strong>
            <span>/ час</span>
          </div>
        </div>

        <div class="reviews-section">
          <h3>Отзывы</h3>
          <div id="reviews-container"></div>
        </div>
      </div>

      <div class="booking-sidebar">
        <div class="booking-card">
          <h3>Записаться на консультацию</h3>
          <div class="form-group">
            <label for="booking-date">Дата</label>
            <input type="date" id="booking-date" min="${today}" value="${today}">
          </div>
          <div id="slots-container" class="slots-grid"></div>
          <form id="booking-form" style="display:none;">
            <input type="hidden" id="selected-time">
            <div class="form-group">
              <label for="booking-desc">Описание запроса</label>
              <textarea id="booking-desc" rows="3" placeholder="Опишите, чем вам нужна помощь..."></textarea>
            </div>
            <button type="submit" class="btn btn--primary" style="width:100%;">Записаться</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('booking-date').addEventListener('change', async (e) => {
    await refreshSlots(mentor.id, e.target.value);
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitBooking(mentor.id);
  });

  refreshSlots(mentor.id, today);
}

function renderReviews(reviews, container) {
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);padding:20px 0;">Пока нет отзывов</p>';
    return;
  }
  container.innerHTML = reviews.map(r => `
    <div class="review">
      <div class="review__header">
        <span class="review__author">${escapeHtml(r.profiles?.full_name || 'Ученик')}</span>
        <span class="review__rating">${renderStars(r.rating)} ${r.rating}</span>
      </div>
      <div class="review__comment">${escapeHtml(r.comment || '')}</div>
    </div>
  `).join('');
}

function renderTimeSlots(slots, container) {
  if (!slots || slots.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);grid-column:1/-1;text-align:center;padding:20px 0;">Нет доступных слотов на эту дату</p>';
    return;
  }
  container.innerHTML = slots.map(s => `
    <div class="slot ${s.booked ? 'slot--disabled' : ''}" data-time="${s.time}" ${s.booked ? 'title="Уже занято"' : ''}>
      ${s.display}${s.booked ? ' ✕' : ''}
    </div>
  `).join('');

  if (!container._bound) {
    container.addEventListener('click', (e) => {
      const slot = e.target.closest('.slot');
      if (!slot || slot.classList.contains('slot--disabled')) return;
      container.querySelectorAll('.slot').forEach(s => s.classList.remove('slot--selected'));
      slot.classList.add('slot--selected');
      document.getElementById('selected-time').value = slot.dataset.time;
      document.getElementById('booking-form').style.display = 'block';
    });
    container._bound = true;
  }
}

async function refreshSlots(mentorId, date) {
  const container = document.getElementById('slots-container');
  const form = document.getElementById('booking-form');
  form.style.display = 'none';
  document.getElementById('selected-time').value = '';
  container.querySelectorAll('.slot').forEach(s => s.classList.remove('slot--selected'));

  const slots = await getAvailableSlots(mentorId, date);
  renderTimeSlots(slots, container);
}

async function submitBooking(mentorId) {
  const user = await getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const time = document.getElementById('selected-time').value;
  const date = document.getElementById('booking-date').value;
  const description = document.getElementById('booking-desc').value.trim();

  if (!time) {
    showToast('Выберите время', 'error');
    return;
  }

  const client = getSupabase();
  const { error } = await client
    .from('bookings')
    .insert({
      mentor_id: mentorId,
      student_id: user.id,
      booking_date: date,
      time_slot: time,
      description: description || null,
      status: 'pending'
    });

  if (error) {
    showToast('Ошибка при записи: ' + error.message, 'error');
    return;
  }

  showToast('Запись создана! Ментор подтвердит вашу заявку.');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
}
