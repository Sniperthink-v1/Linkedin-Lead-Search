const fs = require("fs");
const p = "d:/SniperThink/Linkedin-Lead-Search/client/src/App.jsx";
let c = fs.readFileSync(p, "utf8");
const start = c.indexOf("const handleLogout = () =>");
if (start === -1) {
  console.log("handleLogout start not found");
  process.exit(0);
}
const after = c.indexOf("};", start);
if (after === -1) {
  console.log("handleLogout end not found");
  process.exit(0);
}
const oldBlock = c.slice(start, after + 2);
const newBlock = `const handleLogout = () => {
  setIsAuthenticated(false);
  setUser(null);
  setLeads([]);
  setSearched(false);
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  setShowAuthModal(true);
};`;
if (oldBlock === newBlock) {
  console.log("handleLogout already formatted");
  process.exit(0);
}
const updated = c.slice(0, start) + newBlock + c.slice(after + 2);
fs.writeFileSync(p, updated, "utf8");
console.log("handleLogout replaced");
