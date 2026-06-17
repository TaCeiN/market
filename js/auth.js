async function login(email, password) {
  const client = getSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

async function register(email, password, fullName, role) {
  const client = getSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password
  });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await client
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: fullName,
        role: role
      });
    if (profileError) throw profileError;
  }

  return data;
}

async function loginWithGoogle() {
  const client = getSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google'
  });
  if (error) throw error;
}

function initAuthForm() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const isRegister = mode === 'register';

  const title = document.getElementById('auth-title');
  const form = document.getElementById('auth-form');
  const toggle = document.getElementById('auth-toggle');
  const fullNameGroup = document.getElementById('full-name-group');
  const roleGroup = document.getElementById('role-group');
  const submitBtn = document.getElementById('auth-submit');
  const googleBtn = document.getElementById('google-btn');

  if (isRegister) {
    title.textContent = 'Регистрация';
    submitBtn.textContent = 'Зарегистрироваться';
    fullNameGroup.style.display = 'block';
    roleGroup.style.display = 'block';
    toggle.innerHTML = 'Уже есть аккаунт? <a href="login.html">Войти</a>';
  } else {
    title.textContent = 'Вход';
    submitBtn.textContent = 'Войти';
    fullNameGroup.style.display = 'none';
    roleGroup.style.display = 'none';
    toggle.innerHTML = 'Нет аккаунта? <a href="login.html?mode=register">Зарегистрироваться</a>';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    submitBtn.disabled = true;

    try {
      if (isRegister) {
        const fullName = form.full_name.value.trim();
        const role = form.role.value;
        if (!fullName) {
          showToast('Введите полное имя', 'error');
          return;
        }
        if (!role) {
          showToast('Выберите роль', 'error');
          return;
        }
        await register(email, password, fullName, role);
        showToast('Регистрация успешна! Проверьте почту для подтверждения.', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      } else {
        await login(email, password);
        showToast('Вход выполнен успешно!', 'success');
        window.location.href = 'dashboard.html';
      }
    } catch (err) {
      const messages = {
        'Invalid login credentials': 'Неверный email или пароль',
        'User already registered': 'Пользователь уже зарегистрирован',
        'Password should be at least 6 characters': 'Пароль должен содержать минимум 6 символов',
        'Unable to validate email address: invalid format': 'Некорректный формат email'
      };
      showToast(messages[err.message] || err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      showToast('Ошибка авторизации через Google', 'error');
    }
  });
}
