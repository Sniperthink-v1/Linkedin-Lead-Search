const fs = require("fs");
const p = "d:/SniperThink/Linkedin-Lead-Search/client/src/App.jsx";
let c = fs.readFileSync(p, "utf8");
const marker = "const fetchUserData = async (token) => {";
const idx = c.indexOf(marker);
if (idx === -1) {
  console.log("fetchUserData not found");
  process.exit(0);
}
const start = idx;
const end = c.indexOf("};", start);
if (end === -1) {
  console.log("fetchUserData end not found");
  process.exit(0);
}
const block = c.slice(start, end + 2);
if (block.includes("response.status === 401")) {
  console.log("fetchUserData already handles 401");
  process.exit(0);
}
const newBlock =
  'const fetchUserData = async (token) => {\n  try {\n    const response = await fetch(API_URL + \'/api/auth/me\', {\n      headers: {\n        Authorization: `Bearer ${token}`,\n      },\n    });\n\n    if (response.status === 401) {\n      // Token expired or invalid - logout the user\n      handleLogout();\n      setShowAuthModal(true);\n      return;\n    }\n\n    const data = await response.json();\n    if (data.success) {\n      setUser(data.user);\n      localStorage.setItem("user", JSON.stringify(data.user));\n    }\n  } catch (error) {\n    console.error("Failed to fetch user data:", error);\n  }\n};';
const updated = c.slice(0, start) + newBlock + c.slice(end + 2);
fs.writeFileSync(p, updated, "utf8");
console.log("fetchUserData updated");
