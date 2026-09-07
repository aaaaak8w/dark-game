const crypto = require("crypto");
const { loadDatabase, saveDatabase } = require("./database");

function createOwnerSession() {
  const db = loadDatabase();

  if (!db.settings.owner) {
    throw new Error("Owner structure not found");
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");

  db.settings.owner.sessionToken = sessionToken;
  db.settings.owner.authenticated = true;
  db.settings.owner.lastLogin = new Date().toISOString();

  saveDatabase(db);

  return sessionToken;
}

function isOwnerAuthenticated(token) {
  const db = loadDatabase();

  return Boolean(
    token &&
    db.settings.owner &&
    db.settings.owner.authenticated === true &&
    db.settings.owner.sessionToken === token
  );
}

function logoutOwner() {
  const db = loadDatabase();

  if (db.settings.owner) {
    db.settings.owner.sessionToken = null;
    db.settings.owner.authenticated = false;
  }

  saveDatabase(db);
}

module.exports = {
  createOwnerSession,
  isOwnerAuthenticated,
  logoutOwner
};
