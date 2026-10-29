/**
 * CLI Runner for tests/unit-tests.js in Node.js environment
 * Provides mock browser globals (localStorage, document, fetch)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage
class LocalStorageMock {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new LocalStorageMock();

// Mock document for XSS test
globalThis.document = {
  createElement: (tag) => {
    let text = '';
    return {
      set textContent(val) { text = val; },
      get textContent() { return text; },
      get innerHTML() {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
    };
  }
};

// Mock fetch for PWA tests
globalThis.fetch = async (url) => {
  const clean = url.replace(/^\.\.\//, '');
  const targetPath = path.resolve(rootDir, clean);
  if (fs.existsSync(targetPath)) {
    const data = fs.readFileSync(targetPath);
    return {
      status: 200,
      ok: true,
      json: async () => JSON.parse(data.toString('utf-8')),
      text: async () => data.toString('utf-8')
    };
  }
  return {
    status: 404,
    ok: false,
    json: async () => ({}),
    text: async () => ''
  };
};

// Dynamic import after globals are setup
async function main() {
  const { TestRunner, registerAllTests } = await import('./unit-tests.js');
  console.log('======================================================================');
  console.log('   МОЙ РИТМ: Запуск JavaScript Unit-тестов (Test Suite)');
  console.log('======================================================================\n');

  const runner = new TestRunner();
  registerAllTests(runner);

  let currentSuiteName = '';
  const startTime = performance.now();

  const results = await runner.run((test, suiteName) => {
    if (suiteName !== currentSuiteName) {
      currentSuiteName = suiteName;
      console.log(`\n--- ${suiteName} ---`);
    }
    if (test.passed) {
      console.log(`  [OK] ${test.name} (${test.duration}ms)`);
    } else {
      console.log(`  [FAIL] ${test.name} (${test.duration}ms)`);
      console.log(`         Ошибка: ${test.error}`);
      if (test.stack) {
        console.log(`         Стек: ${test.stack.split('\n').slice(0, 3).join('\n         ')}`);
      }
    }
  });

  const totalDuration = Math.round(performance.now() - startTime);

  console.log('\n======================================================================');
  console.log('ИТОГОВЫЙ ОТЧЁТ JS UNIT-ТЕСТОВ:');
  console.log(`  Всего тестов : ${results.total}`);
  console.log(`  Успешно [OK] : ${results.passed}`);
  console.log(`  Ошибок [FAIL]: ${results.failed}`);
  console.log(`  Длительность : ${totalDuration} ms`);
  const rate = Math.round((results.passed / results.total) * 100);
  console.log(`  Pass Rate    : ${rate}%`);
  console.log('======================================================================');

  if (results.failed > 0) {
    console.error(`\nВНИМАНИЕ: Обнаружено ${results.failed} упавших тестов!`);
    process.exit(1);
  } else {
    console.log('\n*** ВСЕ JS UNIT-ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ (100% PASS RATE) ***\n');
  }
}

main().catch(err => {
  console.error('Критический сбой тестового раннера:', err);
  process.exit(1);
});
