/**
 * Мой ритм — Дневник состояния между встречами
 * Модуль авторизации (Имя + Пароль, VK ID, Firebase Auth адаптер, Демо-доступ)
 */

import { storage } from './storage.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
  constructor() {
    this.currentUser = storage.getCurrentUser();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isTherapist() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  /**
   * Вход по Имени и Паролю
   */
  async login(name, password) {
    if (!name || !name.trim()) {
      throw new Error('Пожалуйста, введите ваше имя');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать не менее 4 символов');
    }

    const cleanName = name.trim();
    const isDenis = cleanName.toLowerCase().includes('денис') || cleanName.toLowerCase().includes('казаков') || cleanName.toLowerCase() === 'admin';
    const users = storage.getUsers();

    // Специальная гарантированная проверка для терапевта Дениса
    if (isDenis) {
      let adminUser = users.find(u => u.role === 'admin') || {
        id: 'user_admin',
        name: 'Денис Казаков',
        role: 'admin',
        registeredAt: new Date().toISOString()
      };
      adminUser.role = 'admin'; // Всегда админ!
      storage.saveUser(adminUser);
      this.currentUser = adminUser;
      storage.setCurrentUser(adminUser);
      return adminUser;
    }

    // Проверяем, есть ли такой участник
    let user = users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());

    // Проверка пароля (если у пользователя есть хеш)
    if (user && user.passwordHash) {
      const inputHash = await hashPassword(password);
      if (inputHash !== user.passwordHash) {
        throw new Error('Неверный пароль. Попробуйте ещё раз.');
      }
    }

    if (!user) {
      throw new Error(`Пользователь с именем "${cleanName}" не найден. Пожалуйста, пройдите быструю регистрацию.`);
    }

    this.currentUser = user;
    storage.setCurrentUser(user);
    return user;
  }

  /**
   * Прямой гарантированный вход в кабинет ведущего (Денис Казаков)
   */
  async loginAsTherapist() {
    const users = storage.getUsers();
    let adminUser = users.find(u => u.role === 'admin') || {
      id: 'user_admin',
      name: 'Денис Казаков',
      role: 'admin',
      registeredAt: new Date().toISOString()
    };
    adminUser.role = 'admin';
    storage.saveUser(adminUser);
    this.currentUser = adminUser;
    storage.setCurrentUser(adminUser);
    return adminUser;
  }

  /**
   * Мгновенное переключение текущей сессии на роль ведущего
   */
  switchToAdmin() {
    let user = this.getCurrentUser();
    if (!user) {
      user = { id: 'user_admin', name: 'Денис Казаков', role: 'admin', registeredAt: new Date().toISOString() };
    } else {
      user.role = 'admin';
      if (!user.name || user.name.toLowerCase() === 'участник') {
        user.name = 'Денис Казаков';
      }
    }
    storage.saveUser(user);
    storage.setCurrentUser(user);
    this.currentUser = user;
    return user;
  }

  /**
   * Регистрация нового участника
   */
  async register(name, password) {
    if (!name || !name.trim()) {
      throw new Error('Пожалуйста, введите ваше имя');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать минимум 4 символа');
    }

    const cleanName = name.trim();
    const isDenis = cleanName.toLowerCase().includes('денис') || cleanName.toLowerCase().includes('казаков') || cleanName.toLowerCase() === 'admin';
    const users = storage.getUsers();

    const exists = users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
    if (exists && !isDenis) {
      throw new Error(`Пользователь с именем "${cleanName}" уже зарегистрирован. Пожалуйста, выполните вход.`);
    }

    const newUser = {
      id: isDenis ? 'user_admin' : 'user_' + Date.now(),
      name: cleanName,
      role: isDenis ? 'admin' : 'patient', // Если Денис регистрируется — он сразу админ!
      registeredAt: new Date().toISOString(),
      isDemo: false
    };

    newUser.passwordHash = await hashPassword(password);
    storage.saveUser(newUser);
    this.currentUser = newUser;
    storage.setCurrentUser(newUser);
    return newUser;
  }

  /**
   * Авторизация через ВКонтакте (VK ID)
   */
  async loginWithVk(vkUserMock = null) {
    const vkProfile = vkUserMock || {
      vkId: 'vk_' + Math.floor(Math.random() * 1000000),
      name: 'Участник VK (' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ')'
    };

    const users = storage.getUsers();
    let user = users.find(u => u.vkId === vkProfile.vkId);

    if (!user) {
      user = {
        id: 'user_vk_' + Date.now(),
        name: vkProfile.name,
        vkId: vkProfile.vkId,
        role: 'patient',
        registeredAt: new Date().toISOString(),
        authProvider: 'vk'
      };
      storage.saveUser(user);
    }

    this.currentUser = user;
    storage.setCurrentUser(user);
    return user;
  }

  /**
   * Быстрый вход в 1 клик для демонстрации
   */
  loginAsDemo(role = 'patient', userKey = 'anna') {
    if (role === 'admin') {
      const admin = storage.getUsers().find(u => u.role === 'admin') || {
        id: 'user_admin',
        name: 'Денис Казаков',
        role: 'admin'
      };
      this.currentUser = admin;
      storage.setCurrentUser(admin);
      return admin;
    }

    const patient = storage.getUsers().find(u => u.id === `user_${userKey}`) || storage.getUsers().find(u => u.role === 'patient');
    this.currentUser = patient;
    storage.setCurrentUser(patient);
    return patient;
  }

  /**
   * Выход из аккаунта
   */
  logout() {
    this.currentUser = null;
    storage.setCurrentUser(null);
  }
}

export const authService = new AuthService();
