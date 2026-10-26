/**
 * Uniqueness Service
 * Implements TF-IDF + cosine similarity for comparing LinkedIn posts.
 * Used to detect when generated content is too similar to existing posts.
 */

// Common English stop words to exclude from tokenization
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'were',
  'been', 'are', 'am', 'will', 'would', 'could', 'should', 'may', 'might',
  'can', 'do', 'did', 'does', 'has', 'had', 'have', 'having', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'if', 'then', 'about', 'up', 'out', 'into', 'over',
  'after', 'before', 'between', 'under', 'above', 'also', 'here', 'there',
  'again', 'once', 'during', 'while', 'through', 'get', 'got', 'like',
  'make', 'made', 'know', 'think', 'take', 'see', 'come', 'want', 'look',
  'use', 'find', 'give', 'tell', 'say', 'said', 'need', 'going', 'go',
  'new', 'one', 'two', 'first', 'well', 'way', 'even', 'back', 'any',
  'work', 'day', 'still', 'let', 'much', 'many', 'being', 'its', 'been',
  'dont', 'ive', 'youre', 'thats', 'heres', 'im', 'weve', 'theyre',
]);

/**
 * Tokenize text for TF-IDF analysis.
 * Lowercases, removes punctuation, splits into words, and filters stop words.
 * @param {string} text - The text to tokenize
 * @returns {string[]} Array of meaningful tokens
 */
function tokenize(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove hashtags symbols but keep the word
    .replace(/#(\w+)/g, '$1')
    // Remove punctuation and special characters
    .replace(/[^\w\s]/g, ' ')
    // Split into words
    .split(/\s+/)
    // Filter out stop words, short words, and pure numbers
    .filter(word => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

/**
 * Calculate term frequency for a document (array of tokens).
 * @param {string[]} tokens - Array of tokens
 * @returns {Map<string, number>} Map of term → normalized frequency
 */
function calculateTF(tokens) {
  const tf = new Map();
  const totalTerms = tokens.length;

  if (totalTerms === 0) return tf;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by total number of terms
  for (const [term, count] of tf) {
    tf.set(term, count / totalTerms);
  }

  return tf;
}

/**
 * Calculate inverse document frequency for all terms across documents.
 * @param {string[][]} tokenizedDocs - Array of tokenized documents
 * @returns {Map<string, number>} Map of term → IDF value
 */
function calculateIDF(tokenizedDocs) {
  const idf = new Map();
  const totalDocs = tokenizedDocs.length;

  if (totalDocs === 0) return idf;

  // Count how many documents contain each term
  const docFrequency = new Map();
  for (const tokens of tokenizedDocs) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
    }
  }

  // Compute IDF: log(totalDocs / (1 + docFrequency))
  // Adding 1 to prevent division by zero (Laplace smoothing)
  for (const [term, df] of docFrequency) {
    idf.set(term, Math.log(totalDocs / (1 + df)) + 1);
  }

  return idf;
}

/**
 * Calculate TF-IDF vectors for a set of documents.
 * @param {string[]} documents - Array of document texts
 * @returns {{ vectors: Map<string, number>[], vocabulary: Set<string> }}
 */
function calculateTFIDF(documents) {
  // Tokenize all documents
  const tokenizedDocs = documents.map(doc => tokenize(doc));

  // Calculate IDF across all documents
  const idf = calculateIDF(tokenizedDocs);

  // Build vocabulary (all unique terms)
  const vocabulary = new Set();
  for (const tokens of tokenizedDocs) {
    for (const token of tokens) {
      vocabulary.add(token);
    }
  }

  // Calculate TF-IDF vector for each document
  const vectors = tokenizedDocs.map(tokens => {
    const tf = calculateTF(tokens);
    const tfidf = new Map();

    for (const term of vocabulary) {
      const tfValue = tf.get(term) || 0;
      const idfValue = idf.get(term) || 0;
      if (tfValue > 0) {
        tfidf.set(term, tfValue * idfValue);
      }
    }

    return tfidf;
  });

  return { vectors, vocabulary };
}

/**
 * Compute cosine similarity between two TF-IDF vectors.
 * @param {Map<string, number>} vecA - First vector
 * @param {Map<string, number>} vecB - Second vector
 * @returns {number} Cosine similarity (0 to 1)
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  // Compute dot product using shared terms
  for (const [term, valueA] of vecA) {
    magnitudeA += valueA * valueA;
    const valueB = vecB.get(term);
    if (valueB) {
      dotProduct += valueA * valueB;
    }
  }

  for (const [, valueB] of vecB) {
    magnitudeB += valueB * valueB;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Check how similar a new post is compared to existing posts.
 * @param {string} newContent - The new post content to check
 * @param {Array<{ id: number, content: string }>} existingPosts - Existing posts to compare against
 * @returns {{ score: number, mostSimilarPost: { id: number, content: string, score: number } | null, isTooSimilar: boolean }}
 */
function checkSimilarity(newContent, existingPosts) {
  // Default result for no existing posts
  if (!existingPosts || existingPosts.length === 0) {
    return {
      score: 0,
      mostSimilarPost: null,
      isTooSimilar: false,
    };
  }

  // Normalize existing posts (support both strings and { id, content } objects)
  const normalizedExisting = existingPosts.map((p, index) => {
    if (typeof p === 'string') {
      return { id: index + 1, content: p };
    }
    return { id: p && p.id !== undefined ? p.id : index + 1, content: (p && p.content) ? p.content : '' };
  });

  // Build the document set: new content first, then existing posts
  const allDocuments = [newContent, ...normalizedExisting.map(p => p.content)];

  // Calculate TF-IDF for all documents
  const { vectors } = calculateTFIDF(allDocuments);

  // The first vector is the new content
  const newVector = vectors[0];

  // Compare against each existing post
  let highestScore = 0;
  let mostSimilarPost = null;

  for (let i = 0; i < normalizedExisting.length; i++) {
    const existingVector = vectors[i + 1]; // +1 because new content is at index 0
    const similarity = cosineSimilarity(newVector, existingVector);

    if (similarity > highestScore) {
      highestScore = similarity;
      mostSimilarPost = {
        id: normalizedExisting[i].id,
        content: normalizedExisting[i].content,
        score: Math.round(similarity * 1000) / 1000, // Round to 3 decimal places
      };
    }
  }

  return {
    score: Math.round(highestScore * 1000) / 1000,
    mostSimilarPost,
    isTooSimilar: highestScore > 0.6,
  };
}

module.exports = {
  checkSimilarity,
  tokenize,
  calculateTFIDF,
  cosineSimilarity,
};
