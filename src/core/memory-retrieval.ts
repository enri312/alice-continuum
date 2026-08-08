export type RetrievableMemory = {
  id?: string;
  intention: string;
  summary?: string;
  nextStep?: string;
  finishedAt?: string;
};

export type MemoryMatch<T extends RetrievableMemory = RetrievableMemory> = {
  memory: T;
  score: number;
  matchedTerms: string[];
  reason: string;
};

const stopwords = new Set([
  "a", "al", "algo", "como", "con", "cual", "cuando", "de", "del", "donde", "el", "ella", "en", "es", "esa", "ese", "esto", "fue", "ha", "hay", "la", "las", "lo", "los", "me", "mi", "mis", "para", "pero", "por", "que", "se", "sin", "sobre", "su", "sus", "te", "tu", "un", "una", "y", "ya",
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length < 5) return token;
  return token
    .replace(/(amientos|imientos|aciones|adores|adoras)$/u, "")
    .replace(/(mente|acion|idades|idad|ando|iendo)$/u, "")
    .replace(/(es|os|as|s)$/u, "");
}

function tokens(value: string) {
  return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1 && !stopwords.has(token)).map(stem))];
}

function readableTokens(value: string) {
  return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1 && !stopwords.has(token)))];
}

function containsToken(value: string, token: string) {
  return tokens(value).includes(token);
}

export function retrieveMemories<T extends RetrievableMemory>(query: string, memories: T[], limit = 3): MemoryMatch<T>[] {
  const queryTerms = readableTokens(query);
  const queryTokens = tokens(query);
  if (!queryTokens.length || !memories.length || limit <= 0) return [];

  const documentTokens = memories.map((memory) => new Set(tokens(`${memory.intention} ${memory.summary ?? ""} ${memory.nextStep ?? ""}`)));
  const documentFrequency = new Map<string, number>();
  for (const token of queryTokens) {
    documentFrequency.set(token, documentTokens.filter((document) => document.has(token)).length);
  }

  const normalizedQuery = normalize(query);
  return memories
    .map((memory, index): MemoryMatch<T> | null => {
      const title = memory.intention;
      const summary = memory.summary ?? "";
      const nextStep = memory.nextStep ?? "";
      const matchedTerms: string[] = [];
      const matchedFields = new Set<string>();
      let score = 0;

      for (const token of queryTokens) {
        const frequency = documentFrequency.get(token) ?? 0;
        const inverseFrequency = Math.log((memories.length + 1) / (frequency + 1)) + 1;
        let weight = 0;
        if (containsToken(title, token)) { weight += 2.4; matchedFields.add("tema"); }
        if (containsToken(summary, token)) { weight += 1.45; matchedFields.add("resumen"); }
        if (containsToken(nextStep, token)) { weight += .9; matchedFields.add("próximo paso"); }
        if (weight) {
          matchedTerms.push(queryTerms.find((term) => stem(term) === token) ?? token);
          score += weight * inverseFrequency;
        }
      }

      const fullText = normalize(`${title} ${summary} ${nextStep}`);
      if (normalizedQuery.length > 4 && fullText.includes(normalizedQuery)) score += 3;
      if (!matchedTerms.length) return null;

      score = score / Math.sqrt(queryTokens.length) + 0.04 / (index + 1);
      return {
        memory,
        score: Number(score.toFixed(3)),
        matchedTerms,
        reason: `Coincidencia en ${[...matchedFields].join(" y ")}: ${matchedTerms.join(", ")}`,
      };
    })
    .filter((match): match is MemoryMatch<T> => Boolean(match))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
