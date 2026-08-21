import { HttpError } from '../../common/http-error.js';

type AssistantFetch = typeof fetch;

export type AssistantChatInput = {
  userName: string;
  message: string;
};

export type AssistantChatResult = {
  reply: string;
};

export type GeneratePhotoTitleInput = {
  albumTitle?: string;
  currentTitle?: string | null;
  dateAdded?: string;
  location?: string | null;
  uploaderName?: string;
};

const ASSISTANT_SYSTEM_PROMPT =
  '你是拾忆相册的中文助手，回答要简短、具体、温和，只围绕相册、照片、共享、好友、账号和版本更新提供帮助。';

const extractTextReply = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';

  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join('')
    .trim();
};

export const createAssistantService = ({
  apiKey,
  baseUrl,
  model,
  fetchImpl = fetch,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: AssistantFetch;
}) => {
  const assertConfigured = () => {
    if (!apiKey || !baseUrl || !model) {
      throw new HttpError(503, 'ASSISTANT_UNAVAILABLE', '助手暂时不可用，请稍后再试');
    }
  };

  const sendMessage = async (content: string, maxTokens = 600) => {
    assertConfigured();

    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: ASSISTANT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new HttpError(502, 'ASSISTANT_UPSTREAM_ERROR', '助手暂时不可用，请稍后再试');
    }

    const payload = await response.json();
    const reply = extractTextReply(payload);

    if (!reply) {
      throw new HttpError(502, 'ASSISTANT_EMPTY_REPLY', '助手暂时不可用，请稍后再试');
    }

    return reply;
  };

  return {
    async chat(input: AssistantChatInput): Promise<AssistantChatResult> {
      const reply = await sendMessage(`用户 ${input.userName} 问：${input.message}`);

      return { reply };
    },

    async generateTitle(input: GeneratePhotoTitleInput): Promise<string> {
      const reply = await sendMessage(
        [
          '请为一张相册照片生成一个自然的中文回忆标题，只返回标题，不要解释，不要标点包裹。',
          `相册：${input.albumTitle || '未命名相册'}`,
          `原始标题：${input.currentTitle || '无'}`,
          `日期：${input.dateAdded || '未知日期'}`,
          `地点：${input.location || '未标记地点'}`,
          `上传人：${input.uploaderName || '我'}`,
        ].join('\n'),
        80,
      );

      return reply.replace(/^["“”'「」]+|["“”'「」]+$/g, '').trim().slice(0, 24);
    },
  };
};

export type AssistantService = ReturnType<typeof createAssistantService>;
