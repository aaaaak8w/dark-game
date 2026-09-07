const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const {
  loadDatabase,
  saveDatabase,
  id
} = require("./database");

const app = express();
const PORT = 3000;
const FRONTEND = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const otpStore = new Map();

function now() {
  return new Date().toISOString();
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    level: user.level || 1,
    xp: user.xp || 0,
    gameBalance: user.gameBalance || 0,
    withdrawableBalance: user.withdrawableBalance || 0,
    balance:
      (user.gameBalance || 0) +
      (user.withdrawableBalance || 0),
    createdAt: user.createdAt
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!bearer) {
    return res.status(401).json({
      success: false,
      message: "نیاز به ورود دارید"
    });
  }

  const db = loadDatabase();

  const user = db.users.find(
    u => u.sessionToken === bearer
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "نشست شما منقضی شده است"
    });
  }

  req.user = user;
  req.db = db;
  next();
}

function owner(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "فقط مالک برنامه به این بخش دسترسی دارد"
      });
    }

    next();
  });
}

function finance(req, res, next) {
  auth(req, res, () => {
    if (
      !["owner", "finance_manager"].includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "دسترسی بخش مالی ندارید"
      });
    }

    next();
  });
}

function admin(req, res, next) {
  auth(req, res, () => {
    if (!["owner", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "دسترسی مدیریتی ندارید"
      });
    }

    next();
  });
}

function log(db, userId, action, meta = {}) {
  db.logs.push({
    id: id("log"),
    userId,
    action,
    meta,
    createdAt: now()
  });

  if (db.logs.length > 5000) {
    db.logs = db.logs.slice(-5000);
  }
}

function syncBalance(user) {
  user.gameBalance = Number(user.gameBalance || 0);
  user.withdrawableBalance =
    Number(user.withdrawableBalance || 0);

  user.balance =
    user.gameBalance +
    user.withdrawableBalance;
}

function transaction(
  db,
  userId,
  type,
  amount,
  balanceType,
  description
) {
  db.transactions.push({
    id: id("txn"),
    userId,
    type,
    amount,
    balanceType,
    description,
    createdAt: now()
  });
}

function levelFromXp(xp) {
  return Math.max(
    1,
    Math.floor(Number(xp || 0) / 1000) + 1
  );
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    app: "KILL ZONE",
    status: "online",
    time: now()
  });
});

/* ================= AUTH ================= */

app.post("/api/auth/request-otp", (req, res) => {
  let phone = String(req.body.phone || "").trim();

  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("98")) phone = "0" + phone.slice(2);

  if (!/^0?9[0-9]{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "شماره موبایل معتبر نیست"
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
console.log(`\\n[KILL ZONE OTP] شماره: ${phone} | کد ورود: ${code}\\n`);

  otpStore.set(phone, {
    code,
    expires: Date.now() + 120000
  });

  console.log("");
  console.log("================================");
  console.log("[KILL ZONE OTP]");
  console.log("Phone:", phone);
  console.log("CODE :", code);
  console.log("Valid: 120 seconds");
  console.log("================================");
  console.log("");

  res.json({
    success: true,
    message: "کد تأیید ارسال شد",
    developmentCode: code
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  let phone = String(req.body.phone || "").trim();

  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("98")) phone = "0" + phone.slice(2);

  const code = String(req.body.code || "").trim();

  console.log(`[KILL ZONE VERIFY] phone=${phone} code=${code}`);

  const saved = otpStore.get(phone);

  if (!saved) {
    return res.status(400).json({
      success: false,
      message: "برای این شماره کد فعالی وجود ندارد؛ دوباره درخواست کد کنید"
    });
  }

  if (saved.expires < Date.now()) {
    otpStore.delete(phone);
    return res.status(400).json({
      success: false,
      message: "کد منقضی شده است؛ دوباره درخواست کد کنید"
    });
  }

  if (saved.code !== code) {
    console.log(`[KILL ZONE OTP ERROR] expected=${saved.code} received=${code}`);
    return res.status(400).json({
      success: false,
      message: "کد تأیید اشتباه است"
    });
  }

  otpStore.delete(phone);

  const db = loadDatabase();

  let user = db.users.find(
    u => String(u.phone) === phone
  );

  if (!user) {
    user = {
      id: id("user"),
      phone,
      name: `کاربر ${phone.slice(-4)}`,
      role: "user",
      gameBalance: 0,
      withdrawableBalance: 0,
      balance: 0,
      xp: 0,
      level: 1,
      createdAt: now()
    };

    db.users.push(user);
  }

  user.sessionToken = token();
  user.lastLogin = now();

  saveDatabase(db);

  res.json({
    success: true,
    message: "ورود موفق بود",
    token: user.sessionToken,
    user: publicUser(user)
  });
});

/* ================= PROFILE ================= */

app.put("/api/me/profile", auth, (req, res) => {
  const name = String(req.body.name || "").trim();

  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({
      success: false,
      message: "نام باید بین ۲ تا ۴۰ کاراکتر باشد"
    });
  }

  req.user.name = name;
  saveDatabase(req.db);

  res.json({
    success: true,
    user: publicUser(req.user)
  });
});

app.post("/api/me/mobile/request", auth, (req, res) => {
  const newPhone = String(
    req.body.newPhone || ""
  ).trim();

  if (!/^[0-9]{8,15}$/.test(newPhone)) {
    return res.status(400).json({
      success: false,
      message: "شماره جدید معتبر نیست"
    });
  }

  const exists = req.db.users.some(
    u =>
      String(u.phone) === newPhone &&
      u.id !== req.user.id
  );

  if (exists) {
    return res.status(400).json({
      success: false,
      message: "این شماره قبلاً ثبت شده است"
    });
  }

  const code = "123456";

  otpStore.set(`change:${req.user.id}`, {
    code,
    newPhone,
    expires: Date.now() + 120000
  });

  console.log(
    `[KILL ZONE MOBILE CHANGE OTP] ${newPhone}: ${code}`
  );

  res.json({
    success: true,
    message: "کد تغییر شماره ارسال شد",
    developmentCode:
      process.env.NODE_ENV === "production"
        ? undefined
        : code
  });
});

app.post("/api/me/mobile/verify", auth, (req, res) => {
  const code = String(req.body.code || "").trim();

  const saved = otpStore.get(
    `change:${req.user.id}`
  );

  if (
    !saved ||
    saved.code !== code ||
    saved.expires < Date.now()
  ) {
    return res.status(400).json({
      success: false,
      message: "کد اشتباه یا منقضی شده است"
    });
  }

  req.user.phone = saved.newPhone;
  req.user.sessionToken = token();

  otpStore.delete(`change:${req.user.id}`);

  log(req.db, req.user.id, "CHANGE_MOBILE");
  saveDatabase(req.db);

  res.json({
    success: true,
    token: req.user.sessionToken,
    user: publicUser(req.user)
  });
});

/* ================= CARDS ================= */

app.get("/api/me/cards", auth, (req, res) => {
  res.json({
    success: true,
    cards: req.user.cards || []
  });
});

app.post("/api/me/cards", auth, (req, res) => {
  const masked = String(
    req.body.masked || ""
  ).trim();

  const tokenRef = String(
    req.body.tokenRef || ""
  ).trim();

  const label = String(
    req.body.label || "کارت من"
  ).trim();

  if (
    !/^\*{2,}[0-9]{4}$/.test(masked) ||
    tokenRef.length < 5
  ) {
    return res.status(400).json({
      success: false,
      message:
        "برای امنیت فقط کارت ماسک‌شده و شناسه امن درگاه ثبت می‌شود"
    });
  }

  if (!Array.isArray(req.user.cards)) {
    req.user.cards = [];
  }

  const card = {
    id: id("card"),
    label,
    masked,
    tokenRef,
    isDefault: req.user.cards.length === 0,
    createdAt: now()
  };

  req.user.cards.push(card);
  saveDatabase(req.db);

  res.json({
    success: true,
    card
  });
});

app.patch("/api/me/cards/:cardId/default", auth, (req, res) => {
  const card = (req.user.cards || []).find(
    c => c.id === req.params.cardId
  );

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "کارت پیدا نشد"
    });
  }

  req.user.cards.forEach(c => {
    c.isDefault = false;
  });

  card.isDefault = true;

  saveDatabase(req.db);

  res.json({
    success: true,
    cards: req.user.cards
  });
});

app.delete("/api/me/cards/:cardId", auth, (req, res) => {
  const before = req.user.cards.length;

  req.user.cards = req.user.cards.filter(
    c => c.id !== req.params.cardId
  );

  if (req.user.cards.length === before) {
    return res.status(404).json({
      success: false,
      message: "کارت پیدا نشد"
    });
  }

  if (
    req.user.cards.length &&
    !req.user.cards.some(c => c.isDefault)
  ) {
    req.user.cards[0].isDefault = true;
  }

  saveDatabase(req.db);

  res.json({
    success: true,
    cards: req.user.cards
  });
});

/* ================= CATEGORIES ================= */

app.get("/api/match-categories", (req, res) => {
  const db = loadDatabase();

  res.json({
    success: true,
    categories: db.matchCategories
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order)
  });
});

app.get("/api/owner/match-categories", owner, (req, res) => {
  res.json({
    success: true,
    categories: req.db.matchCategories
  });
});

app.post("/api/owner/match-categories", owner, (req, res) => {
  const category = {
    id: id("cat"),
    name: String(req.body.name || "دسته جدید"),
    icon: String(req.body.icon || "🎮"),
    enabled: true,
    order: req.db.matchCategories.length + 1
  };

  req.db.matchCategories.push(category);
  saveDatabase(req.db);

  res.json({
    success: true,
    category
  });
});

app.patch(
  "/api/owner/match-categories/:id/toggle",
  owner,
  (req, res) => {
    const category = req.db.matchCategories.find(
      c => c.id === req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "دسته پیدا نشد"
      });
    }

    category.enabled = !category.enabled;
    saveDatabase(req.db);

    res.json({
      success: true,
      category
    });
  }
);

/* ================= ROOMS ================= */

app.get("/api/rooms", (req, res) => {
  const db = loadDatabase();

  let rooms = [...db.rooms];

  const category = String(
    req.query.category || ""
  ).trim();

  const search = String(
    req.query.search || ""
  ).trim()
  .toLowerCase();

  if (category) {
    rooms = rooms.filter(
      r => r.category === category
    );
  }

  if (search) {
    rooms = rooms.filter(r =>
      String(r.title || "")
        .toLowerCase()
        .includes(search)
    );
  }

  rooms = rooms
    .filter(r => r.status !== "deleted")
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json({
    success: true,
    rooms
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const db = loadDatabase();

  const room = db.rooms.find(
    r => r.id === req.params.roomId
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

app.post("/api/rooms/:roomId/join", auth, (req, res) => {
  const room = req.db.rooms.find(
    r => r.id === req.params.roomId
  );

  if (!room) {
    return res.status(404).json({
      success: false,
      message: "مسابقه پیدا نشد"
    });
  }

  if (room.status === "closed") {
    return res.status(400).json({
      success: false,
      message: "مسابقه بسته شده است"
    });
  }

  if (!Array.isArray(room.players)) {
    room.players = [];
  }

  if (
    room.players.some(
      p => p.userId === req.user.id
    )
  ) {
    return res.json({
      success: true,
      message: "شما قبلاً وارد مسابقه شده‌اید",
      room
    });
  }

  const maxPlayers =
    Number(room.maxPlayers || 100);

  if (room.players.length >= maxPlayers) {
    return res.status(400).json({
      success: false,
      message: "ظرفیت مسابقه تکمیل است"
    });
  }

  const fee = Number(room.entryFee || 0);
  const freeRole = ["owner", "admin"].includes(
    req.user.role
  );

  if (fee > 0 && !freeRole) {
    if (req.user.gameBalance < fee) {
      return res.status(400).json({
        success: false,
        message:
          "موجودی بازی برای ورود به این مسابقه کافی نیست"
      });
    }

    req.user.gameBalance -= fee;

    transaction(
      req.db,
      req.user.id,
      "ROOM_ENTRY",
      -fee,
      "GAME_BALANCE",
      `ورود به ${room.title}`
    );

    syncBalance(req.user);
  }

  room.players.push({
    userId: req.user.id,
    name: req.user.name,
    joinedAt: now()
  });

  saveDatabase(req.db);

  res.json({
    success: true,
    message: "با موفقیت وارد مسابقه شدید",
    room,
    user: publicUser(req.user)
  });
});

/* ================= TOURNAMENTS ================= */

app.get("/api/tournaments", (req, res) => {
  const db = loadDatabase();

  res.json({
    success: true,
    tournaments: db.tournaments
      .filter(t => t.status !== "deleted")
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
  });
});

app.get(
  "/api/tournaments/:id",
  (req, res) => {
    const db = loadDatabase();

    const tournament =
      db.tournaments.find(
        t => t.id === req.params.id
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
  }
);

/* ================= TEAMS ================= */

app.get("/api/teams", (req, res) => {
  const db = loadDatabase();

  res.json({
    success: true,
    teams: db.teams
  });
});

app.post("/api/teams", auth, (req, res) => {
  const name = String(
    req.body.name || ""
  ).trim();

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: "نام تیم معتبر نیست"
    });
  }

  const team = {
    id: id("team"),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
    wins: 0,
    losses: 0,
    xp: 0,
    createdAt: now()
  };

  req.db.teams.push(team);
  saveDatabase(req.db);

  res.json({
    success: true,
    team
  });
});

/* ================= SHOP / NEWS ================= */

app.get("/api/shop", (req, res) => {
  const db = loadDatabase();

  res.json({
    success: true,
    shop: db.shop
  });
});

app.get("/api/news", (req, res) => {
  const db = loadDatabase();

  res.json({
    success: true,
    news: db.news
      .filter(n => n.enabled !== false)
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
  });
});

/* ================= WALLET ================= */

app.get("/api/wallet", auth, (req, res) => {
  syncBalance(req.user);

  const transactions =
    req.db.transactions
      .filter(t => t.userId === req.user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .slice(0, 100);

  const withdrawals =
    req.db.withdrawals
      .filter(w => w.userId === req.user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

  res.json({
    success: true,
    user: publicUser(req.user),
    transactions,
    withdrawals,
    limits: {
      minTopup: req.db.settings.minTopup,
      maxTopup: req.db.settings.maxTopup,
      minWithdraw: req.db.settings.minWithdraw,
      maxWithdraw: req.db.settings.maxWithdraw,
      withdrawalCooldownHours:
        req.db.settings.withdrawalCooldownHours
    }
  });
});

app.post("/api/wallet/topup", auth, (req, res) => {
  const amount = Number(req.body.amount);

  const settings = req.db.settings;

  if (
    !Number.isInteger(amount) ||
    amount < settings.minTopup ||
    amount > settings.maxTopup
  ) {
    return res.status(400).json({
      success: false,
      message:
        `مبلغ افزایش موجودی باید بین ${settings.minTopup.toLocaleString()} و ${settings.maxTopup.toLocaleString()} تومان باشد`
    });
  }

  const topup = {
    id: id("topup"),
    userId: req.user.id,
    amount,
    status: "pending",
    provider:
      settings.gateway.provider || "not-configured",
    createdAt: now()
  };

  req.db.topups.push(topup);

  transaction(
    req.db,
    req.user.id,
    "TOPUP_PENDING",
    amount,
    "GAME_BALANCE",
    "درخواست افزایش موجودی"
  );

  log(
    req.db,
    req.user.id,
    "TOPUP_REQUEST",
    { amount }
  );

  saveDatabase(req.db);

  res.json({
    success: true,
    topup,
    message:
      "درخواست ثبت شد؛ پس از اتصال درگاه بانکی، کاربر به صفحه پرداخت واقعی منتقل می‌شود"
  });
});

app.get("/api/wallet/transactions", auth, (req, res) => {
  res.json({
    success: true,
    transactions:
      req.db.transactions
        .filter(t => t.userId === req.user.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
  });
});

/* ================= WITHDRAW ================= */

app.post("/api/wallet/withdraw", auth, (req, res) => {
  const amount = Number(req.body.amount);

  const settings = req.db.settings;

  if (
    !Number.isInteger(amount) ||
    amount < settings.minWithdraw ||
    amount > settings.maxWithdraw
  ) {
    return res.status(400).json({
      success: false,
      message:
        `مبلغ برداشت باید بین ${settings.minWithdraw.toLocaleString()} و ${settings.maxWithdraw.toLocaleString()} تومان باشد`
    });
  }

  if (req.user.withdrawableBalance < amount) {
    return res.status(400).json({
      success: false,
      message: "موجودی قابل برداشت کافی نیست"
    });
  }

  const last = req.db.withdrawals
    .filter(
      w =>
        w.userId === req.user.id &&
        w.status !== "rejected" &&
        w.status !== "cancelled"
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )[0];

  if (last) {
    const diff =
      Date.now() -
      new Date(last.createdAt).getTime();

    const cooldown =
      settings.withdrawalCooldownHours *
      60 *
      60 *
      1000;

    if (diff < cooldown) {
      const remain =
        Math.ceil((cooldown - diff) / 3600000);

      return res.status(400).json({
        success: false,
        message:
          `تا درخواست برداشت بعدی حدود ${remain} ساعت باقی مانده است`
      });
    }
  }

  const card =
    (req.user.cards || []).find(
      c => c.isDefault
    ) ||
    (req.user.cards || [])[0];

  if (!card) {
    return res.status(400).json({
      success: false,
      message:
        "ابتدا یک کارت بانکی امن برای برداشت ثبت کنید"
    });
  }

  req.user.withdrawableBalance -= amount;
  syncBalance(req.user);

  const withdrawal = {
    id: id("withdraw"),
    userId: req.user.id,
    amount,
    cardId: card.id,
    cardMasked: card.masked,
    status: "pending",
    createdAt: now()
  };

  req.db.withdrawals.push(withdrawal);

  transaction(
    req.db,
    req.user.id,
    "WITHDRAW_REQUEST",
    -amount,
    "WITHDRAWABLE_BALANCE",
    "درخواست برداشت"
  );

  log(
    req.db,
    req.user.id,
    "WITHDRAW_REQUEST",
    { amount }
  );

  saveDatabase(req.db);

  res.json({
    success: true,
    withdrawal,
    user: publicUser(req.user)
  });
});

/* ================= NOTIFICATIONS ================= */

app.get(
  "/api/notifications",
  auth,
  (req, res) => {
    res.json({
      success: true,
      notifications:
        req.db.notifications
          .filter(
            n =>
              n.userId === null ||
              n.userId === req.user.id
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          )
    });
  }
);

app.patch(
  "/api/notifications/:id/read",
  auth,
  (req, res) => {
    const notification =
      req.db.notifications.find(
        n =>
          n.id === req.params.id &&
          (n.userId === null ||
            n.userId === req.user.id)
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "اعلان پیدا نشد"
      });
    }

    notification.read = true;
    saveDatabase(req.db);

    res.json({
      success: true
    });
  }
);

/* ================= SUPPORT ================= */

app.post("/api/support/tickets", auth, (req, res) => {
  const subject = String(
    req.body.subject || ""
  ).trim();

  const message = String(
    req.body.message || ""
  ).trim();

  if (!subject || !message) {
    return res.status(400).json({
      success: false,
      message: "موضوع و پیام الزامی است"
    });
  }

  const ticket = {
    id: id("ticket"),
    userId: req.user.id,
    subject,
    status: "open",
    createdAt: now(),
    updatedAt: now()
  };

  req.db.tickets.push(ticket);

  req.db.ticketMessages.push({
    id: id("ticketmsg"),
    ticketId: ticket.id,
    userId: req.user.id,
    senderRole: req.user.role,
    message,
    createdAt: now()
  });

  saveDatabase(req.db);

  res.json({
    success: true,
    ticket
  });
});

app.get("/api/support/tickets", auth, (req, res) => {
  res.json({
    success: true,
    tickets:
      req.db.tickets
        .filter(
          t => t.userId === req.user.id
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
  });
});

app.get(
  "/api/support/tickets/:id",
  auth,
  (req, res) => {
    const ticket =
      req.db.tickets.find(
        t =>
          t.id === req.params.id &&
          t.userId === req.user.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "تیکت پیدا نشد"
      });
    }

    res.json({
      success: true,
      ticket,
      messages:
        req.db.ticketMessages.filter(
          m => m.ticketId === ticket.id
        )
    });
  }
);

app.post(
  "/api/support/tickets/:id/messages",
  auth,
  (req, res) => {
    const ticket =
      req.db.tickets.find(
        t =>
          t.id === req.params.id &&
          t.userId === req.user.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "تیکت پیدا نشد"
      });
    }

    const message = String(
      req.body.message || ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "پیام خالی است"
      });
    }

    req.db.ticketMessages.push({
      id: id("ticketmsg"),
      ticketId: ticket.id,
      userId: req.user.id,
      senderRole: req.user.role,
      message,
      createdAt: now()
    });

    ticket.updatedAt = now();

    saveDatabase(req.db);

    res.json({
      success: true
    });
  }
);

/* ================= OWNER DASHBOARD ================= */

app.get("/api/owner/dashboard", owner, (req, res) => {
  const db = req.db;

  const totalGameBalance =
    db.users.reduce(
      (sum, u) =>
        sum + Number(u.gameBalance || 0),
      0
    );

  const totalWithdrawableBalance =
    db.users.reduce(
      (sum, u) =>
        sum +
        Number(u.withdrawableBalance || 0),
      0
    );

  res.json({
    success: true,
    stats: {
      users: db.users.length,
      rooms: db.rooms.length,
      tournaments: db.tournaments.length,
      teams: db.teams.length,
      pendingWithdrawals:
        db.withdrawals.filter(
          w => w.status === "pending"
        ).length,
      totalGameBalance,
      totalWithdrawableBalance,
      topups:
        db.topups.filter(
          t => t.status === "pending"
        ).length
    }
  });
});

app.get("/api/owner/users", owner, (req, res) => {
  res.json({
    success: true,
    users: req.db.users.map(publicUser)
  });
});

app.patch(
  "/api/owner/users/:id/role",
  owner,
  (req, res) => {
    const role = String(
      req.body.role || ""
    ).trim();

    const allowed = [
      "user",
      "admin",
      "finance_manager"
    ];

    if (!allowed.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "نقش نامعتبر است"
      });
    }

    const user = req.db.users.find(
      u => u.id === req.params.id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر پیدا نشد"
      });
    }

    user.role = role;

    log(
      req.db,
      req.user.id,
      "CHANGE_USER_ROLE",
      {
        targetUserId: user.id,
        role
      }
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      user: publicUser(user)
    });
  }
);

/* ================= MANUAL REWARD ================= */

app.post(
  "/api/owner/users/:id/manual-reward",
  finance,
  (req, res) => {
    const amount = Number(req.body.amount);

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "مبلغ معتبر نیست"
      });
    }

    const user = req.db.users.find(
      u => u.id === req.params.id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر پیدا نشد"
      });
    }

    const description = String(
      req.body.description ||
        "پاداش دستی مالک"
    );

    user.gameBalance += amount;
    syncBalance(user);

    transaction(
      req.db,
      user.id,
      "MANUAL_REWARD",
      amount,
      "GAME_BALANCE",
      description
    );

    log(
      req.db,
      req.user.id,
      "MANUAL_REWARD",
      {
        targetUserId: user.id,
        amount
      }
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      user: publicUser(user)
    });
  }
);

/* ================= PAID ROOM EARNINGS ================= */

app.post(
  "/api/owner/users/:id/earnings",
  finance,
  (req, res) => {
    const amount = Number(req.body.amount);

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "مبلغ معتبر نیست"
      });
    }

    const user = req.db.users.find(
      u => u.id === req.params.id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر پیدا نشد"
      });
    }

    user.withdrawableBalance += amount;
    syncBalance(user);

    transaction(
      req.db,
      user.id,
      "PAID_ROOM_EARNING",
      amount,
      "WITHDRAWABLE_BALANCE",
      String(
        req.body.description ||
          "درآمد مسابقه پولی"
      )
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      user: publicUser(user)
    });
  }
);

/* ================= OWNER ROOMS ================= */

app.post("/api/owner/rooms", admin, (req, res) => {
  const room = {
    id: id("room"),
    title: String(
      req.body.title || "مسابقه جدید"
    ),
    category: String(
      req.body.category || "battle"
    ),
    mode: String(
      req.body.mode || "BR"
    ),
    entryFee: Number(
      req.body.entryFee || 0
    ),
    prize: Number(
      req.body.prize || 0
    ),
    maxPlayers: Number(
      req.body.maxPlayers || 100
    ),
    status: "open",
    players: [],
    roomCode: String(
      req.body.roomCode || ""
    ),
    roomPassword: String(
      req.body.roomPassword || ""
    ),
    createdAt: now()
  };

  req.db.rooms.push(room);
  saveDatabase(req.db);

  res.json({
    success: true,
    room
  });
});

app.delete(
  "/api/owner/rooms/:id",
  admin,
  (req, res) => {
    const room = req.db.rooms.find(
      r => r.id === req.params.id
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "روم پیدا نشد"
      });
    }

    room.status = "deleted";
    saveDatabase(req.db);

    res.json({
      success: true
    });
  }
);

/* ================= OWNER TOURNAMENTS ================= */

app.post(
  "/api/owner/tournaments",
  admin,
  (req, res) => {
    const tournament = {
      id: id("tournament"),
      title: String(
        req.body.title ||
          "تورنمنت KILL ZONE"
      ),
      description: String(
        req.body.description || ""
      ),
      entryFee: Number(
        req.body.entryFee || 0
      ),
      prize: Number(
        req.body.prize || 0
      ),
      maxTeams: Number(
        req.body.maxTeams || 16
      ),
      status: "open",
      teams: [],
      createdAt: now()
    };

    req.db.tournaments.push(tournament);
    saveDatabase(req.db);

    res.json({
      success: true,
      tournament
    });
  }
);

/* ================= FINANCE SETTINGS ================= */

app.get(
  "/api/owner/finance-settings",
  finance,
  (req, res) => {
    res.json({
      success: true,
      settings: {
        minTopup:
          req.db.settings.minTopup,
        maxTopup:
          req.db.settings.maxTopup,
        minWithdraw:
          req.db.settings.minWithdraw,
        maxWithdraw:
          req.db.settings.maxWithdraw,
        withdrawalCooldownHours:
          req.db.settings
            .withdrawalCooldownHours
      }
    });
  }
);

app.put(
  "/api/owner/finance-settings",
  owner,
  (req, res) => {
    const fields = [
      "minTopup",
      "maxTopup",
      "minWithdraw",
      "maxWithdraw",
      "withdrawalCooldownHours"
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);

        if (
          !Number.isInteger(value) ||
          value < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              `مقدار ${field} نامعتبر است`
          });
        }

        req.db.settings[field] = value;
      }
    }

    saveDatabase(req.db);

    res.json({
      success: true,
      settings: req.db.settings
    });
  }
);

/* ================= SETTLEMENT / GATEWAY ================= */

app.get(
  "/api/owner/payment-settings",
  finance,
  (req, res) => {
    res.json({
      success: true,
      gateway: {
        provider:
          req.db.settings.gateway.provider,
        active:
          req.db.settings.gateway.active,
        settlementCardMasked:
          req.db.settings.gateway
            .settlementCardMasked
      }
    });
  }
);

app.put(
  "/api/owner/payment-settings",
  owner,
  (req, res) => {
    const gateway =
      req.db.settings.gateway;

    gateway.provider = String(
      req.body.provider || ""
    ).trim();

    gateway.merchantId = String(
      req.body.merchantId || ""
    ).trim();

    gateway.settlementCardMasked =
      String(
        req.body.settlementCardMasked ||
          ""
      ).trim();

    gateway.settlementTokenRef =
      String(
        req.body.settlementTokenRef || ""
      ).trim();

    gateway.active =
      Boolean(req.body.active);

    log(
      req.db,
      req.user.id,
      "CHANGE_GATEWAY_SETTINGS"
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      gateway: {
        provider: gateway.provider,
        active: gateway.active,
        settlementCardMasked:
          gateway.settlementCardMasked
      }
    });
  }
);

/* ================= WITHDRAWAL MANAGEMENT ================= */

app.get(
  "/api/owner/withdrawals",
  finance,
  (req, res) => {
    res.json({
      success: true,
      withdrawals:
        req.db.withdrawals
          .map(w => ({
            ...w,
            user:
              publicUser(
                req.db.users.find(
                  u => u.id === w.userId
                )
              )
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          )
    });
  }
);

app.patch(
  "/api/owner/withdrawals/:id/status",
  finance,
  (req, res) => {
    const status = String(
      req.body.status || ""
    );

    const allowed = [
      "pending",
      "approved",
      "processing",
      "paid",
      "rejected"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "وضعیت نامعتبر است"
      });
    }

    const withdrawal =
      req.db.withdrawals.find(
        w => w.id === req.params.id
      );

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "درخواست پیدا نشد"
      });
    }

    withdrawal.status = status;
    withdrawal.updatedAt = now();

    if (status === "rejected") {
      const user = req.db.users.find(
        u => u.id === withdrawal.userId
      );

      if (user && !withdrawal.refunded) {
        user.withdrawableBalance +=
          withdrawal.amount;

        syncBalance(user);

        transaction(
          req.db,
          user.id,
          "WITHDRAW_REFUND",
          withdrawal.amount,
          "WITHDRAWABLE_BALANCE",
          "بازگشت مبلغ برداشت رد شده"
        );

        withdrawal.refunded = true;
      }
    }

    log(
      req.db,
      req.user.id,
      "WITHDRAWAL_STATUS",
      {
        withdrawalId:
          withdrawal.id,
        status
      }
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      withdrawal
    });
  }
);

/* ================= OWNER CONTENT ================= */

app.post(
  "/api/owner/news",
  admin,
  (req, res) => {
    const item = {
      id: id("news"),
      title: String(
        req.body.title || "خبر جدید"
      ),
      text: String(
        req.body.text || ""
      ),
      image: String(
        req.body.image || ""
      ),
      enabled: true,
      createdAt: now()
    };

    req.db.news.push(item);
    saveDatabase(req.db);

    res.json({
      success: true,
      news: item
    });
  }
);

app.delete(
  "/api/owner/news/:id",
  admin,
  (req, res) => {
    req.db.news =
      req.db.news.filter(
        n => n.id !== req.params.id
      );

    saveDatabase(req.db);

    res.json({
      success: true
    });
  }
);

app.get(
  "/api/owner/ads",
  admin,
  (req, res) => {
    res.json({
      success: true,
      ads: req.db.ads
    });
  }
);

app.post(
  "/api/owner/ads",
  admin,
  (req, res) => {
    const ad = {
      id: id("ad"),
      title: String(
        req.body.title || "تبلیغ"
      ),
      text: String(
        req.body.text || ""
      ),
      image: String(
        req.body.image || ""
      ),
      link: String(
        req.body.link || ""
      ),
      enabled: true,
      createdAt: now()
    };

    req.db.ads.push(ad);
    saveDatabase(req.db);

    res.json({
      success: true,
      ad
    });
  }
);

/* ================= OWNER NOTIFICATIONS ================= */

app.post(
  "/api/owner/notifications",
  admin,
  (req, res) => {
    const notification = {
      id: id("notification"),
      userId:
        req.body.userId
          ? String(req.body.userId)
          : null,
      title: String(
        req.body.title || "اعلان KILL ZONE"
      ),
      text: String(
        req.body.text || ""
      ),
      read: false,
      createdAt: now()
    };

    req.db.notifications.push(
      notification
    );

    saveDatabase(req.db);

    res.json({
      success: true,
      notification
    });
  }
);

/* ================= OWNER SUPPORT ================= */

app.get(
  "/api/owner/support/tickets",
  admin,
  (req, res) => {
    res.json({
      success: true,
      tickets:
        req.db.tickets
          .map(t => ({
            ...t,
            user:
              publicUser(
                req.db.users.find(
                  u => u.id === t.userId
                )
              )
          }))
          .sort(
            (a, b) =>
              new Date(b.updatedAt) -
              new Date(a.updatedAt)
          )
    });
  }
);

app.get(
  "/api/owner/support/tickets/:id",
  admin,
  (req, res) => {
    const ticket =
      req.db.tickets.find(
        t => t.id === req.params.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "تیکت پیدا نشد"
      });
    }

    res.json({
      success: true,
      ticket,
      messages:
        req.db.ticketMessages.filter(
          m =>
            m.ticketId === ticket.id
        )
    });
  }
);

app.post(
  "/api/owner/support/tickets/:id/reply",
  admin,
  (req, res) => {
    const ticket =
      req.db.tickets.find(
        t => t.id === req.params.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "تیکت پیدا نشد"
      });
    }

    const message = String(
      req.body.message || ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "پیام خالی است"
      });
    }

    req.db.ticketMessages.push({
      id: id("ticketmsg"),
      ticketId: ticket.id,
      userId: req.user.id,
      senderRole: req.user.role,
      message,
      createdAt: now()
    });

    ticket.status = "answered";
    ticket.updatedAt = now();

    req.db.notifications.push({
      id: id("notification"),
      userId: ticket.userId,
      title: "پاسخ پشتیبانی",
      text: "پاسخ جدیدی برای تیکت شما ثبت شد.",
      read: false,
      createdAt: now()
    });

    saveDatabase(req.db);

    res.json({
      success: true
    });
  }
);

/* ================= OWNER PROFILE ================= */

app.get(
  "/api/owner/profile",
  owner,
  (req, res) => {
    res.json({
      success: true,
      user: publicUser(req.user)
    });
  }
);

app.put(
  "/api/owner/profile",
  owner,
  (req, res) => {
    const name = String(
      req.body.name || ""
    ).trim();

    if (
      name.length < 2 ||
      name.length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "نام مالک معتبر نیست"
      });
    }

    req.user.name = name;

    saveDatabase(req.db);

    res.json({
      success: true,
      user: publicUser(req.user)
    });
  }
);

/* ================= OWNER LOGS / SECURITY ================= */

app.get(
  "/api/owner/logs",
  owner,
  (req, res) => {
    res.json({
      success: true,
      logs: req.db.logs
        .slice()
        .reverse()
        .slice(0, 500)
    });
  }
);

app.get(
  "/api/owner/settings",
  owner,
  (req, res) => {
    res.json({
      success: true,
      settings: {
        appName:
          req.db.settings.appName,
        currency:
          req.db.settings.currency,
        maintenance:
          req.db.settings.maintenance
      }
    });
  }
);

app.put(
  "/api/owner/settings",
  owner,
  (req, res) => {
    if (req.body.appName !== undefined) {
      req.db.settings.appName =
        String(req.body.appName);
    }

    if (req.body.maintenance !== undefined) {
      req.db.settings.maintenance =
        Boolean(req.body.maintenance);
    }

    saveDatabase(req.db);

    res.json({
      success: true,
      settings: req.db.settings
    });
  }
);

/* ================= STATIC APP ================= */

app.use(express.static(FRONTEND));

app.listen(PORT, "0.0.0.0", () => {
  loadDatabase();

  console.log("");
  console.log("================================");
  console.log("      KILL ZONE BACKEND");
  console.log("================================");
  console.log(
    `Local: http://127.0.0.1:${PORT}`
  );
  console.log(
    `LAN:   http://0.0.0.0:${PORT}`
  );
  console.log("Status: ONLINE");
  console.log("================================");
  console.log("");
});
