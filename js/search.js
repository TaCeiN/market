let currentFilters = {
  search: '',
  subject: '',
  minPrice: null,
  maxPrice: null,
  sortBy: 'rating'
};

function setFilter(key, value) {
  currentFilters[key] = value;
}

function getFilters() {
  return { ...currentFilters };
}

async function loadMentors() {
  const client = getSupabase();
  let query = client
    .from('profiles')
    .select('*')
    .eq('role', 'mentor');

  if (currentFilters.search) {
    query = query.or(`full_name.ilike.%${currentFilters.search}%,topics.cs.{${currentFilters.search}}`);
  }

  if (currentFilters.subject) {
    query = query.contains('topics', [currentFilters.subject]);
  }

  if (currentFilters.minPrice !== null) {
    query = query.gte('price_per_hour', currentFilters.minPrice);
  }

  if (currentFilters.maxPrice !== null) {
    query = query.lte('price_per_hour', currentFilters.maxPrice);
  }

  const sortMap = {
    rating: { column: 'rating', ascending: false },
    price_asc: { column: 'price_per_hour', ascending: true },
    price_desc: { column: 'price_per_hour', ascending: false },
    new: { column: 'created_at', ascending: false }
  };

  const sort = sortMap[currentFilters.sortBy] || sortMap.rating;
  query = query.order(sort.column, { ascending: sort.ascending });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  return stars || '☆';
}

function renderMentorCards(mentors, container) {
  if (!mentors || mentors.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 40px;background:var(--white);border-radius:var(--radius-lg);box-shadow:var(--shadow);">
        <div style="font-size:3rem;margin-bottom:16px;opacity:0.5;">🔍</div>
        <p style="font-size:1.1rem;color:var(--gray-500);margin-bottom:8px;">Менторы не найдены</p>
        <p style="font-size:0.9rem;color:var(--gray-400);">Попробуйте изменить параметры поиска</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mentors.map(m => {
    const name = escapeHtml(m.full_name || 'Ментор');
    const avatar = name.charAt(0);
    const topics = (m.topics || []).slice(0, 3);
    const rating = m.rating || 0;
    const stars = renderStars(rating);
    
    return `
      <a href="profile.html?id=${m.id}" class="mentor-card">
        <div class="mentor-card__header">
          <div class="mentor-card__avatar">${avatar}</div>
          <div>
            <div class="mentor-card__name">${name}</div>
            <div class="mentor-card__rating">${stars} ${rating.toFixed(1)}</div>
          </div>
        </div>
        <div class="mentor-card__topics">
          ${topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="mentor-card__price">
          <strong>${m.price_per_hour || '—'} ₽</strong>
          <span>/ час</span>
        </div>
      </a>
    `;
  }).join('');
}
