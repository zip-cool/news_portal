/**
 * ========================================================================================
 * ТОЛСТЫЙ КЛИЕНТ: МОДУЛЬ СЕТЕВЫХ ЗАПРОСОВ И JWT-АУТЕНТИФИКАЦИИ (static/js/api.js)
 * ========================================================================================
 * 
 * В архитектуре «Толстый клиент» браузер берет на себя управление сессией и обращением к API:
 * 1. Хранение токена: при успешном входе JWT-токен сохраняется в localStorage браузера.
 * 2. Автоматическая авторизация: метод request() автоматически подставляет заголовок
 *    "Authorization: Bearer <token>" во все сетевые вызовы.
 * 3. Асинхронное взаимодействие (AJAX / Fetch API): запросы к серверу отправляются в фоне
 *    без перезагрузки HTML-страницы (single-page application).
 * 4. Обработка ошибок: перехват 401 Unauthorized (истечение срока токена) и автоматический сброс сессии.
 * ========================================================================================
 */

const API = {
    // Ключи для постоянного хранения токена и данных профиля в памяти браузера
    TOKEN_KEY: 'news_portal_jwt',
    USER_KEY: 'news_portal_user',

    /**
     * Получает сохраненный JWT-токен из localStorage.
     * Если пользователь не авторизован, возвращает null.
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * Сохраняет полученный от сервера JWT-токен в localStorage.
     */
    setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    },

    /**
     * Возвращает закэшированные данные текущего пользователя (id, логин, роль).
     */
    getUser() {
        try {
            const raw = localStorage.getItem(this.USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Сохраняет данные текущего пользователя в localStorage.
     */
    setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    /**
     * Очищает данные аутентификации при выходе (Logout) или истечении срока токена.
     */
    clearAuth() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    /**
     * Проверяет, авторизован ли пользователь в данный момент на клиенте.
     */
    isLoggedIn() {
        return !!this.getToken() && !!this.getUser();
    },

    /**
     * Проверяет, обладает ли текущий пользователь правами администратора ('admin').
     */
    isAdmin() {
        const user = this.getUser();
        return !!(user && user.role === 'admin');
    },

    /**
     * ГЛАВНЫЙ МЕТОД ОБРАЩЕНИЯ К СЕРВЕРУ (FETCH WRAPPER):
     * - Добавляет базовый URL /api
     * - При наличии токена прикрепляет заголовок: Authorization: Bearer <token>
     * - Сериализует тело запроса в JSON (если передается не FormData)
     * - Обрабатывает сетевые ошибки и статус-коды
     */
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
        const headers = options.headers || {};

        // Внедрение JWT-токена в заголовок Authorization
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Если передаем JavaScript-объект (не файл/FormData), отправляем как JSON
        if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        options.headers = headers;

        try {
            const response = await fetch(url, options);

            // Если сервер вернул 401 Unauthorized — токен недействителен или просрочен
            if (response.status === 401) {
                this.clearAuth();
                UI.renderNavbar();
                if (!endpoint.includes('/auth/me')) {
                    UI.showAlert('Сессия истекла. Пожалуйста, выполните вход снова.', 'warning');
                    window.location.hash = '#login';
                }
                throw new Error('Требуется авторизация');
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = data.detail || data.message || `Ошибка сервера (${response.status})`;
                throw new Error(message);
            }

            return data;
        } catch (error) {
            console.error(`API Error on [${options.method || 'GET'} ${url}]:`, error);
            throw error;
        }
    },

    // ----------------------------------------------------------------------------------
    // АУТЕНТИФИКАЦИЯ (API МЕТОДЫ)
    // ----------------------------------------------------------------------------------

    /**
     * Вход пользователя: отправляет POST /api/auth/login.
     * При успехе сохраняет полученный JWT в localStorage и кэширует профиль.
     */
    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        if (data.access_token) {
            this.setToken(data.access_token);
            this.setUser(data.user);
        }
        return data;
    },

    /**
     * Регистрация нового аккаунта: отправляет POST /api/auth/register.
     */
    async register(username, email, password, confirmPassword) {
        return await this.request('/auth/register', {
            method: 'POST',
            body: {
                username,
                email,
                password,
                confirm_password: confirmPassword
            }
        });
    },

    /**
     * Проверка валидности текущего JWT токена при старте страницы: GET /api/auth/me.
     */
    async getMe() {
        if (!this.getToken()) return null;
        try {
            const data = await this.request('/auth/me');
            if (data.user) {
                this.setUser(data.user);
                return data.user;
            }
        } catch (e) {
            this.clearAuth();
        }
        return null;
    },

    /**
     * Выход пользователя: удаляет токен из браузера и переключает интерфейс.
     */
    logout() {
        this.clearAuth();
        UI.showAlert('Вы успешно вышли из системы', 'info');
        UI.renderNavbar();
        window.location.hash = '#home';
    },

    // ----------------------------------------------------------------------------------
    // ПУБЛИЧНЫЕ МЕТОДЫ (НОВОСТИ, КАТЕГОРИИ, КОММЕНТАРИИ)
    // ----------------------------------------------------------------------------------

    async getHome() {
        return await this.request('/news/home');
    },

    async getNews(params = {}) {
        const query = new URLSearchParams();
        if (params.category) query.append('category', params.category);
        if (params.search) query.append('search', params.search);
        if (params.date) query.append('date', params.date);
        if (params.page) query.append('page', params.page);
        if (params.per_page) query.append('per_page', params.per_page);

        const qs = query.toString() ? `?${query.toString()}` : '';
        return await this.request(`/news${qs}`);
    },

    async getNewsDetail(newsId) {
        return await this.request(`/news/${newsId}`);
    },

    async addComment(newsId, text) {
        return await this.request(`/news/${newsId}/comments`, {
            method: 'POST',
            body: { text }
        });
    },

    async getCategories() {
        return await this.request('/categories');
    },

    // ----------------------------------------------------------------------------------
    // АДМИНИСТРАТИВНЫЕ МЕТОДЫ (ТРЕБУЮТ РОЛЬ ADMIN И JWT)
    // ----------------------------------------------------------------------------------

    async adminGetDashboard() {
        return await this.request('/admin/dashboard');
    },

    async adminGetNews() {
        return await this.request('/admin/news');
    },

    async adminCreateNews(formData) {
        return await this.request('/admin/news', {
            method: 'POST',
            body: formData // Передается объект FormData с бинарным файлом обложки
        });
    },

    async adminUpdateNews(newsId, formData) {
        return await this.request(`/admin/news/${newsId}`, {
            method: 'PUT',
            body: formData
        });
    },

    async adminDeleteNews(newsId) {
        return await this.request(`/admin/news/${newsId}`, {
            method: 'DELETE'
        });
    },

    async adminGetCategories() {
        return await this.request('/admin/categories');
    },

    async adminCreateCategory(name, description) {
        return await this.request('/admin/categories', {
            method: 'POST',
            body: { name, description }
        });
    },

    async adminUpdateCategory(catId, name, description) {
        return await this.request(`/admin/categories/${catId}`, {
            method: 'PUT',
            body: { name, description }
        });
    },

    async adminDeleteCategory(catId) {
        return await this.request(`/admin/categories/${catId}`, {
            method: 'DELETE'
        });
    },

    async adminGetComments() {
        return await this.request('/admin/comments');
    },

    async adminUpdateComment(commentId, text) {
        return await this.request(`/admin/comments/${commentId}`, {
            method: 'PUT',
            body: { text }
        });
    },

    async adminDeleteComment(commentId) {
        return await this.request(`/admin/comments/${commentId}`, {
            method: 'DELETE'
        });
    },

    async adminGetUsers() {
        return await this.request('/admin/users');
    },

    async adminUserAction(userId, action) {
        return await this.request(`/admin/users/${userId}/action`, {
            method: 'POST',
            body: { action }
        });
    },

    async adminGetStatistics() {
        return await this.request('/admin/statistics');
    }
};
