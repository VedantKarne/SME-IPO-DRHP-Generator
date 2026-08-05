export const getToken = () => localStorage.getItem('nirmaan_token');
export const setToken = (t) => localStorage.setItem('nirmaan_token', t);
export const clearToken = () => localStorage.removeItem('nirmaan_token');

export const decodeToken = (t) => {
  try {
    return JSON.parse(atob(t.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const isTokenExpired = (t) => {
  const decoded = decodeToken(t);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
};

export const authedFetch = (url, opts = {}) => {
  // FormData bodies must NOT carry an explicit Content-Type — the browser needs
  // to set it itself so it can include the multipart boundary.
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;

  return fetch(url, {
    ...opts,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...opts.headers,
      Authorization: `Bearer ${getToken()}`
    }
  });
};
