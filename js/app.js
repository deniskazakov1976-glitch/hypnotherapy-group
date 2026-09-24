/**
 * ЛЕНДИНГ «ГРУППОВАЯ ГИПНОТЕРАПИЯ ДО КОНЦА ГОДА»
 * Скрипты мирового уровня:
 * 1. Web Audio API — встроенный генератор расслабляющего тета-эмбиента и звуковая визуализация.
 * 2. Интерактивный чекап нервной системы с расчетом индекса стресса и автозаполнением заявки.
 * 3. Интерактивные табы клинических кейсов (до / процесс / результат).
 * 4. FAQ аккордеон, мобильное меню, модалка с динамическим контекстом.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ================= 1. МОБИЛЬНОЕ МЕНЮ И ШАПКА =================
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  const navLinks = document.querySelectorAll('.nav-link');
  const header = document.getElementById('header');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      menuToggle.classList.toggle('active', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.08)';
    } else {
      header.style.boxShadow = 'none';
    }
  });

  // ================= 2. ИНТЕРАКТИВНЫЙ ЧЕКАП (КВИЗ) =================
  const quizSteps = document.querySelectorAll('.quiz-step');
  const quizProgressFill = document.getElementById('quizProgressFill');
  const quizResult = document.getElementById('quizResult');
  const resultScoreVal = document.getElementById('resultScoreVal');
  const resultTitle = document.getElementById('resultTitle');
  const resultSubtitle = document.getElementById('resultSubtitle');
  const resultDiagnosisBox = document.getElementById('resultDiagnosisBox');
  const resetQuizBtn = document.getElementById('resetQuizBtn');

  let currentStep = 1;
  let totalScore = 0;
  let userDiagnosisText = '';

  const quizOptions = document.querySelectorAll('.quiz-opt');
  quizOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const score = parseInt(opt.getAttribute('data-score'), 10) || 1;
      totalScore += score;

      if (currentStep < 3) {
        // Переход к следующему вопросу
        quizSteps.forEach(s => s.classList.remove('active'));
        currentStep++;
        const nextStepEl = document.querySelector(`.quiz-step[data-step="${currentStep}"]`);
        if (nextStepEl) nextStepEl.classList.add('active');
        if (quizProgressFill) {
          quizProgressFill.style.width = `${(currentStep / 3) * 100}%`;
        }
      } else {
        // Завершение квиза и вывод результата
        showQuizResult(totalScore);
      }
    });
  });

  function showQuizResult(score) {
    quizSteps.forEach(s => s.classList.remove('active'));
    if (quizProgressFill) quizProgressFill.style.width = '100%';
    if (quizResult) quizResult.style.display = 'block';

    let percentage = Math.round((score / 9) * 100);
    let level = 'high';
    let title = '';
    let subtitle = '';
    let diagnosis = '';

    if (score <= 4) {
      level = 'low';
      title = 'Умеренное утомление';
      subtitle = 'Организм справляется, но резервы на исходе';
      diagnosis = 'Ваша нервная система пока держит баланс, но появляются первые звоночки. Программа поможет не допустить накопления усталости и научит быстро восстанавливать ресурс.';
    } else if (score <= 6) {
      level = 'mid';
      title = 'Повышенная стрессовая нагрузка';
      subtitle = 'Тело сигнализирует о перегрузке';
      diagnosis = 'Тело чувствует напряжение: поверхностный сон, зажимы в шее и плечах, фоновое беспокойство. Рекомендуем забронировать место в группе для снятия напряжения и нормализации вегетатики.';
    } else {
      title = 'Выраженная стрессовая перегрузка';
      subtitle = 'Организму нужна профессиональная поддержка';
      diagnosis = 'Судя по ответам, нервная система длительное время находится в перегрузке. Обычный отдых уже не восстанавливает силы. Рекомендуем пройти терапевтическую программу в закрытой группе.';
    }

    if (quizResult) quizResult.setAttribute('data-level', level);
    if (resultScoreVal) resultScoreVal.textContent = `${percentage}%`;
    if (resultTitle) resultTitle.textContent = title;
    if (resultSubtitle) resultSubtitle.textContent = subtitle;
    if (resultDiagnosisBox) resultDiagnosisBox.textContent = diagnosis;

    userDiagnosisText = `Самооценка стресса: ${percentage}% (${title})`;
  }

  if (resetQuizBtn) {
    resetQuizBtn.addEventListener('click', () => {
      currentStep = 1;
      totalScore = 0;
      quizResult.style.display = 'none';
      quizSteps.forEach((s, idx) => {
        s.classList.toggle('active', idx === 0);
      });
      if (quizProgressFill) quizProgressFill.style.width = '0%';
    });
  }

  // ================= 3.5 ФИЛЬТРАЦИЯ ТЕМ ЗАПРОСОВ =================
  const filterTabBtns = document.querySelectorAll('.filter-tab-btn');
  const topicCards = document.querySelectorAll('#topicsGrid .feature-card');

  filterTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');

      filterTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      topicCards.forEach(card => {
        const category = card.getAttribute('data-category') || '';
        if (filter === 'all' || category.includes(filter) || category === 'all') {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // ================= 5. АККОРДЕОН FAQ =================
  // Точная высота ответа через scrollHeight — фиксированный max-height
  // обрезал длинные ответы на узких экранах
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    const setAnswerHeight = (open) => {
      if (!answer) return;
      answer.style.maxHeight = open ? `${answer.scrollHeight}px` : '';
    };

    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          const otherAnswer = otherItem.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.maxHeight = '';
        }
      });
      item.classList.toggle('active', !isActive);
      questionBtn.setAttribute('aria-expanded', String(!isActive));
      setAnswerHeight(!isActive);
    });

    questionBtn.setAttribute('aria-expanded', item.classList.contains('active') ? 'true' : 'false');
  });

  if (faqItems.length > 0) {
    faqItems[0].classList.add('active');
    const firstAnswer = faqItems[0].querySelector('.faq-answer');
    if (firstAnswer) firstAnswer.style.maxHeight = `${firstAnswer.scrollHeight}px`;
    faqItems[0].querySelector('.faq-question').setAttribute('aria-expanded', 'true');
  }

  // ================= 6. МОДАЛЬНОЕ ОКНО ЗАПИСИ =================
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalClose = document.getElementById('modalClose');
  const openModalBtns = document.querySelectorAll('.open-modal-btn');
  const modalTag = document.getElementById('modalTag');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const bookingForm = document.getElementById('bookingForm');
  const userNoteInput = document.getElementById('userNote');
  const modalSuccess = document.getElementById('modalSuccess');
  const successCloseBtn = document.getElementById('successCloseBtn');

  const modalVariants = {
    plan_booking: {
      tag: 'Бронирование места',
      title: 'Забронировать место в закрытой группе',
      desc: 'Оставьте контакты для фиксации места или напишите напрямую Денису. Около 80% группы — постоянные участники, бронь подтверждается в пару сообщений.'
    },
    diagnostics: {
      tag: 'Бронирование места',
      title: 'Забронировать место в группе',
      desc: 'Оставьте контакты для фиксации места или напишите напрямую в WhatsApp / Telegram / VK. Мы подтвердим участие и согласуем детали.'
    },
    plan_monthly: {
      tag: 'Помесячный тариф • 3 000 ₽ / занятие',
      title: 'Бронирование места (Помесячная оплата)',
      desc: 'Стоимость: 3 000 ₽ за 1 занятие (12 000 ₽ в месяц). Оплата частями раз в месяц. Оставьте контакты, и мы свяжемся с вами в удобном мессенджере.'
    },
    plan_full: {
      tag: 'Полный курс • 2 500 ₽ / занятие',
      title: 'Бронирование места на полный курс',
      desc: 'Стоимость: 2 500 ₽ за 1 занятие (35 000 ₽ за весь курс из 14 встреч со скидкой 7 000 ₽). Оставьте контакты для фиксации специальной цены.'
    }
  };

  const openModal = (type = 'plan_booking') => {
    const config = modalVariants[type] || modalVariants.plan_booking;
    if (modalTag) modalTag.textContent = config.tag;
    if (modalTitle) modalTitle.textContent = config.title;
    if (modalDesc) modalDesc.textContent = config.desc;

    // Автоподстановка результатов чекапа, если пройден
    if (userNoteInput && userDiagnosisText && !userNoteInput.value) {
      userNoteInput.value = userDiagnosisText;
    }

    if (bookingForm) {
      bookingForm.style.display = 'block';
    }
    if (modalSuccess) {
      modalSuccess.style.display = 'none';
    }

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  };

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.getAttribute('data-type') || 'plan_booking';
      openModal(type);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (successCloseBtn) successCloseBtn.addEventListener('click', closeModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
      closeModal();
    }
  });

  // Отправка формы — открывает выбранный мессенджер (WhatsApp, Telegram, VK) с предзаполненным текстом
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.textContent;

      const name = document.getElementById('userName').value.trim();
      const contact = document.getElementById('userContact').value.trim();
      const format = document.getElementById('userFormat') ? document.getElementById('userFormat').value : 'offline';
      const experience = document.getElementById('userExperience') ? document.getElementById('userExperience').value : 'returning';
      const topicSelect = document.getElementById('userTopicSelect');
      const topic = topicSelect ? topicSelect.value : '';
      const note = document.getElementById('userNote') ? document.getElementById('userNote').value.trim() : '';

      const preferredRadio = document.querySelector('input[name="preferredChannel"]:checked');
      const channel = preferredRadio ? preferredRadio.value : 'whatsapp';

      const formatLabels = { 
        offline: 'Офлайн в офисе (г. Пермь)', 
        online: 'Онлайн (МТС Линк)', 
        any: 'Пока выбираю' 
      };

      const experienceLabels = {
        returning: 'Постоянный участник (уже был у Дениса)',
        new: 'Новый участник (иду впервые)'
      };

      const channelLabels = {
        whatsapp: 'WhatsApp',
        telegram: 'Telegram',
        vk: 'ВКонтакте'
      };

      let message = `Заявка: Группа гипнотерапии\n\n`;
      message += `Имя: ${name}\n`;
      message += `Контакт: ${contact}\n`;
      message += `Связь через: ${channelLabels[channel] || channel}\n`;
      message += `Статус: ${experienceLabels[experience] || experience}\n`;
      message += `Формат: ${formatLabels[format] || format}\n`;
      if (topic) message += `Тема: ${topic}\n`;
      if (note) message += `Вопрос/запрос: ${note}\n`;

      submitBtn.disabled = true;

      let targetUrl = '';
      if (channel === 'whatsapp') {
        submitBtn.textContent = 'Открываем WhatsApp...';
        targetUrl = `https://wa.me/79028028246?text=${encodeURIComponent(message)}`;
      } else if (channel === 'vk') {
        submitBtn.textContent = 'Открываем ВКонтакте...';
        targetUrl = `https://vk.com/write468816327`;
        // Копируем сообщение в буфер обмена для удобства вставки в диалог VK
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message).catch(() => {});
        }
      } else {
        submitBtn.textContent = 'Открываем Telegram...';
        targetUrl = `https://t.me/dkazak1999?text=${encodeURIComponent(message)}`;
      }

      window.open(targetUrl, '_blank');

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        bookingForm.style.display = 'none';
        modalSuccess.style.display = 'block';
      }, 1000);
    });
  }

  // ================= 7. ПЛАВНЫЙ СКРОЛЛ =================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerOffset = 76;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ================= 8. АНИМАЦИИ ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ (ui-designer) =================
  const revealItems = document.querySelectorAll('.reveal-item');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealItems.forEach(item => {
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(item => item.classList.add('revealed'));
  }
});
