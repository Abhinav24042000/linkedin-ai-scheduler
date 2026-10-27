/**
 * Gemini AI Service
 * Generates LinkedIn post content using Google's Gemini API.
 */

const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
].filter(Boolean);

/**
 * Build the system prompt for Gemini based on post parameters.
 */
function buildSystemPrompt({ topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags, existingPosts }) {
  // Length guidelines
  const lengthGuide = {
    short: '50-100 words',
    medium: '100-200 words',
    long: '200-350 words',
  };

  const targetLength = lengthGuide[length] || lengthGuide.medium;

  let prompt = `You are an expert LinkedIn content writer. Generate a LinkedIn post with the following specifications:

**Topics:** ${topics && topics.length > 0 ? topics.join(', ') : 'General professional content'}
${customTopics ? `**Additional Context/Topics:** ${customTopics}` : ''}
**Tone:** ${tone || 'professional'}
**Target Length:** ${targetLength}

**Formatting Rules:**
`;

  if (useHeadings) {
    prompt += `- USE headings/subheadings to structure the post (use line breaks and bold text, NOT markdown headers since LinkedIn doesn't render them)\n`;
  } else {
    prompt += `- Do NOT use headings or subheadings. Write in flowing paragraphs or short lines.\n`;
  }

  if (useEmojis) {
    prompt += `- Include emojis sparingly to enhance readability (1-3 emojis, placed naturally)\n`;
  } else {
    prompt += `- Do NOT include any emojis\n`;
  }

  if (useHashtags) {
    prompt += `- Add 3-5 relevant hashtags at the END of the post. Only use hashtags that are genuinely relevant to the content.\n`;
  } else {
    prompt += `- Do NOT include any hashtags\n`;
  }

  prompt += `
**Content Guidelines:**
- Write in a way that is engaging, authentic, and suitable for LinkedIn's professional audience
- Start with a compelling hook that stops scrolling
- Include a clear value proposition or takeaway
- End with a call-to-action or thought-provoking question (before hashtags if any)
- Use line breaks for readability (LinkedIn posts perform better with whitespace)
- NEVER invent or fabricate trends, statistics, percentages, or news. If asked about trending topics, note that real-time trends cannot be verified.
- Do not use generic filler phrases like "In today's fast-paced world" or "As we all know"
- Be specific and provide actionable insights where possible

**IMPORTANT:** Return ONLY the post content. No explanations, no "Here's your post:", no meta-commentary. Just the raw post text ready to be published on LinkedIn.
`;

  // Include existing posts to avoid repetition
  if (existingPosts && existingPosts.length > 0) {
    prompt += `\n**Existing Posts to AVOID Repeating (do not reuse similar hooks, structures, or ideas):**\n`;
    existingPosts.slice(0, 10).forEach((post, index) => {
      // Truncate long posts in the prompt
      const truncated = post.length > 300 ? post.substring(0, 300) + '...' : post;
      prompt += `\n--- Post ${index + 1} ---\n${truncated}\n`;
    });
  }

  return prompt;
}

/**
 * Generate a LinkedIn post using the Gemini API.
 *
 * @param {Object} params
 * @param {string} params.apiKey - Gemini API key
 * @param {string[]} params.topics - Selected topics
 * @param {string} params.customTopics - Custom topic text
 * @param {string} params.tone - Post tone (professional, casual, inspirational, etc.)
 * @param {string} params.length - Post length (short, medium, long)
 * @param {boolean} params.useHeadings - Whether to include headings
 * @param {boolean} params.useEmojis - Whether to include emojis
 * @param {boolean} params.useHashtags - Whether to include hashtags
 * @param {string[]} params.existingPosts - Array of existing post contents for uniqueness
 * @returns {Promise<string>} The generated post content
 */
async function generatePost({ apiKey, topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags, existingPosts }) {
  let cleanApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  cleanApiKey = cleanApiKey.replace(/^["']|["']$/g, '').trim();
  cleanApiKey = cleanApiKey.replace(/^GEMINI_API_KEY\s*[:=]\s*/i, '').trim();
  cleanApiKey = cleanApiKey.replace(/^["']|["']$/g, '').trim();

  console.log(`[Gemini] Calling API with key prefix: "${cleanApiKey.substring(0, 8)}...", length: ${cleanApiKey.length}`);

  const systemPrompt = buildSystemPrompt({ topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags, existingPosts });

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  };

  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanApiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // If auth error, don't bother trying other models
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid Gemini API key. Please check your API key in Settings.');
        }

        // If 503 (high demand) or 404 (model retired/changed), try the next candidate model
        if (response.status === 503 || response.status === 404 || response.status === 429) {
          console.warn(`[Gemini] Model ${model} returned ${response.status} (${data.error?.message || 'temporary issue'}), trying next model...`);
          lastError = new Error(`Gemini API (${model}): ${data.error?.message || response.statusText}`);
          continue;
        }

        if (response.status === 400) {
          throw new Error(`Gemini API error: ${data.error?.message || 'Invalid request'}`);
        }

        throw new Error(`Gemini API error (${response.status}): ${data.error?.message || 'Unknown error'}`);
      }

      // Extract the generated text from the response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        if (data.promptFeedback?.blockReason) {
          throw new Error(`Content generation was blocked by safety filters: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('Gemini returned no content. Please try again with different parameters.');
      }

      const generatedText = candidates[0].content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error('Gemini returned an empty response. Please try again.');
      }

      // Success with this model!
      console.log(`[Gemini] Successfully generated post using model: ${model}`);
      return generatedText.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      if (error.message.includes('Invalid Gemini API key') || error.message.includes('safety filters')) {
        throw error;
      }
      console.warn(`[Gemini] Attempt with ${model} failed: ${error.message}`);
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to generate post with any available Gemini model.');
}

module.exports = { generatePost };
