/**
 * Мой ритм — Дневник состояния между встречами
 * Главный контроллер приложения (App Orchestration)
 */

import { APP_CONFIG } from './config.js';
import { storage } from './storage.js';
import { authService, generateSimplePassword } from './auth-service.js';
import { aiService } from './ai-service.js';
import { chartManager } from './chart-manager.js';
import { firebaseService } from './firebase-service.js';

/** Utility: escape user text for safe innerHTML insertion (XSS prevention) */
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

class App {
  constructor() {
    this.selectedTherapistPatientId = null;
    this.revealedPasswords = new Set();
    this.init();
  }

  init() {
    this.bindEvents();
    this.setupSliderDescriptions();
    this.setupPwa();
    this.checkSessionAndRoute();
  }

  // =========================================================================
  // НАВИГАЦИЯ И ЭКРАНЫ
  // =========================================================================
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  checkSessionAndRoute() {
    let user = authService.getCurrentUser();

    // Если в сессии Денис Казаков, но роль случайно осталась patient — гарантированно повышаем до admin
    if (user && (user.name.toLowerCase().includes('денис') || user.name.toLowerCase().includes('казаков') || user.name.toLowerCase() === 'admin')) {
      if (user.role !== 'admin') {
        user.role = 'admin';
        storage.saveUser(user);
        storage.setCurrentUser(user);
      }
    }

    this.updateHeaderNav(user);

    if (!user) {
      this.showScreen('screen-auth');
      return;
    }

    if (user.role === 'admin') {
      this.showScreen('screen-therapist-dashboard');
      this.renderTherapistDashboard();
      return;
    }

    // Пользователь — участник: проверяем, заполнена ли первичная анкета
    const survey = storage.getSurveyByUserId(user.id);
    if (!survey) {
      this.showScreen('screen-initial-survey');
    } else {
      this.showScreen('screen-patient-dashboard');
      this.renderPatientDashboard(user);
    }
  }

  updateHeaderNav(user) {
    const navBox = document.getElementById('user-nav-box');
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const logoutBtn = document.getElementById('btn-logout');
    const settingsBtn = document.getElementById('btn-admin-settings');

    if (user) {
      navBox.style.display = 'flex';
      nameEl.textContent = user.name;
      logoutBtn.style.display = 'inline-flex';

      if (user.role === 'admin') {
        roleEl.textContent = 'Ведущий';
        roleEl.className = 'role-tag admin';
        settingsBtn.style.display = 'inline-flex';
      } else {
        roleEl.textContent = 'Участник';
        roleEl.className = 'role-tag patient';
        settingsBtn.style.display = 'none';
      }
    } else {
      navBox.style.display = 'none';
      logoutBtn.style.display = 'none';
      settingsBtn.style.display = 'none';
    }
  }

  // =========================================================================
  // ПРИВЯЗКА СОБЫТИЙ
  // =========================================================================
  bindEvents() {
    // Вкладки авторизации (Вход / Регистрация)
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    const switchAuthTab = (activeTab) => {
      [tabLogin, tabRegister].forEach(t => t && t.classList.remove('active'));
      if (formLogin) formLogin.style.display = 'none';
      if (formRegister) formRegister.style.display = 'none';

      if (activeTab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (formLogin) formLogin.style.display = 'block';
      } else if (activeTab === 'register') {
        if (tabRegister) tabRegister.classList.add('active');
        if (formRegister) formRegister.style.display = 'block';
      }
    };

    if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

    // Отправка формы входа (по имени или email)
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-name').value;
        const pass = document.getElementById('login-password').value;
        try {
          const user = await authService.login(identifier, pass);
          this.showToast(`Добро пожаловать, ${user.name}!`);
          this.checkSessionAndRoute();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Отправка формы регистрации (Имя + Email + Пароль)
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        try {
          await authService.register(name, email, pass);
          this.showToast('Регистрация успешна! Заполните вводную анкету.');
          this.checkSessionAndRoute();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Восстановление пароля по email
    const linkForgot = document.getElementById('link-forgot-password');
    if (linkForgot) {
      linkForgot.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal('modal-reset-password');
      });
    }

    const modalResetClose = document.getElementById('modal-reset-close');
    if (modalResetClose) {
      modalResetClose.addEventListener('click', () => {
        this.closeModal('modal-reset-password');
      });
    }

    const formReset = document.getElementById('form-reset-password');
    if (formReset) {
      formReset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const p1 = document.getElementById('reset-new-password').value;
        const p2 = document.getElementById('reset-confirm-password').value;

        if (p1 !== p2) {
          this.showToast('Пароли не совпадают. Пожалуйста, проверьте ввод.', 'error');
          return;
        }

        try {
          const user = await authService.resetPasswordByEmail(email, p1);
          this.closeModal('modal-reset-password');
          this.showToast(`Пароль успешно обновлён! Добро пожаловать, ${user.name}`);
          this.checkSessionAndRoute();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Вход через ВКонтакте — открытие модального окна выбора профиля
    const btnVkLogin = document.getElementById('btn-vk-login');
    if (btnVkLogin) {
      btnVkLogin.addEventListener('click', () => {
        this.openModal('modal-vk-auth');
      });
    }

    const modalVkClose = document.getElementById('modal-vk-close');
    if (modalVkClose) {
      modalVkClose.addEventListener('click', () => {
        this.closeModal('modal-vk-auth');
      });
    }

    // Форма входа участника через VK
    const formVkParticipant = document.getElementById('form-vk-participant');
    if (formVkParticipant) {
      formVkParticipant.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = document.getElementById('vk-input-profile').value;
        try {
          const user = await authService.loginWithVk(profile);
          this.closeModal('modal-vk-auth');
          this.showToast(`Вход через ВКонтакте выполнен: ${user.name}`);
          this.checkSessionAndRoute();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Выход
    document.getElementById('btn-logout').addEventListener('click', () => {
      authService.logout();
      this.showToast('Вы вышли из дневника');
      this.checkSessionAndRoute();
    });

    // Клик по логотипу
    document.getElementById('brand-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.checkSessionAndRoute();
    });

    // Первичная анкета
    document.getElementById('form-initial-survey').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleInitialSurveySubmit();
    });

    // Открытие модалки чек-ина (всегда начинаем с Шага 1)
    document.getElementById('btn-open-checkin').addEventListener('click', () => {
      this.setCheckinStep(1);
      this.openModal('modal-checkin');
    });

    document.getElementById('modal-checkin-close').addEventListener('click', () => {
      this.closeModal('modal-checkin');
    });

    // Навигация по шагам модалки чек-ина (1. Шкалы -> 2. Заметки)
    const tabStep1 = document.getElementById('chk-tab-step1');
    const tabStep2 = document.getElementById('chk-tab-step2');
    const btnToStep2 = document.getElementById('btn-chk-to-step2');
    const btnBackToStep1 = document.getElementById('btn-chk-back-to-step1');

    if (tabStep1) tabStep1.addEventListener('click', () => this.setCheckinStep(1));
    if (tabStep2) tabStep2.addEventListener('click', () => this.setCheckinStep(2));
    if (btnToStep2) btnToStep2.addEventListener('click', () => this.setCheckinStep(2));
    if (btnBackToStep1) btnBackToStep1.addEventListener('click', () => this.setCheckinStep(1));

    // Отправка еженедельного чек-ина
    document.getElementById('form-weekly-checkin').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleWeeklyCheckinSubmit();
    });

    // Настройки терапевта
    const btnSettings = document.getElementById('btn-admin-settings');
    btnSettings.addEventListener('click', () => {
      this.loadSettingsForm();
      this.openModal('modal-settings');
    });

    document.getElementById('modal-settings-close').addEventListener('click', () => {
      this.closeModal('modal-settings');
    });

    document.getElementById('form-settings').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettingsForm();
    });

    // Экспорт / Импорт / Сброс данных
    document.getElementById('btn-export-data').addEventListener('click', () => {
      const json = storage.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moy-ritm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Резервная копия данных выгружена в JSON');
    });

    document.getElementById('btn-import-data').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = storage.importAllData(event.target.result);
          if (res.success) {
            this.showToast('Данные успешно импортированы!');
            this.closeModal('modal-settings');
            this.checkSessionAndRoute();
          } else {
            this.showToast('Ошибка импорта: ' + res.error, 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (confirm('Сбросить базу данных к начальным демонстрационным записям группы?')) {
        storage.resetToDemo();
        this.showToast('Демо-данные восстановлены');
        this.closeModal('modal-settings');
        this.checkSessionAndRoute();
      }
    });

    // Кнопка обновления в админке
    document.getElementById('btn-refresh-admin').addEventListener('click', () => {
      this.renderTherapistDashboard();
      this.showToast('Данные обновлены');
    });

    // ИИ-сводка перед сессией (боковая и верхняя кнопки)
    const onSummaryClick = async () => { await this.handleGenerateAiSummary(); };
    document.getElementById('btn-generate-ai-summary').addEventListener('click', onSummaryClick);
    const topSummaryBtn = document.getElementById('btn-generate-ai-summary-top');
    if (topSummaryBtn) topSummaryBtn.addEventListener('click', onSummaryClick);

    // Скопировать сводку в буфер обмена
    document.getElementById('btn-copy-summary').addEventListener('click', () => {
      const text = document.getElementById('therapist-ai-summary-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Текст сводки скопирован в буфер обмена!');
      });
    });

    // =========================================================================
    // АДМИНИСТРИРОВАНИЕ УЧАСТНИКОВ ГРУППЫ (РЕГИСТРАЦИЯ, ПАРОЛИ, ОПРОС, СИНХР.)
    // =========================================================================
    
    // Кнопка открытия модалки регистрации участника
    const btnAddPart = document.getElementById('btn-admin-add-participant');
    if (btnAddPart) {
      btnAddPart.addEventListener('click', () => {
        const form = document.getElementById('form-admin-add-participant');
        if (form) form.reset();
        const passInput = document.getElementById('admin-add-pass');
        if (passInput) passInput.value = generateSimplePassword();
        this.openModal('modal-admin-add-participant');
      });
    }

    // Закрытие модалки регистрации
    const btnCloseAdd = document.getElementById('modal-admin-add-close');
    if (btnCloseAdd) {
      btnCloseAdd.addEventListener('click', () => this.closeModal('modal-admin-add-participant'));
    }

    // Генерация простого пароля в модалке регистрации
    const btnGenPassAdd = document.getElementById('btn-admin-gen-pass-add');
    if (btnGenPassAdd) {
      btnGenPassAdd.addEventListener('click', () => {
        const passInput = document.getElementById('admin-add-pass');
        if (passInput) passInput.value = generateSimplePassword();
      });
    }

    // Отправка формы регистрации участника (обычное сохранение)
    const formAddPart = document.getElementById('form-admin-add-participant');
    if (formAddPart) {
      formAddPart.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAdminAddParticipant(false);
      });
    }

    // Кнопка "Сохранить и скопировать для WhatsApp"
    const btnSaveAndCopy = document.getElementById('btn-admin-save-and-copy');
    if (btnSaveAndCopy) {
      btnSaveAndCopy.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleAdminAddParticipant(true);
      });
    }

    // Модалка редактирования участника: закрытие и отмена
    const btnCloseEdit = document.getElementById('modal-admin-edit-close');
    const btnCancelEdit = document.getElementById('btn-admin-edit-cancel');
    if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => this.closeModal('modal-admin-edit-participant'));
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => this.closeModal('modal-admin-edit-participant'));

    // Генерация пароля в модалке редактирования
    const btnGenPassEdit = document.getElementById('btn-admin-gen-pass-edit');
    if (btnGenPassEdit) {
      btnGenPassEdit.addEventListener('click', () => {
        const passInput = document.getElementById('admin-edit-pass');
        if (passInput) passInput.value = generateSimplePassword();
      });
    }

    // Сохранение изменений участника
    const formEditPart = document.getElementById('form-admin-edit-participant');
    if (formEditPart) {
      formEditPart.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAdminEditParticipantSubmit();
      });
    }

    // Модалка очного среза: закрытие и отмена
    const btnCloseEntry = document.getElementById('modal-admin-entry-close');
    const btnCancelEntry = document.getElementById('btn-admin-entry-cancel');
    if (btnCloseEntry) btnCloseEntry.addEventListener('click', () => this.closeModal('modal-admin-entry-checkin'));
    if (btnCancelEntry) btnCancelEntry.addEventListener('click', () => this.closeModal('modal-admin-entry-checkin'));

    // Сохранение очного среза на группе
    const formEntryCheckin = document.getElementById('form-admin-entry-checkin');
    if (formEntryCheckin) {
      formEntryCheckin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAdminEntryCheckinSubmit();
      });
    }

    // Кнопка облачной синхронизации
    const btnSyncCloud = document.getElementById('btn-admin-sync-cloud');
    if (btnSyncCloud) {
      btnSyncCloud.addEventListener('click', async () => {
        await this.syncCloudData();
      });
    }
  }

  // =========================================================================
  // СЛАЙДЕРЫ И ДИНАМИЧЕСКИЕ ОПИСАНИЯ
  // =========================================================================
  setupSliderDescriptions() {
    const scales = [
      { id: 'init-anxiety', metric: 'anxiety' },
      { id: 'init-sleep', metric: 'sleep' },
      { id: 'init-mood', metric: 'mood' },
      { id: 'init-energy', metric: 'energy' },
      { id: 'chk-anxiety', metric: 'anxiety' },
      { id: 'chk-sleep', metric: 'sleep' },
      { id: 'chk-mood', metric: 'mood' },
      { id: 'chk-energy', metric: 'energy' },
      { id: 'admin-chk-anxiety', metric: 'anxiety' },
      { id: 'admin-chk-sleep', metric: 'sleep' },
      { id: 'admin-chk-mood', metric: 'mood' },
      { id: 'admin-chk-energy', metric: 'energy' }
    ];

    const getDesc = (metric, val) => {
      val = parseInt(val, 10);
      switch(metric) {
        case 'anxiety':
          if (val <= 2) return `${val}: Спокойствие`;
          if (val <= 4) return `${val}: Лёгкое волнение`;
          if (val <= 6) return `${val}: Умеренное напряжение`;
          if (val <= 8) return `${val}: Заметная тревога`;
          return `${val}: Острая тревога / паника`;
        case 'sleep':
          if (val <= 2) return `${val}: Тяжёлая бессонница`;
          if (val <= 4) return `${val}: Прерывистый, тревожный`;
          if (val <= 6) return `${val}: Удовлетворительный`;
          if (val <= 8) return `${val}: Хороший, крепкий`;
          return `${val}: Глубокий, восстанавливающий`;
        case 'mood':
          if (val <= 2) return `${val}: Глубокая подавленность`;
          if (val <= 4) return `${val}: Сниженное, апатия`;
          if (val <= 6) return `${val}: Нейтральное, ровное`;
          if (val <= 8) return `${val}: Светлое, хорошее`;
          return `${val}: Душевный подъем`;
        case 'energy':
          if (val <= 2) return `${val}: Полное истощение`;
          if (val <= 4) return `${val}: Быстрая утомляемость`;
          if (val <= 6) return `${val}: Хватает на рутину`;
          if (val <= 8) return `${val}: Бодрость, активность`;
          return `${val}: Полон ресурса и сил`;
      }
      return `${val}/10`;
    };

    scales.forEach(item => {
      const range = document.getElementById(`${item.id}-range`);
      const badge = document.getElementById(`${item.id}-badge`);
      const desc = document.getElementById(`${item.id}-desc`);

      if (range && badge) {
        range.addEventListener('input', (e) => {
          const val = e.target.value;
          badge.textContent = val;
          if (desc) desc.textContent = getDesc(item.metric, val);
        });
      }
    });
  }

  setCheckinStep(step) {
    const tab1 = document.getElementById('chk-tab-step1');
    const tab2 = document.getElementById('chk-tab-step2');
    const pane1 = document.getElementById('chk-step1-pane');
    const pane2 = document.getElementById('chk-step2-pane');

    if (step === 1) {
      if (tab1) tab1.classList.add('active');
      if (tab2) tab2.classList.remove('active');
      if (pane1) pane1.style.display = 'block';
      if (pane2) pane2.style.display = 'none';
    } else {
      if (tab2) tab2.classList.add('active');
      if (tab1) tab1.classList.remove('active');
      if (pane2) pane2.style.display = 'block';
      if (pane1) pane1.style.display = 'none';
    }
  }

  // =========================================================================
  // ПЕРВИЧНАЯ АНКЕТА
  // =========================================================================
  handleInitialSurveySubmit() {
    const user = authService.getCurrentUser();
    if (!user) return;

    const concern = document.getElementById('init-concern').value;
    const anxiety = parseInt(document.getElementById('init-anxiety-range').value, 10);
    const sleep = parseInt(document.getElementById('init-sleep-range').value, 10);
    const mood = parseInt(document.getElementById('init-mood-range').value, 10);
    const energy = parseInt(document.getElementById('init-energy-range').value, 10);
    const goal = document.getElementById('init-goal').value;
    const duration = document.getElementById('init-duration').value;

    const surveyData = {
      concern,
      anxiety,
      sleep,
      mood,
      energy,
      goal,
      duration,
      submittedAt: new Date().toISOString()
    };

    storage.saveSurvey(user.id, surveyData);
    this.showToast('Первичная анкета сохранена! Добро пожаловать в дневник.');
    this.checkSessionAndRoute();
  }

  // =========================================================================
  // КАБИНЕТ ПАЦИЕНТА
  // =========================================================================
  renderPatientDashboard(user) {
    document.getElementById('dash-patient-name').textContent = user.name;

    const initialSurvey = storage.getSurveyByUserId(user.id);
    const checkins = storage.getCheckinsByUserId(user.id);

    // Расчет текущих показателей (последний чек-ин либо начальная анкета)
    const latestState = checkins.length > 0 ? checkins[checkins.length - 1] : initialSurvey;

    if (latestState) {
      document.getElementById('pill-anxiety').textContent = latestState.anxiety;
      document.getElementById('pill-sleep').textContent = latestState.sleep;
      document.getElementById('pill-mood').textContent = latestState.mood;
      document.getElementById('pill-energy').textContent = latestState.energy;

      // Тренды (если есть чек-ины)
      if (checkins.length > 0 && initialSurvey) {
        const anxDiff = latestState.anxiety - initialSurvey.anxiety;
        const sleepDiff = latestState.sleep - initialSurvey.sleep;
        
        const anxEl = document.getElementById('trend-anxiety');
        if (anxDiff < 0) {
          anxEl.innerHTML = `<span style="color:#16A34A;font-weight:600;">↘ −${Math.abs(anxDiff)}</span> <span style="color:var(--color-text-muted);">от старта (лучше)</span>`;
        } else if (anxDiff > 0) {
          anxEl.innerHTML = `<span style="color:#DC2626;font-weight:600;">↗ +${anxDiff}</span> <span style="color:var(--color-text-muted);">от старта (рост)</span>`;
        } else {
          anxEl.innerHTML = `<span style="color:#64748B;">→ без изменений</span>`;
        }

        const sleepEl = document.getElementById('trend-sleep');
        if (sleepDiff > 0) {
          sleepEl.innerHTML = `<span style="color:#16A34A;font-weight:600;">↗ +${sleepDiff}</span> <span style="color:var(--color-text-muted);">от старта (лучше)</span>`;
        } else if (sleepDiff < 0) {
          sleepEl.innerHTML = `<span style="color:#DC2626;font-weight:600;">↘ −${Math.abs(sleepDiff)}</span> <span style="color:var(--color-text-muted);">от старта</span>`;
        } else {
          sleepEl.innerHTML = `<span style="color:#64748B;">→ без изменений</span>`;
        }

        document.getElementById('trend-mood').innerHTML = `<span style="color:var(--color-text-muted);">Текущий уровень: <strong>${latestState.mood}/10</strong></span>`;
        document.getElementById('trend-energy').innerHTML = `<span style="color:var(--color-text-muted);">Текущий уровень: <strong>${latestState.energy}/10</strong></span>`;
      } else {
        document.getElementById('trend-anxiety').textContent = 'Исходный уровень';
        document.getElementById('trend-sleep').textContent = 'Исходный уровень';
        document.getElementById('trend-mood').textContent = 'Исходный уровень';
        document.getElementById('trend-energy').textContent = 'Исходный уровень';
      }
    }

    // Отрисовка графика
    const canvas = document.getElementById('patient-dynamics-chart');
    chartManager.renderPatientChart(canvas, initialSurvey, checkins);

    // Карточка ИИ-ассистента / Кризисный протокол
    const aiBox = document.getElementById('patient-ai-box');
    aiBox.innerHTML = '';

    if (checkins.length > 0) {
      const lastCheckin = checkins[checkins.length - 1];
      if (lastCheckin.isCrisis) {
        aiBox.innerHTML = this.renderCrisisBoxHtml(user.name);
      } else if (lastCheckin.aiResponse) {
        aiBox.innerHTML = `
          <div class="ai-response-card">
            <div class="ai-response-header">
              <span class="ai-badge">✨ Поддерживающий отклик ассистента</span>
              <span style="font-size: 0.8rem; color: var(--color-text-muted);">
                ${new Date(lastCheckin.date).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div class="ai-response-body">«${esc(lastCheckin.aiResponse)}»</div>
          </div>
        `;
      }
    }

    // Хроника
    const timelineEl = document.getElementById('patient-timeline');
    timelineEl.innerHTML = '';

    if (checkins.length === 0) {
      timelineEl.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
          Вы ещё не заполняли еженедельные чек-ины. Нажмите кнопку <strong>«Заполнить чек-ин за неделю»</strong> выше, чтобы сделать первую запись.
        </div>
      `;
    } else {
      const reversed = [...checkins].reverse();
      const latest = reversed[0];
      const older = reversed.slice(1);

      const renderItemHtml = (c, weekNum) => `
        <div class="timeline-item">
          <div class="timeline-header">
            <span class="timeline-date">Неделя #${weekNum} • ${new Date(c.date).toLocaleDateString('ru-RU')}</span>
            <div class="timeline-scores">
              <span class="score-badge anxiety">Тревожность: ${c.anxiety}</span>
              <span class="score-badge sleep">Сон: ${c.sleep}</span>
              <span class="score-badge mood">Настроение: ${c.mood}</span>
              <span class="score-badge energy">Энергия: ${c.energy}</span>
            </div>
          </div>
          ${c.weekText ? `<div class="timeline-text"><strong>Как прошла неделя:</strong> ${esc(c.weekText)}</div>` : ''}
          ${c.insights ? `<div class="timeline-insights"><strong>Инсайт недели:</strong> ${esc(c.insights)}</div>` : ''}
          ${c.aiResponse ? `<div style="font-size: 0.88rem; font-style: italic; color: var(--color-primary-light); margin-top: 8px;"><strong>Отклик ассистента:</strong> «${esc(c.aiResponse)}»</div>` : ''}
        </div>
      `;

      // Самый свежий чек-ин всегда виден
      timelineEl.innerHTML = renderItemHtml(latest, checkins.length);

      // Предыдущие недели аккуратно сворачиваются в аккордеон
      if (older.length > 0) {
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'timeline-toggle-box';
        toggleWrapper.innerHTML = `
          <button type="button" class="btn btn-outline btn-sm" id="btn-toggle-older-weeks">
            📅 Показать предыдущие недели (${older.length}) ▾
          </button>
          <div id="older-weeks-container" style="display: none; flex-direction: column; gap: 14px; margin-top: 14px;">
            ${older.map((c, i) => renderItemHtml(c, checkins.length - 1 - i)).join('')}
          </div>
        `;
        timelineEl.appendChild(toggleWrapper);

        const btnToggle = toggleWrapper.querySelector('#btn-toggle-older-weeks');
        const container = toggleWrapper.querySelector('#older-weeks-container');
        btnToggle.addEventListener('click', () => {
          const isHidden = container.style.display === 'none';
          container.style.display = isHidden ? 'flex' : 'none';
          btnToggle.textContent = isHidden 
            ? `▲ Свернуть предыдущие недели (${older.length})`
            : `📅 Показать предыдущие недели (${older.length}) ▾`;
        });
      }
    }
  }

  // =========================================================================
  // ОБРАБОТКА ЕЖЕНЕДЕЛЬНОГО ЧЕК-ИНА
  // =========================================================================
  async handleWeeklyCheckinSubmit() {
    const user = authService.getCurrentUser();
    if (!user) return;

    const submitBtn = document.getElementById('btn-submit-checkin');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '✨ Ассистент бережно анализирует ответ...';

    try {
      const weekText = document.getElementById('chk-week-text').value;
      const anxiety = parseInt(document.getElementById('chk-anxiety-range').value, 10);
      const sleep = parseInt(document.getElementById('chk-sleep-range').value, 10);
      const mood = parseInt(document.getElementById('chk-mood-range').value, 10);
      const energy = parseInt(document.getElementById('chk-energy-range').value, 10);
      const insights = document.getElementById('chk-insights').value;

      const checkinDraft = {
        weekText,
        anxiety,
        sleep,
        mood,
        energy,
        insights
      };

      // Генерация отклика ИИ с проверкой кризисного протокола
      const aiResult = await aiService.generateCheckinResponse(user.name, checkinDraft);

      const checkinRecord = {
        ...checkinDraft,
        date: new Date().toISOString(),
        aiResponse: aiResult.text,
        isCrisis: aiResult.isCrisis,
        priorityAlert: aiResult.isCrisis
      };

      storage.saveCheckin(user.id, checkinRecord);

      this.closeModal('modal-checkin');
      document.getElementById('form-weekly-checkin').reset();

      if (aiResult.isCrisis) {
        this.showToast('Внимание: активирован протокол экстренной поддержки', 'warning');
      } else {
        this.showToast('Чек-ин сохранён! ИИ-ассистент оставил тёплый отклик.');
      }

      this.renderPatientDashboard(user);
    } catch (err) {
      console.error(err);
      this.showToast('Произошла ошибка при сохранении чек-ина: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  renderCrisisBoxHtml(userName) {
    const therapist = APP_CONFIG.therapist;
    const emergency = APP_CONFIG.emergencyHelp;

    return `
      <div class="crisis-alert-box">
        <div class="crisis-alert-header">
          <span>🛡️</span> Протокол заботы и безопасности
        </div>
        <div class="crisis-alert-text">
          ${userName}, если прямо сейчас вы чувствуете сильную тяжесть, боль или отчаяние — пожалуйста, не оставайтесь наедине с этим состоянием до следующей встречи группы. Денис на связи и готов помочь:
        </div>
        <div class="crisis-actions" style="align-items: center;">
          <a href="tel:${therapist.phoneRaw}" class="btn btn-crisis-call">
            📞 Позвонить Денису: ${therapist.phone}
          </a>
          <a href="${therapist.whatsappUrl}" target="_blank" rel="noopener" class="btn btn-outline" style="background: #25D366; color: #FFFFFF; border-color: #25D366;">
            💬 Написать в WhatsApp
          </a>
          <a href="tel:88002000122" class="btn btn-outline">
            ☎️ Линия доверия 24/7: ${emergency.phone}
          </a>
          <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.crisis-alert-box').style.display='none'" style="margin-left: auto; color: var(--color-text-muted);">
            ✕ Скрыть оповещение
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // КАБИНЕТ ТЕРАПЕВТА (АДМИНИСТРАТОРА)
  // =========================================================================
  renderTherapistDashboard() {
    const users = storage.getUsers().filter(u => u.role === 'patient');
    const tabsContainer = document.getElementById('therapist-tabs');
    const alertsContainer = document.getElementById('therapist-crisis-alerts-container');

    // 1. Отображение критических алертов
    const crisisAlerts = storage.getCrisisAlerts();
    alertsContainer.innerHTML = '';
    if (crisisAlerts.length > 0) {
      const alertBanner = document.createElement('div');
      alertBanner.className = 'crisis-alert-box';
      alertBanner.style.marginBottom = '20px';
      alertBanner.innerHTML = `
        <div class="crisis-alert-header">
          <span>⚠️</span> Приоритетные сигналы безопасности (${crisisAlerts.length})
        </div>
        <div style="font-size: 0.95rem; margin-bottom: 10px;">
          Участники с маркерами высокого напряжения / кризисными формулировками в недавних чек-инах:
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${crisisAlerts.map(a => `
            <div style="background: rgba(255,255,255,0.8); padding: 8px 12px; border-radius: 8px; font-size: 0.9rem;">
              <strong>${a.user.name}</strong> (${new Date(a.checkin.date).toLocaleDateString('ru-RU')}):
              «${a.checkin.weekText}»
            </div>
          `).join('')}
        </div>
      `;
      alertsContainer.appendChild(alertBanner);
    }

    // 2. Сводка всей группы (Group Pulse Overview)
    const overviewContainer = document.getElementById('therapist-group-overview');
    if (overviewContainer) {
      overviewContainer.innerHTML = '';
      users.forEach(u => {
        const survey = storage.getSurveyByUserId(u.id);
        const checkins = storage.getCheckinsByUserId(u.id);
        const latest = checkins.length > 0 ? checkins[checkins.length - 1] : survey;
        const hasCrisis = checkins.some(c => c.isCrisis || c.priorityAlert);
        const isSelected = u.id === this.selectedTherapistPatientId;

        const card = document.createElement('div');
        card.className = `group-participant-card ${isSelected ? 'active' : ''}`;

        let statusBadge = '';
        if (hasCrisis) {
          statusBadge = '<span style="color:#DC2626;font-size:0.75rem;font-weight:700;">⚠️ Внимание</span>';
        } else if (checkins.length > 0) {
          statusBadge = '<span style="color:#16A34A;font-size:0.75rem;font-weight:600;">В процессе ✨</span>';
        } else {
          statusBadge = '<span style="color:#94A3B8;font-size:0.75rem;">Новый</span>';
        }

        let dateNote = 'нет записей';
        if (checkins.length > 0) {
          const d = new Date(checkins[checkins.length - 1].date);
          dateNote = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }

        card.innerHTML = `
          <div class="group-card-header">
            <span class="group-card-name">👤 ${esc(u.name)}</span>
            ${statusBadge}
          </div>
          <div class="group-card-metrics">
            <div><span style="color:var(--scale-anxiety);">${latest?.anxiety ?? '—'}</span>Тревога</div>
            <div><span style="color:var(--scale-sleep);">${latest?.sleep ?? '—'}</span>Сон</div>
            <div><span style="color:var(--scale-mood);">${latest?.mood ?? '—'}</span>Настр.</div>
            <div><span style="color:var(--scale-energy);">${latest?.energy ?? '—'}</span>Энергия</div>
          </div>
          <div class="group-card-footer">
            <span>Чек-инов: <strong>${checkins.length}</strong></span>
            <span>Посл.: <strong>${dateNote}</strong></span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.selectedTherapistPatientId = u.id;
          this.renderTherapistDashboard();
          const dossier = document.getElementById('therapist-profile-name');
          if (dossier) dossier.scrollIntoView({ behavior: 'smooth' });
        });

        overviewContainer.appendChild(card);
      });
    }

    // Отрисовка таблицы администрирования участников (для десктопа/ноутбука)
    this.renderAdminParticipantsTable();
    this.updateCloudSyncBadge();

    // 3. Вкладки участников
    tabsContainer.innerHTML = '';

    if (users.length === 0) {
      tabsContainer.innerHTML = '<div style="color: var(--color-text-muted);">В группе пока нет зарегистрированных участников.</div>';
      return;
    }

    if (!this.selectedTherapistPatientId || !users.some(u => u.id === this.selectedTherapistPatientId)) {
      this.selectedTherapistPatientId = users[0].id;
    }

    users.forEach(u => {
      const btn = document.createElement('button');
      btn.className = `therapist-patient-tab ${u.id === this.selectedTherapistPatientId ? 'active' : ''}`;
      
      const checkins = storage.getCheckinsByUserId(u.id);
      const hasCrisis = checkins.some(c => c.isCrisis || c.priorityAlert);

      // Расчет дней с последнего чек-ина (P1-13: маркер пропусков)
      let recencyBadge = '';
      if (checkins.length > 0) {
        const lastDate = new Date(checkins[checkins.length - 1].date);
        const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 14) {
          recencyBadge = `<span style="color:#DC2626;font-size:0.7rem;font-weight:700;" title="Пропуск более 2 недель">⚠️ ${daysAgo}д</span>`;
        } else if (daysAgo >= 7) {
          recencyBadge = `<span style="color:#D97706;font-size:0.7rem;" title="Пора сдать чек-ин">${daysAgo}д</span>`;
        }
      } else {
        recencyBadge = `<span style="color:#94A3B8;font-size:0.7rem;">(нет записей)</span>`;
      }

      btn.innerHTML = `
        <span>👤 ${esc(u.name)}</span>
        ${hasCrisis ? '<span class="alert-dot" title="Есть приоритетный маркер"></span>' : ''}
        <span style="font-size: 0.76rem; opacity: 0.8;">(${checkins.length} чек-ин.)</span>
        ${recencyBadge}
      `;

      btn.addEventListener('click', () => {
        this.selectedTherapistPatientId = u.id;
        this.renderTherapistDashboard();
      });

      tabsContainer.appendChild(btn);
    });

    // 3. Досье выбранного участника
    this.renderSelectedPatientDossier(this.selectedTherapistPatientId);
  }

  renderSelectedPatientDossier(patientId) {
    const patient = storage.getUserById(patientId);
    if (!patient) return;

    const survey = storage.getSurveyByUserId(patientId);
    const checkins = storage.getCheckinsByUserId(patientId);

    document.getElementById('therapist-profile-name').textContent = `Досье: ${patient.name}`;
    document.getElementById('therapist-profile-concern').textContent = survey?.concern || 'Не заполнено';
    document.getElementById('therapist-profile-goal').textContent = survey?.goal || 'Не указана';
    document.getElementById('therapist-profile-duration').textContent = survey?.duration || 'Не указан';
    document.getElementById('therapist-profile-regdate').textContent = 
      new Date(patient.registeredAt).toLocaleDateString('ru-RU');

    // Скрываем блок прошлой ИИ-сводки при смене участника
    document.getElementById('therapist-ai-summary-box').style.display = 'none';

    // График динамики
    const canvas = document.getElementById('therapist-dynamics-chart');
    chartManager.renderTherapistChart(canvas, survey, checkins);

    // Хроника чек-инов участника
    const timelineEl = document.getElementById('therapist-patient-timeline');
    timelineEl.innerHTML = '';

    if (checkins.length === 0) {
      timelineEl.innerHTML = `
        <div style="padding: 16px; color: var(--color-text-muted); text-align: center;">
          Участник пока не отправил ни одного еженедельного чек-ина.
        </div>
      `;
    } else {
      [...checkins].reverse().forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        if (c.isCrisis) {
          item.style.borderColor = 'var(--scale-anxiety)';
          item.style.background = '#FFF8F7';
        }

        item.innerHTML = `
          <div class="timeline-header">
            <span class="timeline-date">
              ${c.isCrisis ? '⚠️ [ВНИМАНИЕ] ' : ''}Неделя #${checkins.length - idx} • ${new Date(c.date).toLocaleDateString('ru-RU')}
            </span>
            <div class="timeline-scores">
              <span class="score-badge anxiety">Тревожность: ${c.anxiety}</span>
              <span class="score-badge sleep">Сон: ${c.sleep}</span>
              <span class="score-badge mood">Настроение: ${c.mood}</span>
              <span class="score-badge energy">Энергия: ${c.energy}</span>
            </div>
          </div>
          ${c.weekText ? `<div class="timeline-text"><strong>Ответ:</strong> ${esc(c.weekText)}</div>` : ''}
          ${c.insights ? `<div class="timeline-insights"><strong>Инсайт:</strong> ${esc(c.insights)}</div>` : ''}
          ${c.aiResponse ? `<div style="font-size: 0.85rem; font-style: italic; color: var(--color-text-muted); margin-top: 6px;"><strong>Отклик ИИ:</strong> «${esc(c.aiResponse)}»</div>` : ''}
        `;
        timelineEl.appendChild(item);
      });
    }
  }

  async handleGenerateAiSummary() {
    const patientId = this.selectedTherapistPatientId;
    const patient = storage.getUserById(patientId);
    if (!patient) return;

    const survey = storage.getSurveyByUserId(patientId);
    const checkins = storage.getCheckinsByUserId(patientId);

    const btn = document.getElementById('btn-generate-ai-summary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '✨ Формирование аналитической сводки...';

    try {
      const summaryText = await aiService.generateTherapistSummary(patient, survey, checkins);
      const summaryBox = document.getElementById('therapist-ai-summary-box');
      const summaryEl = document.getElementById('therapist-ai-summary-text');
      summaryEl.textContent = summaryText;
      summaryBox.style.display = 'block';
      this.showToast('ИИ-сводка перед сессией сформирована!');
    } catch (err) {
      console.error(err);
      this.showToast('Ошибка при формировании сводки: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // =========================================================================
  // АДМИНИСТРИРОВАНИЕ УЧАСТНИКОВ ГРУППЫ (МЕТОДЫ)
  // =========================================================================
  updateCloudSyncBadge() {
    const badge = document.getElementById('cloud-sync-status-badge');
    if (!badge) return;
    const cfg = storage.getCloudSyncConfig();
    if (cfg.status === 'syncing') {
      badge.className = 'cloud-sync-badge syncing';
      badge.textContent = '🔄 Синхронизация...';
    } else if (cfg.status === 'synced') {
      badge.className = 'cloud-sync-badge synced';
      const timeStr = cfg.lastSyncedAt ? new Date(cfg.lastSyncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'сейчас';
      badge.textContent = `🟢 Данные синхронизированы (${timeStr})`;
    } else {
      badge.className = 'cloud-sync-badge';
      badge.textContent = '💾 Локальное хранилище';
    }
  }

  renderAdminParticipantsTable() {
    const container = document.getElementById('admin-participants-table-container');
    if (!container) return;

    const users = storage.getUsers().filter(u => u.role === 'patient');

    if (users.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--color-text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">👥</div>
          <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 4px;">В группе пока нет участников</div>
          <p style="font-size: 0.9rem; margin-bottom: 16px;">Зарегистрируйте первого участника с помощью кнопки «➕ Зарегистрировать участника» выше.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Участник</th>
              <th>Логин для входа</th>
              <th>Пароль</th>
              <th>Срезов</th>
              <th>Последний срез</th>
              <th style="text-align: right;">Действия</th>
            </tr>
          </thead>
          <tbody>
    `;

    users.forEach(u => {
      const checkins = storage.getCheckinsByUserId(u.id);
      const survey = storage.getSurveyByUserId(u.id);
      const latest = checkins.length > 0 ? checkins[checkins.length - 1] : survey;
      const isRevealed = this.revealedPasswords.has(u.id);
      const displayPass = u.plainPassword || (u.passwordHash ? '••••••••' : '1234');
      const passText = isRevealed ? esc(displayPass) : (u.plainPassword ? '••••••••' : '••••••••');

      // Инициалы для аватара
      const initials = (u.name || 'У').trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();

      // Дата последнего среза
      let dateNote = '—';
      if (checkins.length > 0) {
        const d = new Date(checkins[checkins.length - 1].date);
        dateNote = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      } else if (survey) {
        dateNote = 'Анкета';
      }

      // Мини-чипы последних баллов
      let chipsHtml = '—';
      if (latest && (latest.anxiety !== undefined)) {
        chipsHtml = `
          <div class="admin-metrics-pill-box">
            <span class="admin-metric-chip anx" title="Тревожность">Т:${latest.anxiety}</span>
            <span class="admin-metric-chip slp" title="Сон">С:${latest.sleep}</span>
            <span class="admin-metric-chip mood" title="Настроение">Н:${latest.mood}</span>
            <span class="admin-metric-chip enrg" title="Энергия">Э:${latest.energy}</span>
          </div>
        `;
      }

      html += `
        <tr data-user-id="${u.id}">
          <td data-label="Участник">
            <div class="admin-user-cell">
              <div class="admin-user-avatar">${initials}</div>
              <div class="admin-user-meta">
                <span class="admin-user-name">${esc(u.name)}</span>
                <span class="admin-user-sub">Рег.: ${new Date(u.registeredAt || Date.now()).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </td>
          <td data-label="Логин">
            <span style="font-family: monospace; font-size: 0.88rem; color: var(--color-text-main); font-weight: 500;">
              ${esc(u.email || u.name)}
            </span>
          </td>
          <td data-label="Пароль">
            <div class="admin-pass-box">
              <span class="${isRevealed ? '' : 'admin-pass-hidden'}" style="font-size: 0.9rem;">
                ${passText}
              </span>
              <button type="button" class="admin-icon-btn btn-toggle-pass" data-user-id="${u.id}" title="${isRevealed ? 'Скрыть пароль' : 'Показать пароль'}">
                ${isRevealed ? '👁️‍🗨️' : '👁️'}
              </button>
              ${u.plainPassword ? `
                <button type="button" class="admin-icon-btn btn-copy-pass" data-pass="${esc(u.plainPassword)}" title="Скопировать пароль">
                  📋
                </button>
              ` : ''}
            </div>
          </td>
          <td data-label="Срезов">
            <strong>${checkins.length}</strong>
          </td>
          <td data-label="Последний срез">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 0.82rem; color: var(--color-text-muted);">${dateNote}</span>
              ${chipsHtml}
            </div>
          </td>
          <td data-label="Действия">
            <div class="admin-actions-cell" style="justify-content: flex-end;">
              <button type="button" class="btn btn-accent btn-sm btn-action-checkin" data-user-id="${u.id}" data-user-name="${esc(u.name)}" title="Зафиксировать срез состояния на шеринге">
                ✍️ Внести срез
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-action-card" data-user-id="${u.id}" title="Скопировать доступ для WhatsApp">
                📋 Доступ
              </button>
              <button type="button" class="admin-icon-btn btn-action-edit" data-user-id="${u.id}" title="Редактировать">
                ✏️
              </button>
              <button type="button" class="admin-icon-btn btn-action-delete" data-user-id="${u.id}" data-user-name="${esc(u.name)}" title="Удалить участника" style="color: #DC2626;">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    // Слушатели переключения видимости пароля
    container.querySelectorAll('.btn-toggle-pass').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.getAttribute('data-user-id');
        if (this.revealedPasswords.has(uid)) {
          this.revealedPasswords.delete(uid);
        } else {
          this.revealedPasswords.add(uid);
        }
        this.renderAdminParticipantsTable();
      });
    });

    // Копирование чистого пароля
    container.querySelectorAll('.btn-copy-pass').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pass = btn.getAttribute('data-pass');
        navigator.clipboard.writeText(pass).then(() => {
          this.showToast('Пароль скопирован: ' + pass);
        });
      });
    });

    // Внесение очного среза
    container.querySelectorAll('.btn-action-checkin').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        this.openExpressCheckinModal(uid);
      });
    });

    // Карточка доступа для WhatsApp
    container.querySelectorAll('.btn-action-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        const user = storage.getUserById(uid);
        if (user) this.copyParticipantAccessCard(user);
      });
    });

    // Редактирование
    container.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        this.openEditParticipantModal(uid);
      });
    });

    // Удаление
    container.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        const uname = btn.getAttribute('data-user-name');
        if (confirm(`Удалить участника «${uname}» и все его записи из группы?`)) {
          try {
            authService.adminDeleteParticipant(uid);
            this.showToast(`Участник «${uname}» удалён`);
            this.renderTherapistDashboard();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        }
      });
    });
  }

  async handleAdminAddParticipant(copyToClipboard = false) {
    const name = document.getElementById('admin-add-name').value;
    const login = document.getElementById('admin-add-login').value;
    const pass = document.getElementById('admin-add-pass').value;
    const concern = document.getElementById('admin-add-concern').value;
    const goal = document.getElementById('admin-add-goal').value;

    try {
      const newUser = await authService.adminCreateParticipant({
        name,
        email: login,
        password: pass,
        concern,
        goal
      });

      this.closeModal('modal-admin-add-participant');
      document.getElementById('form-admin-add-participant').reset();

      if (copyToClipboard) {
        this.copyParticipantAccessCard(newUser);
      } else {
        this.showToast(`Участник «${newUser.name}» успешно зарегистрирован!`);
      }

      this.renderTherapistDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openEditParticipantModal(userId) {
    const user = storage.getUserById(userId);
    if (!user) return;

    document.getElementById('admin-edit-id').value = user.id;
    document.getElementById('admin-edit-name').value = user.name || '';
    document.getElementById('admin-edit-login').value = user.email || '';
    document.getElementById('admin-edit-pass').value = user.plainPassword || '';

    this.openModal('modal-admin-edit-participant');
  }

  async handleAdminEditParticipantSubmit() {
    const userId = document.getElementById('admin-edit-id').value;
    const name = document.getElementById('admin-edit-name').value;
    const email = document.getElementById('admin-edit-login').value;
    const password = document.getElementById('admin-edit-pass').value;

    try {
      await authService.adminUpdateParticipant(userId, { name, email, password });
      this.closeModal('modal-admin-edit-participant');
      this.showToast('Данные участника успешно обновлены!');
      this.renderTherapistDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openExpressCheckinModal(userId) {
    const user = storage.getUserById(userId);
    if (!user) return;

    const checkins = storage.getCheckinsByUserId(userId);
    const survey = storage.getSurveyByUserId(userId);
    const latest = checkins.length > 0 ? checkins[checkins.length - 1] : survey;

    document.getElementById('admin-entry-user-id').value = user.id;
    document.getElementById('admin-entry-name').textContent = user.name;

    // Задаем исходные значения шкал (из последнего среза или по умолчанию 5)
    const setSliderVal = (id, val) => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.value = val;
        slider.dispatchEvent(new Event('input'));
      }
    };

    setSliderVal('admin-chk-anxiety-range', latest?.anxiety ?? 5);
    setSliderVal('admin-chk-sleep-range', latest?.sleep ?? 5);
    setSliderVal('admin-chk-mood-range', latest?.mood ?? 5);
    setSliderVal('admin-chk-energy-range', latest?.energy ?? 5);

    document.getElementById('admin-chk-notes').value = '';
    document.getElementById('admin-chk-insights').value = '';
    document.getElementById('admin-chk-ai-enabled').checked = true;

    this.openModal('modal-admin-entry-checkin');
  }

  async handleAdminEntryCheckinSubmit() {
    const userId = document.getElementById('admin-entry-user-id').value;
    const user = storage.getUserById(userId);
    if (!user) return;

    const submitBtn = document.getElementById('btn-admin-entry-submit');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '✨ AnyModel формулирует отклик...';

    try {
      const anxiety = parseInt(document.getElementById('admin-chk-anxiety-range').value, 10);
      const sleep = parseInt(document.getElementById('admin-chk-sleep-range').value, 10);
      const mood = parseInt(document.getElementById('admin-chk-mood-range').value, 10);
      const energy = parseInt(document.getElementById('admin-chk-energy-range').value, 10);
      const notes = document.getElementById('admin-chk-notes').value;
      const insights = document.getElementById('admin-chk-insights').value;
      const isAiEnabled = document.getElementById('admin-chk-ai-enabled').checked;

      const checkinDraft = {
        date: new Date().toISOString(),
        anxiety,
        sleep,
        mood,
        energy,
        weekText: notes.trim() || 'Срез зафиксирован ведущим на очной встрече группы',
        insights: insights.trim(),
        byTherapist: true
      };

      if (isAiEnabled) {
        const aiResult = await aiService.generateCheckinResponse(user.name, checkinDraft);
        checkinDraft.aiResponse = aiResult.text;
        checkinDraft.isCrisis = aiResult.isCrisis;
        checkinDraft.priorityAlert = aiResult.isCrisis;
      }

      storage.saveCheckin(user.id, checkinDraft);

      this.closeModal('modal-admin-entry-checkin');
      document.getElementById('form-admin-entry-checkin').reset();

      this.showToast(`Срез за ${user.name} сохранён! ${isAiEnabled ? 'Отклик AnyModel получен.' : ''}`);
      this.renderTherapistDashboard();
    } catch (err) {
      console.error(err);
      this.showToast('Ошибка сохранения среза: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  copyParticipantAccessCard(participant) {
    const login = participant.email || participant.name;
    const pass = participant.plainPassword || '1234';
    const text = `🌿 Здравствуйте, ${participant.name}!
Ваш доступ к личному дневнику «Мой ритм» (групповая гипнотерапия):

🌐 Ссылка: https://deniskazakov1976-glitch.github.io/hypnotherapy-group/ritm/
👤 Логин: ${login}
🔑 Пароль: ${pass}

Приложение можно установить на экран телефона в 1 клик через браузер!`;

    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`Карточка доступа для ${participant.name} скопирована! Отправьте её в WhatsApp.`);
    }).catch(() => {
      this.showToast(`Логин: ${login}, Пароль: ${pass}`);
    });
  }

  async syncCloudData() {
    const badge = document.getElementById('cloud-sync-status-badge');
    if (badge) {
      badge.className = 'cloud-sync-badge syncing';
      badge.textContent = '🔄 Синхронизация...';
    }

    try {
      storage.saveCloudSyncConfig({
        enabled: true,
        lastSyncedAt: new Date().toISOString(),
        status: 'synced'
      });

      if (firebaseService.isInitialized) {
        await firebaseService.syncAll({
          users: storage.getUsers(),
          surveys: storage.getSurveys(),
          checkins: storage.getAllCheckins()
        });
      }

      setTimeout(() => {
        this.updateCloudSyncBadge();
        this.showToast('Данные успешно синхронизированы! ✨');
      }, 500);
    } catch (err) {
      console.warn('Sync error:', err);
      if (badge) {
        badge.className = 'cloud-sync-badge error';
        badge.textContent = '⚠️ Ошибка связи';
      }
      this.showToast('Синхронизация сохранена локально', 'warning');
    }
  }

  // =========================================================================
  // НАСТРОЙКИ (ANYMODEL.ORG / FIREBASE)
  // =========================================================================
  loadSettingsForm() {
    const aiSettings = storage.getAiSettings();
    document.getElementById('set-ai-endpoint').value = aiSettings.endpoint || APP_CONFIG.ai.endpoint;
    document.getElementById('set-ai-model').value = aiSettings.model || APP_CONFIG.ai.defaultModel;
    document.getElementById('set-ai-key').value = aiSettings.apiKey || '';

    const adminUser = storage.getUsers().find(u => u.role === 'admin');
    const elEmail = document.getElementById('set-therapist-email');
    if (elEmail && adminUser) {
      elEmail.value = adminUser.email || '';
    }
    const elPass = document.getElementById('set-therapist-pass');
    if (elPass) elPass.value = '';
  }

  async saveSettingsForm() {
    const endpoint = document.getElementById('set-ai-endpoint').value;
    const model = document.getElementById('set-ai-model').value;
    const apiKey = document.getElementById('set-ai-key').value;

    storage.saveAiSettings({
      endpoint,
      model,
      apiKey,
      useMockFallback: true
    });

    const email = document.getElementById('set-therapist-email')?.value;
    const newPass = document.getElementById('set-therapist-pass')?.value;

    if (newPass || email) {
      try {
        await authService.changeTherapistPassword(newPass, email);
        this.showToast('Пароль и email ведущего сохранены!');
      } catch (err) {
        this.showToast(err.message, 'error');
        return;
      }
    }

    this.showToast('Настройки успешно сохранены!');
    this.closeModal('modal-settings');
  }

  // =========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (МОДАЛКИ, ТОСТЫ)
  // =========================================================================
  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('active');
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = '🌿';
    if (type === 'error') {
      icon = '⚠️';
      toast.style.background = '#DC2626';
    } else if (type === 'warning') {
      icon = '🛡️';
      toast.style.background = '#B45309';
    }

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // =========================================================================
  // ПОДДЕРЖКА PWA (УСТАНОВКА НА ANDROID И IOS)
  // =========================================================================
  setupPwa() {
    // 1. Регистрация Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=2.0.0')
          .then(reg => {
            console.log('[PWA] Service Worker успешно зарегистрирован:', reg.scope);
            reg.update();
          })
          .catch(err => {
            console.log('[PWA] Ошибка Service Worker:', err);
          });
      });
    }

    // Проверяем, открыто ли уже как автономное приложение
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;

    // Определение платформы iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Кнопка в шапке (показываем, если открыто в обычном браузере)
    const btnHeaderInstall = document.getElementById('btn-header-install');
    if (btnHeaderInstall && !isStandalone) {
      btnHeaderInstall.style.display = 'inline-flex';
    }

    // Элементы модального окна установки
    const modalInstallId = 'modal-install-pwa';
    const tabAndroid = document.getElementById('tab-pwa-android');
    const tabIos = document.getElementById('tab-pwa-ios');
    const paneAndroid = document.getElementById('pwa-pane-android');
    const paneIos = document.getElementById('pwa-pane-ios');
    const promptBox = document.getElementById('pwa-android-prompt-box');
    const btnDirectInstall = document.getElementById('btn-pwa-direct-install');
    const btnOpenInstallModal = document.getElementById('btn-open-install-modal');
    const btnModalClose = document.getElementById('modal-install-close');
    const btnModalOk = document.getElementById('btn-pwa-modal-ok');

    // Функция переключения вкладок в модальном окне
    const switchPwaTab = (platform) => {
      if (platform === 'android') {
        tabAndroid?.classList.add('active');
        tabIos?.classList.remove('active');
        if (paneAndroid) paneAndroid.style.display = 'block';
        if (paneIos) paneIos.style.display = 'none';
      } else {
        tabIos?.classList.add('active');
        tabAndroid?.classList.remove('active');
        if (paneIos) paneIos.style.display = 'block';
        if (paneAndroid) paneAndroid.style.display = 'none';
      }
    };

    // Открытие модального окна с автовыбором вкладки под систему пользователя
    const openInstallModal = (platform = null) => {
      const targetPlatform = platform || (isIos ? 'ios' : 'android');
      switchPwaTab(targetPlatform);
      this.openModal(modalInstallId);
    };

    // Слушатели переключения вкладок
    tabAndroid?.addEventListener('click', () => switchPwaTab('android'));
    tabIos?.addEventListener('click', () => switchPwaTab('ios'));

    // Открытие модалки по клику на кнопки
    btnOpenInstallModal?.addEventListener('click', () => openInstallModal());
    btnHeaderInstall?.addEventListener('click', () => openInstallModal());

    // Закрытие модалки
    btnModalClose?.addEventListener('click', () => this.closeModal(modalInstallId));
    btnModalOk?.addEventListener('click', () => this.closeModal(modalInstallId));

    // Элементы плавающего баннера
    const banner = document.getElementById('pwa-install-banner');
    const btnInstall = document.getElementById('btn-pwa-install');
    const btnDismiss = document.getElementById('btn-pwa-dismiss');
    const descText = document.getElementById('pwa-install-desc');

    let deferredPrompt = null;

    // Установка в 1 клик для Android / Chrome / Chromium
    const triggerInstall = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast('«Мой ритм» устанавливается на ваш телефон! 🎉');
          this.closeModal(modalInstallId);
          if (banner) banner.style.display = 'none';
        }
        deferredPrompt = null;
        if (promptBox) promptBox.style.display = 'none';
      } else {
        openInstallModal(isIos ? 'ios' : 'android');
      }
    };

    // Слушатель системного события PWA перед установкой
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (promptBox) promptBox.style.display = 'block';
      if (banner && !isStandalone && !localStorage.getItem('moy_ritm_pwa_dismissed')) {
        banner.style.display = 'block';
      }
    });

    // Кнопка быстрой установки в модальном окне
    btnDirectInstall?.addEventListener('click', triggerInstall);

    // Кнопка на плавающем баннере
    btnInstall?.addEventListener('click', () => {
      if (deferredPrompt) {
        triggerInstall();
      } else {
        openInstallModal();
      }
    });

    // Закрытие баннера
    btnDismiss?.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
      localStorage.setItem('moy_ritm_pwa_dismissed', 'true');
    });

    // Настройка баннера для iOS Safari
    if (isIos && !isStandalone && !localStorage.getItem('moy_ritm_pwa_dismissed')) {
      if (banner) banner.style.display = 'block';
      if (descText) {
        descText.textContent = 'Установите иконку: нажмите «Поделиться» ⎋ → «На экран "Домой"»';
      }
      if (btnInstall) {
        btnInstall.textContent = 'Инструкция';
      }
    }
  }
}

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
