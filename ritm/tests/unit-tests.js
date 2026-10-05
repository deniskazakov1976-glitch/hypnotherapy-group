/**
 * МОЙ РИТМ — Комплексный пакет юнит-тестов (Test Suite)
 * Покрытие: Config, StorageService, AuthService, AiService, ChartManager, Security, PWA
 */

import { APP_CONFIG } from '../js/config.js';
import { StorageService } from '../js/storage.js';
import { AuthService } from '../js/auth-service.js';
import { AiService } from '../js/ai-service.js';
import { ChartManager } from '../js/chart-manager.js';

// ============================================================================
// ЛЁГКОВЕСНЫЙ АВТОНОМНЫЙ ТЕСТОВЫЙ ДВИЖОК
// ============================================================================
export class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passed = 0;
    this.failed = 0;
  }

  describe(name, fn) {
    const suite = { name, tests: [], beforeEaches: [] };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  beforeEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeEaches.push(fn);
    }
  }

  it(name, testFn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ name, testFn });
    }
  }

  async run(onProgress = null) {
    this.totalTests = 0;
    this.passed = 0;
    this.failed = 0;
    const results = [];

    for (const suite of this.suites) {
      const suiteResult = { name: suite.name, tests: [] };

      for (const test of suite.tests) {
        this.totalTests++;
        let err = null;
        const start = performance.now();

        try {
          for (const be of suite.beforeEaches) {
            await be();
          }
          await test.testFn();
          this.passed++;
        } catch (e) {
          this.failed++;
          err = e;
        }

        const duration = Math.round(performance.now() - start);
        const testRes = {
          name: test.name,
          passed: !err,
          error: err ? (err.message || String(err)) : null,
          stack: err ? err.stack : null,
          duration
        };

        suiteResult.tests.push(testRes);
        if (onProgress) onProgress(testRes, suite.name);
      }
      results.push(suiteResult);
    }

    return {
      total: this.totalTests,
      passed: this.passed,
      failed: this.failed,
      suites: results
    };
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected deep equal ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, but got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, but got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) throw new Error(`Expected ${actual} < ${expected}`);
    },
    toContain(expected) {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) throw new Error(`Array does not contain ${JSON.stringify(expected)}`);
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected)) throw new Error(`String does not contain "${expected}"`);
      } else {
        throw new Error(`Cannot call toContain on type ${typeof actual}`);
      }
    },
    toThrow(expectedMessage = null) {
      if (typeof actual !== 'function') throw new Error('Expected a function to check for throw');
      let threw = false;
      let msg = '';
      try {
        actual();
      } catch (e) {
        threw = true;
        msg = e.message;
      }
      if (!threw) throw new Error('Expected function to throw, but it did not throw');
      if (expectedMessage && !msg.toLowerCase().includes(expectedMessage.toLowerCase())) {
        throw new Error(`Expected error containing "${expectedMessage}", but got "${msg}"`);
      }
    },
    async toReject(expectedMessage = null) {
      let threw = false;
      let msg = '';
      try {
        await actual;
      } catch (e) {
        threw = true;
        msg = e.message;
      }
      if (!threw) throw new Error('Expected promise to reject, but it resolved');
      if (expectedMessage && !msg.toLowerCase().includes(expectedMessage.toLowerCase())) {
        throw new Error(`Expected rejection containing "${expectedMessage}", but got "${msg}"`);
      }
    }
  };
}

// ============================================================================
// ОПРЕДЕЛЕНИЕ ТЕСТОВЫХ НАБОРОВ
// ============================================================================
export function registerAllTests(runner) {
  // --------------------------------------------------------------------------
  // СЬЮТ 1: КОНФИГУРАЦИЯ И СИСТЕМНЫЕ ПАРАМЕТРЫ
  // --------------------------------------------------------------------------
  runner.describe('1. Конфигурация и метаданные (config.js)', () => {
    runner.it('Приложение имеет корректное название и подзаголовок', () => {
      expect(APP_CONFIG.appName).toBe('Мой ритм');
      expect(APP_CONFIG.subtitle).toContain('Дневник состояния');
    });

    runner.it('Контакты ведущего Дениса Казакова заполнены и валидны', () => {
      expect(APP_CONFIG.therapist.name).toBe('Денис Казаков');
      expect(APP_CONFIG.therapist.phone).toContain('902');
      expect(APP_CONFIG.therapist.phoneRaw).toBe('79028028246');
      expect(APP_CONFIG.therapist.whatsappUrl).toContain('wa.me/79028028246');
      expect(APP_CONFIG.therapist.telegramUrl).toContain('t.me/dkazak1999');
    });

    runner.it('Экстренная линия помощи заполнена по протоколу 24/7', () => {
      expect(APP_CONFIG.emergencyHelp.phone).toBe('8-800-2000-122');
      expect(APP_CONFIG.emergencyHelp.description).toContain('Круглосуточная');
    });

    runner.it('Определены все 4 ключевые шкалы состояния (тревога, сон, настроение, энергия)', () => {
      expect(APP_CONFIG.metrics.length).toBe(4);
      const ids = APP_CONFIG.metrics.map(m => m.id);
      expect(ids).toContain('anxiety');
      expect(ids).toContain('sleep');
      expect(ids).toContain('mood');
      expect(ids).toContain('energy');
      const anxiety = APP_CONFIG.metrics.find(m => m.id === 'anxiety');
      expect(anxiety.reversed).toBe(true); // меньше тревоги = лучше
    });

    runner.it('Кризисные триггеры безопасности содержат ключевые маркеры', () => {
      expect(APP_CONFIG.crisisTriggers.length).toBeGreaterThan(10);
      expect(APP_CONFIG.crisisTriggers).toContain('суицид');
      expect(APP_CONFIG.crisisTriggers).toContain('умереть');
      expect(APP_CONFIG.crisisTriggers).toContain('не хочу жить');
    });

    runner.it('Настройки ИИ: корректный endpoint и модель am/nemotron-3-ultra-550b-a55b', () => {
      expect(APP_CONFIG.ai.endpoint).toBe('https://anymodel.org/v1/chat/completions');
      expect(APP_CONFIG.ai.defaultModel).toBe('am/nemotron-3-ultra-550b-a55b');
      expect(APP_CONFIG.ai.apiKey).toBe('sk-dc9d4b7df36ba555-jaj089-e4f556ca');
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 2: ХРАНИЛИЩЕ ДАННЫХ (StorageService)
  // --------------------------------------------------------------------------
  runner.describe('2. Хранилище данных и персистентность (storage.js)', () => {
    let testStorage;

    runner.beforeEach(() => {
      localStorage.clear();
      testStorage = new StorageService();
    });

    runner.it('Инициализирует демо-данные при первом запуске', () => {
      const users = testStorage.getUsers();
      expect(users.length).toBeGreaterThan(0);
      const admin = users.find(u => u.role === 'admin');
      expect(admin.name).toBe('Денис Казаков');
    });

    runner.it('Сохраняет и возвращает нового пользователя', () => {
      const u = { id: 'test_1', name: 'Тестовый Участник', role: 'patient' };
      testStorage.saveUser(u);
      const retrieved = testStorage.getUserById('test_1');
      expect(retrieved.name).toBe('Тестовый Участник');
    });

    runner.it('Управляет текущей активной сессией пользователя', () => {
      const u = { id: 'test_session', name: 'Алексей' };
      testStorage.setCurrentUser(u);
      expect(testStorage.getCurrentUser().name).toBe('Алексей');
      testStorage.setCurrentUser(null);
      expect(testStorage.getCurrentUser()).toBeFalsy();
    });

    runner.it('Сохраняет и возвращает первичную анкету участника', () => {
      const surveyData = {
        concern: 'Беспокойство по вечерам',
        anxiety: 7,
        sleep: 5,
        mood: 6,
        energy: 5,
        goal: 'Спокойствие'
      };
      testStorage.saveSurvey('user_test_survey', surveyData);
      const res = testStorage.getSurveyByUserId('user_test_survey');
      expect(res.concern).toBe('Беспокойство по вечерам');
      expect(res.anxiety).toBe(7);
      expect(res.submittedAt).toBeTruthy();
    });

    runner.it('Сохраняет чек-ины и сортирует их по дате (хронологический порядок)', () => {
      testStorage.saveCheckin('user_chk', {
        id: 'c2',
        date: '2026-10-10T12:00:00Z',
        anxiety: 4
      });
      testStorage.saveCheckin('user_chk', {
        id: 'c1',
        date: '2026-10-01T12:00:00Z',
        anxiety: 8
      });

      const list = testStorage.getCheckinsByUserId('user_chk');
      expect(list.length).toBe(2);
      expect(list[0].id).toBe('c1'); // Более ранний первым
      expect(list[1].id).toBe('c2');
    });

    runner.it('Выявляет кризисные алерты в getCrisisAlerts()', () => {
      testStorage.saveCheckin('user_crisis_test', {
        id: 'c_crit',
        date: new Date().toISOString(),
        anxiety: 9,
        isCrisis: true,
        weekText: 'Критическое состояние'
      });
      const alerts = testStorage.getCrisisAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      const alert = alerts.find(a => a.checkin.id === 'c_crit');
      expect(alert.checkin.isCrisis).toBe(true);
    });

    runner.it('Экспорт и импорт данных работают без потерь (JSON Backup)', () => {
      const exportedJson = testStorage.exportAllData();
      expect(typeof exportedJson).toBe('string');
      const parsed = JSON.parse(exportedJson);
      expect(parsed.users).toBeTruthy();
      expect(parsed.surveys).toBeTruthy();

      const importResult = testStorage.importAllData(exportedJson);
      expect(importResult.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 3: АВТОРИЗАЦИЯ И БЕЗОПАСНОСТЬ (AuthService)
  // --------------------------------------------------------------------------
  runner.describe('3. Авторизация, пароли и роли (auth-service.js)', () => {
    let auth;

    runner.beforeEach(() => {
      localStorage.clear();
      new StorageService();
      auth = new AuthService();
    });

    runner.it('Прошитый вход администратора (Денис Казаков) с паролем 127554', async () => {
      const admin = await auth.login('denis_kazakov@mail.ru', '127554');
      expect(admin.role).toBe('admin');
      expect(admin.name).toBe('Денис Казаков');
      expect(auth.isTherapist()).toBe(true);
    });

    runner.it('Вход Дениса Казакова по имени «Денис» с паролем 127554', async () => {
      const admin = await auth.login('Денис', '127554');
      expect(admin.role).toBe('admin');
    });

    runner.it('Отклоняет неверный пароль администратора', async () => {
      await expect(auth.login('denis_kazakov@mail.ru', 'wrongpass')).toReject('Неверный пароль');
    });

    runner.it('Регистрирует нового участника с хэшированием пароля', async () => {
      const user = await auth.register('Мария Иванова', 'maria@test.ru', 'secure123');
      expect(user.role).toBe('patient');
      expect(user.name).toBe('Мария Иванова');
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash.length).toBe(64); // SHA-256 hex length
    });

    runner.it('Запрещает регистрацию с уже существующим email или именем', async () => {
      await auth.register('Ольга', 'olga@test.ru', '12345');
      await expect(auth.register('Ольга', 'other@test.ru', '12345')).toReject('уже зарегистрирован');
      await expect(auth.register('Ирина', 'olga@test.ru', '12345')).toReject('уже зарегистрирован');
    });

    runner.it('Запрещает регистрацию под зарезервированными данными Дениса Казакова', async () => {
      await expect(auth.register('Денис', 'denis_kazakov@mail.ru', '12345')).toReject('зарезервирован');
    });

    runner.it('Успешный вход участника по имени и паролю', async () => {
      await auth.register('Сергей', 'sergey@test.ru', 'password99');
      const logged = await auth.login('Сергей', 'password99');
      expect(logged.name).toBe('Сергей');
      expect(logged.email).toBe('sergey@test.ru');
    });

    runner.it('Отклоняет неверный пароль участника при входе', async () => {
      await auth.register('Наталья', 'nat@test.ru', 'correctpass');
      await expect(auth.login('Наталья', 'wrongpass')).toReject('Неверный пароль');
    });

    runner.it('Восстановление пароля по Email (resetPasswordByEmail)', async () => {
      await auth.register('Виктор', 'viktor@test.ru', 'oldpass1');
      await auth.resetPasswordByEmail('viktor@test.ru', 'newpass2');
      const loggedIn = await auth.login('viktor@test.ru', 'newpass2');
      expect(loggedIn.name).toBe('Виктор');
    });

    runner.it('Авторизация через ВКонтакте для обычного участника', async () => {
      const vkUser = await auth.loginWithVk('id987654321');
      expect(vkUser.role).toBe('patient');
      expect(vkUser.authProvider).toBe('vk');
    });

    runner.it('Авторизация через VK для Дениса требует пароль ведущего', async () => {
      await expect(auth.loginWithVk('id468816327')).toReject('требуется ввести секретный пароль');
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 4: ИИ-АССИСТЕНТ И КРИЗИСНЫЙ ПРОТОКОЛ (AiService)
  // --------------------------------------------------------------------------
  runner.describe('4. ИИ-ассистент и протокол безопасности (ai-service.js)', () => {
    let ai;

    runner.beforeEach(() => {
      ai = new AiService();
    });

    runner.it('Текстовый кризис-детектор: мгновенно выявляет опасные триггеры', () => {
      expect(ai.detectCrisis('мне кажется, лучше умереть')).toBe(true);
      expect(ai.detectCrisis('появились мысли о суициде')).toBe(true);
      expect(ai.detectCrisis('СУИЦИД это конец')).toBe(true);
      expect(ai.detectCrisis('не хочу жить больше')).toBe(true);
      expect(ai.detectCrisis('порезать себя ночью')).toBe(true);
    });

    runner.it('Текстовый кризис-детектор: безопасен для обычного текста', () => {
      expect(ai.detectCrisis('Хорошо отдохнул на природе')).toBe(false);
      expect(ai.detectCrisis('')).toBe(false);
      expect(ai.detectCrisis(null)).toBe(false);
    });

    runner.it('Числовой кризис-детектор: экстремальная тревога (9+) и низкое настроение (<=2)', () => {
      expect(ai.detectNumericCrisis({ anxiety: 9, mood: 2, sleep: 5, energy: 4 })).toBe(true);
      expect(ai.detectNumericCrisis({ anxiety: 10, mood: 1, sleep: 3, energy: 1 })).toBe(true);
      expect(ai.detectNumericCrisis({ anxiety: 8, mood: 2, sleep: 5, energy: 4 })).toBe(false);
    });

    runner.it('Числовой кризис-детектор: тотальный коллапс позитивных шкал (сон, настроение, энергия <= 2)', () => {
      expect(ai.detectNumericCrisis({ anxiety: 5, sleep: 2, mood: 2, energy: 2 })).toBe(true);
      expect(ai.detectNumericCrisis({ anxiety: 5, sleep: 2, mood: 3, energy: 2 })).toBe(false);
    });

    runner.it('Кризисный ответ содержит экстренные контакты Дениса и горячую линию', () => {
      const response = ai.generateCrisisResponse('Светлана');
      expect(response).toContain('Светлана');
      expect(response).toContain('902');
      expect(response).toContain('WhatsApp');
      expect(response).toContain('8-800-2000-122');
    });

    runner.it('Локальный эмпатичный симулятор адаптирует тон под показатели шкал', () => {
      const highAnx = ai.generateEmpatheticFallback('Дмитрий', {
        anxiety: 8, sleep: 5, mood: 5, energy: 5
      });
      expect(highAnx).toContain('Дмитрий');
      expect(highAnx).toContain('тревожн');

      const goodSleep = ai.generateEmpatheticFallback('Дмитрий', {
        anxiety: 3, sleep: 8, mood: 7, energy: 7
      });
      expect(goodSleep).toContain('покой');
    });

    runner.it('generateCheckinResponse немедленно блокирует опасный чек-ин кризисным ответом', async () => {
      const res = await ai.generateCheckinResponse('Игорь', {
        anxiety: 9, sleep: 2, mood: 1, energy: 2,
        weekText: 'мне тяжело'
      });
      expect(res.isCrisis).toBe(true);
      expect(res.text).toContain('8-800-2000-122');
    });

    runner.it('Формирует аналитическую сводку для терапевта с расчетом динамики', async () => {
      const patient = { name: 'Елена' };
      const survey = { concern: 'Панические атаки', goal: 'Спокойствие', anxiety: 8, sleep: 4 };
      const checkins = [
        { date: '2026-10-01', anxiety: 8, sleep: 4, mood: 5, energy: 5 },
        { date: '2026-10-08', anxiety: 5, sleep: 7, mood: 7, energy: 6, weekText: 'Легче дышать', insights: 'Паника проходит' }
      ];
      const summary = await ai.generateTherapistSummary(patient, survey, checkins);
      expect(summary).toContain('Елена');
      expect(summary).toContain('снизилась на 3'); // с 8 до 5
      expect(summary).toContain('улучшилось');
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 5: ПОСТРОЕНИЕ ГРАФИКОВ (ChartManager)
  // --------------------------------------------------------------------------
  runner.describe('5. Интерактивные графики динамики (chart-manager.js)', () => {
    let cm;

    runner.beforeEach(() => {
      cm = new ChartManager();
    });

    runner.it('Формирует точку «Старт» из первичной анкеты и еженедельные точки', () => {
      const survey = {
        submittedAt: '2026-10-01T10:00:00Z',
        anxiety: 8, sleep: 4, mood: 5, energy: 4
      };
      const checkins = [
        { date: '2026-10-08T10:00:00Z', anxiety: 6, sleep: 6, mood: 6, energy: 5 },
        { date: '2026-10-15T10:00:00Z', anxiety: 4, sleep: 7, mood: 8, energy: 7 }
      ];

      const data = cm.prepareChartData(survey, checkins);
      expect(data.labels.length).toBe(3);
      expect(data.labels[0]).toContain('Старт');
      expect(data.labels[1]).toContain('Неделя 1');
      expect(data.labels[2]).toContain('Неделя 2');
    });

    runner.it('Создает 4 набора данных со строгой цветовой палитрой', () => {
      const data = cm.prepareChartData(null, []);
      expect(data.datasets.length).toBe(4);
      expect(data.datasets[0].borderColor).toBe('#E06D53'); // Тревожность
      expect(data.datasets[1].borderColor).toBe('#5B7298'); // Сон
      expect(data.datasets[2].borderColor).toBe('#3E886D'); // Настроение
      expect(data.datasets[3].borderColor).toBe('#D99B26'); // Энергия
    });

    runner.it('Опции графика зафиксированы на шкале 1–10', () => {
      const opts = cm.getCommonOptions();
      expect(opts.scales.y.min).toBe(1);
      expect(opts.scales.y.max).toBe(10);
      expect(opts.responsive).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 6: XSS ЗАЩИТА И БЕЗОПАСНОСТЬ ВВОДА (Security Sanitization)
  // --------------------------------------------------------------------------
  runner.describe('6. Безопасность ввода и защита от XSS', () => {
    function esc(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
    }

    runner.it('Экранирует теги <script> и события onerror', () => {
      const malicious = '<script>alert("hack")</script><img src=x onerror=alert(1)>';
      const safe = esc(malicious);
      expect(safe).not.toContain('<script>');
      expect(safe).toContain('&lt;script&gt;');
      expect(safe).toContain('&lt;img');
    });

    runner.it('Корректно обрабатывает пустые значения, null и числа', () => {
      expect(esc('')).toBe('');
      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
      expect(esc(12345)).toBe('12345');
    });
  });

  // --------------------------------------------------------------------------
  // СЬЮТ 7: PWA СТАНДАРТЫ И МАНИФЕСТ
  // --------------------------------------------------------------------------
  runner.describe('7. Стандарты PWA, Manifest и Service Worker', () => {
    runner.it('Манифест содержит все обязательные поля для установки на мобильные', async () => {
      const resp = await fetch('../manifest.json');
      expect(resp.status).toBe(200);
      const manifest = await resp.json();
      expect(manifest.name).toContain('Мой ритм');
      expect(manifest.short_name).toBe('Мой ритм');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('./index.html');
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    runner.it('Иконки 192px и 512px доступны по HTTP', async () => {
      const r192 = await fetch('../assets/icon-192.png');
      expect(r192.status).toBe(200);
      const r512 = await fetch('../assets/icon-512.png');
      expect(r512.status).toBe(200);
    });
  });
}
