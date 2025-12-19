const fs = require("fs");
const p = "d:/SniperThink/Linkedin-Lead-Search/client/src/App.jsx";
let c = fs.readFileSync(p, "utf8");
if (c.includes("// Auto logout when JWT expires")) {
  console.log("Auto-logout already present");
  process.exit(0);
}
const insert = `\n  // Auto logout when JWT expires\n  const parseJwt = (token) => {\n    try {\n      const base64Url = token.split('.')[1];\n      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');\n      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));\n      return JSON.parse(jsonPayload);\n    } catch (e) {\n      return null;\n    }\n  };\n\n  useEffect(() => {\n    const token = localStorage.getItem('authToken');\n    if (!token) return;\n    const payload = parseJwt(token);\n    const expMs = payload?.exp ? payload.exp * 1000 : null;\n    if (!expMs) return;\n    if (expMs <= Date.now()) {\n      handleLogout();\n      setShowAuthModal(true);\n      return;\n    }\n    const timeout = expMs - Date.now() + 1000;\n    const id = setTimeout(() => {\n      handleLogout();\n      setShowAuthModal(true);\n    }, timeout);\n    return () => clearTimeout(id);\n  }, [isAuthenticated]);\n\n`;
// insert just before the first occurrence of "  return ("
const idx = c.indexOf("\n  return (");
if (idx === -1) {
  console.log("return statement not found");
  process.exit(1);
}
const updated = c.slice(0, idx) + insert + c.slice(idx);
fs.writeFileSync(p, updated, "utf8");
console.log("Inserted auto-logout useEffect");
