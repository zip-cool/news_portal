/**
 * ========================================================================================
 * ТОЛСТЫЙ КЛИЕНТ: МОДУЛЬ ГЕНЕРАЦИИ UI НА СТОРОНЕ КЛИЕНТА (static/js/ui.js)
 * ========================================================================================
 * 
 * В архитектуре «Толстый клиент» генерация пользовательского интерфейса (Client-Side Rendering)
 * полностью выполняется в браузере с помощью JavaScript:
 * 
 * 1. Сервер НЕ отдает готовые HTML-страницы (нет Jinja2/PHP шаблонизации на сервере).
 * 2. Клиент отправляет асинхронный запрос к REST API (через модуль API) и получает "сырые" данные в JSON.
 * 3. Настоящий модуль (UI) принимает JSON-данные и программно конструирует DOM-элементы:
 *    - Карточки новостей, списки категорий, пагинацию;
 *    - Формы фильтрации, поиска и отправки комментариев;
 *    - Панель администратора (таблицы CRUD, модальные окна Bootstrap);
 *    - Интерактивные графики Chart.js на элементе <canvas>.
 * 4. Результат монтируется в единственный контейнер <main id="app-content">.
 * ========================================================================================
 */
const UI = {
    // Основные контейнеры DOM
    appContent: document.getElementById('app-content'),
    alertsContainer: document.getElementById('alerts-container'),
    navbarContainer: document.getElementById('navbar-container'),

    // ---------------------------------------------------------
    // Утилиты (вспомогательные функции форматирования и экранирования)
    // ---------------------------------------------------------
    showAlert(message, type = 'info') {
        const wrapper = document.createElement('div');
        wrapper.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
        wrapper.role = 'alert';
        wrapper.innerHTML = `
            <div>${message}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        this.alertsContainer.appendChild(wrapper);

        setTimeout(() => {
            wrapper.classList.remove('show');
            setTimeout(() => wrapper.remove(), 250);
        }, 4000);
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const clean = dateStr.replace(/[^0-9\- :]/g, '').trim();
            const parts = clean.split(' ');
            const dateParts = parts[0].split('-');
            if (dateParts.length === 3) {
                const day = dateParts[2];
                const month = dateParts[1];
                const year = dateParts[0];
                const time = parts[1] ? parts[1].substring(0, 5) : '';
                return `${day}.${month}.${year}${time ? ' ' + time : ''}`;
            }
        } catch (e) {
            return dateStr;
        }
        return dateStr;
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // ---------------------------------------------------------
    // Динамическая панель навигации
    // ---------------------------------------------------------
    renderNavbar() {
        const user = API.getUser();
        const isAdmin = API.isAdmin();
        const currentHash = window.location.hash || '#home';

        this.navbarContainer.innerHTML = `
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="#home">
                        <i class="fas fa-newspaper text-primary me-2"></i>Новостной портал
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav me-auto">
                            <li class="nav-item">
                                <a class="nav-link ${currentHash === '#home' || currentHash === '' ? 'active' : ''}" href="#home">Главная</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link ${currentHash.startsWith('#news') && !currentHash.startsWith('#admin') ? 'active' : ''}" href="#news">Новости</a>
                            </li>
                            ${isAdmin ? `
                                <li class="nav-item dropdown">
                                    <a class="nav-link dropdown-toggle ${currentHash.startsWith('#admin') ? 'active text-warning' : ''}" href="#" id="adminDropdown" role="button" data-bs-toggle="dropdown">
                                        <i class="fas fa-shield-alt me-1"></i>Админ панель
                                    </a>
                                    <ul class="dropdown-menu shadow">
                                        <li><a class="dropdown-item" href="#admin"><i class="fas fa-tachometer-alt me-2 text-primary"></i>Обзор</a></li>
                                        <li><a class="dropdown-item" href="#admin/news"><i class="fas fa-newspaper me-2 text-success"></i>Новости</a></li>
                                        <li><a class="dropdown-item" href="#admin/categories"><i class="fas fa-folder me-2 text-info"></i>Категории</a></li>
                                        <li><a class="dropdown-item" href="#admin/comments"><i class="fas fa-comments me-2 text-warning"></i>Комментарии</a></li>
                                        <li><a class="dropdown-item" href="#admin/users"><i class="fas fa-users me-2 text-secondary"></i>Пользователи</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" href="#admin/statistics"><i class="fas fa-chart-bar me-2 text-danger"></i>Статистика (Chart.js)</a></li>
                                    </ul>
                                </li>
                            ` : ''}
                        </ul>
                        <ul class="navbar-nav align-items-center">
                            ${user ? `
                                <li class="nav-item me-3 text-light">
                                    <span class="badge ${isAdmin ? 'bg-danger' : 'bg-primary'} px-3 py-2">
                                        <i class="fas fa-user-circle me-1"></i>${this.escapeHtml(user.username)}
                                        ${isAdmin ? ' (Админ)' : ''}
                                    </span>
                                </li>
                                <li class="nav-item">
                                    <button class="btn btn-outline-light btn-sm" id="nav-logout-btn">
                                        <i class="fas fa-sign-out-alt me-1"></i>Выйти
                                    </button>
                                </li>
                            ` : `
                                <li class="nav-item">
                                    <a class="nav-link ${currentHash === '#login' ? 'active' : ''}" href="#login">
                                        <i class="fas fa-sign-in-alt me-1"></i>Войти
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link ${currentHash === '#register' ? 'active' : ''}" href="#register">
                                        <i class="fas fa-user-plus me-1"></i>Регистрация
                                    </a>
                                </li>
                            `}
                        </ul>
                    </div>
                </div>
            </nav>
        `;

        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => API.logout());
        }
    },

    showLoading() {
        this.appContent.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка данных...</span>
                </div>
            </div>
        `;
    },

    // ---------------------------------------------------------
    // 1. Главная страница (Home View) — Генерация UI на клиенте
    // ---------------------------------------------------------
    /**
     * Отрисовка главной страницы:
     * 1. Включает индикатор загрузки (spinner).
     * 2. Выполняет асинхронный запрос к серверу: API.getHome() -> GET /api/news/home.
     * 3. Получив JSON с объектами {categories, hot_news, latest_news},
     *    динамически генерирует HTML-разметку карточек и категорий с помощью шаблонов JavaScript.
     * 4. Вставляет сгенерированный DOM в appContent без перезагрузки всей страницы.
     */
    async renderHome() {
        this.showLoading();
        try {
            const data = await API.getHome();
            const { categories, hot_news, latest_news } = data;

            let hotNewsHtml = '';
            if (hot_news && hot_news.length > 0) {
                hotNewsHtml = hot_news.map(item => `
                    <div class="card mb-4 news-card hot-news shadow-sm">
                        <div class="card-body">
                            <h3 class="card-title h4">${this.escapeHtml(item.title)}</h3>
                            <p class="card-text text-secondary">${this.escapeHtml(item.short_text)}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted"><i class="far fa-clock me-1"></i>${this.formatDate(item.date)}</small>
                                <a href="#news/${item.id}" class="btn btn-primary btn-sm">Читать далее &rarr;</a>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                hotNewsHtml = '<div class="alert alert-light border">Горячих новостей на данный момент нет.</div>';
            }

            const categoriesHtml = categories.map(cat => `
                <a href="#news?category=${cat.id}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    ${this.escapeHtml(cat.name)}
                    <span class="badge bg-primary rounded-pill">${cat.news_count || 0}</span>
                </a>
            `).join('');

            const latestNewsHtml = latest_news.map(item => `
                <div class="card mb-3 shadow-sm news-card">
                    <div class="card-body py-2">
                        <h6 class="card-title fw-bold mb-1">${this.escapeHtml(item.title)}</h6>
                        <small class="text-muted d-block mb-2"><i class="far fa-clock me-1"></i>${this.formatDate(item.date)}</small>
                        <a href="#news/${item.id}" class="btn btn-sm btn-outline-primary">Читать</a>
                    </div>
                </div>
            `).join('');

            this.appContent.innerHTML = `
                <div class="row">
                    <div class="col-lg-8">
                        <h2 class="mb-4"><i class="fas fa-fire text-danger me-2"></i>Горячие новости</h2>
                        ${hotNewsHtml}
                    </div>
                    <div class="col-lg-4">
                        <h3 class="mb-3"><i class="fas fa-th-list text-primary me-2"></i>Категории</h3>
                        <div class="list-group shadow-sm mb-4">
                            ${categoriesHtml}
                        </div>
                        <h3 class="mb-3"><i class="fas fa-history text-secondary me-2"></i>Последние новости</h3>
                        ${latestNewsHtml}
                    </div>
                </div>
            `;
        } catch (error) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка загрузки главной страницы: ${error.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 2. Каталог новостей с фильтрами и пагинацией (News List View)
    // ---------------------------------------------------------
    /**
     * Отрисовка каталога новостей:
     * 1. Отправляет параллельные запросы к API за списком новостей и списком категорий.
     * 2. Строит форму поиска и фильтров с сохранением текущих значений.
     * 3. Генерирует карточки новостей и постраничную навигацию (пагинацию).
     * 4. Навешивает клиентские обработчики событий (EventListener) на форму и кнопки страниц,
     *    чтобы переключать фильтры без перезагрузки страницы (через Router.navigateNews).
     */
    async renderNewsList(params = {}) {
        this.showLoading();
        try {
            const [newsData, catData] = await Promise.all([
                API.getNews(params),
                API.getCategories()
            ]);

            const { items, total, page, per_page, total_pages } = newsData;
            const categories = catData.categories || [];

            const categoryOptions = categories.map(c => `
                <option value="${c.id}" ${params.category === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>
            `).join('');

            let newsCardsHtml = '';
            if (items && items.length > 0) {
                newsCardsHtml = items.map(item => `
                    <div class="card mb-4 news-card shadow-sm ${item.is_hot == 1 ? 'hot-news' : ''}">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h3 class="card-title h4 mb-0">${this.escapeHtml(item.title)}</h3>
                                ${item.is_hot == 1 ? '<span class="badge bg-danger ms-2"><i class="fas fa-fire me-1"></i>Горячая</span>' : ''}
                            </div>
                            <p class="card-text text-secondary">${this.escapeHtml(item.short_text)}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <small class="text-muted"><i class="far fa-clock me-1"></i>${this.formatDate(item.date)}</small>
                                    ${item.category_name ? `<span class="badge bg-secondary ms-2">${this.escapeHtml(item.category_name)}</span>` : ''}
                                </div>
                                <a href="#news/${item.id}" class="btn btn-primary btn-sm">Читать далее &rarr;</a>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                newsCardsHtml = `
                    <div class="alert alert-warning text-center py-4 my-4">
                        <i class="fas fa-info-circle fa-2x mb-2 d-block"></i>
                        <h5>Новости не найдены</h5>
                        <p class="mb-0 text-muted">Попробуйте изменить параметры поиска или фильтрации.</p>
                    </div>
                `;
            }

            // Пагинация
            let paginationHtml = '';
            if (total_pages > 1) {
                let pagesBtns = '';
                for (let p = 1; p <= total_pages; p++) {
                    pagesBtns += `
                        <li class="page-item ${p === page ? 'active' : ''}">
                            <a class="page-link pagination-btn cursor-pointer" data-page="${p}">${p}</a>
                        </li>
                    `;
                }
                paginationHtml = `
                    <nav class="mt-4">
                        <ul class="pagination justify-content-center">
                            ${pagesBtns}
                        </ul>
                    </nav>
                `;
            }

            this.appContent.innerHTML = `
                <div class="row mb-4 g-2 align-items-center">
                    <div class="col-md-9">
                        <form id="news-filter-form" class="row g-2">
                            <div class="col-md-4">
                                <select id="filter-category" class="form-select">
                                    <option value="">Все категории</option>
                                    ${categoryOptions}
                                </select>
                            </div>
                            <div class="col-md-4">
                                <input type="text" id="filter-search" class="form-control" placeholder="Поиск по новостям..." value="${this.escapeHtml(params.search || '')}">
                            </div>
                            <div class="col-md-2">
                                <input type="date" id="filter-date" class="form-control" value="${this.escapeHtml(params.date || '')}">
                            </div>
                            <div class="col-md-2">
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="fas fa-search me-1"></i>Найти
                                </button>
                            </div>
                        </form>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group">
                            <span class="input-group-text"><i class="fas fa-list-ol"></i></span>
                            <select id="filter-per-page" class="form-select">
                                <option value="5" ${per_page === 5 ? 'selected' : ''}>5 новостей</option>
                                <option value="10" ${per_page === 10 ? 'selected' : ''}>10 новостей</option>
                                <option value="20" ${per_page === 20 ? 'selected' : ''}>20 новостей</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${params.search ? `
                    <div class="alert alert-info py-2 d-flex justify-content-between align-items-center">
                        <span>Результаты поиска по запросу: <strong>${this.escapeHtml(params.search)}</strong> (найдено: ${total})</span>
                        <button class="btn btn-sm btn-outline-secondary" id="clear-search-btn">Сбросить</button>
                    </div>
                ` : ''}

                ${newsCardsHtml}
                ${paginationHtml}
            `;

            // Обработчики событий фильтров
            const filterForm = document.getElementById('news-filter-form');
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const cat = document.getElementById('filter-category').value;
                const search = document.getElementById('filter-search').value;
                const date = document.getElementById('filter-date').value;
                const pp = document.getElementById('filter-per-page').value;
                Router.navigateNews({ category: cat, search, date, per_page: pp, page: 1 });
            });

            document.getElementById('filter-per-page').addEventListener('change', (e) => {
                Router.navigateNews({ ...params, per_page: e.target.value, page: 1 });
            });

            const clearBtn = document.getElementById('clear-search-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    Router.navigateNews({ ...params, search: '', page: 1 });
                });
            }

            document.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetPage = e.target.getAttribute('data-page');
                    Router.navigateNews({ ...params, page: targetPage });
                });
            });

        } catch (error) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка загрузки новостей: ${error.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 3. Детальный просмотр новости и комментарии (News Detail View)
    // ---------------------------------------------------------
    /**
     * Отрисовка страницы отдельной статьи:
     * 1. Запрашивает у сервера данные статьи, количество просмотров и комментарии: GET /api/news/:id.
     * 2. Строит «хлебные крошки» (навигацию), карточку статьи с картинкой и счетчиком просмотров.
     * 3. В зависимости от авторизации пользователя (API.getUser()) отображает либо форму
     *    добавления комментария, либо плашку с предложением войти/зарегистрироваться.
     * 4. При отправке комментария форма не перезагружает страницу: комментарий отправляется
     *    через POST /api/news/:id/comments, и новый элемент динамически добавляется в список.
     */
    async renderNewsDetail(newsId) {
        this.showLoading();
        try {
            const data = await API.getNewsDetail(newsId);
            const { news, total_views, comments } = data;
            const user = API.getUser();

            let imageHtml = '';
            if (news.image && !news.image.endsWith('default.jpg')) {
                const imgUrl = news.image.startsWith('/') ? news.image : `/${news.image}`;
                imageHtml = `
                    <div class="text-center my-4">
                        <img src="${imgUrl}" class="img-fluid rounded shadow-sm" style="max-height: 460px; object-fit: cover;" alt="${this.escapeHtml(news.title)}">
                    </div>
                `;
            }

            let commentsHtml = '';
            if (comments && comments.length > 0) {
                commentsHtml = comments.map(c => `
                    <div class="card mb-3 bg-light border-0 shadow-sm">
                        <div class="card-body py-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="fw-bold text-primary"><i class="fas fa-user-circle me-1"></i>${this.escapeHtml(c.username || 'Неизвестный')}</span>
                                <small class="text-muted"><i class="far fa-clock me-1"></i>${this.formatDate(c.date)}</small>
                            </div>
                            <p class="mb-0 text-secondary" style="white-space: pre-line;">${this.escapeHtml(c.text)}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                commentsHtml = '<p class="text-muted text-center py-3">Пока нет комментариев. Оставьте первый комментарий!</p>';
            }

            this.appContent.innerHTML = `
                <div class="row justify-content-center">
                    <div class="col-lg-10">
                        <nav aria-label="breadcrumb" class="mb-3">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item"><a href="#home">Главная</a></li>
                                <li class="breadcrumb-item"><a href="#news">Новости</a></li>
                                <li class="breadcrumb-item active">${this.escapeHtml(news.title)}</li>
                            </ol>
                        </nav>

                        <article class="card shadow-sm mb-4 border-0">
                            <div class="card-body p-4 p-md-5">
                                <h1 class="card-title fw-bold mb-3">${this.escapeHtml(news.title)}</h1>
                                <div class="text-muted mb-4 pb-3 border-bottom d-flex flex-wrap align-items-center gap-3">
                                    <span><i class="far fa-calendar-alt me-1"></i>${this.formatDate(news.date)}</span>
                                    ${news.category_name ? `<span><i class="fas fa-folder me-1"></i><span class="badge bg-secondary">${this.escapeHtml(news.category_name)}</span></span>` : ''}
                                    <span><i class="fas fa-eye me-1 text-primary"></i><strong>${total_views}</strong> просмотров</span>
                                    ${news.is_hot == 1 ? '<span class="badge bg-danger"><i class="fas fa-fire me-1"></i>Горячая</span>' : ''}
                                </div>
                                ${imageHtml}
                                <div class="fs-5 text-dark" style="white-space: pre-line; line-height: 1.8;">
                                    ${this.escapeHtml(news.full_text)}
                                </div>
                            </div>
                        </article>

                        <!-- Блок комментариев -->
                        <div class="card shadow-sm border-0 mb-5">
                            <div class="card-header bg-white py-3 border-bottom">
                                <h4 class="mb-0 fs-5 fw-bold">
                                    <i class="fas fa-comments text-primary me-2"></i>Комментарии 
                                    <span class="badge bg-secondary ms-1" id="comments-count">${comments.length}</span>
                                </h4>
                            </div>
                            <div class="card-body p-4">
                                ${user ? `
                                    <form id="add-comment-form" class="mb-4">
                                        <div class="mb-3">
                                            <label class="form-label fw-bold small text-muted">Ваш комментарий как <strong>${this.escapeHtml(user.username)}</strong>:</label>
                                            <textarea id="comment-text" class="form-control" rows="3" placeholder="Напишите комментарий..." required></textarea>
                                        </div>
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-paper-plane me-1"></i>Отправить комментарий
                                        </button>
                                    </form>
                                ` : `
                                    <div class="alert alert-secondary mb-4">
                                        <i class="fas fa-lock me-2"></i>Пожалуйста, <a href="#login" class="alert-link">войдите</a> или <a href="#register" class="alert-link">зарегистрируйтесь</a>, чтобы оставить комментарий.
                                    </div>
                                `}

                                <div id="comments-container">
                                    ${commentsHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Добавление комментария через клиентский API (без перезагрузки страницы)
            const commentForm = document.getElementById('add-comment-form');
            if (commentForm) {
                commentForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const text = document.getElementById('comment-text').value.trim();
                    if (!text) return;

                    try {
                        const newComment = await API.addComment(newsId, text);
                        this.showAlert('Комментарий успешно добавлен!', 'success');
                        document.getElementById('comment-text').value = '';

                        // Обновляем список комментариев на клиенте
                        const container = document.getElementById('comments-container');
                        const countBadge = document.getElementById('comments-count');

                        const commentElem = document.createElement('div');
                        commentElem.className = 'card mb-3 bg-light border-0 shadow-sm';
                        commentElem.innerHTML = `
                            <div class="card-body py-3">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="fw-bold text-primary"><i class="fas fa-user-circle me-1"></i>${this.escapeHtml(newComment.username)}</span>
                                    <small class="text-muted"><i class="far fa-clock me-1"></i>${this.formatDate(newComment.date)}</small>
                                </div>
                                <p class="mb-0 text-secondary" style="white-space: pre-line;">${this.escapeHtml(newComment.text)}</p>
                            </div>
                        `;

                        // Если была надпись "Пока нет комментариев", удаляем её
                        if (container.querySelector('p.text-muted')) {
                            container.innerHTML = '';
                        }
                        container.insertBefore(commentElem, container.firstChild);
                        countBadge.textContent = parseInt(countBadge.textContent || '0') + 1;
                    } catch (err) {
                        this.showAlert(err.message, 'danger');
                    }
                });
            }

        } catch (error) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${error.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 4. Вход и регистрация (Auth Views) — Клиентская аутентификация
    // ---------------------------------------------------------
    /**
     * Форма входа:
     * Отрисовывает интерфейс формы авторизации.
     * Обработчик submit перехватывает отправку (e.preventDefault()), вызывает API.login(u, p),
     * сохраняет JWT-токен в localStorage, обновляет навигационную панель и перенаправляет
     * пользователя на главную страницу или в панель администратора без перезагрузки.
     */
    renderLogin() {
        this.appContent.innerHTML = `
            <div class="row justify-content-center my-4">
                <div class="col-md-6 col-lg-5">
                    <div class="card shadow-sm border-0">
                        <div class="card-body p-4 p-md-5">
                            <div class="text-center mb-4">
                                <i class="fas fa-user-circle fa-3x text-primary mb-2"></i>
                                <h2 class="card-title fw-bold">Вход в систему</h2>
                                <p class="text-muted small">Введите ваши учетные данные (JWT авторизация)</p>
                            </div>
                            
                            <form id="login-form">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Имя пользователя</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-user"></i></span>
                                        <input type="text" id="login-username" class="form-control" placeholder="Логин" required autofocus>
                                    </div>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Пароль</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                        <input type="password" id="login-password" class="form-control" placeholder="Пароль" required>
                                    </div>
                                </div>
                                
                                <div class="d-grid mb-3">
                                    <button type="submit" class="btn btn-primary btn-lg" id="login-submit-btn">
                                        Войти
                                    </button>
                                </div>
                            </form>
                            
                            <div class="text-center mt-3 pt-3 border-top">
                                <p class="mb-0 text-muted">Нет аккаунта? <a href="#register" class="fw-semibold">Зарегистрироваться</a></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Вход...';

            const u = document.getElementById('login-username').value.trim();
            const p = document.getElementById('login-password').value;

            try {
                const res = await API.login(u, p);
                this.showAlert(`Добро пожаловать, ${res.user.username}!`, 'success');
                this.renderNavbar();
                window.location.hash = res.user.role === 'admin' ? '#admin' : '#home';
            } catch (err) {
                this.showAlert(err.message, 'danger');
                btn.disabled = false;
                btn.innerHTML = 'Войти';
            }
        });
    },

    renderRegister() {
        this.appContent.innerHTML = `
            <div class="row justify-content-center my-4">
                <div class="col-md-7 col-lg-6">
                    <div class="card shadow-sm border-0">
                        <div class="card-body p-4 p-md-5">
                            <div class="text-center mb-4">
                                <i class="fas fa-user-plus fa-3x text-primary mb-2"></i>
                                <h2 class="card-title fw-bold">Регистрация</h2>
                                <p class="text-muted small">Создайте новый аккаунт в системе</p>
                            </div>
                            
                            <form id="register-form">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Имя пользователя (логин)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-user"></i></span>
                                        <input type="text" id="reg-username" class="form-control" placeholder="Минимум 3 символа" required autofocus>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Email</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-envelope"></i></span>
                                        <input type="email" id="reg-email" class="form-control" placeholder="example@mail.ru" required>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Пароль</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                        <input type="password" id="reg-password" class="form-control" placeholder="Минимум 6 символов" required>
                                    </div>
                                </div>
                                
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Подтверждение пароля</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="fas fa-check-double"></i></span>
                                        <input type="password" id="reg-confirm" class="form-control" placeholder="Повторите пароль" required>
                                    </div>
                                </div>
                                
                                <div class="d-grid mb-3">
                                    <button type="submit" class="btn btn-primary btn-lg" id="reg-submit-btn">
                                        Зарегистрироваться
                                    </button>
                                </div>
                            </form>
                            
                            <div class="text-center mt-3 pt-3 border-top">
                                <p class="mb-0 text-muted">Уже есть аккаунт? <a href="#login" class="fw-semibold">Войти</a></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const p = document.getElementById('reg-password').value;
            const cp = document.getElementById('reg-confirm').value;

            if (p !== cp) {
                this.showAlert('Пароли не совпадают!', 'danger');
                return;
            }

            const btn = document.getElementById('reg-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Регистрация...';

            try {
                const res = await API.register(u, email, p, cp);
                this.showAlert(res.message || 'Регистрация успешна! Ожидайте подтверждения администратором.', 'success');
                window.location.hash = '#login';
            } catch (err) {
                this.showAlert(err.message, 'danger');
                btn.disabled = false;
                btn.innerHTML = 'Зарегистрироваться';
            }
        });
    },

    // ---------------------------------------------------------
    // 5. Панель управления (Admin Views)
    // ---------------------------------------------------------
    ensureAdmin() {
        if (!API.isAdmin()) {
            this.showAlert('Доступ ограничен. Требуются права администратора.', 'danger');
            window.location.hash = '#login';
            return false;
        }
        return true;
    },

    renderAdminNav(activeTab) {
        return `
            <div class="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom flex-wrap gap-2">
                <h1 class="h2 mb-0"><i class="fas fa-shield-alt text-danger me-2"></i>Панель администратора</h1>
                <div class="btn-group">
                    <a href="#admin" class="btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-tachometer-alt me-1"></i>Обзор</a>
                    <a href="#admin/news" class="btn btn-sm ${activeTab === 'news' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-newspaper me-1"></i>Новости</a>
                    <a href="#admin/categories" class="btn btn-sm ${activeTab === 'categories' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-folder me-1"></i>Категории</a>
                    <a href="#admin/comments" class="btn btn-sm ${activeTab === 'comments' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-comments me-1"></i>Комментарии</a>
                    <a href="#admin/users" class="btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-users me-1"></i>Пользователи</a>
                    <a href="#admin/statistics" class="btn btn-sm ${activeTab === 'statistics' ? 'btn-primary' : 'btn-outline-primary'}"><i class="fas fa-chart-bar me-1"></i>Статистика</a>
                </div>
            </div>
        `;
    },

    async renderAdminDashboard() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const data = await API.adminGetDashboard();
            const { counters, latest_comments, latest_news } = data;

            this.appContent.innerHTML = `
                ${this.renderAdminNav('dashboard')}

                <div class="row g-3 mb-4">
                    <div class="col-sm-6 col-xl-3">
                        <div class="card bg-primary text-white shadow-sm border-0 h-100">
                            <div class="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title text-uppercase mb-1 opacity-75">Пользователи</h6>
                                    <span class="display-5 fw-bold">${counters.users}</span>
                                </div>
                                <i class="fas fa-users fa-3x opacity-50"></i>
                            </div>
                            <div class="card-footer bg-transparent border-0 pt-0">
                                <a href="#admin/users" class="text-white text-decoration-none small">Подробнее &rarr;</a>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-3">
                        <div class="card bg-success text-white shadow-sm border-0 h-100">
                            <div class="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title text-uppercase mb-1 opacity-75">Новости</h6>
                                    <span class="display-5 fw-bold">${counters.news}</span>
                                </div>
                                <i class="fas fa-newspaper fa-3x opacity-50"></i>
                            </div>
                            <div class="card-footer bg-transparent border-0 pt-0">
                                <a href="#admin/news" class="text-white text-decoration-none small">Подробнее &rarr;</a>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-3">
                        <div class="card bg-info text-white shadow-sm border-0 h-100">
                            <div class="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title text-uppercase mb-1 opacity-75">Комментарии</h6>
                                    <span class="display-5 fw-bold">${counters.comments}</span>
                                </div>
                                <i class="fas fa-comments fa-3x opacity-50"></i>
                            </div>
                            <div class="card-footer bg-transparent border-0 pt-0">
                                <a href="#admin/comments" class="text-white text-decoration-none small">Подробнее &rarr;</a>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-3">
                        <div class="card bg-warning text-dark shadow-sm border-0 h-100">
                            <div class="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title text-uppercase mb-1 opacity-75">Просмотры</h6>
                                    <span class="display-5 fw-bold">${counters.views}</span>
                                </div>
                                <i class="fas fa-eye fa-3x opacity-50"></i>
                            </div>
                            <div class="card-footer bg-transparent border-0 pt-0">
                                <a href="#admin/statistics" class="text-dark text-decoration-none small fw-bold">Подробнее &rarr;</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fs-6 fw-bold"><i class="fas fa-comments text-info me-2"></i>Последние комментарии</h5>
                                <a href="#admin/comments" class="btn btn-sm btn-link text-decoration-none p-0">Все</a>
                            </div>
                            <div class="card-body p-0">
                                <div class="list-group list-group-flush">
                                    ${latest_comments.length > 0 ? latest_comments.map(c => `
                                        <div class="list-group-item p-3">
                                            <div class="d-flex w-100 justify-content-between mb-1">
                                                <h6 class="mb-0 fw-bold text-primary">${this.escapeHtml(c.username || 'Неизвестный')}</h6>
                                                <small class="text-muted">${this.formatDate(c.date)}</small>
                                            </div>
                                            <p class="mb-1 text-secondary small">${this.escapeHtml(c.text)}</p>
                                            <small class="text-muted">К новости: <a href="#news/${c.news_id}">${this.escapeHtml(c.news_title || c.news_id)}</a></small>
                                        </div>
                                    `).join('') : '<div class="p-4 text-center text-muted">Комментариев пока нет.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fs-6 fw-bold"><i class="fas fa-newspaper text-success me-2"></i>Последние новости</h5>
                                <a href="#admin/news" class="btn btn-sm btn-link text-decoration-none p-0">Все</a>
                            </div>
                            <div class="card-body p-0">
                                <div class="list-group list-group-flush">
                                    ${latest_news.length > 0 ? latest_news.map(n => `
                                        <div class="list-group-item p-3">
                                            <div class="d-flex w-100 justify-content-between mb-1">
                                                <h6 class="mb-0 fw-bold"><a href="#news/${n.id}" class="text-dark text-decoration-none">${this.escapeHtml(n.title)}</a></h6>
                                                <small class="text-muted">${this.formatDate(n.date)}</small>
                                            </div>
                                            <p class="mb-1 text-secondary small text-truncate">${this.escapeHtml(n.short_text)}</p>
                                            <div class="d-flex justify-content-between align-items-center mt-2">
                                                <span class="badge bg-secondary">${this.escapeHtml(n.category_name || 'Без категории')}</span>
                                                <small class="text-muted"><i class="fas fa-eye me-1"></i>${n.views_count || 0} просмотров</small>
                                            </div>
                                        </div>
                                    `).join('') : '<div class="p-4 text-center text-muted">Новостей пока нет.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 6. Управление новостями в админке
    // ---------------------------------------------------------
    async renderAdminNews() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const [newsData, catData] = await Promise.all([
                API.adminGetNews(),
                API.adminGetCategories()
            ]);

            const news = newsData.news || [];
            const categories = catData.categories || [];

            const catOptions = categories.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');

            const rowsHtml = news.map(item => `
                <tr>
                    <td><span class="badge bg-light text-dark border">${item.id}</span></td>
                    <td class="fw-bold"><a href="#news/${item.id}" target="_blank" class="text-decoration-none">${this.escapeHtml(item.title)}</a></td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(item.category_name || '—')}</span></td>
                    <td><small class="text-muted">${this.formatDate(item.date)}</small></td>
                    <td>${item.is_hot == 1 ? '<span class="badge bg-danger">Горячая</span>' : '<span class="badge bg-light text-muted border">Обычная</span>'}</td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit-news" data-id="${item.id}" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-del-news" data-id="${item.id}" data-title="${this.escapeHtml(item.title)}" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            this.appContent.innerHTML = `
                ${this.renderAdminNav('news')}

                <!-- Форма добавления новости -->
                <div class="card shadow-sm mb-4">
                    <div class="card-header bg-light">
                        <h5 class="mb-0"><i class="fas fa-plus-circle text-success me-2"></i>Добавить новость</h5>
                    </div>
                    <div class="card-body">
                        <form id="admin-add-news-form">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Заголовок</label>
                                        <input type="text" id="add-title" class="form-control" placeholder="Заголовок новости" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Краткое описание (анонс)</label>
                                        <textarea id="add-short-text" class="form-control" rows="2" placeholder="Краткий анонс для списка" required></textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Полный текст</label>
                                        <textarea id="add-content" class="form-control" rows="5" placeholder="Полный текст новости" required></textarea>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Категория</label>
                                        <select id="add-category" class="form-select" required>
                                            ${catOptions}
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Изображение (обложка)</label>
                                        <input type="file" id="add-image" class="form-control" accept="image/*">
                                    </div>
                                    <div class="mb-4 form-check form-switch">
                                        <input type="checkbox" id="add-is-hot" class="form-check-input">
                                        <label class="form-check-label fw-bold" for="add-is-hot"><i class="fas fa-fire text-danger me-1"></i>Горячая новость</label>
                                    </div>
                                    <div class="d-grid">
                                        <button type="submit" class="btn btn-success" id="add-news-submit-btn">
                                            <i class="fas fa-check me-1"></i>Опубликовать новость
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Список новостей -->
                <div class="card shadow-sm">
                    <div class="card-header bg-light">
                        <h5 class="mb-0">Список опубликованных новостей (${news.length})</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Заголовок</th>
                                        <th>Категория</th>
                                        <th>Дата</th>
                                        <th>Статус</th>
                                        <th class="text-end pe-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Модальное окно редактирования (динамический контейнер) -->
                <div class="modal fade" id="editNewsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <form id="edit-news-form">
                                <input type="hidden" id="edit-news-id">
                                <div class="modal-header">
                                    <h5 class="modal-title">Редактирование новости</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Заголовок</label>
                                        <input type="text" id="edit-title" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Краткое описание</label>
                                        <textarea id="edit-short-text" class="form-control" rows="3" required></textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Полный текст</label>
                                        <textarea id="edit-content" class="form-control" rows="6" required></textarea>
                                    </div>
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label fw-bold">Категория</label>
                                            <select id="edit-category" class="form-select" required>
                                                ${catOptions}
                                            </select>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label fw-bold">Сменить изображение</label>
                                            <input type="file" id="edit-image" class="form-control" accept="image/*">
                                        </div>
                                    </div>
                                    <div class="form-check form-switch mt-2">
                                        <input type="checkbox" id="edit-is-hot" class="form-check-input">
                                        <label class="form-check-label fw-bold" for="edit-is-hot">Горячая новость</label>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                                    <button type="submit" class="btn btn-primary"><i class="fas fa-save me-1"></i>Сохранить изменения</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Обработка добавления
            document.getElementById('admin-add-news-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('title', document.getElementById('add-title').value.trim());
                formData.append('short_text', document.getElementById('add-short-text').value.trim());
                formData.append('content', document.getElementById('add-content').value.trim());
                formData.append('category_id', document.getElementById('add-category').value);
                formData.append('is_hot', document.getElementById('add-is-hot').checked ? '1' : '0');

                const imageInput = document.getElementById('add-image');
                if (imageInput.files && imageInput.files[0]) {
                    formData.append('image', imageInput.files[0]);
                }

                try {
                    await API.adminCreateNews(formData);
                    this.showAlert('Новость успешно создана!', 'success');
                    this.renderAdminNews();
                } catch (err) {
                    this.showAlert(err.message, 'danger');
                }
            });

            // Обработка удаления
            document.querySelectorAll('.btn-del-news').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const title = btn.getAttribute('data-title');
                    if (confirm(`Вы действительно хотите удалить новость «${title}»?`)) {
                        try {
                            await API.adminDeleteNews(id);
                            this.showAlert('Новость удалена', 'success');
                            this.renderAdminNews();
                        } catch (err) {
                            this.showAlert(err.message, 'danger');
                        }
                    }
                });
            });

            // Обработка редактирования
            const editModalEl = document.getElementById('editNewsModal');
            const editModal = new bootstrap.Modal(editModalEl);

            document.querySelectorAll('.btn-edit-news').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = news.find(n => n.id === id);
                    if (!item) return;

                    document.getElementById('edit-news-id').value = item.id;
                    document.getElementById('edit-title').value = item.title;
                    document.getElementById('edit-short-text').value = item.short_text;
                    document.getElementById('edit-content').value = item.full_text;
                    document.getElementById('edit-category').value = item.category_id;
                    document.getElementById('edit-is-hot').checked = item.is_hot == 1;

                    editModal.show();
                });
            });

            document.getElementById('edit-news-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-news-id').value;
                const formData = new FormData();
                formData.append('title', document.getElementById('edit-title').value.trim());
                formData.append('short_text', document.getElementById('edit-short-text').value.trim());
                formData.append('content', document.getElementById('edit-content').value.trim());
                formData.append('category_id', document.getElementById('edit-category').value);
                formData.append('is_hot', document.getElementById('edit-is-hot').checked ? '1' : '0');

                const imageInput = document.getElementById('edit-image');
                if (imageInput.files && imageInput.files[0]) {
                    formData.append('image', imageInput.files[0]);
                }

                try {
                    await API.adminUpdateNews(id, formData);
                    editModal.hide();
                    this.showAlert('Новость обновлена', 'success');
                    this.renderAdminNews();
                } catch (err) {
                    this.showAlert(err.message, 'danger');
                }
            });

        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 7. Управление категориями
    // ---------------------------------------------------------
    async renderAdminCategories() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const data = await API.adminGetCategories();
            const categories = data.categories || [];

            const rowsHtml = categories.map(cat => `
                <tr>
                    <td><span class="badge bg-light text-dark border">${cat.id}</span></td>
                    <td class="fw-bold">${this.escapeHtml(cat.name)}</td>
                    <td class="text-muted">${this.escapeHtml(cat.description || '—')}</td>
                    <td class="text-center"><span class="badge bg-primary rounded-pill">${cat.news_count || 0}</span></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit-cat" data-id="${cat.id}" data-name="${this.escapeHtml(cat.name)}" data-desc="${this.escapeHtml(cat.description || '')}" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-del-cat" data-id="${cat.id}" data-name="${this.escapeHtml(cat.name)}" data-count="${cat.news_count || 0}" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            this.appContent.innerHTML = `
                ${this.renderAdminNav('categories')}

                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Список категорий (${categories.length})</h5>
                    <button class="btn btn-primary btn-sm" id="btn-open-add-cat">
                        <i class="fas fa-plus me-1"></i>Добавить категорию
                    </button>
                </div>

                <div class="card shadow-sm">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Название</th>
                                        <th>Описание</th>
                                        <th class="text-center">Кол-во новостей</th>
                                        <th class="text-end pe-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Модальное окно добавления -->
                <div class="modal fade" id="addCatModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <form id="add-cat-form">
                                <div class="modal-header">
                                    <h5 class="modal-title">Добавить категорию</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Название</label>
                                        <input type="text" id="add-cat-name" class="form-control" required placeholder="Например: Наука">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Описание</label>
                                        <textarea id="add-cat-desc" class="form-control" rows="3" placeholder="Краткое описание"></textarea>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                                    <button type="submit" class="btn btn-primary">Создать</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Модальное окно редактирования -->
                <div class="modal fade" id="editCatModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <form id="edit-cat-form">
                                <input type="hidden" id="edit-cat-id">
                                <div class="modal-header">
                                    <h5 class="modal-title">Редактировать категорию</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Название</label>
                                        <input type="text" id="edit-cat-name" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Описание</label>
                                        <textarea id="edit-cat-desc" class="form-control" rows="3"></textarea>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                                    <button type="submit" class="btn btn-primary">Сохранить</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            const addModal = new bootstrap.Modal(document.getElementById('addCatModal'));
            const editModal = new bootstrap.Modal(document.getElementById('editCatModal'));

            document.getElementById('btn-open-add-cat').addEventListener('click', () => {
                document.getElementById('add-cat-form').reset();
                addModal.show();
            });

            document.getElementById('add-cat-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('add-cat-name').value.trim();
                const desc = document.getElementById('add-cat-desc').value.trim();
                try {
                    await API.adminCreateCategory(name, desc);
                    addModal.hide();
                    this.showAlert('Категория успешно создана', 'success');
                    this.renderAdminCategories();
                } catch (err) {
                    this.showAlert(err.message, 'danger');
                }
            });

            document.querySelectorAll('.btn-edit-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('edit-cat-id').value = btn.getAttribute('data-id');
                    document.getElementById('edit-cat-name').value = btn.getAttribute('data-name');
                    document.getElementById('edit-cat-desc').value = btn.getAttribute('data-desc');
                    editModal.show();
                });
            });

            document.getElementById('edit-cat-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-cat-id').value;
                const name = document.getElementById('edit-cat-name').value.trim();
                const desc = document.getElementById('edit-cat-desc').value.trim();
                try {
                    await API.adminUpdateCategory(id, name, desc);
                    editModal.hide();
                    this.showAlert('Категория обновлена', 'success');
                    this.renderAdminCategories();
                } catch (err) {
                    this.showAlert(err.message, 'danger');
                }
            });

            document.querySelectorAll('.btn-del-cat').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name');
                    const count = parseInt(btn.getAttribute('data-count') || '0');
                    if (count > 0) {
                        alert(`Невозможно удалить категорию «${name}»: в ней содержится ${count} новостей!`);
                        return;
                    }
                    if (confirm(`Вы уверены, что хотите удалить категорию «${name}»?`)) {
                        try {
                            await API.adminDeleteCategory(id);
                            this.showAlert('Категория удалена', 'success');
                            this.renderAdminCategories();
                        } catch (err) {
                            this.showAlert(err.message, 'danger');
                        }
                    }
                });
            });

        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 8. Управление комментариями в админке
    // ---------------------------------------------------------
    async renderAdminComments() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const data = await API.adminGetComments();
            const comments = data.comments || [];

            const rowsHtml = comments.map(c => `
                <tr>
                    <td><span class="badge bg-light text-dark border">${c.id}</span></td>
                    <td class="fw-bold"><a href="#news/${c.news_id}" target="_blank">${this.escapeHtml(c.news_title || c.news_id)}</a></td>
                    <td><span class="badge bg-secondary">${this.escapeHtml(c.username || '—')}</span></td>
                    <td><div class="text-break" style="max-height: 80px; overflow-y: auto;">${this.escapeHtml(c.text)}</div></td>
                    <td><small class="text-muted">${this.formatDate(c.date)}</small></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-edit-comment" data-id="${c.id}" data-text="${this.escapeHtml(c.text)}" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-del-comment" data-id="${c.id}" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            this.appContent.innerHTML = `
                ${this.renderAdminNav('comments')}

                <div class="card shadow-sm">
                    <div class="card-header bg-light">
                        <h5 class="mb-0">Все комментарии (${comments.length})</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Новость</th>
                                        <th>Пользователь</th>
                                        <th>Текст</th>
                                        <th>Дата</th>
                                        <th class="text-end pe-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="6" class="text-center py-4 text-muted">Комментариев нет</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Модальное окно редактирования комментария -->
                <div class="modal fade" id="editComModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <form id="edit-com-form">
                                <input type="hidden" id="edit-com-id">
                                <div class="modal-header">
                                    <h5 class="modal-title">Редактирование комментария</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <label class="form-label fw-bold">Текст комментария</label>
                                        <textarea id="edit-com-text" class="form-control" rows="4" required></textarea>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                                    <button type="submit" class="btn btn-primary">Сохранить</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            const editModal = new bootstrap.Modal(document.getElementById('editComModal'));

            document.querySelectorAll('.btn-edit-comment').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('edit-com-id').value = btn.getAttribute('data-id');
                    document.getElementById('edit-com-text').value = btn.getAttribute('data-text');
                    editModal.show();
                });
            });

            document.getElementById('edit-com-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-com-id').value;
                const text = document.getElementById('edit-com-text').value.trim();
                try {
                    await API.adminUpdateComment(id, text);
                    editModal.hide();
                    this.showAlert('Комментарий успешно обновлен', 'success');
                    this.renderAdminComments();
                } catch (err) {
                    this.showAlert(err.message, 'danger');
                }
            });

            document.querySelectorAll('.btn-del-comment').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm('Вы уверены, что хотите удалить этот комментарий?')) {
                        try {
                            await API.adminDeleteComment(id);
                            this.showAlert('Комментарий удален', 'success');
                            this.renderAdminComments();
                        } catch (err) {
                            this.showAlert(err.message, 'danger');
                        }
                    }
                });
            });

        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 9. Управление пользователями
    // ---------------------------------------------------------
    async renderAdminUsers() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const data = await API.adminGetUsers();
            const users = data.users || [];

            const rowsHtml = users.map(u => `
                <tr>
                    <td><span class="badge bg-light text-dark border">${u.id}</span></td>
                    <td class="fw-bold"><i class="fas fa-user-circle me-1 text-secondary"></i>${this.escapeHtml(u.username)}</td>
                    <td>${this.escapeHtml(u.email)}</td>
                    <td>
                        <span class="badge ${u.group_name === 'admin' ? 'bg-danger' : 'bg-primary'}">
                            ${u.group_name === 'admin' ? 'Администратор' : 'Пользователь'}
                        </span>
                    </td>
                    <td>
                        ${u.is_active == 0 ? '<span class="badge bg-danger">Заблокирован</span>' :
                          u.is_confirmed == 0 ? '<span class="badge bg-warning text-dark">Ожидает подтверждения</span>' :
                          '<span class="badge bg-success">Активен</span>'}
                    </td>
                    <td><small class="text-muted">${this.formatDate(u.registration_date)}</small></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            ${u.is_confirmed == 0 ? `
                                <button class="btn btn-success btn-user-action" data-id="${u.id}" data-action="confirm" title="Подтвердить регистрацию">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}

                            ${u.is_active == 1 ? `
                                <button class="btn btn-outline-warning btn-user-action" data-id="${u.id}" data-action="block" title="Заблокировать">
                                    <i class="fas fa-ban"></i>
                                </button>
                            ` : `
                                <button class="btn btn-outline-info btn-user-action" data-id="${u.id}" data-action="unblock" title="Разблокировать">
                                    <i class="fas fa-unlock"></i>
                                </button>
                            `}

                            ${u.group_name === 'user' ? `
                                <button class="btn btn-outline-primary btn-user-action" data-id="${u.id}" data-action="make_admin" title="Сделать администратором">
                                    <i class="fas fa-shield-alt"></i>
                                </button>
                            ` : `
                                <button class="btn btn-outline-secondary btn-user-action" data-id="${u.id}" data-action="make_user" title="Снять права администратора">
                                    <i class="fas fa-user"></i>
                                </button>
                            `}

                            <button class="btn btn-outline-danger btn-user-action" data-id="${u.id}" data-action="delete" title="Удалить пользователя">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            this.appContent.innerHTML = `
                ${this.renderAdminNav('users')}

                <div class="card shadow-sm">
                    <div class="card-header bg-light">
                        <h5 class="mb-0">Пользователи системы (${users.length})</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Логин</th>
                                        <th>Email</th>
                                        <th>Группа</th>
                                        <th>Статус</th>
                                        <th>Дата регистрации</th>
                                        <th class="text-end pe-3">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            document.querySelectorAll('.btn-user-action').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const act = btn.getAttribute('data-action');
                    if (act === 'delete' && !confirm('Вы уверены, что хотите удалить этого пользователя?')) {
                        return;
                    }
                    try {
                        const res = await API.adminUserAction(id, act);
                        this.showAlert(res.message, 'success');
                        this.renderAdminUsers();
                    } catch (err) {
                        this.showAlert(err.message, 'danger');
                    }
                });
            });

        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 10. Статистика с интерактивными графиками Chart.js
    // ---------------------------------------------------------
    /**
     * Отрисовка раздела статистики и визуализации:
     * 1. Запрашивает аналитические данные: GET /api/admin/statistics.
     * 2. Сервер возвращает массивы чисел и меток (метки новостей, количество просмотров, ключевые слова поиска).
     * 3. Клиент генерирует HTML-разметку с элементами <canvas id="viewsChartCanvas"> и <canvas id="searchesChartCanvas">.
     * 4. Создает экземпляры new Chart(...), которые визуализируют интерактивные столбчатые диаграммы
     *    прямо в браузере с анимацией, всплывающими подсказками (tooltips) и адаптивным масштабированием.
     */
    async renderAdminStatistics() {
        if (!this.ensureAdmin()) return;
        this.showLoading();
        try {
            const data = await API.adminGetStatistics();
            const { total_views, total_searches, top_news, views_chart_labels, views_chart_data, top_searches, search_chart_labels, search_chart_data } = data;

            this.appContent.innerHTML = `
                ${this.renderAdminNav('statistics')}

                <div class="row g-4 mb-4">
                    <!-- График просмотров -->
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fs-6 fw-bold"><i class="fas fa-eye text-primary me-2"></i>Топ новостей по просмотрам</h5>
                                <span class="badge bg-primary">Всего: ${total_views}</span>
                            </div>
                            <div class="card-body">
                                <div style="position: relative; height: 300px; width: 100%;">
                                    <canvas id="viewsChartCanvas"></canvas>
                                </div>
                            </div>
                            <div class="card-footer bg-white border-top">
                                <h6 class="fw-bold mb-2 small text-uppercase text-muted">Таблица лидеров</h6>
                                <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                                    <table class="table table-sm table-hover align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Новость</th>
                                                <th class="text-end">Просмотры</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${top_news.map(n => `
                                                <tr>
                                                    <td><a href="#news/${n.id}" class="text-decoration-none text-dark fw-semibold">${this.escapeHtml(n.title)}</a></td>
                                                    <td class="text-end"><span class="badge bg-info text-dark">${n.views}</span></td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="2" class="text-center text-muted">Данных нет</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- График поисковых запросов -->
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fs-6 fw-bold"><i class="fas fa-search text-warning me-2"></i>Популярные поисковые слова</h5>
                                <span class="badge bg-warning text-dark">Всего: ${total_searches}</span>
                            </div>
                            <div class="card-body">
                                <div style="position: relative; height: 300px; width: 100%;">
                                    <canvas id="searchesChartCanvas"></canvas>
                                </div>
                            </div>
                            <div class="card-footer bg-white border-top">
                                <h6 class="fw-bold mb-2 small text-uppercase text-muted">Таблица ключевых слов</h6>
                                <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                                    <table class="table table-sm table-hover align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Ключевое слово</th>
                                                <th class="text-end">Запросов</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${top_searches.map(s => `
                                                <tr>
                                                    <td><i class="fas fa-search me-1 text-muted small"></i>${this.escapeHtml(s.keyword)}</td>
                                                    <td class="text-end"><span class="badge bg-warning text-dark">${s.count}</span></td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="2" class="text-center text-muted">Данных нет</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Построение интерактивных графиков Chart.js на клиенте
            const ctxViews = document.getElementById('viewsChartCanvas').getContext('2d');
            new Chart(ctxViews, {
                type: 'bar',
                data: {
                    labels: views_chart_labels.map(l => l.length > 20 ? l.substring(0, 20) + '...' : l),
                    datasets: [{
                        label: 'Просмотры',
                        data: views_chart_data,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => views_chart_labels[items[0].dataIndex]
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });

            const ctxSearches = document.getElementById('searchesChartCanvas').getContext('2d');
            new Chart(ctxSearches, {
                type: 'bar',
                data: {
                    labels: search_chart_labels,
                    datasets: [{
                        label: 'Запросы',
                        data: search_chart_data,
                        backgroundColor: 'rgba(255, 159, 64, 0.7)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });

        } catch (err) {
            this.appContent.innerHTML = `<div class="alert alert-danger">Ошибка: ${err.message}</div>`;
        }
    },

    // ---------------------------------------------------------
    // 11. Страница 404
    // ---------------------------------------------------------
    renderNotFound() {
        this.appContent.innerHTML = `
            <div class="text-center my-5 py-5">
                <h1 class="display-1 fw-bold text-danger">404</h1>
                <h2 class="mb-3">Страница не найдена</h2>
                <p class="lead text-muted mb-4">Запрашиваемый раздел не существует в толстом клиенте.</p>
                <a href="#home" class="btn btn-primary btn-lg"><i class="fas fa-home me-2"></i>На главную</a>
            </div>
        `;
    }
};
