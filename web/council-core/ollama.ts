import * as dotenv from 'dotenv';
dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  repeat_penalty?: number;
}

export async function callOllama(
  system: string,
  user: string,
  model: string,
  options: OllamaOptions = {},
  format?: 'json'
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error('OLLAMA_TIMEOUT'));
  }, 45000);

  const requestBody: any = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.num_predict ?? 700,
      repeat_penalty: options.repeat_penalty ?? 1.15,
      ...options
    }
  };

  if (format === 'json') {
    requestBody.format = 'json';
  }

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('OLLAMA_MODEL');
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data.message.content;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.message === 'OLLAMA_TIMEOUT' || error.name === 'AbortError') {
      throw new Error('OLLAMA_TIMEOUT');
    }
    if (error.message === 'OLLAMA_MODEL') {
      throw error;
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.name === 'TypeError') {
      throw new Error('OLLAMA_CONNECTION');
    }
    throw error;
  }
}
