import { handleRequest } from '../server/index.js';

export function createRouteHandler(pathname) {
  return async function routeHandler(req, res) {
    const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${pathname}${query}`;
    return handleRequest(req, res);
  };
}
