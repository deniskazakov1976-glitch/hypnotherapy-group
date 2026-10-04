/**
 * Мой ритм — Дневник состояния между встречами
 * Модуль интеграции с Firebase (Authentication & Cloud Firestore)
 * 
 * Предоставляет адаптер для переключения между локальным хранилищем (LocalStorage)
 * и облачной базой данных Firebase.
 */

import { storage } from './storage.js';

export class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Инициализация Firebase с переданными ключами проекта
   */
  async init(firebaseConfig) {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.log('Firebase: Конфигурация не задана, используется локальное хранилище.');
      return false;
    }

    try {
      // Динамический импорт модулей Firebase v10 из CDN
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.firestoreMethods = { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy };
      this.authMethods = { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };

      this.isInitialized = true;
      console.log('Firebase успешно инициализирован.');
      return true;
    } catch (err) {
      console.warn('Не удалось загрузить Firebase SDK (работаем в локальном режиме):', err);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Преобразование "Имени" в системный email для Firebase Auth
   */
  nameToEmail(name) {
    // Безопасная транслитерация / хеширование имени в email
    const clean = encodeURIComponent(name.trim().toLowerCase()).replace(/%/g, 'x');
    return `${clean}@moyritm.local`;
  }

  /**
   * Регистрация в Firebase Auth + сохранение профиля в Firestore
   */
  async registerUser(name, password) {
    if (!this.isInitialized) return null;

    const email = this.nameToEmail(name);
    const { createUserWithEmailAndPassword } = this.authMethods;
    const { doc, setDoc } = this.firestoreMethods;

    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    const uid = userCredential.user.uid;

    const userDoc = {
      id: uid,
      name: name.trim(),
      role: 'patient',
      registeredAt: new Date().toISOString()
    };

    await setDoc(doc(this.db, 'users', uid), userDoc);
    return userDoc;
  }

  /**
   * Вход в Firebase Auth + получение данных из Firestore
   */
  async loginUser(name, password) {
    if (!this.isInitialized) return null;

    const email = this.nameToEmail(name);
    const { signInWithEmailAndPassword } = this.authMethods;
    const { doc, getDoc } = this.firestoreMethods;

    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    const uid = userCredential.user.uid;

    const snap = await getDoc(doc(this.db, 'users', uid));
    if (snap.exists()) {
      return snap.data();
    }
    return { id: uid, name, role: 'patient' };
  }

  /**
   * Сохранение первичной анкеты в Firestore
   */
  async saveInitialSurvey(userId, surveyData) {
    if (!this.isInitialized) return;
    const { doc, setDoc } = this.firestoreMethods;
    await setDoc(doc(this.db, 'users', userId), { initialSurvey: surveyData }, { merge: true });
  }

  /**
   * Сохранение еженедельного чек-ина в Firestore
   */
  async saveCheckin(userId, checkinData) {
    if (!this.isInitialized) return;
    const { collection, addDoc } = this.firestoreMethods;
    await addDoc(collection(this.db, 'checkins', userId, 'items'), {
      ...checkinData,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Загрузка чек-инов из Firestore
   */
  async loadCheckins(userId) {
    if (!this.isInitialized) return [];
    const { collection, getDocs, query, orderBy } = this.firestoreMethods;
    const q = query(collection(this.db, 'checkins', userId, 'items'), orderBy('date', 'asc'));
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    return items;
  }
}

export const firebaseService = new FirebaseService();
