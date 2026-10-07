/**
 * Мой ритм — Дневник состояния между встречами
 * Хранилище данных (LocalStorage с поддержкой Firebase Firestore)
 */

import { APP_CONFIG } from './config.js';

const STORAGE_KEYS = {
  CURRENT_USER: 'moy_ritm_current_user',
  USERS: 'moy_ritm_users',
  SURVEYS: 'moy_ritm_surveys',
  CHECKINS: 'moy_ritm_checkins',
  AI_SETTINGS: 'moy_ritm_ai_settings',
  FIREBASE_CONFIG: 'moy_ritm_firebase_config',
  CLOUD_SYNC: 'moy_ritm_cloud_sync'
};

// Начальные демонстрационные данные (группа из 3 участников + терапевт)
const INITIAL_DEMO_USERS = [
  {
    id: 'user_admin',
    name: 'Денис Казаков',
    email: 'denis_kazakov@mail.ru',
    role: 'admin',
    registeredAt: '2026-09-20T10:00:00Z',
    isDemo: false
  },
  {
    id: 'user_anna',
    name: 'Анна',
    email: 'anna@ritm.local',
    plainPassword: 'ритм-42',
    role: 'patient',
    registeredAt: '2026-09-28T14:30:00Z',
    isDemo: true
  },
  {
    id: 'user_mikhail',
    name: 'Михаил',
    email: 'mikhail@ritm.local',
    plainPassword: 'мир-77',
    role: 'patient',
    registeredAt: '2026-09-28T16:00:00Z',
    isDemo: true
  },
  {
    id: 'user_elena',
    name: 'Елена',
    email: 'elena@ritm.local',
    plainPassword: 'весна-18',
    role: 'patient',
    registeredAt: '2026-09-29T11:20:00Z',
    isDemo: true
  }
];

const INITIAL_DEMO_SURVEYS = {
  user_anna: {
    userId: 'user_anna',
    concern: 'Постоянная фоновая тревога, тяжело переключаться после работы, комок в горле к вечеру и поверхностный сон.',
    anxiety: 8,
    sleep: 4,
    mood: 5,
    energy: 4,
    goal: 'Научиться расслаблять тело без чувства вины, вернуть глубокий сон и внутреннее спокойствие.',
    duration: 'Около года, особенно усилилось последние 3 месяца',
    submittedAt: '2026-09-28T14:45:00Z'
  },
  user_mikhail: {
    userId: 'user_mikhail',
    concern: 'Эмоциональное выгорание, синдром самозванца при руководстве проектами, прокрастинация и нехватка утренних сил.',
    anxiety: 7,
    sleep: 5,
    mood: 4,
    energy: 3,
    goal: 'Снять груз гиперконтроля, вернуть интерес к жизни и восстановить рабочий ресурс.',
    duration: 'Более 2 лет',
    submittedAt: '2026-09-28T16:15:00Z'
  },
  user_elena: {
    userId: 'user_elena',
    concern: 'Внезапные приступы паники в метро и людных местах, страх потери контроля, напряжение в плечах и шее.',
    anxiety: 9,
    sleep: 3,
    mood: 4,
    energy: 4,
    goal: 'Освободиться от страха панических атак, вернуть доверие к своему телу.',
    duration: '6 месяцев',
    submittedAt: '2026-09-29T11:35:00Z'
  }
};

const INITIAL_DEMO_CHECKINS = {
  user_anna: [
    {
      id: 'chk_anna_1',
      date: '2026-10-06T18:00:00Z',
      anxiety: 7,
      sleep: 5,
      mood: 6,
      energy: 5,
      weekText: 'После первой встречи группы почувствовала облегчение, что я не одна со своей тревогой. Слушала вечером аудиопрактику транса, заснула быстрее обычного.',
      insights: 'Тело само помнит, как расслабляться, если не заставлять себя силой.',
      aiResponse: 'Здравствуйте, Анна. Очень ценно, что первая встреча и аудиосессия помогли вам почувствовать поддержку и быстрее уснуть. Вы сделали важный шаг — позволили телу расслабиться в своём естественном темпе.',
      isCrisis: false,
      priorityAlert: false
    },
    {
      id: 'chk_anna_2',
      date: '2026-10-13T18:30:00Z',
      anxiety: 6,
      sleep: 6,
      mood: 7,
      energy: 6,
      weekText: 'Была непростая неделя на работе, но комок в горле почти не появлялся. В моменты стресса делала дыхание блуждающего нерва, как учил Денис.',
      insights: 'Смогла сказать коллеге спокойное «нет» и не испытывала потом терзаний.',
      aiResponse: 'Здравствуйте, Анна. Радостно видеть, как практические инструменты работы с дыханием помогают вам удерживать устойчивость среди рабочих вызовов. Спокойное отстаивание своих границ без чувства вины — это весомый шаг к вашей эмоциональной свободе.',
      isCrisis: false,
      priorityAlert: false
    },
    {
      id: 'chk_anna_3',
      date: '2026-10-20T19:00:00Z',
      anxiety: 4,
      sleep: 8,
      mood: 8,
      energy: 7,
      weekText: 'Сплю отлично! Утром просыпаюсь отдохнувшей. Стала замечать, что тревога отступает, когда я просто даю себе право замедлиться.',
      insights: 'Мой ритм может быть мягким, и мир от этого не рушится.',
      aiResponse: 'Здравствуйте, Анна. Замечательная динамика: глубокий сон и утренний прилив сил говорят о том, что нервная система действительно переключается в режим глубокого восстановления. Берегите это ощущение доверия к себе и своему ритму.',
      isCrisis: false,
      priorityAlert: false
    }
  ],
  user_mikhail: [
    {
      id: 'chk_mik_1',
      date: '2026-10-06T20:00:00Z',
      anxiety: 7,
      sleep: 5,
      mood: 5,
      energy: 4,
      weekText: 'На неделе старался отслеживать момент, когда начинаю накручивать себя перед созвонами.',
      insights: 'Понял, что часто путаю ответственность с тотальным контролем.',
      aiResponse: 'Здравствуйте, Михаил. Заметить автоматическую привычку гиперконтроля — это уже половина пути к освобождению от лишнего напряжения. Бережно отмечайте эти моменты, не критикуя себя за них.',
      isCrisis: false,
      priorityAlert: false
    },
    {
      id: 'chk_mik_2',
      date: '2026-10-13T21:10:00Z',
      anxiety: 5,
      sleep: 6,
      mood: 6,
      energy: 6,
      weekText: 'Впервые за полгода в выходные не открывал рабочий чат. Сходил в лес на прогулку, почувствовал тишину в голове.',
      insights: 'Без работы мир не остановился, а я набрался сил.',
      aiResponse: 'Здравствуйте, Михаил. Настоящий цифровой детокс и прогулка на природе — лучший подарок для уставшей нервной системы. Вы на практике возвращаете себе право на полноценный отдых.',
      isCrisis: false,
      priorityAlert: false
    }
  ],
  user_elena: [
    {
      id: 'chk_el_1',
      date: '2026-10-06T17:20:00Z',
      anxiety: 8,
      sleep: 4,
      mood: 5,
      energy: 5,
      weekText: 'Была в торговом центре, почувствовала приближение паники, но вспомнила заземление и технику взгляда из транса. Справилась без таблеток.',
      insights: 'Паника — это просто всплеск адреналина, она проходит за 10 минут, если не бороться.',
      aiResponse: 'Здравствуйте, Елена. Это большая личная победа — встретить тревожную волну и пройти сквозь неё, опираясь на тело и техники. Вы доказали себе, что способны сохранять управление.',
      isCrisis: false,
      priorityAlert: false
    },
    {
      id: 'chk_el_2',
      date: '2026-10-13T19:40:00Z',
      anxiety: 5,
      sleep: 6,
      mood: 6,
      energy: 6,
      weekText: 'Неделя прошла спокойно, плечи расслабились, шея не болит.',
      insights: 'Стало легче дышать полной грудью.',
      aiResponse: 'Здравствуйте, Елена. Физическое расслабление в плечах и свободное дыхание — верный знак того, что мышечный панцирь постепенно уступает место спокойствию.',
      isCrisis: false,
      priorityAlert: false
    }
  ]
};

export class StorageService {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_DEMO_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SURVEYS)) {
      localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(INITIAL_DEMO_SURVEYS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHECKINS)) {
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(INITIAL_DEMO_CHECKINS));
    }
  }

  // Пользователи
  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    } catch {
      return [];
    }
  }

  getUserById(id) {
    return this.getUsers().find(u => u.id === id) || null;
  }

  saveUser(user) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return user;
  }

  updateUser(id, updatedFields) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updatedFields, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return users[idx];
    }
    return null;
  }

  deleteUser(id) {
    if (!id || id === 'user_admin') return false;
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Очищаем привязанную анкету и чек-ины
    const surveys = this.getSurveys();
    if (surveys[id]) {
      delete surveys[id];
      localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));
    }

    const checkins = this.getAllCheckins();
    if (checkins[id]) {
      delete checkins[id];
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(checkins));
    }

    return true;
  }

  getPatientParticipants() {
    return this.getUsers().filter(u => u.role === 'patient');
  }

  // Текущая сессия
  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    } catch {
      return null;
    }
  }

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // Первичная анкета
  getSurveys() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEYS) || '{}');
    } catch {
      return {};
    }
  }

  getSurveyByUserId(userId) {
    const surveys = this.getSurveys();
    return surveys[userId] || null;
  }

  saveSurvey(userId, surveyData) {
    const surveys = this.getSurveys();
    surveys[userId] = {
      userId,
      ...surveyData,
      submittedAt: surveyData.submittedAt || new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));
    return surveys[userId];
  }

  // Еженедельные чек-ины
  getAllCheckins() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKINS) || '{}');
    } catch {
      return {};
    }
  }

  getCheckinsByUserId(userId) {
    const all = this.getAllCheckins();
    return (all[userId] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  saveCheckin(userId, checkinData) {
    const all = this.getAllCheckins();
    if (!all[userId]) {
      all[userId] = [];
    }
    const checkinId = checkinData.id || 'chk_' + Date.now();
    const existingIdx = all[userId].findIndex(c => c.id === checkinId);
    const newCheckin = {
      id: checkinId,
      date: checkinData.date || new Date().toISOString(),
      ...checkinData
    };

    if (existingIdx >= 0) {
      all[userId][existingIdx] = { ...all[userId][existingIdx], ...newCheckin };
    } else {
      all[userId].push(newCheckin);
    }

    localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(all));
    return newCheckin;
  }

  deleteCheckin(userId, checkinId) {
    const all = this.getAllCheckins();
    if (all[userId]) {
      all[userId] = all[userId].filter(c => c.id !== checkinId);
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(all));
      return true;
    }
    return false;
  }

  // Получить кризисные чек-ины (для подсветки у терапевта)
  getCrisisAlerts() {
    const all = this.getAllCheckins();
    const alerts = [];
    for (const userId in all) {
      const user = this.getUserById(userId);
      const userCheckins = all[userId] || [];
      const crisisItems = userCheckins.filter(c => c.isCrisis || c.priorityAlert);
      crisisItems.forEach(item => {
        alerts.push({
          user: user || { id: userId, name: 'Неизвестный участник' },
          checkin: item
        });
      });
    }
    return alerts.sort((a, b) => new Date(b.checkin.date) - new Date(a.checkin.date));
  }

  // Настройки ИИ (anymodel.org)
  getAiSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.model || parsed.model === 'gpt-4o-mini') {
          parsed.model = APP_CONFIG.ai.defaultModel;
        }
        if (!parsed.endpoint || parsed.endpoint === 'https://api.anymodel.org/v1/chat/completions') {
          parsed.endpoint = APP_CONFIG.ai.endpoint;
        }
        if (!parsed.apiKey || parsed.apiKey.trim() === '') {
          parsed.apiKey = APP_CONFIG.ai.apiKey || '';
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading AI settings:', e);
    }
    return {
      endpoint: APP_CONFIG.ai.endpoint,
      model: APP_CONFIG.ai.defaultModel,
      apiKey: APP_CONFIG.ai.apiKey || '',
      useMockFallback: true
    };
  }

  saveAiSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(settings));
  }

  // Firebase Config
  getFirebaseConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading Firebase config:', e);
    }
    return null;
  }

  saveFirebaseConfig(cfg) {
    localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(cfg));
  }

  // Настройки облачной синхронизации (Cloud Sync)
  getCloudSyncConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLOUD_SYNC);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading Cloud Sync config:', e);
    }
    return {
      enabled: false,
      cloudEndpoint: '',
      groupId: 'ritm_kazakov_group',
      lastSyncedAt: null,
      status: 'local' // 'synced' | 'local' | 'syncing' | 'error'
    };
  }

  saveCloudSyncConfig(cfg) {
    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC, JSON.stringify(cfg));
  }

  // Экспорт / Импорт
  exportAllData() {
    return JSON.stringify({
      users: this.getUsers(),
      surveys: this.getSurveys(),
      checkins: this.getAllCheckins(),
      aiSettings: this.getAiSettings(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  importAllData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
      if (data.surveys) localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(data.surveys));
      if (data.checkins) localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(data.checkins));
      if (data.aiSettings) localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(data.aiSettings));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Сброс к демонстрационным данным
  resetToDemo() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_DEMO_USERS));
    localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(INITIAL_DEMO_SURVEYS));
    localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(INITIAL_DEMO_CHECKINS));
  }
}

export const storage = new StorageService();
