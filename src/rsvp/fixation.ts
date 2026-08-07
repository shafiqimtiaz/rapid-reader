export function fixationIndex(wordLength: number): number {
  if (wordLength <= 2) return Math.floor(wordLength / 2);
  if (wordLength <= 6) return wordLength - 2;
  if (wordLength <= 9) return wordLength - 3;
  return Math.min(wordLength - 1, wordLength - 4);
}
