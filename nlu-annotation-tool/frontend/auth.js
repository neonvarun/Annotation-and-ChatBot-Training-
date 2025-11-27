const API_BASE = 'http://127.0.0.1:5000';

document.getElementById('btn-register').addEventListener('click', async () => {
  const email = document.getElementById('reg-email').value || '';
  const password = document.getElementById('reg-password').value || '';
  if (!email || !password) return alert('Enter email and password');
  try {
    const resp = await fetch(API_BASE + '/api/auth/register', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password})
    });
    const data = await resp.json();
    if (resp.ok && data.token) {
      localStorage.setItem('nlu_token', data.token);
      window.location.href = 'workspace.html';
    } else {
      alert('Register error: ' + JSON.stringify(data));
    }
  } catch (err) { alert('Network: ' + err.message); }
});

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value || '';
  const password = document.getElementById('login-password').value || '';
  if (!email || !password) return alert('Enter email and password');
  try {
    const resp = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password})
    });
    const data = await resp.json();
    if (resp.ok && data.token) {
      localStorage.setItem('nlu_token', data.token);
      window.location.href = 'workspace.html';
    } else {
      alert('Login error: ' + JSON.stringify(data));
    }
  } catch (err) { alert('Network: ' + err.message); }
});
