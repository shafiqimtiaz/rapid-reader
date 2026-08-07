const SENTENCE_ENDERS = new Set(['.', '!', '?', '…']);
const MID_SENTENCE = new Set([',', ';', ':', '—']);

export function pauseMultiplier(char: string | undefined): number {
  if (!char) return 1;
  if (SENTENCE_ENDERS.has(char)) return 3;
  if (MID_SENTENCE.has(char)) return 1.5;
  return 1;
}
