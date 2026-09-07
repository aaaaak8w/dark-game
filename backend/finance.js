const { loadDatabase, saveDatabase } = require("./database");

function addManualReward(userId, amount, description = "پاداش دستی") {
  if (!userId) {
    throw new Error("شناسه کاربر الزامی است");
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("مبلغ باید یک عدد صحیح مثبت باشد");
  }

  const db = loadDatabase();
  const user = db.users.find(user => user.id === String(userId));

  if (!user) {
    throw new Error("کاربر پیدا نشد");
  }

  if (typeof user.gameBalance !== "number") {
    user.gameBalance = 0;
  }

  if (typeof user.withdrawableBalance !== "number") {
    user.withdrawableBalance = 0;
  }

  user.gameBalance += amount;

  db.transactions.push({
    id: Date.now().toString(),
    userId: user.id,
    type: "MANUAL_REWARD",
    amount,
    balanceType: "GAME_BALANCE",
    description,
    createdAt: new Date().toISOString()
  });

  saveDatabase(db);

  return user;
}

module.exports = {
  addManualReward
};
