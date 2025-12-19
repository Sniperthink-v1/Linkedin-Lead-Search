const fs = require('fs');
const p = 'd:/SniperThink/Linkedin-Lead-Search/client/src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
const marker = 'const fetchUserData = async (token) => {';
const idx = c.indexOf(marker);
if (idx === -1) { console.log('fetchUserData not found'); process.exit(0); }
const start = idx;
const end = c.indexOf('};', start);
if (end === -1) { console.log('fetchUserData end not found'); process.exit(0); }
const block = c.slice(start, end+2);
if (block.includes('response.status === 401')) { console.log('fetchUserData already handles 401'); process.exit(0); }
const newBlock = `const fetchUserData = async (token) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      // Token expired or invalid - logout the user
      handleLogout();
      setShowAuthModal(true);
      return;
    }

    const data = await response.json();
    if (data.success) {
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
  } catch (error) {
    console.error("Failed to fetch user data:", error);
  }
};`;
const updated = c.slice(0, start) + newBlock + c.slice(end+2);
fs.writeFileSync(p, updated, 'utf8');
console.log('fetchUserData updated');
