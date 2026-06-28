/**
 * AI caption generation module.
 *
 * Uses Claude claude-sonnet-4-6 with optional vision support.
 * When a mediaUrl is provided, the image is fetched server-side,
 * encoded as base64, and sent to Claude so it actually reads the photo.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface GenerateCaptionParams {
  rawConcept?: string;
  platforms: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  instructions?: string;
  businessContext?: string;
  voiceTone?: string;
  originalCaption?: string;
  enhanceRequest?: string;
}

const SYSTEM_PROMPT = `You are a professional social media copywriter who writes captions for businesses and creators.

Your writing rules — follow them without exception:
- Write in a simple, human, professional tone.
- Absolutely no emojis unless the user specifically asks for them.
- Never use hollow AI marketing language. Banned phrases include: "dive in", "dive deep", "unleash", "game-changer", "revolutionize", "elevate your", "take your X to the next level", "unlock your potential", "transform your", "supercharge", "skyrocket", "leverage", "cutting-edge", "seamlessly", "in today's fast-paced world".
- Write like a real person talking to another real person, not like a marketing bot.
- Be direct and specific. Vague generalities are not captions.
- Match the caption style and length to each platform:
    - Instagram: visual-first, 1-3 short punchy sentences, optional call to action.
    - LinkedIn: 2-4 sentences, professional but conversational, insight-led.
    - TikTok: very short, punchy, hooks the viewer in the first line.
    - Facebook: friendly, 1-3 sentences, conversational.
    - General / multiple: keep it versatile, 2-3 sentences max.
- If multiple platforms are specified, write one caption that works across all of them.
- Return only the caption text. No labels, no explanations, no surrounding quotes.`;

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mt = contentType.split(';')[0].trim();
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const finalType = allowed.includes(mt) ? mt : 'image/jpeg';
    return { base64, mediaType: finalType };
  } catch {
    return null;
  }
}

const ENHANCE_SYSTEM_PROMPT = `You are a social media caption enhancer for CNB CUT barbershop.
Your task:
- Keep the original caption's exact style, tone, and vibe
- Do not rewrite it from scratch
- Naturally weave in the user's requested details
- Maintain the same quality of English and professionalism
- Return only the enhanced caption, nothing else`;

export async function generateCaption(params: GenerateCaptionParams): Promise<string> {
  const { rawConcept, platforms, mediaUrl, mediaType, instructions, businessContext, voiceTone, originalCaption, enhanceRequest } = params;

  if (!platforms || platforms.length === 0) {
    throw new Error('generateCaption: at least one platform must be specified.');
  }

  // Enhance mode: refine existing caption without rewriting it
  if (originalCaption && enhanceRequest) {
    const enhancePrompt = `Here is the original caption:\n\n"${originalCaption}"\n\nThe user wants to add or include: ${enhanceRequest}`;
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: ENHANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: enhancePrompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text' && textBlock.text.trim()) {
      return textBlock.text.trim();
    }
  }

  const platformList = platforms
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(', ');

  const lines: string[] = [
    'Write a social media caption for the following.',
    '',
    `Target platform(s): ${platformList}`,
  ];

  if (voiceTone) lines.push(`Voice/tone: ${voiceTone}`);
  if (businessContext) lines.push(`Business context: ${businessContext}`);
  if (instructions) lines.push(`Special instructions: ${instructions}`);
  if (rawConcept?.trim()) {
    lines.push('', 'Additional context from the user:', rawConcept.trim());
  }

  const textPrompt = lines.join('\n');

  type MessageContent = Anthropic.ImageBlockParam | Anthropic.TextBlockParam;
  const messageContent: MessageContent[] = [];

  if (mediaUrl && mediaType === 'image') {
    const imageData = await fetchImageAsBase64(mediaUrl);
    if (imageData) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageData.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: imageData.base64,
        },
      });
    }
  }

  messageContent.push({ type: 'text', text: textPrompt });

  let response: Anthropic.Message;

  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw new Error(
      `generateCaption: unexpected error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
    throw new Error('generateCaption: Anthropic returned an empty or non-text response.');
  }

  return textBlock.text.trim();
}
