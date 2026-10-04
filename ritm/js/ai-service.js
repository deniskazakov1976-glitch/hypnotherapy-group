/**
 * Мой ритм — Дневник состояния между встречами
 * Модуль ИИ-ассистента и протокола психологической безопасности
 */

import { APP_CONFIG } from './config.js';
import { storage } from './storage.js';

export class AiService {
  constructor() {
    this.config = APP_CONFIG;
  }

  /**
   * Проверка текста на кризисные триггеры
   */
  detectCrisis(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return this.config.crisisTriggers.some(trigger => lower.includes(trigger));
  }

  /**
   * Числовой кризис-детектор: экстремально низкие показатели без текста
   */
  detectNumericCrisis(checkinData) {
    if (!checkinData) return false;
    const { anxiety, sleep, mood, energy } = checkinData;
    // Тревожность ≥ 9 в сочетании с mood ≤ 2 или energy ≤ 2
    if (anxiety >= 9 && (mood <= 2 || energy <= 2)) return true;
    // Все 3 позитивных шкалы ≤ 2 (тотальный коллапс)
    if (sleep <= 2 && mood <= 2 && energy <= 2) return true;
    return false;
  }

  /**
   * Построение системного промпта для пациента
   */
  buildSystemPrompt(patientName) {
    const therapist = this.config.therapist;
    const emergency = this.config.emergencyHelp;

    return `Ты — поддерживающий ассистент для участников терапевтической группы «Мой ритм» гипнотерапевта Дениса Казакова.
Обращайся к человеку по имени (${patientName}) и уважительно, на "вы".

Твоя задача — мягко и эмпатично реагировать на то, что пишет человек о своём состоянии за неделю.

ПРАВИЛА:
- НЕ ставь диагнозы
- НЕ давай медицинских советов
- НЕ заменяй терапевта, не интерпретируй глубинные причины
- Можно: отражать чувства, подбадривать, отмечать прогресс, если он есть
- Отвечай коротко, строго 2-4 предложения

КРИЗИСНЫЙ ПРОТОКОЛ:
Если человек пишет о суицидальных мыслях, самоповреждении или угрозе себе/другим — обязательно:
1. Прояви сочувствие, не паникуй в тексте.
2. Сразу дай контакт терапевта: "Пожалуйста, свяжитесь с Денисом прямо сейчас по телефону ${therapist.phone} (звонок или сообщение в WhatsApp) — он на связи и готов помочь".
3. Дополнительно укажи: "Также можно позвонить на линию экстренной психологической помощи: ${emergency.phone} (бесплатно, круглосуточно)".
4. Мягко порекомендуй не оставаться с этим в одиночестве до следующей сессии группы.`;
  }

  /**
   * Формирование кризисного ответа (гарантированный локальный шаблон по протоколу безопасности)
   */
  generateCrisisResponse(patientName) {
    const therapist = this.config.therapist;
    const emergency = this.config.emergencyHelp;

    return `Здравствуйте, ${patientName}. Мне очень жаль, что сейчас вы проходите через настолько тяжёлое и болезненное состояние, но вы не одни.

Пожалуйста, свяжитесь с Денисом прямо сейчас по телефону ${therapist.phone} (позвоните или напишите в WhatsApp) — он на связи и готов оказать поддержку. Также круглосуточно работает бесплатная линия экстренной психологической помощи: ${emergency.phone}.

Пожалуйста, не оставайтесь наедине с этой тяжестью до следующей встречи группы — обратитесь за помощью уже сегодня.`;
  }

  /**
   * Генерация отклика ИИ на еженедельный чек-ин
   */
  async generateCheckinResponse(patientName, checkinData) {
    const fullText = `${checkinData.weekText || ''} ${checkinData.insights || ''}`;
    const isCrisis = this.detectCrisis(fullText);

    // Проверяем и числовые маркеры кризиса (экстремальные шкалы)
    const isNumericCrisis = this.detectNumericCrisis(checkinData);

    // Если сработал любой кризисный триггер — немедленно активируем строгий протокол безопасности
    if (isCrisis || isNumericCrisis) {
      return {
        text: this.generateCrisisResponse(patientName),
        isCrisis: true
      };
    }

    const aiSettings = storage.getAiSettings();

    // Если есть реальный API-ключ anymodel.org, делаем внешний запрос
    if (aiSettings.apiKey && aiSettings.apiKey.trim() !== '') {
      try {
        const response = await this.callAnymodelApi(patientName, checkinData, aiSettings);
        return {
          text: response,
          isCrisis: false
        };
      } catch (err) {
        console.warn('API error, switching to empathetic local fallback:', err);
      }
    }

    // Иначе используем умный локальный генератор (Mock AI)
    return {
      text: this.generateEmpatheticFallback(patientName, checkinData),
      isCrisis: false
    };
  }

  /**
   * Вызов OpenAI-совместимого API anymodel.org
   */
  async callAnymodelApi(patientName, checkinData, aiSettings) {
    const systemPrompt = this.buildSystemPrompt(patientName);
    const userMessage = `Участник группы: ${patientName}.
Показатели недели (шкала 1-10):
- Тревожность: ${checkinData.anxiety}/10
- Качество сна: ${checkinData.sleep}/10
- Настроение: ${checkinData.mood}/10
- Уровень энергии: ${checkinData.energy}/10

Как прошла неделя: "${checkinData.weekText || 'Без комментария'}"
Инсайты и наблюдения: "${checkinData.insights || 'Без комментария'}"

Дай короткий поддерживающий отклик (2-4 предложения) по правилам системного промпта.`;

    const response = await fetch(aiSettings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey}`
      },
      body: JSON.stringify({
        model: aiSettings.model || this.config.ai.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: this.config.ai.temperature,
        max_tokens: this.config.ai.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`API HTTP Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || this.generateEmpatheticFallback(patientName, checkinData);
  }

  /**
   * Локальный генератор эмпатичного отклика (работает без ключей и в офлайне)
   */
  generateEmpatheticFallback(patientName, checkinData) {
    const { anxiety, sleep, mood, energy, weekText, insights } = checkinData;

    // Анализ доминантных показателей
    const isAnxietyHigh = anxiety >= 7;
    const isSleepGood = sleep >= 7;
    const isSleepPoor = sleep <= 4;
    const isEnergyLow = energy <= 4;
    const hasInsights = insights && insights.trim().length > 10;

    let observation = '';
    let warmEncouragement = '';

    if (isAnxietyHigh) {
      observation = 'Заметно, что на этой неделе внутренняя тревожность давала о себе знать сильнее обычного.';
      warmEncouragement = 'Позвольте себе не бороться с этим напряжением в одиночку — на предстоящей очной сессии мы бережно вернём опору и телесное спокойствие.';
    } else if (anxiety <= 4 && isSleepGood) {
      observation = 'Очень радостно видеть, как ваша нервная система находит глубокий покой, а сон становится крепким союзником восстановления.';
      warmEncouragement = 'Замедляйтесь и присваивайте этот прогресс: ваше тело учится доверять себе и удерживать состояние безопасности.';
    } else if (isSleepPoor || isEnergyLow) {
      observation = 'Чувствуется, что неделя потребовала много душевных сил, а телу пока не хватает глубокого отдыха и энергии.';
      warmEncouragement = 'Сейчас самое главное — бережность к себе без лишних требований. Обязательно дайте себе право на паузу до нашей встречи.';
    } else {
      observation = 'Спасибо, что делитесь своими ощущениями и продолжаете бережно наблюдать за своим ритмом.';
      warmEncouragement = 'Каждое ваше наблюдение — это кирпичик в фундамент вашей внутренней устойчивости, который мы продолжим укреплять на группе.';
    }

    let insightNote = '';
    if (hasInsights) {
      insightNote = ' Ваш инсайт о происходящем очень ценен: способность замечать эти нюансы помогает трансформировать старые реакции.';
    }

    return `Здравствуйте, ${patientName}. ${observation}${insightNote} ${warmEncouragement}`;
  }

  /**
   * Аналитическая сводка для терапевта перед очной сессией
   */
  async generateTherapistSummary(patient, survey, checkins) {
    if (!checkins || checkins.length === 0) {
      return `По участнику ${patient.name} пока нет записей еженедельных чек-инов. Первичный запрос: "${survey?.concern || 'Не указан'}". Ожидания: "${survey?.goal || 'Не указаны'}".`;
    }

    const latest = checkins[checkins.length - 1];
    const prev = checkins.length > 1 ? checkins[checkins.length - 2] : null;

    // Сравнение со стартом
    const initialAnxiety = survey?.anxiety ?? checkins[0].anxiety;
    const initialSleep = survey?.sleep ?? checkins[0].sleep;
    const anxietyDiff = latest.anxiety - initialAnxiety;
    const sleepDiff = latest.sleep - initialSleep;

    const aiSettings = storage.getAiSettings();

    // Если есть подключение к API, пробуем запросить сводку
    if (aiSettings.apiKey && aiSettings.apiKey.trim() !== '') {
      try {
        const prompt = `Ты — клинический ассистент гипнотерапевта Дениса Казакова.
Составь краткую, ёмкую аналитическую сводку перед еженедельной очной сессией терапевтической группы.
Участник: ${patient.name}
Первичная проблема: ${survey?.concern || 'Нет данных'}
Цель терапии: ${survey?.goal || 'Нет данных'}
Стартовые шкалы: Тревожность ${initialAnxiety}/10, Сон ${initialSleep}/10.

Последний чек-ин (${new Date(latest.date).toLocaleDateString('ru-RU')}):
- Тревожность: ${latest.anxiety}/10 (динамика от старта: ${anxietyDiff > 0 ? '+' + anxietyDiff : anxietyDiff})
- Сон: ${latest.sleep}/10 (динамика: ${sleepDiff > 0 ? '+' + sleepDiff : sleepDiff})
- Настроение: ${latest.mood}/10
- Энергия: ${latest.energy}/10
- Заметка недели: "${latest.weekText}"
- Инсайты: "${latest.insights}"

Формат ответа:
1. Динамика состояния за неделю (2 предложения)
2. Ключевые изменения и маркеры
3. Рекомендация для ведущего: на что обратить внимание на очной сессии`;

        const res = await fetch(aiSettings.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiSettings.apiKey}`
          },
          body: JSON.stringify({
            model: aiSettings.model || this.config.ai.defaultModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 600
          })
        });

        if (res.ok) {
          const data = await res.json();
          return data.choices?.[0]?.message?.content?.trim();
        }
      } catch (e) {
        console.warn('API error in summary, using local rule-based engine:', e);
      }
    }

    // Локальное структурированное резюме
    let trendDesc = '';
    if (anxietyDiff < 0) {
      trendDesc = `Тревожность снизилась на ${Math.abs(anxietyDiff)} п. (с ${initialAnxiety} до ${latest.anxiety}/10), что указывает на постепенную разгрузку вегетатики.`;
    } else if (anxietyDiff > 0) {
      trendDesc = `Отмечен рост тревожности на +${anxietyDiff} п. (текущий балл ${latest.anxiety}/10). Возможен внешний стрессор или период обострения сопротивления.`;
    } else {
      trendDesc = `Показатель тревожности стабилен на уровне ${latest.anxiety}/10.`;
    }

    const sleepDesc = sleepDiff > 0 
      ? `Качество сна улучшилось (+${sleepDiff} п., текущий ${latest.sleep}/10).` 
      : sleepDiff < 0 
        ? `Наблюдается ухудшение сна (${latest.sleep}/10 vs ${initialSleep} на старте).` 
        : `Сон удерживается на уровне ${latest.sleep}/10.`;

    const focusTopic = latest.anxiety >= 7 
      ? 'Глубокая телесная релаксация, снятие гиперконтроля, работа с блуждающим нервом и заземление.' 
      : latest.energy <= 4 
        ? 'Ресурсные трансовые техники, восстановление вегетативного баланса, работа с выгоранием.' 
        : 'Закрепление новых паттернов поведения, присвоение успехов и интеграция опыта спокойствия.';

    return `📋 АНАЛИТИЧЕСКАЯ СВОДКА ПЕРЕД СЕССИЕЙ: ${patient.name}

1. Динамика недели:
${trendDesc} ${sleepDesc} Текущее настроение: ${latest.mood}/10, энергия: ${latest.energy}/10.

2. Отчёт участника:
• Заметка: «${latest.weekText || 'Без текста'}»
• Инсайт: «${latest.insights || 'Инсайты не зафиксированы'}»

3. Фокус внимания на очной сессии:
${focusTopic}
Рекомендуется бережно проверить телесные отклики на упражнения и свериться с первоначальным запросом («${survey?.goal || 'стабилизация'}»).`;
  }
}

export const aiService = new AiService();
