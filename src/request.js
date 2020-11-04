import { version } from "../package.json";
import QueryCache from "./query_cache";

const cache = new QueryCache();

// enable to abort fetch
// https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
let controller = new AbortController();
let signal = null;
let active_requests = 0;

export function request(
  searchKey,
  apiEndpoint,
  path,
  params,
  cacheResponses,
  { additionalHeaders } = {}
) {
  const method = "POST";
  const key = cache.getKey(method, apiEndpoint + path, params);
  if (cacheResponses) {
    const cachedResult = cache.retrieve(key);
    if (cachedResult) {
      return Promise.resolve(cachedResult);
    }
  }

  return _request(method, searchKey, apiEndpoint, path, params, {
    additionalHeaders
  })
    .then(response => {
      active_requests = Math.max(0, --active_requests);
      return response
        .json()
        .then(json => {
          const result = { response: response, json: json };
          if (cacheResponses) cache.store(key, result);
          return result;
        })
        .catch(() => {
          return { response: response, json: {} };
        });
    })
    .catch(e => {
      // catch the aborted fetch, custom message prop
      return { response: { ok: false, message: "aborted" } };
    });
}

function _request(
  method,
  searchKey,
  apiEndpoint,
  path,
  params,
  { additionalHeaders } = {}
) {
  // abort previous fetch
  if (0 < active_requests && null !== signal) {
    controller.abort();
    controller = new AbortController();
  }
  signal = controller.signal;
  ++active_requests;

  const headers = new Headers({
    Authorization: `Bearer ${searchKey}`,
    "Content-Type": "application/json",
    "X-Swiftype-Client": "elastic-app-search-javascript",
    "X-Swiftype-Client-Version": version,
    ...additionalHeaders
  });

  return fetch(`${apiEndpoint}${path}`, {
    method,
    headers,
    body: JSON.stringify(params),
    credentials: "include",
    signal // allow to abort this fetch
  });
}
