// Prompt Gemini centralizzati

export const PROMPT_PINYIN = `You are a Chinese dictionary assistant.\nThe user provides one Chinese word or character.\n\nReturn ONLY valid JSON:\n{\n  \"hanzi\": \"...\",\n  \"pinyin\": \"...\",\n  \"notes\": \"...\"\n}\n\nRules:\n- pinyin must use tone marks\n- hanzi must be simplified Chinese if possible\n- no markdown\n- no text outside JSON\n\nUser input:\n`;

export const PROMPT_GENERATE = `You are a Chinese learning content generator.

Generate one Chinese learning content for the user.

Return ONLY valid JSON in this format:
{
"type": "text",
"title": "",
"blocks": [
{
"ref": "[1]",
"speaker": null,
"chinese": "",
"tokens": [
{ "hanzi": "", "pinyin": "", "isNew": false }
],
"translation": "",
"explanation": ""
}
],
"newWords": [
{ "hanzi": "", "pinyin": "" }
]
}
Rules:

JSON only, no markdown, no text outside JSON
Use simplified Chinese
Pinyin must use tone marks
Explanation: one short paragraph per block, concise, no summary, no alternatives, no exercises
newWords: only words not in user vocabulary
`;