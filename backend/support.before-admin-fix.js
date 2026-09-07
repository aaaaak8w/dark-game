const { loadDatabase, saveDatabase } = require("./database");

function ensureSupport(db) {
  if (!Array.isArray(db.tickets)) db.tickets = [];
  if (!Array.isArray(db.ticketMessages)) db.ticketMessages = [];
  return db;
}

function createTicket(userId, subject, message) {
  const db = ensureSupport(loadDatabase());

  const user = db.users.find(u => u.id === String(userId));

  if (!user) {
    throw new Error("کاربر پیدا نشد");
  }

  if (!subject || !message) {
    throw new Error("موضوع و پیام الزامی است");
  }

  const now = new Date().toISOString();

  const ticket = {
    id: "T-" + Date.now(),
    userId: user.id,
    subject: String(subject).trim(),
    status: "open",
    createdAt: now,
    updatedAt: now
  };

  db.tickets.push(ticket);

  db.ticketMessages.push({
    id: "TM-" + Date.now(),
    ticketId: ticket.id,
    senderId: user.id,
    senderRole: "user",
    message: String(message).trim(),
    createdAt: now
  });

  saveDatabase(db);

  return ticket;
}

function getUserTickets(userId) {
  const db = ensureSupport(loadDatabase());

  return db.tickets
    .filter(t => t.userId === String(userId))
    .sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
}

function getTicket(userId, ticketId) {
  const db = ensureSupport(loadDatabase());

  const ticket = db.tickets.find(
    t => t.id === String(ticketId) &&
         t.userId === String(userId)
  );

  if (!ticket) {
    throw new Error("تیکت پیدا نشد");
  }

  const messages = db.ticketMessages
    .filter(m => m.ticketId === ticket.id)
    .sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );

  return {
    ...ticket,
    messages
  };
}

function addUserMessage(userId, ticketId, message) {
  const db = ensureSupport(loadDatabase());

  const ticket = db.tickets.find(
    t => t.id === String(ticketId) &&
         t.userId === String(userId)
  );

  if (!ticket) {
    throw new Error("تیکت پیدا نشد");
  }

  if (ticket.status === "closed") {
    throw new Error("این تیکت بسته شده است");
  }

  if (!message || !String(message).trim()) {
    throw new Error("پیام خالی است");
  }

  const now = new Date().toISOString();

  db.ticketMessages.push({
    id: "TM-" + Date.now(),
    ticketId: ticket.id,
    senderId: String(userId),
    senderRole: "user",
    message: String(message).trim(),
    createdAt: now
  });

  ticket.status = "open";
  ticket.updatedAt = now;

  saveDatabase(db);

  return ticket;
}

function getAllTickets() {
  const db = ensureSupport(loadDatabase());

  return db.tickets
    .map(ticket => {
      const user = db.users.find(u => u.id === ticket.userId);

      return {
        ...ticket,
        userName: user?.name || "کاربر",
        phone: user?.phone || null
      };
    })
    .sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
}

function getAdminTicket(ticketId) {
  const db = ensureSupport(loadDatabase());

  const ticket = db.tickets.find(
    t => t.id === String(ticketId)
  );

  if (!ticket) {
    throw new Error("تیکت پیدا نشد");
  }

  const user = db.users.find(u => u.id === ticket.userId);

  const messages = db.ticketMessages
    .filter(m => m.ticketId === ticket.id)
    .sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );

  return {
    ...ticket,
    userName: user?.name || "کاربر",
    phone: user?.phone || null,
    messages
  };
}

function addAdminMessage(ticketId, message, senderId = "owner") {
  const db = ensureSupport(loadDatabase());

  const ticket = db.tickets.find(
    t => t.id === String(ticketId)
  );

  if (!ticket) {
    throw new Error("تیکت پیدا نشد");
  }

  if (!message || !String(message).trim()) {
    throw new Error("پیام خالی است");
  }

  const now = new Date().toISOString();

  db.ticketMessages.push({
    id: "TM-" + Date.now(),
    ticketId: ticket.id,
    senderId: String(senderId),
    senderRole: "admin",
    message: String(message).trim(),
    createdAt: now
  });

  ticket.status = "answered";
  ticket.updatedAt = now;

  saveDatabase(db);

  return ticket;
}

function updateTicketStatus(ticketId, status) {
  const allowed = ["open", "answered", "closed"];

  if (!allowed.includes(status)) {
    throw new Error("وضعیت نامعتبر است");
  }

  const db = ensureSupport(loadDatabase());

  const ticket = db.tickets.find(
    t => t.id === String(ticketId)
  );

  if (!ticket) {
    throw new Error("تیکت پیدا نشد");
  }

  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();

  saveDatabase(db);

  return ticket;
}

module.exports = {
  ensureSupport,
  createTicket,
  getUserTickets,
  getTicket,
  addUserMessage,
  getAllTickets,
  getAdminTicket,
  addAdminMessage,
  updateTicketStatus
};
