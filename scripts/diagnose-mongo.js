/**
 * Diagnose MongoDB Atlas connectivity. Masks credentials in output.
 * Run: node scripts/diagnose-mongo.js
 */
const path = require("path");
const dns = require("dns").promises;
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function maskUri(uri) {
  if (!uri) return "(NOT SET)";
  return uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/,
    (_, scheme, user) => `${scheme}${user}:****@`
  );
}

function parseCredentials(uri) {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@/);
  if (!m) return null;
  return { user: m[1], pass: decodeURIComponent(m[2]) };
}

const uri = process.env.MONGODB_URI || "";
const creds = parseCredentials(uri);

console.log("=== 1. dotenv load (be/.env) ===");
console.log("MONGODB_URI loaded:", uri ? "YES" : "NO");
console.log("Masked URI:", maskUri(uri));
console.log("");

console.log("=== 2. URI format vs Atlas template ===");
const atlasSrv =
  "mongodb+srv://culturajoanahfaye_db_user:****@joanah.3wtbfp4.mongodb.net/?retryWrites=true&w=majority&appName=Joanah";
console.log("Atlas SRV template:", atlasSrv);
console.log("Current scheme:", uri.startsWith("mongodb+srv://") ? "mongodb+srv" : uri.startsWith("mongodb://") ? "mongodb (direct)" : "unknown");
console.log("Has joanah.3wtbfp4.mongodb.net:", uri.includes("joanah.3wtbfp4.mongodb.net") ? "YES" : "NO (using shard hostnames instead)");
console.log("Database in path:", uri.match(/\.mongodb\.net\/([^?]+)/)?.[1] || "(none)");
console.log("");

console.log("=== 3. Credentials ===");
if (creds) {
  console.log("Username:", creds.user);
  console.log("Expected username: culturajoanahfaye_db_user");
  console.log("Username match:", creds.user === "culturajoanahfaye_db_user" ? "YES" : "NO");
  const special = [...creds.pass].filter((c) => /[^A-Za-z0-9_-]/.test(c));
  console.log("Password length:", creds.pass.length);
  console.log(
    "URL-encoding needed:",
    special.length ? `YES (${special.map((c) => JSON.stringify(c)).join(", ")})` : "NO (alphanumeric only)"
  );
} else {
  console.log("Could not parse credentials from URI");
}
console.log("");

async function testDns() {
  console.log("=== 4. DNS / network ===");
  try {
    const records = await dns.resolveSrv("_mongodb._tcp.joanah.3wtbfp4.mongodb.net");
    console.log("SRV lookup (_mongodb._tcp.joanah.3wtbfp4.mongodb.net): OK,", records.length, "record(s)");
    records.slice(0, 3).forEach((r) => console.log("  -", r.name + ":" + r.port));
  } catch (e) {
    console.log("SRV lookup FAILED:", e.code || e.name, "-", e.message);
  }

  const host = "ac-0e3ufsq-shard-00-00.3wtbfp4.mongodb.net";
  try {
    const { address } = await dns.lookup(host);
    console.log("A record for shard host:", host, "->", address);
  } catch (e) {
    console.log("A record lookup FAILED:", e.message);
  }
  console.log("");
}

async function testConnect(label, testUri) {
  const mongoose = require("mongoose");
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 20_000 });
    console.log(label + ": SUCCESS — database:", mongoose.connection.name);
    await mongoose.disconnect();
    return true;
  } catch (err) {
    console.log(label + ": FAILED");
    console.log("  Error name:", err.name);
    console.log("  Message:", err.message);
    if (err.reason?.servers) {
      const servers = [...err.reason.servers.entries?.() || []];
      console.log("  Replica set servers discovered:", servers.length);
    }
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

async function main() {
  await testDns();

  console.log("=== 5. Connection tests ===");
  await testConnect("Current URI from .env", uri);

  if (creds) {
    const encoded = encodeURIComponent(creds.pass);
    const srvUri = `mongodb+srv://${creds.user}:${encoded}@joanah.3wtbfp4.mongodb.net/joanah?retryWrites=true&w=majority&appName=Joanah`;
    await testConnect("Atlas SRV (system DNS)", srvUri);

    const dns = require("dns");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("(retrying SRV with Google/Cloudflare DNS)");
    await testConnect("Atlas SRV (public DNS 8.8.8.8)", srvUri);

    const srvAdmin = `${srvUri}&authSource=admin`;
    await testConnect("Atlas SRV (public DNS, authSource=admin)", srvAdmin);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
