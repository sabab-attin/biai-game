export const QUIZ_QUESTIONS = Object.freeze([
  {
    id: 'q1',
    category: 'Computer vision',
    prompt: 'An AI learns from cat pictures but never sees a dog. What might happen when shown a dog?',
    options: [
      { id: 0, label: 'Always recognizes it' },
      { id: 1, label: 'Might classify it as a cat' },
      { id: 2, label: 'Refuses to respond' },
      { id: 3, label: 'Generates a cat picture' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q2',
    category: 'Core concepts',
    prompt: 'An AI gives a confident but completely false answer. What is this called?',
    options: [
      { id: 0, label: 'Overfitting' },
      { id: 1, label: 'Hallucination' },
      { id: 2, label: 'Fine-tuning' },
      { id: 3, label: 'Training' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q3',
    category: 'Model scaling',
    prompt: 'Does an AI model with more parameters always perform better?',
    options: [
      { id: 0, label: 'Yes' },
      { id: 1, label: 'No, not necessarily' },
      { id: 2, label: 'Only with internet' },
      { id: 3, label: 'Only with a GPU' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q4',
    category: 'Recommendations',
    prompt: "Netflix notices you've started watching documentaries instead of action movies. What should its recommendation AI do?",
    options: [
      { id: 0, label: 'Keep suggesting action movies' },
      { id: 1, label: 'Adapt to your new interests' },
      { id: 2, label: 'Stop recommending movies' },
      { id: 3, label: 'Suggest random content' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q5',
    category: 'Generalization',
    prompt: 'An AI performs well in one hospital but poorly in another. What could be the reason?',
    options: [
      { id: 0, label: 'Different training and real-world data' },
      { id: 1, label: 'Slow internet' },
      { id: 2, label: 'Smaller computer screens' },
      { id: 3, label: 'Too many users' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q6',
    category: 'AI basics',
    prompt: 'What is the primary goal of Artificial Intelligence?',
    options: [
      { id: 0, label: 'Make computers physically smaller' },
      { id: 1, label: 'Enable machines to perform tasks that typically require human intelligence' },
      { id: 2, label: 'Increase internet speed' },
      { id: 3, label: 'Replace computer hardware' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q7',
    category: 'Machine learning',
    prompt: 'Which of the following best describes Machine Learning?',
    options: [
      { id: 0, label: 'Programming every possible outcome manually' },
      { id: 1, label: 'Teaching computers to learn patterns from data' },
      { id: 2, label: 'Making computers run faster' },
      { id: 3, label: 'Creating computer hardware' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q8',
    category: 'AI vs ML',
    prompt: 'What is the difference between AI and ML?',
    options: [
      { id: 0, label: 'They are exactly the same' },
      { id: 1, label: 'ML is a subset of AI' },
      { id: 2, label: 'AI is a subset of ML' },
      { id: 3, label: 'ML only works with images' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q9',
    category: 'Core concepts',
    prompt: 'What does LLM stand for?',
    options: [
      { id: 0, label: 'Large Language Model' },
      { id: 1, label: 'Logical Learning Machine' },
      { id: 2, label: 'Language Learning Mechanism' },
      { id: 3, label: 'Large Logic Machine' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q10',
    category: 'Computer vision',
    prompt: 'Which of these is an example of Computer Vision?',
    options: [
      { id: 0, label: 'Translating English into Bangla' },
      { id: 1, label: 'Recognizing faces in photographs' },
      { id: 2, label: 'Generating music from text' },
      { id: 3, label: 'Predicting stock prices from financial data' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q11',
    category: 'Neural networks',
    prompt: 'What is a neural network inspired by?',
    options: [
      { id: 0, label: 'The human brain' },
      { id: 1, label: 'The human digestive system' },
      { id: 2, label: 'The internet' },
      { id: 3, label: 'Computer hardware circuits' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q12',
    category: 'Model training',
    prompt: 'What is the purpose of training an AI model?',
    options: [
      { id: 0, label: 'To increase its file size' },
      { id: 1, label: 'To help it learn patterns from data' },
      { id: 2, label: 'To connect it to the internet' },
      { id: 3, label: 'To improve its screen resolution' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q13',
    category: 'Generative AI',
    prompt: 'Which of these is an example of Generative AI?',
    options: [
      { id: 0, label: 'A calculator solving 5 × 5' },
      { id: 1, label: 'An AI creating an image from a text prompt' },
      { id: 2, label: 'A traditional search engine displaying links' },
      { id: 3, label: 'A spreadsheet sorting numbers' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q14',
    category: 'NLP',
    prompt: 'What does NLP stand for?',
    options: [
      { id: 0, label: 'Natural Language Processing' },
      { id: 1, label: 'Neural Learning Program' },
      { id: 2, label: 'Network Language Protocol' },
      { id: 3, label: 'Numerical Logic Processing' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q15',
    category: 'Training data',
    prompt: 'What is a dataset in Machine Learning?',
    options: [
      { id: 0, label: 'A collection of data used for analysis or training' },
      { id: 1, label: 'A type of GPU' },
      { id: 2, label: 'A programming language' },
      { id: 3, label: 'A computer operating system' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q16',
    category: 'Core concepts',
    prompt: 'What is a hallucination in an LLM?',
    options: [
      { id: 0, label: 'When an AI generates convincing but factually incorrect information' },
      { id: 1, label: 'When an AI refuses to process text' },
      { id: 2, label: 'When an AI runs out of electricity' },
      { id: 3, label: 'When an AI learns a new language' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q17',
    category: 'Open models',
    prompt: 'Which of these is an open-source model family developed by Meta?',
    options: [
      { id: 0, label: 'Gemini' },
      { id: 1, label: 'Claude' },
      { id: 2, label: 'Llama' },
      { id: 3, label: 'GPT' },
    ],
    correctOptionId: 2,
  },
  {
    id: 'q18',
    category: 'AI hardware',
    prompt: 'What is the main purpose of a GPU in AI?',
    options: [
      { id: 0, label: 'Store large datasets permanently' },
      { id: 1, label: 'Perform parallel computations efficiently' },
      { id: 2, label: 'Connect AI models to the internet' },
      { id: 3, label: 'Replace the CPU completely' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q19',
    category: 'NLP',
    prompt: 'What does a chatbot use to understand and respond to human language?',
    options: [
      { id: 0, label: 'NLP' },
      { id: 1, label: 'Blockchain' },
      { id: 2, label: 'Computer Graphics' },
      { id: 3, label: 'Data Compression' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q20',
    category: 'Deep learning',
    prompt: 'What is Deep Learning?',
    options: [
      { id: 0, label: 'A method of storing data in multiple folders' },
      { id: 1, label: 'A branch of ML that uses multi-layer neural networks' },
      { id: 2, label: 'A technique for increasing internet speed' },
      { id: 3, label: 'A type of programming language' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q21',
    category: 'Prompting',
    prompt: 'What is a prompt in Generative AI?',
    options: [
      { id: 0, label: 'An instruction or input given to an AI model' },
      { id: 1, label: 'A type of neural network' },
      { id: 2, label: 'A training dataset' },
      { id: 3, label: 'A computer processor' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q22',
    category: 'Generative AI',
    prompt: 'Which of these is an AI-powered image-generation model?',
    options: [
      { id: 0, label: 'Stable Diffusion' },
      { id: 1, label: 'MySQL' },
      { id: 2, label: 'Linux' },
      { id: 3, label: 'Git' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q23',
    category: 'Recommendations',
    prompt: 'What is the purpose of a recommendation algorithm?',
    options: [
      { id: 0, label: 'To suggest relevant content based on user preferences or behavior' },
      { id: 1, label: 'To generate computer hardware' },
      { id: 2, label: 'To encrypt files' },
      { id: 3, label: 'To increase network bandwidth' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q24',
    category: 'Reinforcement learning',
    prompt: 'What is Reinforcement Learning primarily based on?',
    options: [
      { id: 0, label: 'Learning through rewards and penalties' },
      { id: 1, label: 'Memorizing a fixed dataset' },
      { id: 2, label: 'Translating languages' },
      { id: 3, label: 'Manually writing every rule' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q25',
    category: 'AI agents',
    prompt: 'What is an AI Agent?',
    options: [
      { id: 0, label: 'A computer that only stores information' },
      { id: 1, label: 'An AI system that can pursue goals, make decisions, and take actions' },
      { id: 2, label: 'A traditional database' },
      { id: 3, label: 'A computer virus that learns' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q26',
    category: 'Applied AI · Intermediate',
    prompt: 'What is RAG (Retrieval-Augmented Generation) used for?',
    options: [
      { id: 0, label: 'Making an AI model physically larger' },
      { id: 1, label: 'Allowing an LLM to retrieve external information before generating an answer' },
      { id: 2, label: 'Reducing the number of neural network layers' },
      { id: 3, label: 'Training a model without any data' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q27',
    category: 'Neural networks · Intermediate',
    prompt: 'What is the primary purpose of an activation function in a neural network?',
    options: [
      { id: 0, label: 'Introduce non-linearity into the network' },
      { id: 1, label: 'Store training data' },
      { id: 2, label: 'Reduce internet latency' },
      { id: 3, label: 'Convert text into images' },
    ],
    correctOptionId: 0,
  },
  {
    id: 'q28',
    category: 'Architectures · Intermediate',
    prompt: 'What makes the Transformer architecture particularly powerful for LLMs?',
    options: [
      { id: 0, label: 'It relies entirely on recurrent neural networks' },
      { id: 1, label: 'Its attention mechanism helps capture relationships between tokens' },
      { id: 2, label: 'It does not require training' },
      { id: 3, label: 'It can only process numerical data' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q29',
    category: 'Model evaluation · Intermediate',
    prompt: 'What happens when an ML model overfits its training data?',
    options: [
      { id: 0, label: 'It performs exceptionally well on all unseen data' },
      { id: 1, label: 'It memorizes training patterns and struggles to generalize to new data' },
      { id: 2, label: 'It stops learning entirely' },
      { id: 3, label: 'It automatically becomes a larger model' },
    ],
    correctOptionId: 1,
  },
  {
    id: 'q30',
    category: 'Fine-tuning · Intermediate',
    prompt: 'What is the purpose of fine-tuning a pretrained LLM?',
    options: [
      { id: 0, label: 'To train a model from scratch without existing knowledge' },
      { id: 1, label: 'To adapt an existing model to a particular task or domain' },
      { id: 2, label: 'To increase its internet connection speed' },
      { id: 3, label: 'To remove its neural network layers' },
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
      category: question.category,
      prompt: question.prompt,
      options: shuffle(question.options, rng),
    }));
}

export function getQuizQuestion(questionId) {
  return QUIZ_QUESTIONS.find((question) => question.id === questionId) || null;
}
