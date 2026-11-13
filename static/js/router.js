/**
 * ========================================================================================
 * ТОЛСТЫЙ КЛИЕНТ: КЛИЕНТСКИЙ МАРШРУТИЗАТОР (static/js/router.js)
 * ========================================================================================
 * 
 * В традиционном («тонком») веб-приложении при каждом переходе по ссылке браузер
 * отправляет запрос на сервер и перезагружает страницу целиком.
 * 
 * В «ТОЛСТОМ КЛИЕНТЕ» (Single Page Application):
 * 1. Страница загружается ровно один раз (index.html).
 * 2. Маршрутизация происходит через фрагмент URL (хэш — #home, #news, #admin и т.д.).
 * 3. Событие "hashchange" перехватывает смену адреса без отправки HTTP-запроса на сервер.
 * 4. Клиентский код сам решает, какую функцию рендеринга вызвать из UI-модуля.
 * ========================================================================================
 */

const Router = {
    /**
     * Инициализация маршрутизатора:
     * Вешает слушатель на событие изменения хэша (hashchange) в адресной строке.
     */
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        // Выполняем маршрутизацию для текущего адреса сразу при загрузке
        this.handleRoute();
    },

    /**
     * Программное переключение маршрута (например, Router.navigate('#admin'))
     */
    navigate(hash) {
        window.location.hash = hash;
    },

    /**
     * Формирует URL для каталога новостей с query-параметрами фильтрации и пагинации
     * Пример результата: #news?category=cat1&search=спорт&page=2
     */
    navigateNews(params = {}) {
        const q = new URLSearchParams();
        if (params.category) q.append('category', params.category);
        if (params.search) q.append('search', params.search);
        if (params.date) q.append('date', params.date);
        if (params.page) q.append('page', params.page);
        if (params.per_page) q.append('per_page', params.per_page);

        const qs = q.toString() ? `?${q.toString()}` : '';
        window.location.hash = `#news${qs}`;
    },

    /**
     * ГЛАВНЫЙ ОБРАБОТЧИК МАРШРУТА (ROUTER DISPATCHER):
     * Анализирует текущий window.location.hash, парсит параметры и вызывает нужный UI-компонент.
     */
    handleRoute() {
        // Убираем решетку '#' из начала строки, по умолчанию открываем 'home'
        const rawHash = window.location.hash.slice(1) || 'home';
        // Разделяем путь и query-параметры (например, "news?page=2" -> path="news", queryString="page=2")
        const [path, queryString] = rawHash.split('?');

        // Парсинг query-параметров в обычный JavaScript-объект
        const params = {};
        if (queryString) {
            const sp = new URLSearchParams(queryString);
            for (const [k, v] of sp.entries()) {
                params[k] = v;
            }
        }

        // Обновляем состояние подсветки активных ссылок в навигационной панели
        UI.renderNavbar();

        // 1. Главная страница (#home или #)
        if (path === '' || path === 'home') {
            UI.renderHome();
            return;
        }

        // 2. Каталог новостей (#news) с поддержкой фильтров и пагинации
        if (path === 'news') {
            UI.renderNewsList(params);
            return;
        }

        // 3. Просмотр конкретной новости (#news/:id, например #news/news3)
        if (path.startsWith('news/')) {
            const newsId = path.split('/')[1];
            if (newsId) {
                UI.renderNewsDetail(newsId);
                return;
            }
        }

        // 4. Страницы аутентификации (#login, #register)
        if (path === 'login') {
            UI.renderLogin();
            return;
        }

        if (path === 'register') {
            UI.renderRegister();
            return;
        }

        // 5. Разделы панели администратора (#admin, #admin/*)
        // Внутри методов админки встроен Auth Guard (проверка прав администратора)
        if (path === 'admin') {
            UI.renderAdminDashboard();
            return;
        }

        if (path === 'admin/news') {
            UI.renderAdminNews();
            return;
        }

        if (path === 'admin/categories') {
            UI.renderAdminCategories();
            return;
        }

        if (path === 'admin/comments') {
            UI.renderAdminComments();
            return;
        }

        if (path === 'admin/users') {
            UI.renderAdminUsers();
            return;
        }

        if (path === 'admin/statistics') {
            UI.renderAdminStatistics();
            return;
        }

        // 6. Неизвестный маршрут — отображение страницы 404
        UI.renderNotFound();
    }
};
