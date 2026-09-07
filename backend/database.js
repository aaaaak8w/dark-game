const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "killzone.json");

const defaults = {
  users: [],
  rooms: [],
  tournaments: [],
  teams: [],
  transactions: [],
  withdrawals: [],
  topups: [],
  notifications: [],
  tickets: [],
  ticketMessages: [],
  news: [],
  ads: [],
  shop: [],
  invites: [],
  logs: [],
  matchCategories: [
    { id: "battle", name: "بتل رویال", icon: "🔥", enabled: true, order: 1 },
    { id: "multiplayer", name: "مولتی‌پلیر", icon: "⚔️", enabled: true, order: 2 },
    { id: "kill", name: "کیلی", icon: "🎯", enabled: true, order: 3 },
    { id: "free", name: "رایگان", icon: "🆓", enabled: true, order: 4 }
  ],
  settings: {
    appName: "DARK GAME",
    currency: "تومان",
    minTopup: 100000,
    maxTopup: 10000000,
    minWithdraw: 100000,
    maxWithdraw: 5000000,
    withdrawalCooldownHours: 24,
    ownerUserId: null,
    maintenance: false,
    gateway: {
      provider: "",
      merchantId: "",
      settlementCardMasked: "",
      settlementTokenRef: "",
      active: false
    }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDatabase() {
  let db;

  if (fs.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch {
      db = clone(defaults);
    }
  } else {
    db = clone(defaults);
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (db[key] === undefined) {
      db[key] = clone(value);
    }
  }

  for (const key of [
    "users",
    "rooms",
    "tournaments",
    "teams",
    "transactions",
    "withdrawals",
    "topups",
    "notifications",
    "tickets",
    "ticketMessages",
    "news",
    "ads",
    "shop",
    "invites",
    "logs",
    "matchCategories"
  ]) {
    if (!Array.isArray(db[key])) db[key] = [];
  }

  if (!db.settings || typeof db.settings !== "object") {
    db.settings = clone(defaults.settings);
  }

  for (const [key, value] of Object.entries(defaults.settings)) {
    if (db.settings[key] === undefined) {
      db.settings[key] = clone(value);
    }
  }

  if (!db.settings.gateway) {
    db.settings.gateway = clone(defaults.settings.gateway);
  }

  for (const user of db.users) {
    if (typeof user.gameBalance !== "number") user.gameBalance = 0;
    if (typeof user.withdrawableBalance !== "number") {
      user.withdrawableBalance = 0;
    }
    if (typeof user.balance !== "number") {
      user.balance = user.gameBalance + user.withdrawableBalance;
    }
    if (typeof user.xp !== "number") user.xp = 0;
    if (typeof user.level !== "number") user.level = 1;
    if (!user.role) user.role = "user";
    if (!Array.isArray(user.cards)) user.cards = [];
  }

  saveDatabase(db);
  return db;
}

function loadDatabase() {
  return ensureDatabase();
}

function saveDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

function id(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

module.exports = {
  dbPath,
  ensureDatabase,
  loadDatabase,
  saveDatabase,
  id
};
