/**
 * Мой ритм — Дневник состояния между встречами
 * Модуль построения интерактивных графиков динамики (Chart.js)
 */

import { APP_CONFIG } from './config.js';

export class ChartManager {
  constructor() {
    this.patientChartInstance = null;
    this.therapistChartInstance = null;
  }

  /**
   * Подготовка данных для графика
   */
  prepareChartData(initialSurvey, checkins) {
    const dates = [];
    const anxietyData = [];
    const sleepData = [];
    const moodData = [];
    const energyData = [];

    // Точка 0: Первичная анкета (если есть)
    if (initialSurvey) {
      const initDate = new Date(initialSurvey.submittedAt || Date.now());
      dates.push(`Старт (${initDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })})`);
      anxietyData.push(initialSurvey.anxiety);
      sleepData.push(initialSurvey.sleep);
      moodData.push(initialSurvey.mood);
      energyData.push(initialSurvey.energy);
    }

    // Точки чек-инов
    if (checkins && checkins.length > 0) {
      checkins.forEach((c, idx) => {
        const d = new Date(c.date);
        dates.push(`Неделя ${idx + 1} (${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })})`);
        anxietyData.push(c.anxiety);
        sleepData.push(c.sleep);
        moodData.push(c.mood);
        energyData.push(c.energy);
      });
    }

    return {
      labels: dates,
      datasets: [
        {
          label: 'Тревожность (↓ лучше)',
          data: anxietyData,
          borderColor: '#E06D53',
          backgroundColor: 'rgba(224, 109, 83, 0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#E06D53',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2
        },
        {
          label: 'Сон (↑ лучше)',
          data: sleepData,
          borderColor: '#5B7298',
          backgroundColor: 'rgba(91, 114, 152, 0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#5B7298',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2
        },
        {
          label: 'Настроение (↑ лучше)',
          data: moodData,
          borderColor: '#3E886D',
          backgroundColor: 'rgba(62, 136, 109, 0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#3E886D',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2
        },
        {
          label: 'Энергия (↑ лучше)',
          data: energyData,
          borderColor: '#D99B26',
          backgroundColor: 'rgba(217, 155, 38, 0.1)',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#D99B26',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2
        }
      ]
    };
  }

  /**
   * Конфигурация опций Chart.js
   */
  getCommonOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: 'system-ui, -apple-system, sans-serif',
              size: 13,
              weight: '500'
            },
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(23, 37, 42, 0.95)',
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const val = context.parsed.y;
              return ` ${label}: ${val} из 10`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 1,
          max: 10,
          ticks: {
            stepSize: 1,
            color: '#64748B',
            font: { size: 11 }
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.7)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#64748B',
            font: { size: 11 }
          },
          grid: {
            display: false
          }
        }
      }
    };
  }

  /**
   * Отрисовка графика в кабинете пациента
   */
  renderPatientChart(canvasElement, initialSurvey, checkins) {
    if (!canvasElement) return;

    if (this.patientChartInstance) {
      this.patientChartInstance.destroy();
      this.patientChartInstance = null;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js не загружен');
      return;
    }

    const data = this.prepareChartData(initialSurvey, checkins);
    const ctx = canvasElement.getContext('2d');

    this.patientChartInstance = new Chart(ctx, {
      type: 'line',
      data: data,
      options: this.getCommonOptions()
    });
  }

  /**
   * Отрисовка графика в кабинете терапевта
   */
  renderTherapistChart(canvasElement, initialSurvey, checkins) {
    if (!canvasElement) return;

    if (this.therapistChartInstance) {
      this.therapistChartInstance.destroy();
      this.therapistChartInstance = null;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js не загружен');
      return;
    }

    const data = this.prepareChartData(initialSurvey, checkins);
    const ctx = canvasElement.getContext('2d');

    this.therapistChartInstance = new Chart(ctx, {
      type: 'line',
      data: data,
      options: this.getCommonOptions()
    });
  }
}

export const chartManager = new ChartManager();
