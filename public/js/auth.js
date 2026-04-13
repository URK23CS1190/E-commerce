const API_BASE = window.location.origin;

async function recordLogin(email) {
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    console.log('Login tracked:', data);
    return data;
  } catch (error) {
    console.error('Login tracking failed:', error);
  }
}

async function recordLogout() {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST'
    });
  } catch (error) {
    console.error('Logout tracking failed:', error);
  }
}