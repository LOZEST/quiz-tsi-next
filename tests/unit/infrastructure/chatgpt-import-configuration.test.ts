import { describe, expect, it } from 'vitest';
import { parseChatGptImportUrl } from '../../../src/infrastructure/chatgpt/ChatGptImportConfiguration';

describe('parseChatGptImportUrl', () => {
  it.each([
    ['https://chatgpt.com/g/quiz-tsi', 'https://chatgpt.com/g/quiz-tsi'],
    [
      'https://www.chatgpt.com/g/quiz-tsi',
      'https://www.chatgpt.com/g/quiz-tsi',
    ],
  ])('accepte une URL HTTPS ChatGPT : %s', (value, expected) => {
    expect(parseChatGptImportUrl(value)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>hostile</h1>',
    'http://chatgpt.com/g/quiz-tsi',
    'https://chatgpt.com.attacker.example/g/quiz-tsi',
    '',
    'URL malformée',
    undefined,
  ])('rejette une configuration absente ou dangereuse : %s', (value) => {
    expect(parseChatGptImportUrl(value)).toBeNull();
  });
});
