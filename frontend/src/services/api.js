// API Client for Sokxay Lao Lottery Backend
const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) 
  ? `${window.location.origin}/api/v1` 
  : 'http://localhost:8080/api/v1';


class ApiService {
  constructor() {
    this.token = localStorage.getItem('sokxay_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('sokxay_token', token);
    } else {
      localStorage.removeItem('sokxay_token');
    }
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    try {
      const resp = await fetch(url, config);
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.detail || `Request failed with status ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      console.warn(`API call failed for ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth
  async login(phone, pin) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_number: phone, pin })
    });
    this.setToken(res.access_token);
    return res;
  }

  async register(phone, fullName, pin, referralCode = null) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: phone,
        full_name: fullName,
        pin,
        referral_code: referralCode
      })
    });
    this.setToken(res.access_token);
    return res;
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Lottery
  async getAnimals() {
    return this.request('/lottery/animals');
  }

  async getDraws() {
    return this.request('/lottery/draws');
  }

  async quickPick(digits = 2) {
    return this.request(`/lottery/quick-pick?digits=${digits}`);
  }

  async buyTicket(periodId, items) {
    return this.request('/lottery/buy', {
      method: 'POST',
      body: JSON.stringify({
        period_id: periodId,
        items,
        payment_method: 'WALLET'
      })
    });
  }

  async getUserTickets() {
    return this.request('/lottery/tickets');
  }

  async getTicketDetail(ticketId) {
    return this.request(`/lottery/tickets/${ticketId}`);
  }

  async submitDrawResult(periodId, winning6Digits, winningAnimalId = null) {
    return this.request('/lottery/draws/draw-result', {
      method: 'POST',
      body: JSON.stringify({
        period_id: periodId,
        winning_number_6: winning6Digits,
        winning_animal_id: winningAnimalId
      })
    });
  }

  // Finance
  async getWallet() {
    return this.request('/finance/wallet');
  }

  async createOnePayQR(amount, description = 'Lottery Top-up') {
    return this.request('/finance/onepay/create-qr', {
      method: 'POST',
      body: JSON.stringify({ amount, description })
    });
  }

  async confirmOnePayTopup(paymentRef, amount) {
    return this.request('/finance/onepay/confirm', {
      method: 'POST',
      body: JSON.stringify({ payment_ref: paymentRef, amount })
    });
  }

  async getStatement() {
    return this.request('/finance/statement');
  }
}

export const api = new ApiService();
