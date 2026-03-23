// API integration for Ledger backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getToken = () => sessionStorage.getItem('ledger_token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ─── Auth ──────────────────────────────────────────────────────────
export const loginUser = async (email, password) => {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  sessionStorage.setItem('ledger_token', data.token);
  return data.user;
};

export const registerUser = async (name, email, password) => {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  sessionStorage.setItem('ledger_token', data.token);
  return data.user;
};

export const logoutUser = () => {
  sessionStorage.removeItem('ledger_token');
};

// ─── Expenses ──────────────────────────────────────────────────────
export const getUserExpenses = async () => {
  const res = await fetch(`${API_URL}/api/expenses`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch expenses');
  return data;
};

export const addExpense = async (expenseData) => {
  const res = await fetch(`${API_URL}/api/expenses`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(expenseData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add expense');
  return data;
};

export const deleteExpense = async (expenseId) => {
  const res = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete expense');
  return data;
};

// Bulk-seed preloaded expenses for a newly registered user
export const seedExpenses = async (expenses) => {
  const res = await fetch(`${API_URL}/api/expenses/bulk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ expenses }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to seed expenses');
  return data;
};
