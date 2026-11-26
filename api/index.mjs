import handler from '../backend/src/serverless.js';

export default async function apiHandler(req, res) {
  return handler(req, res);
}
