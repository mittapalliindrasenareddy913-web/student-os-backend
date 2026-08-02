const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');

const SYSTEM_PROMPT = `You are Student OS AI, an academic assistant for engineering students in India.
Help with: concepts, math, physics, CS, exam prep, viva questions, Telugu explanations, quiz generation, code debugging.
Format responses with markdown: **bold** key terms, bullet points for lists, \`\`\`code\`\`\` for code.
Be concise, clear, student-friendly. Use simple language always.`;

const aiResponseCache = new Map();

async function callOpenAICompat({ baseURL, apiKey, model, messages }) {
  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const d = await resp.json();
  return d.choices[0].message.content;
}

async function callGemini(messages, modelName = 'gemini-2.5-flash') {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_PROMPT });

  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(messages[messages.length - 1].content);
  return result.response.text();
}

router.post('/chat', protect, async (req, res) => {
  const { message, history = [], provider = 'gemini' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.text })),
    { role: 'user', content: message },
  ];

  const cacheKey = JSON.stringify(messages);
  if (aiResponseCache.has(cacheKey)) {
    return res.json({ reply: aiResponseCache.get(cacheKey), provider: 'cache' });
  }

  let reply = '', actualProvider = provider;
  try {
    if (provider === 'chatgpt' && process.env.OPENAI_API_KEY?.trim()) {
      reply = await callOpenAICompat({ baseURL: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini', messages });
    } else if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY?.trim()) {
      reply = await callOpenAICompat({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat', messages });
    } else if (provider === 'perplexity' && process.env.PERPLEXITY_API_KEY?.trim()) {
      reply = await callOpenAICompat({ baseURL: 'https://api.perplexity.ai', apiKey: process.env.PERPLEXITY_API_KEY, model: 'llama-3.1-sonar-small-128k-online', messages });
    } else {
      // Primary Gemini
      try {
        reply = await callGemini(messages, 'gemini-2.5-flash');
        actualProvider = 'gemini-2.5-flash';
      } catch (err25) {
        console.warn('[AI/Fallback] gemini-2.5-flash failed, trying 2.0-flash...', err25.message);
        try {
          reply = await callGemini(messages, 'gemini-2.0-flash');
          actualProvider = 'gemini-2.0-flash';
        } catch (err20) {
          console.warn('[AI/Fallback] gemini-2.0-flash failed, trying 1.5-flash...', err20.message);
          reply = await callGemini(messages, 'gemini-1.5-flash');
          actualProvider = 'gemini-1.5-flash';
        }
      }
    }
    
    // Cache the successful response
    aiResponseCache.set(cacheKey, reply);
    // Limit cache size to prevent memory leak (basic FIFO)
    if (aiResponseCache.size > 500) {
      const firstKey = aiResponseCache.keys().next().value;
      aiResponseCache.delete(firstKey);
    }

    res.json({ reply, provider: actualProvider });
  } catch (err) {
    console.error(`[AI/Error]`, err.message);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});

module.exports = router;
