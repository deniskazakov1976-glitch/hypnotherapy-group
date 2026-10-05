/**
 * Мой ритм — Дневник состояния между встречами
 * Конфигурация приложения и системные настройки
 */

export const APP_CONFIG = {
  appName: 'Мой ритм',
  subtitle: 'Дневник состояния между встречами',
  version: '1.0.0',
  
  // Контакты ведущего терапевта
  therapist: {
    name: 'Денис Казаков',
    role: 'Гипнотерапевт, ведущий группы',
    phone: '+7 (902) 802-82-46',
    phoneRaw: '79028028246',
    whatsappUrl: 'https://wa.me/79028028246',
    telegramUrl: 'https://t.me/dkazak1999',
    vkUrl: 'https://vk.com/write468816327',
    landingUrl: 'https://deniskazakov1976-glitch.github.io/hypnotherapy-group/'
  },

  // Протокол экстренной психологической помощи
  emergencyHelp: {
    phone: '8-800-2000-122',
    name: 'Единая линия психологической помощи (бесплатно, 24/7)',
    description: 'Круглосуточная квалифицированная кризисная поддержка'
  },

  // Настройки ИИ по умолчанию (сервис anymodel.org / OpenAI-совместимый)
  ai: {
    endpoint: 'https://anymodel.org/v1/chat/completions',
    defaultModel: 'am/nemotron-3-ultra-550b-a55b',
    apiKey: (typeof atob !== 'undefined') ? atob('c2stZGM5ZDRiN2RmMzZiYTU1NS1qYWowODktZTRmNTU2Y2E=') : '',
    temperature: 0.6,
    maxTokens: 500
  },

  // Шкалы мониторинга
  metrics: [
    {
      id: 'anxiety',
      name: 'Тревожность',
      icon: '🌊',
      color: '#E06D53', // тёплый терракотово-коралловый
      lowLabel: 'Полное спокойствие',
      highLabel: 'Острая тревога / паника',
      reversed: true // для этой шкалы меньше = лучше
    },
    {
      id: 'sleep',
      name: 'Качество сна',
      icon: '🌙',
      color: '#5B7298', // глубокий спокойный индиго
      lowLabel: 'Бессонница / кошмары',
      highLabel: 'Глубокий, восстанавливающий',
      reversed: false
    },
    {
      id: 'mood',
      name: 'Настроение',
      icon: '🌿',
      color: '#3E886D', // мягкий природный шалфей/эмеральд
      lowLabel: 'Глубокая подавленность',
      highLabel: 'Радость и душевный подъем',
      reversed: false
    },
    {
      id: 'energy',
      name: 'Уровень энергии',
      icon: '⚡',
      color: '#D99B26', // теплый янтарный
      lowLabel: 'Полное истощение / нет сил',
      highLabel: 'Полон сил и ресурса',
      reversed: false
    }
  ],

  // Словарь триггеров кризисного протокола безопасности
  crisisTriggers: [
    'суицид', 'покончить с собой', 'не хочу жить', 'умереть', 'самоубийств',
    'вскрыть вены', 'убить себя', 'наложить на себя руки', 'порезать себя',
    'нет сил жить', 'не вижу смысла жить', 'лучше бы меня не было',
    'хочу исчезнуть навсегда', 'причинить себе вред', 'самоповрежд',
    'спрыгнуть с', 'передозировк', 'повеситься', 'закончить все это'
  ]
};
