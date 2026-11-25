export const QUIZ_QUESTIONS = Object.freeze([
  {
    id: 'q1',
    prompt: 'What does "LLM" stand for?',
    options: [
      { id: 0, label: 'Linear Learning Machine' },
      { id: 1, label: 'Large Language Model' },
      { id: 2, label: 'Logical Language Module' },
      { id: 3, label: 'Limited Learning Model' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q2',
    prompt: 'Which architecture powers most modern LLMs?',
    options: [
      { id: 0, label: 'Decision tree' },
      { id: 1, label: 'Perceptron only' },
      { id: 2, label: 'Transformer' },
      { id: 3, label: 'K-means' },
    ],
    correctOptionId: 2,
  },
  {
    id: 'q3',
    prompt: 'What is an AI "hallucination"?',
    options: [
      { id: 0, label: 'The model shutting down' },
      { id: 1, label: 'Confident output that is false or made up' },
      { id: 2, label: 'Slow response time' },
      { id: 3, label: 'Training on too much data' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q4',
    prompt: 'What does RAG stand for in AI?',
    options: [
      { id: 0, label: 'Random Answer Generation' },
      { id: 1, label: 'Rapid Algorithm Growth' },
      { id: 2, label: 'Retrieval-Augmented Generation' },
      { id: 3, label: 'Recursive Auto-Grading' },
    ],
    correctOptionId: 2,
  },
  {
    id: 'q5',
    prompt: 'What is a "prompt"?',
    options: [
      { id: 0, label: 'A software bug' },
      { id: 1, label: 'The input or instruction you give an AI model' },
      { id: 2, label: 'A type of dataset' },
      { id: 3, label: 'A GPU setting' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q6',
    prompt: 'In LLMs, what is a "token"?',
    options: [
      { id: 0, label: 'A login password' },
      { id: 1, label: 'A payment unit only' },
      { id: 2, label: 'A chunk of text (word or word piece) the model processes' },
      { id: 3, label: 'A neural network layer' },
    ],
    correctOptionId: 2,
  },
  {
    id: 'q7',
    prompt: 'What is "training data"?',
    options: [
      { id: 0, label: "The model's final answers" },
      { id: 1, label: 'Examples a model learns patterns from' },
      { id: 2, label: "The user's chat history only" },
      { id: 3, label: 'The hardware used for training' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q8',
    prompt: 'Which is good AI literacy practice?',
    options: [
      { id: 0, label: 'Trust every AI answer' },
      { id: 1, label: 'Never use AI' },
      { id: 2, label: 'Verify important AI outputs with reliable sources' },
      { id: 3, label: 'Share personal secrets with chatbots' },
    ],
    correctOptionId: 2,
  },
  {
    id: 'q9',
    prompt: 'What is "bias" in AI systems?',
    options: [
      { id: 0, label: 'A faster processor' },
      { id: 1, label: 'Systematic unfair outcomes often caused by skewed data' },
      { id: 2, label: "A model's file size" },
      { id: 3, label: 'A coding language' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q10',
    prompt: 'What is supervised learning?',
    options: [
      { id: 0, label: 'Learning with no data' },
      { id: 1, label: 'Learning from labeled examples' },
      { id: 2, label: 'A human watching the GPU' },
      { id: 3, label: 'Learning only from rewards' },
    ],
    correctOptionId: 1,
  },
]);

export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickQuizQuestions(count = 5, rng = Math.random) {
  const safeCount = Math.max(1, Math.min(count, QUIZ_QUESTIONS.length));
  return shuffle(QUIZ_QUESTIONS, rng)
    .slice(0, safeCount)
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: shuffle(question.options, rng),
    }));
}

export function getQuizQuestion(questionId) {
  return QUIZ_QUESTIONS.find((question) => question.id === questionId) || null;
}
