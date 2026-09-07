const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const { loadDatabase, saveDatabase } = require("./database");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* =========================
   Helpers
========================= */

function now() {
  return new Date().toISOString();
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ")
    ? header.slice(7)
    : null;
}

function getUser(req, db) {
  const t = getBearer(req);
  if (!t) return null;

  return db.users.find(
    user => user.sessionToken === t
  ) || null;
}

function ensureDatabase(db) {
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.rooms)) db.rooms = [];
  if (!Array.isArray(db.tournaments)) db.tournaments = [];
  if (!Array.isArray(db.transactions)) db.transactions = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.wallets)) db.wallets = [];
  if (!Array.isArray(db.withdrawals)) db.withdrawals = [];
  if (!Array.isArray(db.teams)) db.teams = [];
  if (!Array.isArray(db.shop)) db.shop = [];
  if (!Array.isArray(db.news)) db.news = [];
  if (!Array.isArray(db.invites)) db.invites = [];
  if (!db.settings) db.settings = {};

  if (!db.settings.finance) {
    db.settings.finance = {
      minTopup: 100000,
      maxTopup: 10000000,
      minWithdraw: 100000,
      maxWithdraw: 5000000,
      withdrawalCooldownHours: 24
    };
  }
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    balance: user.balance || 0,
    gameBalance: user.gameBalance || 0,
    withdrawableBalance: user.withdrawableBalance || 0,
    xp: user.xp || 0,
    level: user.level || 1,
    role: user.role || "user",
    createdAt: user.createdAt
  };
}

function requireUser(req, res, db) {
  const user = getUser(req, db);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "ابتدا وارد حساب شوید"
    });
    return null;
  }

  return user;
}

function requireOwner(req, res, db) {
  const user = getUser(req, db);

  if (!user || user.role !== "owner") {
    res.status(403).json({
      success: false,
      message: "دسترسی فقط برای مالک برنامه است"
    });
    return null;
  }

  return user;
}

function createTransaction(db, data) {
  db.transactions.push({
    id: crypto.randomUUID(),
    createdAt: now(),
    ...data
  });
}

/* =========================
   Initialize DB
========================= */

const initialDb = loadDatabase();
ensureDatabase(initialDb);

for (const user of initialDb.users) {
  if (typeof user.balance !== "number") user.balance = 0;
  if (typeof user.gameBalance !== "number") user.gameBalance = 0;
  if (typeof user.withdrawableBalance !== "number") {
    user.withdrawableBalance = 0;
  }
  if (typeof user.xp !== "number") user.xp = 0;
  if (typeof user.level !== "number") user.level = 1;
}

saveDatabase(initialDb);

/* =========================
   Health
========================= */

app.get("/api/health", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  res.json({
    success: true,
    app: "KILL ZONE",
    status: "online",
    users: db.users.length,
    rooms: db.rooms.length,
    tournaments: db.tournaments.length,
    teams: db.teams.length
  });
});

/* =========================
   Authentication
========================= */

const otpStore = new Map();

app.post("/api/auth/request-otp", (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const username = String(req.body.username || "").trim();

  if (!phone || !username) {
    return res.status(400).json({
      success: false,
      message: "نام کاربری و شماره موبایل الزامی است"
    });
  }

  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  otpStore.set(phone, {
    code: otp,
    username,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  console.log(`[OTP] ${phone} => ${otp}`);

  res.json({
    success: true,
    message: "کد تأیید ایجاد شد"
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const code = String(req.body.code || "").trim();

  if (!phone || !code) {
    return res.status(400).json({
      success: false,
      message: "شماره موبایل و کد تأیید الزامی است"
    });
  }

  const saved = otpStore.get(phone);

  if (!saved) {
    return res.status(400).json({
      success: false,
      message: "کدی برای این شماره وجود ندارد"
    });
  }

  if (Date.now() > saved.expiresAt) {
    otpStore.delete(phone);

    return res.status(400).json({
      success: false,
      message: "کد تأیید منقضی شده است"
    });
  }

  if (code !== saved.code) {
    return res.status(400).json({
      success: false,
      message: "کد تأیید اشتباه است"
    });
  }

  const db = loadDatabase();
  ensureDatabase(db);

  let user = db.users.find(
    item => String(item.phone) === phone
  );

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      phone,
      name: saved.username,
      balance: 0,
      gameBalance: 0,
      withdrawableBalance: 0,
      xp: 0,
      level: 1,
      role: "user",
      createdAt: now()
    };

    db.users.push(user);
  } else {
    user.name = saved.username || user.name;
  }

  const sessionToken = token();

  user.sessionToken = sessionToken;
  user.lastLogin = now();

  saveDatabase(db);
  otpStore.delete(phone);

  res.json({
    success: true,
    message: "ورود با موفقیت انجام شد",
    token: sessionToken,
    user: publicUser(user)
  });
});

app.get("/api/auth/me", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  const user = requireUser(req, res, db);
  if (!user) return;

  res.json({
    success: true,
    user: publicUser(user)
  });
});

app.post("/api/auth/logout", (req, res) => {
  const db = loadDatabase();
  const user = getUser(req, db);

  if (user) {
    user.sessionToken = null;
    saveDatabase(db);
  }

  res.json({
    success: true,
    message: "خروج انجام شد"
  });
});

/* =========================
   User Profile
========================= */

app.get("/api/profile", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  res.json({
    success: true,
    user: publicUser(user)
  });
});

app.put("/api/profile", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  if (req.body.name) {
    user.name = String(req.body.name).trim();
  }

  saveDatabase(db);

  res.json({
    success: true,
    user: publicUser(user)
  });
});

/* =========================
   Rooms
========================= */

app.get("/api/rooms", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  const status = req.query.status;

  let rooms = db.rooms;

  if (status) {
    rooms = rooms.filter(
      room => room.status === status
    );
  }

  res.json({
    success: true,
    rooms
  });
});

app.get("/api/rooms/:id", (req, res) => {
  const db = loadDatabase();

  const room = db.rooms.find(
    item => item.id === req.params.id
  );

  if (!room) {
    return res.status(404).json({
      success: false,
      message: "مسابقه پیدا نشد"
    });
  }

  res.json({
    success: true,
    room
  });
});

app.post("/api/rooms/:id/join", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const room = db.rooms.find(
    item => item.id === req.params.id
  );

  if (!room) {
    return res.status(404).json({
      success: false,
      message: "مسابقه پیدا نشد"
    });
  }

  if (!Array.isArray(room.players)) {
    room.players = [];
  }

  if (
    room.capacity &&
    room.players.length >= room.capacity
  ) {
    return res.status(400).json({
      success: false,
      message: "ظرفیت مسابقه تکمیل است"
    });
  }

  if (
    room.players.some(
      player => player.userId === user.id
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "شما قبلاً وارد این مسابقه شده‌اید"
    });
  }

  const entryFee = Number(room.entryFee || 0);

  if (entryFee > 0) {
    if (user.gameBalance < entryFee) {
      return res.status(400).json({
        success: false,
        message: "موجودی قابل استفاده برای ورود کافی نیست"
      });
    }

    user.gameBalance -= entryFee;

    createTransaction(db, {
      userId: user.id,
      type: "ROOM_ENTRY",
      amount: -entryFee,
      balanceType: "GAME_BALANCE",
      roomId: room.id,
      description: "هزینه ورود به مسابقه"
    });
  }

  room.players.push({
    userId: user.id,
    name: user.name,
    joinedAt: now()
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: "با موفقیت وارد مسابقه شدید",
    user: publicUser(user),
    room
  });
});

/* =========================
   Tournaments
========================= */

app.get("/api/tournaments", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  res.json({
    success: true,
    tournaments: db.tournaments
  });
});

app.get("/api/tournaments/:id", (req, res) => {
  const db = loadDatabase();

  const tournament = db.tournaments.find(
    item => item.id === req.params.id
  );

  if (!tournament) {
    return res.status(404).json({
      success: false,
      message: "تورنمنت پیدا نشد"
    });
  }

  res.json({
    success: true,
    tournament
  });
});

/* =========================
   Teams
========================= */

app.get("/api/teams", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  res.json({
    success: true,
    teams: db.teams
  });
});

app.post("/api/teams", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const name = String(req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "نام تیم الزامی است"
    });
  }

  const team = {
    id: crypto.randomUUID(),
    name,
    ownerId: user.id,
    members: [user.id],
    createdAt: now()
  };

  db.teams.push(team);
  saveDatabase(db);

  res.json({
    success: true,
    message: "تیم ایجاد شد",
    team
  });
});

/* =========================
   Wallet
========================= */

app.get("/api/wallet", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const finance = db.settings.finance;

  res.json({
    success: true,
    wallet: {
      totalBalance:
        (user.gameBalance || 0) +
        (user.withdrawableBalance || 0),

      gameBalance: user.gameBalance || 0,

      withdrawableBalance:
        user.withdrawableBalance || 0
    },
    limits: finance
  });
});

/* =========================
   Top Up
========================= */

app.post("/api/wallet/topup", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const amount = Number(req.body.amount);
  const finance = db.settings.finance;

  if (!Number.isInteger(amount)) {
    return res.status(400).json({
      success: false,
      message: "مبلغ نامعتبر است"
    });
  }

  if (
    amount < finance.minTopup ||
    amount > finance.maxTopup
  ) {
    return res.status(400).json({
      success: false,
      message:
        `مبلغ شارژ باید بین ${finance.minTopup.toLocaleString()} و ${finance.maxTopup.toLocaleString()} تومان باشد`
    });
  }

  const payment = {
    id: crypto.randomUUID(),
    userId: user.id,
    amount,
    status: "pending",
    type: "TOPUP",
    createdAt: now()
  };

  db.wallets.push(payment);

  saveDatabase(db);

  res.json({
    success: true,
    message: "درخواست پرداخت ایجاد شد",
    payment
  });
});

/* =========================
   Manual Reward
   قابل استفاده برای بازی
   غیرقابل برداشت
========================= */

app.post("/api/owner/users/:id/reward", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const amount = Number(req.body.amount);
  const description =
    String(req.body.description || "پاداش دستی");

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "مبلغ پاداش نامعتبر است"
    });
  }

  const user = db.users.find(
    item => item.id === req.params.id
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "کاربر پیدا نشد"
    });
  }

  if (typeof user.gameBalance !== "number") {
    user.gameBalance = 0;
  }

  user.gameBalance += amount;

  createTransaction(db, {
    userId: user.id,
    type: "MANUAL_REWARD",
    amount,
    balanceType: "GAME_BALANCE",
    description,
    createdBy: owner.id
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: "پاداش با موفقیت اضافه شد",
    user: publicUser(user)
  });
});

/* =========================
   Withdraw
========================= */

app.post("/api/wallet/withdraw", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const amount = Number(req.body.amount);
  const destination =
    String(req.body.destination || "").trim();

  const finance = db.settings.finance;

  if (!Number.isInteger(amount)) {
    return res.status(400).json({
      success: false,
      message: "مبلغ نامعتبر است"
    });
  }

  if (
    amount < finance.minWithdraw ||
    amount > finance.maxWithdraw
  ) {
    return res.status(400).json({
      success: false,
      message:
        `مبلغ برداشت باید بین ${finance.minWithdraw.toLocaleString()} و ${finance.maxWithdraw.toLocaleString()} تومان باشد`
    });
  }

  if (!destination) {
    return res.status(400).json({
      success: false,
      message: "مقصد پرداخت الزامی است"
    });
  }

  if (
    Number(user.withdrawableBalance || 0) < amount
  ) {
    return res.status(400).json({
      success: false,
      message: "موجودی قابل برداشت کافی نیست"
    });
  }

  const lastWithdrawal = db.withdrawals
    .filter(item => item.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )[0];

  if (lastWithdrawal) {
    const elapsed =
      Date.now() -
      new Date(lastWithdrawal.createdAt).getTime();

    const cooldown =
      finance.withdrawalCooldownHours *
      60 *
      60 *
      1000;

    if (elapsed < cooldown) {
      const remaining =
        cooldown - elapsed;

      const hours = Math.ceil(
        remaining / (60 * 60 * 1000)
      );

      return res.status(400).json({
        success: false,
        message:
          `هر ۲۴ ساعت فقط یک درخواست برداشت مجاز است. حدود ${hours} ساعت باقی مانده است.`
      });
    }
  }

  user.withdrawableBalance -= amount;

  const withdrawal = {
    id: crypto.randomUUID(),
    userId: user.id,
    amount,
    destination,
    status: "pending",
    createdAt: now()
  };

  db.withdrawals.push(withdrawal);

  createTransaction(db, {
    userId: user.id,
    type: "WITHDRAW_REQUEST",
    amount: -amount,
    balanceType: "WITHDRAWABLE_BALANCE",
    description: "درخواست برداشت",
    withdrawalId: withdrawal.id
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: "درخواست برداشت ثبت شد",
    withdrawal,
    user: publicUser(user)
  });
});

/* =========================
   Transactions
========================= */

app.get("/api/wallet/transactions", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const transactions = db.transactions
    .filter(item => item.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json({
    success: true,
    transactions
  });
});

/* =========================
   User Withdrawals
========================= */

app.get("/api/wallet/withdrawals", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const withdrawals = db.withdrawals
    .filter(item => item.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json({
    success: true,
    withdrawals
  });
});

/* =========================
   News
========================= */

app.get("/api/news", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  res.json({
    success: true,
    news: db.news
  });
});

/* =========================
   Shop
========================= */

app.get("/api/shop", (req, res) => {
  const db = loadDatabase();
  ensureDatabase(db);

  res.json({
    success: true,
    items: db.shop
  });
});

/* =========================
   Notifications
========================= */

app.get("/api/notifications", (req, res) => {
  const db = loadDatabase();
  const user = requireUser(req, res, db);
  if (!user) return;

  const notifications = db.notifications
    .filter(
      item =>
        item.userId === user.id ||
        item.userId === "all"
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json({
    success: true,
    notifications
  });
});

/* =========================
   Owner Dashboard
========================= */

app.get("/api/owner/dashboard", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const pendingWithdrawals =
    db.withdrawals.filter(
      item => item.status === "pending"
    );

  const pendingPayments =
    db.wallets.filter(
      item => item.status === "pending"
    );

  const totalGameBalance =
    db.users.reduce(
      (sum, user) =>
        sum + Number(user.gameBalance || 0),
      0
    );

  const totalWithdrawableBalance =
    db.users.reduce(
      (sum, user) =>
        sum +
        Number(user.withdrawableBalance || 0),
      0
    );

  res.json({
    success: true,

    stats: {
      users: db.users.length,
      rooms: db.rooms.length,
      tournaments: db.tournaments.length,
      teams: db.teams.length,
      transactions: db.transactions.length,
      pendingWithdrawals:
        pendingWithdrawals.length,
      pendingPayments:
        pendingPayments.length,
      totalGameBalance,
      totalWithdrawableBalance
    }
  });
});

/* =========================
   Owner Users
========================= */

app.get("/api/owner/users", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  res.json({
    success: true,
    users: db.users.map(publicUser)
  });
});

/* =========================
   Owner Withdrawals
========================= */

app.get("/api/owner/withdrawals", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  res.json({
    success: true,
    withdrawals: db.withdrawals
  });
});

app.post("/api/owner/withdrawals/:id/status", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const withdrawal = db.withdrawals.find(
    item => item.id === req.params.id
  );

  if (!withdrawal) {
    return res.status(404).json({
      success: false,
      message: "درخواست برداشت پیدا نشد"
    });
  }

  const status = String(req.body.status || "");

  if (
    !["approved", "rejected", "paid"].includes(status)
  ) {
    return res.status(400).json({
      success: false,
      message: "وضعیت نامعتبر است"
    });
  }

  if (
    withdrawal.status === "pending" &&
    status === "rejected"
  ) {
    const user = db.users.find(
      item => item.id === withdrawal.userId
    );

    if (user) {
      user.withdrawableBalance =
        Number(user.withdrawableBalance || 0) +
        Number(withdrawal.amount || 0);

      createTransaction(db, {
        userId: user.id,
        type: "WITHDRAW_REFUND",
        amount: withdrawal.amount,
        balanceType: "WITHDRAWABLE_BALANCE",
        description: "بازگشت مبلغ درخواست برداشت",
        withdrawalId: withdrawal.id,
        createdBy: owner.id
      });
    }
  }

  withdrawal.status = status;
  withdrawal.updatedAt = now();
  withdrawal.updatedBy = owner.id;

  saveDatabase(db);

  res.json({
    success: true,
    message: "وضعیت برداشت به‌روزرسانی شد",
    withdrawal
  });
});

/* =========================
   Owner Finance Settings
========================= */

app.get("/api/owner/finance/settings", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  res.json({
    success: true,
    finance: db.settings.finance
  });
});

app.put("/api/owner/finance/settings", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const finance = db.settings.finance;

  const fields = [
    "minTopup",
    "maxTopup",
    "minWithdraw",
    "maxWithdraw",
    "withdrawalCooldownHours"
  ];

  for (const field of fields) {
    if (
      req.body[field] !== undefined
    ) {
      const value = Number(req.body[field]);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          message: `مقدار ${field} نامعتبر است`
        });
      }

      finance[field] = value;
    }
  }

  saveDatabase(db);

  res.json({
    success: true,
    message: "تنظیمات مالی ذخیره شد",
    finance
  });
});

/* =========================
   Owner Rooms
========================= */

app.post("/api/owner/rooms", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const room = {
    id: crypto.randomUUID(),
    title: String(req.body.title || "مسابقه جدید"),
    game: String(req.body.game || "Call of Duty Mobile"),
    mode: String(req.body.mode || "Multiplayer"),
    entryFee: Number(req.body.entryFee || 0),
    prize: Number(req.body.prize || 0),
    capacity: Number(req.body.capacity || 2),
    players: [],
    status: "open",
    createdAt: now(),
    createdBy: owner.id
  };

  db.rooms.push(room);
  saveDatabase(db);

  res.json({
    success: true,
    message: "مسابقه ایجاد شد",
    room
  });
});

app.delete("/api/owner/rooms/:id", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const index = db.rooms.findIndex(
    item => item.id === req.params.id
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "مسابقه پیدا نشد"
    });
  }

  db.rooms.splice(index, 1);
  saveDatabase(db);

  res.json({
    success: true,
    message: "مسابقه حذف شد"
  });
});

/* =========================
   Owner Tournaments
========================= */

app.post("/api/owner/tournaments", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const tournament = {
    id: crypto.randomUUID(),
    title: String(req.body.title || "تورنمنت جدید"),
    game: String(req.body.game || "Call of Duty Mobile"),
    entryFee: Number(req.body.entryFee || 0),
    prize: Number(req.body.prize || 0),
    capacity: Number(req.body.capacity || 16),
    status: "open",
    players: [],
    createdAt: now(),
    createdBy: owner.id
  };

  db.tournaments.push(tournament);
  saveDatabase(db);

  res.json({
    success: true,
    message: "تورنمنت ایجاد شد",
    tournament
  });
});

/* =========================
   Owner News
========================= */

app.post("/api/owner/news", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const news = {
    id: crypto.randomUUID(),
    title: String(req.body.title || ""),
    text: String(req.body.text || ""),
    image: String(req.body.image || ""),
    createdAt: now(),
    createdBy: owner.id
  };

  if (!news.title) {
    return res.status(400).json({
      success: false,
      message: "عنوان خبر الزامی است"
    });
  }

  db.news.push(news);
  saveDatabase(db);

  res.json({
    success: true,
    message: "خبر ایجاد شد",
    news
  });
});

/* =========================
   Owner Notifications
========================= */

app.post("/api/owner/notifications", (req, res) => {
  const db = loadDatabase();

  const owner = requireOwner(req, res, db);
  if (!owner) return;

  const notification = {
    id: crypto.randomUUID(),
    userId: String(req.body.userId || "all"),
    title: String(req.body.title || "KILL ZONE"),
    text: String(req.body.text || ""),
    createdAt: now(),
    createdBy: owner.id
  };

  db.notifications.push(notification);
  saveDatabase(db);

  res.json({
    success: true,
    message: "اعلان ارسال شد",
    notification
  });
});

/* =========================
   404 API
========================= */


// =========================
// DYNAMIC MATCH CATEGORIES
// =========================

function ensureMatchCategories(db) {
  if (!Array.isArray(db.matchCategories)) {
    db.matchCategories = [
      {
        id: "battle",
        name: "بتل",
        icon: "🔥",
        description: "مسابقات بتل رویال",
        enabled: true,
        sortOrder: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: "free",
        name: "رایگان",
        icon: "🆓",
        description: "روم‌های رایگان",
        enabled: true,
        sortOrder: 2,
        createdAt: new Date().toISOString()
      },
      {
        id: "kill",
        name: "کیلی",
        icon: "🎯",
        description: "مسابقات کیل",
        enabled: true,
        sortOrder: 3,
        createdAt: new Date().toISOString()
      },
      {
        id: "multiplayer",
        name: "مولتی‌پلیر",
        icon: "⚔️",
        description: "مسابقات مولتی‌پلیر",
        enabled: true,
        sortOrder: 4,
        createdAt: new Date().toISOString()
      }
    ];

    saveDatabase(db);
  }
}

// عمومی: دسته‌های فعال
app.get("/api/match-categories", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const categories = db.matchCategories
      .filter(c => c.enabled !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: همه دسته‌ها
app.get("/api/owner/match-categories", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    res.json({
      success: true,
      categories: [...db.matchCategories].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
      )
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: افزودن بخش
app.post("/api/owner/match-categories", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "نام بخش الزامی است"
      });
    }

    const maxOrder = db.matchCategories.reduce(
      (max, c) => Math.max(max, Number(c.sortOrder) || 0),
      0
    );

    const category = {
      id: "cat_" + Date.now().toString(36),
      name,
      icon: String(req.body.icon || "🎮"),
      description: String(req.body.description || ""),
      enabled: req.body.enabled !== false,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString()
    };

    db.matchCategories.push(category);
    saveDatabase(db);

    res.json({
      success: true,
      message: "بخش جدید اضافه شد",
      category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: ویرایش بخش
app.put("/api/owner/match-categories/:id", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const category = db.matchCategories.find(
      c => c.id === req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "بخش پیدا نشد"
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "نام بخش نمی‌تواند خالی باشد"
        });
      }

      category.name = name;
    }

    if (req.body.icon !== undefined)
      category.icon = String(req.body.icon || "🎮");

    if (req.body.description !== undefined)
      category.description = String(req.body.description || "");

    if (req.body.enabled !== undefined)
      category.enabled = Boolean(req.body.enabled);

    if (req.body.sortOrder !== undefined)
      category.sortOrder = Number(req.body.sortOrder);

    category.updatedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      message: "بخش ویرایش شد",
      category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: حذف بخش
app.delete("/api/owner/match-categories/:id", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const index = db.matchCategories.findIndex(
      c => c.id === req.params.id
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "بخش پیدا نشد"
      });
    }

    const removed = db.matchCategories.splice(index, 1)[0];

    saveDatabase(db);

    res.json({
      success: true,
      message: "بخش حذف شد",
      category: removed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: فعال / غیرفعال
app.patch("/api/owner/match-categories/:id/toggle", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const category = db.matchCategories.find(
      c => c.id === req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "بخش پیدا نشد"
      });
    }

    category.enabled = category.enabled === false;
    category.updatedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      message: category.enabled ? "بخش فعال شد" : "بخش غیرفعال شد",
      category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// مالک: تغییر ترتیب
app.post("/api/owner/match-categories/reorder", (req, res) => {
  try {
    const db = loadDatabase();
    ensureMatchCategories(db);

    const order = Array.isArray(req.body.order)
      ? req.body.order
      : [];

    order.forEach((id, index) => {
      const category = db.matchCategories.find(c => c.id === id);

      if (category) {
        category.sortOrder = index + 1;
      }
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: "ترتیب بخش‌ها ذخیره شد",
      categories: [...db.matchCategories].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
      )
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API موردنظر پیدا نشد"
  });
});

/* =========================
   Frontend
========================= */

app.use(
  express.static(
    "/storage/emulated/0/KILL ZONE/frontend"
  )
);

/* =========================
   Start
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `KILL ZONE Backend running on http://127.0.0.1:${PORT}`
  );
});
