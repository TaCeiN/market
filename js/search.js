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
  return stars || '0';
}

function renderMentorCards(mentors, container) {
  if (!mentors || mentors.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--gray-500);">
        <p style="font-size:1.1rem;margin-bottom:8px;">Менторы не найдены</p>
        <p style="font-size:0.9rem;">Попробуйте изменить параметры поиска</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mentors.map(m => `
    <a href="profile.html?id=${m.id}" class="mentor-card">
      <div class="mentor-card__avatar">${escapeHtml(m.full_name.charAt(0))}</div>
      <div class="mentor-card__name">${escapeHtml(m.full_name)}</div>
      <div class="mentor-card__rating">${renderStars(m.rating || 0)} ${m.rating || '0.0'}</div>
      <div class="mentor-card__topics">
        ${(m.topics || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="mentor-card__price"><span>${m.price_per_hour || '—'} ₽</span> / час</div>
    </a>
  `).join('');
}
