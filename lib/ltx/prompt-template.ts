/**
 * Fixed image-to-video instruction sent to LTX with the lead screenshot.
 */
export function buildVideoPrompt(): string {
  return `Create a short, high-quality promotional video using the provided website screenshot as the visual base.

OBJECTIVE
Make the business appear trustworthy, modern, and professional. The video should feel like something the business could confidently post on social media to attract customers.

STRUCTURE (very important)
1) Opening (0–2s):
Introduce the brand clearly. Show the most recognizable part of the website (logo, header, or hero section). Establish credibility immediately.

2) Middle (2–6s):
Highlight key products, services, or content from the screenshot. Keep elements clear and readable. Guide attention to what the business offers.

3) Ending (6–8s):
Settle into a clean, confident final frame. The business should feel established and reliable. No abrupt cuts.

VISUAL STYLE
- Clean, modern, and realistic
- Professional marketing aesthetic
- No flashy effects or gimmicks
- Maintain consistent lighting and colors
- Keep all text and products readable

CAMERA & MOTION
- Use slow, smooth, subtle camera movement only
- Gentle zoom or pan is acceptable
- No fast motion, shaking, or aggressive transitions
- Keep the composition stable and easy to follow

CONSTRAINTS (strict)
- Do NOT distort or warp the layout
- Do NOT morph objects or text
- Do NOT hallucinate new UI elements
- Do NOT create unrealistic animations
- Do NOT make the scene chaotic or busy

FOCUS
- Emphasize clarity and trust
- Make the business feel credible and high-quality
- Prioritize readability over creativity

OUTPUT
A smooth, visually appealing 8-second promotional video that looks like a real marketing asset, not an AI experiment.`;
}
