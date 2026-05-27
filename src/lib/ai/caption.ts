/**
 * AI caption generation module.
 *
 * Uses the Anthropic Claude claude-sonnet-4-6 model to generate platform-tailored
 * social media captions from a raw concept brief.
 *
 * Writing rules enforced via system prompt:
 *   - Simple, human, professional tone
 *   - No emojis (unless explicitly requested)
 *   - No hollow AI marketing phrases
 *   - Sounds like a real person, not a marketing bot
 *   - Length and style appropriate to each platform
 */

import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Client (singleton — instantiated once at module load)
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateCaptionParams {
  /** The raw idea, brief, or concept the user wants to caption. */
  rawConcept: string;
  /** Target platforms, e.g. ['instagram', 'linkedin']. */
  platforms: string[];
  /** Optional brand context (industry, product, audience). */
  businessContext?: string;
  /** Optional voice/tone descriptor, e.g. 'authoritative', 'conversational'. */
  voiceTone?: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional social media copywriter who writes captions for businesses and creators.

Your writing rules — follow them without exception:
- Write in a simple, human, professional tone.
- Absolutely no emojis unless the user specifically asks for them.
- Never use hollow AI marketing language. Banned phrases include: "dive in", "dive deep", "unleash", "game-changer", "game changer", "revolutionize", "revolutionise", "elevate your", "take your X to the next level", "unlock your potential", "transform your", "supercharge", "skyrocket", "leverage", "cutting-edge", "state-of-the-art", "best-in-class", "unparalleled", "seamlessly", "in today's fast-paced world", "in the digital age", "it's no secret", "look no further".
- Write like a real person talking to another real person, not like a marketing bot.
- Be direct and specific. Vague generalities are not captions.
- Match the caption style and length to each platform:
    - Instagram: visual-first, 1-3 short punchy sentences, optional call to action.
    - LinkedIn: 2-4 sentences, professional but conversational, insight-led.
    - TikTok: very short, punchy, hooks the viewer in the first line.
    - Facebook: friendly, 1-3 sentences, conversational.
    - Twitter / X: under 240 characters, tight and direct.
    - General / multiple: keep it versatile, 2-3 sentences max.
- If multiple platforms are specified, write one caption that works across all of them unless they have very different styles.
- Return only the caption text. No labels, no explanations, no surrounding quotes.`;

// ---------------------------------------------------------------------------
// generateCaption
// ---------------------------------------------------------------------------

/**
 * Generates a platform-tailored social media caption for the given concept.
 *
 * @throws {Error} Descriptive error if the Anthropic API call fails.
 */
export async function generateCaption(
  params: GenerateCaptionParams,
): Promise<string> {
  const { rawConcept, platforms, businessContext, voiceTone } = params;

  if (!rawConcept || !rawConcept.trim()) {
    throw new Error('generateCaption: rawConcept must not be empty.');
  }

  if (!platforms || platforms.length === 0) {
    throw new Error('generateCaption: at least one platform must be specified.');
  }

  // ── Build user message ────────────────────────────────────────────────────
  const platformList = platforms
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(', ');

  const lines: string[] = [
    `Write a social media caption for the following concept.`,
    ``,
    `Target platform(s): ${platformList}`,
  ];

  if (voiceTone) {
    lines.push(`Voice/tone: ${voiceTone}`);
  }

  if (businessContext) {
    lines.push(`Business context: ${businessContext}`);
  }

  lines.push(``, `Concept:`, rawConcept.trim());

  const userMessage = lines.join('\n');

  // ── Call Anthropic API ────────────────────────────────────────────────────
  let response: Anthropic.Message;

  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(
        `Anthropic API error (${err.status}): ${err.message}`,
      );
    }
    throw new Error(
      `generateCaption: unexpected error calling Anthropic API: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // ── Extract text content ──────────────────────────────────────────────────
  const textBlock = response.content.find((block) => block.type === 'text');

  if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
    throw new Error(
      'generateCaption: Anthropic returned an empty or non-text response.',
    );
  }

  return textBlock.text.trim();
}
