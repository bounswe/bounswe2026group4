let accessToken = null;
let refreshToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function getRefreshToken() {
  return refreshToken;
}

export function setRefreshToken(token) {
  refreshToken = token;
}

export function clear() {
  accessToken = null;
  refreshToken = null;
  window.dispatchEvent(new Event("auth:logout"));
}
