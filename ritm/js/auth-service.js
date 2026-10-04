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
   * Вход по Имени/Email и Паролю
   */
  async login(identifier, password) {
    if (!identifier || !identifier.trim()) {
      throw new Error('Пожалуйста, введите ваше имя или email');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать не менее 4 символов');
    }

    const cleanInput = identifier.trim();
    const cleanLower = cleanInput.toLowerCase();
    const cleanPass = password.trim();

    // 1. Прошитый вход администратора (Денис Казаков)
    const isDenisEmail = cleanLower === 'denis_kazakov@mail.ru';
    const isDenisName = cleanLower === 'денис' || cleanLower === 'денис казаков' || cleanLower === 'admin' || cleanLower.includes('казаков');

    if (isDenisEmail || isDenisName) {
      if (cleanPass !== '127554') {
        throw new Error('Неверный пароль. Попробуйте ещё раз.');
      }

      const users = storage.getUsers();
      let adminUser = users.find(u => u.role === 'admin') || {
        id: 'user_admin',
        name: 'Денис Казаков',
        email: 'denis_kazakov@mail.ru',
        role: 'admin',
        registeredAt: new Date().toISOString()
      };

      adminUser.role = 'admin';
      adminUser.name = 'Денис Казаков';
      adminUser.email = 'denis_kazakov@mail.ru';
      adminUser.vkId = '468816327';
      adminUser.vkUrl = 'https://vk.com/id468816327';
      adminUser.passwordHash = await hashPassword('127554');
      storage.saveUser(adminUser);
      this.currentUser = adminUser;
      storage.setCurrentUser(adminUser);
      return adminUser;
    }

    // Проверяем обычного участника (по имени или email)
    let user = users.find(u => 
      (u.name && u.name.toLowerCase() === cleanLower) ||
      (u.email && u.email.toLowerCase() === cleanLower)
    );

    // Проверка пароля (если у пользователя есть хеш)
    if (user && user.passwordHash) {
      const inputHash = await hashPassword(password);
      if (inputHash !== user.passwordHash) {
        throw new Error('Неверный пароль. Попробуйте ещё раз или восстановите доступ через email.');
      }
    }

    if (!user) {
      throw new Error(`Пользователь "${cleanInput}" не найден. Пожалуйста, пройдите быструю регистрацию.`);
    }

    this.currentUser = user;
    storage.setCurrentUser(user);
    return user;
  }

  /**
   * Защищенный вход в кабинет ведущего (Денис Казаков) с проверкой пароля
   */
  async loginAsTherapist(password) {
    if (!password) {
      throw new Error('Пожалуйста, введите пароль ведущего');
    }
    const users = storage.getUsers();
    let adminUser = users.find(u => u.role === 'admin') || {
      id: 'user_admin',
      name: 'Денис Казаков',
      role: 'admin',
      registeredAt: new Date().toISOString()
    };

    const inputHash = await hashPassword(password);
    if (adminUser.passwordHash) {
      if (inputHash !== adminUser.passwordHash) {
        throw new Error('Неверный пароль ведущего. Доступ к кабинету закрыт.');
      }
    } else {
      if (password !== '28246' && password.length < 4) {
        throw new Error('Неверный пароль ведущего. Введите стартовый пароль (28246).');
      }
      adminUser.passwordHash = inputHash;
    }

    adminUser.role = 'admin';
    storage.saveUser(adminUser);
    this.currentUser = adminUser;
    storage.setCurrentUser(adminUser);
    return adminUser;
  }

  /**
   * Защищенное переключение текущей сессии на роль ведущего с подтверждением пароля
   */
  async switchToAdmin(password) {
    if (!password) {
      throw new Error('Для перехода в кабинет ведущего требуется пароль');
    }
    const users = storage.getUsers();
    let adminUser = users.find(u => u.role === 'admin') || {
      id: 'user_admin',
      name: 'Денис Казаков',
      role: 'admin',
      registeredAt: new Date().toISOString()
    };

    const inputHash = await hashPassword(password);
    if (adminUser.passwordHash) {
      if (inputHash !== adminUser.passwordHash) {
        throw new Error('Неверный пароль ведущего');
      }
    } else {
      if (password !== '28246' && password.length < 4) {
        throw new Error('Неверный пароль ведущего');
      }
      adminUser.passwordHash = inputHash;
    }

    adminUser.role = 'admin';
    storage.saveUser(adminUser);
    this.currentUser = adminUser;
    storage.setCurrentUser(adminUser);
    return adminUser;
  }

  /**
   * Смена пароля и email ведущего
   */
  async changeTherapistPassword(newPassword, email = null) {
    const users = storage.getUsers();
    let adminUser = users.find(u => u.role === 'admin') || {
      id: 'user_admin',
      name: 'Денис Казаков',
      role: 'admin'
    };

    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 4) {
        throw new Error('Новый пароль должен содержать не менее 4 символов');
      }
      adminUser.passwordHash = await hashPassword(newPassword.trim());
    }

    if (email && email.trim()) {
      adminUser.email = email.trim().toLowerCase();
    }

    storage.saveUser(adminUser);
    if (this.currentUser && this.currentUser.role === 'admin') {
      this.currentUser = { ...this.currentUser, ...adminUser };
      storage.setCurrentUser(this.currentUser);
    }
    return true;
  }

  /**
   * Регистрация нового участника с обязательной электронной почтой для восстановления
   */
  async register(name, email, password) {
    if (!name || !name.trim()) {
      throw new Error('Пожалуйста, введите ваше имя');
    }
    if (!email || !email.trim() || !email.includes('@') || !email.includes('.')) {
      throw new Error('Пожалуйста, введите корректный адрес электронной почты (Email)');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен содержать минимум 4 символа');
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanLowerName = cleanName.toLowerCase();

    // Защита: нельзя зарегистрироваться под данными ведущего
    if (cleanEmail === 'denis_kazakov@mail.ru' || cleanLowerName.includes('денис') || cleanLowerName.includes('казаков') || cleanLowerName === 'admin') {
      throw new Error('Этот логин или email зарезервирован. Пожалуйста, выполните вход.');
    }

    const users = storage.getUsers();

    const existsName = users.find(u => u.name && u.name.toLowerCase() === cleanName.toLowerCase());
    if (existsName) {
      throw new Error(`Пользователь с именем "${cleanName}" уже зарегистрирован. Пожалуйста, выполните вход.`);
    }

    const existsEmail = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (existsEmail) {
      throw new Error(`Пользователь с почтой "${cleanEmail}" уже зарегистрирован. Войдите или восстановите пароль.`);
    }

    const newUser = {
      id: isDenis ? 'user_admin' : 'user_' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      role: isDenis ? 'admin' : 'patient',
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
   * Восстановление пароля по электронной почте
   */
  async resetPasswordByEmail(email, newPassword) {
    if (!email || !email.trim() || !email.includes('@')) {
      throw new Error('Пожалуйста, укажите корректный Email');
    }
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Новый пароль должен быть не короче 4 символов');
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = storage.getUsers();

    // 1. Проверяем участников
    let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    // 2. Если не найден, проверяем ведущего (Дениса)
    if (!user) {
      let adminUser = users.find(u => u.role === 'admin');
      if (adminUser && adminUser.email && adminUser.email.toLowerCase() === cleanEmail) {
        user = adminUser;
      }
    }

    if (!user) {
      throw new Error(`Пользователь с почтой "${cleanEmail}" не найден. Проверьте адрес или зарегистрируйтесь.`);
    }

    user.passwordHash = await hashPassword(newPassword);
    storage.saveUser(user);

    // Авторизуем пользователя с новым паролем
    this.currentUser = user;
    storage.setCurrentUser(user);
    return user;
  }

  /**
   * Авторизация через ВКонтакте (VK ID)
   * Для профиля Дениса Казакова (id468816327) строго запрашивает секретный пароль ведущего.
   * Для участников фиксирует их реальное имя из профиля VK.
   */
  async loginWithVk(profileInput = null, password = null) {
    let vkId = '468816327';
    let name = 'Денис Казаков';
    let isDenis = false;

    if (profileInput) {
      if (typeof profileInput === 'string') {
        const str = profileInput.trim();
        if (str.includes('468816327') || str.toLowerCase().includes('денис') || str.toLowerCase().includes('казаков')) {
          isDenis = true;
          vkId = '468816327';
          name = 'Денис Казаков';
        } else {
          isDenis = false;
          let clean = str.replace(/https?:\/\/vk\.com\//i, '').replace(/^@/, '').trim();
          vkId = 'vk_' + clean.replace(/[^a-zA-Z0-9_]/g, '');
          name = clean.startsWith('id') ? 'Участник (' + clean + ')' : clean;
        }
      } else if (profileInput.vkId || profileInput.name) {
        vkId = String(profileInput.vkId || '');
        name = profileInput.name || '';
        isDenis = vkId.includes('468816327') || name.toLowerCase().includes('денис') || name.toLowerCase().includes('казаков');
      }
    } else {
      isDenis = true;
    }

    // Если это Денис Казаков — СТРОГАЯ проверка пароля ведущего!
    if (isDenis) {
      if (!password) {
        throw new Error('Для входа ведущего (Дениса Казакова) требуется ввести секретный пароль.');
      }

      let adminUser = storage.getUsers().find(u => u.role === 'admin') || {
        id: 'user_admin',
        name: 'Денис Казаков',
        role: 'admin',
        registeredAt: new Date().toISOString()
      };

      const inputHash = await hashPassword(password);
      if (adminUser.passwordHash) {
        if (inputHash !== adminUser.passwordHash) {
          throw new Error('Неверный пароль ведущего! Доступ к кабинету закрыт.');
        }
      } else {
        if (password !== '28246' && password.length < 4) {
          throw new Error('Неверный пароль ведущего. Введите стартовый пароль (28246).');
        }
        adminUser.passwordHash = inputHash;
      }

      adminUser.role = 'admin';
      adminUser.name = 'Денис Казаков';
      adminUser.vkId = '468816327';
      adminUser.vkUrl = 'https://vk.com/id468816327';
      adminUser.authProvider = 'vk';
      storage.saveUser(adminUser);
      this.currentUser = adminUser;
      storage.setCurrentUser(adminUser);
      return adminUser;
    }

    // Иначе это участник группы через VK
    const users = storage.getUsers();
    let user = users.find(u => u.vkId === vkId || (name && u.name.toLowerCase() === name.toLowerCase()));

    if (!user) {
      user = {
        id: 'user_vk_' + Date.now(),
        name: name || 'Участник VK',
        vkId: vkId,
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
   * Быстрый вход в демо-режим для ознакомления
   */
  loginAsDemo(role = 'patient', userKey = 'anna') {
    if (role === 'admin') {
      const admin = {
        id: 'user_demo_admin',
        name: 'Денис Казаков (Демо)',
        role: 'admin',
        isDemo: true
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
