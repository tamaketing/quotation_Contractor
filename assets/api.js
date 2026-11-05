// API client for the Cloudflare D1 backend
const API = (function () {
  const TOKEN_KEY = 'quota_api_token';
  const USER_KEY = 'quota_api_user';

  function base() { return ''; } // same origin

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
  function setUser(u) { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); }

  async function request(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(base() + path, { ...opts, headers, signal: controller.signal });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = (data && data.error) || res.statusText || 'Request failed';
        throw new Error(msg);
      }
      return data;
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('เซิร์ฟเวอร์ใช้เวลานานกว่าปกติ ลองอีกครั้ง');
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    getToken, setToken, getUser, setUser,
    isLoggedIn() { return !!getToken(); },
    logout() { setToken(null); setUser(null); },
    register(email, password, companyName) {
      return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, companyName }) });
    },
    login(email, password) {
      return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },
    getProfile() { return request('/api/profile'); },
    updateProfile(data) { return request('/api/profile', { method: 'PUT', body: JSON.stringify(data) }); },
    forgotPassword(email) { return request('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }); },
    resetPassword(token, password) { return request('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }); },
    changePassword(currentPassword, newPassword) {
      return request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    },
    signOut(redirect) {
      setToken(null); setUser(null);
      try { window.location.replace(redirect || '/'); } catch { window.location.href = redirect || '/'; }
    },
    listDocs(type) { return request('/api/' + type); },
    getDoc(type, id) { return request('/api/' + type + '/' + encodeURIComponent(id)); },
    createDoc(type, data) { return request('/api/' + type, { method: 'POST', body: JSON.stringify(data) }); },
    updateDoc(type, id, data) { return request('/api/' + type + '/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) }); },
    deleteDoc(type, id) { return request('/api/' + type + '/' + encodeURIComponent(id), { method: 'DELETE' }); },
    nextDocNo(prefix, year) { return request('/api/docnum/next', { method: 'POST', body: JSON.stringify({ prefix, year }) }); },
    listCustomers() { return request('/api/customers'); },
    createCustomer(data) { return request('/api/customers', { method: 'POST', body: JSON.stringify(data) }); },
    updateCustomer(id, data) { return request('/api/customers/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) }); },
    deleteCustomer(id) { return request('/api/customers/' + encodeURIComponent(id), { method: 'DELETE' }); },
  };
})();
