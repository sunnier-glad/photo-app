import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import { createAssistantService } from '../../src/modules/assistant/assistant.service.js';

test('chat sends a concise Chinese assistant request to MiMo', async () => {
  const requests: unknown[] = [];
  const headers: Headers[] = [];
  const assistant = createAssistantService({
    apiKey: 'test-key',
    baseUrl: 'https://mimo.example.com/anthropic',
    model: 'mimo-test',
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      headers.push(new Headers(init?.headers));
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '可以，我来帮你整理相册。' }],
        }),
        { status: 200 },
      );
    },
  });

  const result = await assistant.chat({
    userName: '测试用户',
    message: '怎么删除照片？',
  });

  assert.equal(result.reply, '可以，我来帮你整理相册。');
  assert.deepEqual(requests, [
    {
      model: 'mimo-test',
      max_tokens: 600,
      system: '你是拾忆相册的中文助手，回答要简短、具体、温和，只围绕相册、照片、共享、好友、账号和版本更新提供帮助。',
      messages: [
        {
          role: 'user',
          content: '用户 测试用户 问：怎么删除照片？',
        },
      ],
    },
  ]);
  assert.equal(headers[0].get('x-api-key'), 'test-key');
  assert.equal(headers[0].get('anthropic-version'), '2023-06-01');
});

test('chat returns a safe error when MiMo is not configured', async () => {
  const assistant = createAssistantService({
    apiKey: '',
    baseUrl: 'https://mimo.example.com/anthropic',
    model: 'mimo-test',
  });

  await assert.rejects(
    () => assistant.chat({ userName: '测试用户', message: '你好' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 503 &&
      error.code === 'ASSISTANT_UNAVAILABLE',
  );
});

test('generateTitle asks MiMo for a short memory title', async () => {
  let requestBody: unknown;
  const assistant = createAssistantService({
    apiKey: 'test-key',
    baseUrl: 'https://mimo.example.com/anthropic',
    model: 'mimo-test',
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '火锅里的第 200 天' }],
        }),
        { status: 200 },
      );
    },
  });

  const title = await assistant.generateTitle({
    albumTitle: '200天纪念日',
    currentTitle: '1780547590500.jpg',
    dateAdded: '2026-06-04',
    location: '未标记地点',
    uploaderName: '测试用户',
  });

  assert.equal(title, '火锅里的第 200 天');
  assert.match(JSON.stringify(requestBody), /只返回标题/);
  assert.match(JSON.stringify(requestBody), /200天纪念日/);
});
