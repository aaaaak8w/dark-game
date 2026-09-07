const API_BASE = "/api";

let currentUser = null;
let currentPage = "home";
let currentRoom = null;

const app = document.getElementById("app");

function money(n) {
  return Number(n || 0).toLocaleString("fa-IR") + " تومان";
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function token() {
  return localStorage.getItem("killzone_token") || "";
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type":"application/json",
    ...(options.headers || {})
  };

  if (token()) headers.Authorization = "Bearer " + token();

  const res = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || data.message || "خطا در ارتباط با سرور");
  }

  return data;
}

function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2800);
}

function navigate(page) {
  currentPage = page;
  render();
}

async function boot() {
  try {
    if (token()) {
      const data = await api("/auth/me");
      currentUser = data.user || data;
    }
  } catch {
    localStorage.removeItem("killzone_token");
    currentUser = null;
  }

  render();

  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash) splash.classList.add("hide");
  }, 1800);
}

function render() {
  if (!currentUser) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <div class="brand-logo">KZ</div>
        <div class="brand-text">
          <b>DARK GAME</b>
          <small>ULTIMATE GAMING ARENA</small>
        </div>
      </div>

      <button class="avatar" onclick="navigate('profile')">
        ${escapeHtml((currentUser.name || "K").charAt(0))}
      </button>
    </div>

    <main class="container" id="page"></main>

    <nav class="bottom-nav">
      <button class="nav-item ${currentPage==="home"?"active":""}" onclick="navigate('home')">
        <b>⌂</b>خانه
      </button>

      <button class="nav-item ${currentPage==="matches"?"active":""}" onclick="navigate('matches')">
        <b>⚔</b>مسابقات
      </button>

      <button class="nav-item ${currentPage==="tournaments"?"active":""}" onclick="navigate('tournaments')">
        <b>🏆</b>تورنمنت
      </button>

      <button class="nav-item ${currentPage==="wallet"?"active":""}" onclick="navigate('wallet')">
        <b>💰</b>کیف پول
      </button>

      <button class="nav-item ${currentPage==="profile"?"active":""}" onclick="navigate('profile')">
        <b>👤</b>پروفایل
      </button>
    </nav>
  `;

  const page = document.getElementById("page");

  if (currentPage === "home") renderHome(page);
  else if (currentPage === "matches") renderMatches(page);
  else if (currentPage === "tournaments") renderTournaments(page);
  else if (currentPage === "teams") renderTeams(page);
  else if (currentPage === "shop") renderShop(page);
  else if (currentPage === "wallet") renderWallet(page);
  else if (currentPage === "profile") renderProfile(page);
  else if (currentPage === "support") renderSupport(page);
  else if (currentPage === "owner") renderOwner(page);
  else if (currentPage === "room") renderRoom(page);
}

function renderLogin() {
  app.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    ">
      <div class="card" style="width:100%;max-width:430px;text-align:center">

        <div class="brand-logo" style="margin:auto;width:70px;height:70px;font-size:17px">
          KZ
        </div>

        <h1 style="margin:18px 0 5px">DARK GAME</h1>
        <p>ورود به میدان رقابت</p>

        <div class="form-group" style="text-align:right">
          <label>شماره موبایل</label>
          <input id="loginPhone"
                 class="input"
                 inputmode="numeric"
                 placeholder="شماره موبایل">
        </div>

        <button class="btn btn-primary"
                style="width:100%"
                onclick="requestLoginOtp()">
          دریافت کد ورود
        </button>

        <div id="otpArea" style="margin-top:15px"></div>
      </div>
    </div>
  `;
}

async function requestLoginOtp() {
  const phone = document.getElementById("loginPhone").value.trim();

  if (!phone) {
    toast("شماره موبایل را وارد کنید");
    return;
  }

  try {
    const data = await api("/auth/request-otp", {
      method:"POST",
      body:JSON.stringify({phone})
    });

    document.getElementById("otpArea").innerHTML = `
      <div class="form-group">
        <label>کد تأیید</label>
        <input id="loginOtp"
               class="input"
               inputmode="numeric"
               maxlength="6"
               placeholder="کد ۶ رقمی">
      </div>

      <button class="btn btn-success"
              style="width:100%"
              onclick="verifyLoginOtp('${escapeHtml(phone)}')">
        ورود به DARK GAME
      </button>

      ${
        data.devOtp
        ? `<p style="font-size:10px;color:#c084fc">
             کد تست: ${escapeHtml(data.devOtp)}
           </p>`
        : ""
      }
    `;

    toast("کد ورود ارسال شد");
  } catch(e) {
    toast(e.message);
  }
}

async function verifyLoginOtp(phone) {
  const otp = document.getElementById("loginOtp").value.trim();

  if (!otp) {
    toast("کد را وارد کنید");
    return;
  }

  try {
    const data = await api("/auth/verify-otp", {
      method:"POST",
      body:JSON.stringify({phone, code: otp})
    });

    localStorage.setItem("killzone_token", data.token);

    currentUser = data.user;

    toast("خوش آمدید 🎮");

    render();
  } catch(e) {
    toast(e.message);
  }
}

async function renderHome(el) {
  el.innerHTML = `<div class="loading">در حال دریافت اطلاعات...</div>`;

  try {
    const [roomsData, walletData] = await Promise.all([
      api("/rooms"),
      api("/wallet")
    ]);

    const rooms = roomsData.rooms || roomsData || [];

    const gameBalance = walletData.gameBalance || 0;
    const withdrawable = walletData.withdrawableBalance || 0;

    el.innerHTML = `
      <section class="hero">
        <h1>سلام ${escapeHtml(currentUser.name || "گیمر")} 👋</h1>

        <p>
          آماده‌ای وارد میدان DARK GAME بشی؟
          مسابقه خودت رو انتخاب کن و رقابت رو شروع کن.
        </p>

        <div class="hero-actions">
          <button class="btn btn-primary"
                  onclick="navigate('matches')">
            ⚔️ ورود به مسابقات
          </button>

          <button class="btn"
                  onclick="navigate('wallet')">
            💰 کیف پول
          </button>
        </div>
      </section>

      <div class="section-title">
        <h2>💰 موجودی شما</h2>
        <span onclick="navigate('wallet')">جزئیات</span>
      </div>

      <div class="wallet-grid">
        <div class="wallet-card">
          <small>موجودی بازی</small>
          <strong class="money">${money(gameBalance)}</strong>
        </div>

        <div class="wallet-card">
          <small>قابل برداشت</small>
          <strong class="money">${money(withdrawable)}</strong>
        </div>
      </div>

      <div class="section-title">
        <h2>⚡ دسترسی سریع</h2>
      </div>

      <div class="quick-grid">
        <button class="quick" onclick="navigate('matches')">
          <b>⚔️</b>مسابقات
        </button>

        <button class="quick" onclick="navigate('tournaments')">
          <b>🏆</b>تورنمنت
        </button>

        <button class="quick" onclick="navigate('teams')">
          <b>👥</b>تیم‌ها
        </button>

        <button class="quick" onclick="navigate('shop')">
          <b>🛒</b>فروشگاه
        </button>

        <button class="quick" onclick="navigate('support')">
          <b>🎫</b>پشتیبانی
        </button>

        <button class="quick" onclick="navigate('profile')">
          <b>👤</b>پروفایل
        </button>

        ${
          currentUser.role === "owner" ||
          currentUser.role === "admin"
          ? `
          <button class="quick" onclick="navigate('owner')">
            <b>👑</b>مدیریت
          </button>`
          : ""
        }

        <button class="quick" onclick="navigate('wallet')">
          <b>➕</b>افزایش موجودی
        </button>
      </div>

      <div class="section-title">
        <h2>🔥 مسابقات فعال</h2>
        <span onclick="navigate('matches')">مشاهده همه</span>
      </div>

      <div class="match-grid">
        ${
          rooms.length
          ? rooms.slice(0,6).map(roomCard).join("")
          : `<div class="empty" style="grid-column:1/-1">
               هنوز مسابقه‌ای ساخته نشده
             </div>`
        }
      </div>

      <div class="section-title">
        <h2>📢 DARK GAME</h2>
      </div>

      <div class="news-card">
        <h3>به میدان رقابت خوش آمدید 🎮</h3>
        <p>
          مسابقات، تورنمنت‌ها، تیم‌ها، کیف پول و امکانات حرفه‌ای
          همه در یک پلتفرم.
        </p>
      </div>
    `;
  } catch(e) {
    el.innerHTML = `
      <div class="empty">
        دریافت اطلاعات با خطا مواجه شد
        <br><br>
        <button class="btn btn-primary" onclick="render()">تلاش دوباره</button>
      </div>
    `;
  }
}

function roomCard(room) {
  const fee = Number(room.entryFee || 0);

  return `
    <div class="match-card">
      <div class="match-icon">🎮</div>

      <h3>${escapeHtml(room.title || "مسابقه")}</h3>

      <p>
        ${escapeHtml(room.mode || "Multiplayer")}
        <br>
        ظرفیت: ${Number(room.capacity || 0)}
      </p>

      <div class="match-bottom">
        <span class="price ${fee === 0 ? "free":""}">
          ${fee === 0 ? "رایگان" : money(fee)}
        </span>

        <button class="btn btn-small btn-primary"
                onclick="openRoom('${escapeHtml(room.id)}')">
          ورود
        </button>
      </div>
    </div>
  `;
}

async function renderMatches(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>⚔️ مسابقات</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <input class="search"
           id="roomSearch"
           placeholder="جستجوی مسابقه..."
           oninput="filterRooms()">

    <div style="height:12px"></div>

    <div id="roomList" class="match-grid">
      <div class="loading" style="grid-column:1/-1">
        در حال دریافت...
      </div>
    </div>
  `;

  try {
    const data = await api("/rooms");
    window.killzoneRooms = data.rooms || data || [];
    renderRoomList(window.killzoneRooms);
  } catch(e) {
    toast(e.message);
  }
}

function renderRoomList(rooms) {
  const list = document.getElementById("roomList");
  if (!list) return;

  if (!rooms.length) {
    list.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        مسابقه‌ای پیدا نشد
      </div>
    `;
    return;
  }

  list.innerHTML = rooms.map(roomCard).join("");
}

function filterRooms() {
  const q = document.getElementById("roomSearch").value.toLowerCase();

  const filtered = (window.killzoneRooms || []).filter(room =>
    String(room.title || "").toLowerCase().includes(q) ||
    String(room.mode || "").toLowerCase().includes(q)
  );

  renderRoomList(filtered);
}

async function openRoom(id) {
  try {
    const data = await api("/rooms/" + encodeURIComponent(id));
    currentRoom = data.room || data;

    currentPage = "room";
    render();
  } catch(e) {
    toast(e.message);
  }
}

async function renderRoom(el) {
  if (!currentRoom) {
    navigate("matches");
    return;
  }

  const room = currentRoom;
  const players = room.players || room.members || [];
  const fee = Number(room.entryFee || 0);

  el.innerHTML = `
    <div class="page-head">
      <h2>جزئیات مسابقه</h2>
      <button class="back" onclick="navigate('matches')">‹</button>
    </div>

    <div class="room-header">
      <div class="match-icon">🎮</div>

      <h2>${escapeHtml(room.title || "مسابقه")}</h2>

      <p>
        حالت بازی: ${escapeHtml(room.mode || "Multiplayer")}
      </p>

      <div class="tournament-meta">
        <span class="badge">
          👥 ${players.length}/${Number(room.capacity || 0)}
        </span>

        <span class="badge">
          💰 ${fee ? money(fee) : "رایگان"}
        </span>
      </div>
    </div>

    ${
      room.status
      ? `
      <div class="card">
        وضعیت مسابقه:
        <strong>${escapeHtml(room.status)}</strong>
      </div>`
      : ""
    }

    ${
      room.roomCode || room.password
      ? `
      <div class="cod-box">
        <small>اطلاعات ورود به روم</small>
        ${
          room.roomCode
          ? `<strong>${escapeHtml(room.roomCode)}</strong>`
          : ""
        }
        ${
          room.password
          ? `<div style="margin-top:8px">${escapeHtml(room.password)}</div>`
          : ""
        }
      </div>`
      : ""
    }

    <div class="section-title">
      <h2>👥 بازیکنان</h2>
    </div>

    <div class="players">
      ${
        players.length
        ? players.map((p,i)=>`
          <div class="player">
            <div class="player-avatar">
              ${escapeHtml(String(p.name || "P").charAt(0))}
            </div>
            <span>${escapeHtml(p.name || "بازیکن " + (i+1))}</span>
          </div>
        `).join("")
        : `<div class="empty" style="grid-column:1/-1">
             هنوز بازیکنی وارد نشده
           </div>`
      }
    </div>

    <div style="height:15px"></div>

    <button class="btn btn-primary"
            style="width:100%"
            onclick="joinRoom('${escapeHtml(room.id)}')">
      ${fee ? "💰 ورود و پرداخت هزینه" : "🎮 ورود به مسابقه"}
    </button>
  `;
}

async function joinRoom(id) {
  try {
    const data = await api("/rooms/" + encodeURIComponent(id) + "/join", {
      method:"POST"
    });

    toast(data.message || "با موفقیت وارد مسابقه شدید");

    const roomData = await api("/rooms/" + encodeURIComponent(id));
    currentRoom = roomData.room || roomData;

    render();
  } catch(e) {
    toast(e.message);
  }
}

async function renderTournaments(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>🏆 تورنمنت‌ها</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div id="tournamentList">
      <div class="loading">در حال دریافت...</div>
    </div>
  `;

  try {
    const data = await api("/tournaments");
    const list = data.tournaments || data || [];

    document.getElementById("tournamentList").innerHTML =
      list.length
      ? list.map(tournamentCard).join("")
      : `<div class="empty">تورنمنتی وجود ندارد</div>`;
  } catch(e) {
    toast(e.message);
  }
}

function tournamentCard(t) {
  return `
    <div class="tournament-card">
      <h3>🏆 ${escapeHtml(t.title || "تورنمنت")}</h3>

      <p>${escapeHtml(t.description || "تورنمنت DARK GAME")}</p>

      <div class="tournament-meta">
        <span class="badge">👥 ${Number(t.capacity || 0)}</span>
        <span class="badge">💰 ${t.entryFee ? money(t.entryFee) : "رایگان"}</span>
        <span class="badge">🎁 ${t.prize ? money(t.prize) : "جایزه"}</span>
      </div>

      <div style="margin-top:13px">
        <button class="btn btn-primary btn-small">
          مشاهده تورنمنت
        </button>
      </div>
    </div>
  `;
}

async function renderTeams(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>👥 تیم‌ها</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div id="teamsList">
      <div class="loading">در حال دریافت...</div>
    </div>

    <button class="btn btn-primary"
            style="width:100%;margin-top:10px"
            onclick="createTeam()">
      ➕ ساخت تیم
    </button>
  `;

  try {
    const data = await api("/teams");
    const teams = data.teams || data || [];

    document.getElementById("teamsList").innerHTML =
      teams.length
      ? teams.map(t=>`
          <div class="card">
            <div class="row">
              <div>
                <h3>${escapeHtml(t.name || "تیم")}</h3>
                <p>${Number(t.members?.length || t.memberCount || 0)} عضو</p>
              </div>
              <span class="badge">👥 تیم</span>
            </div>
          </div>
        `).join("")
      : `<div class="empty">هنوز تیمی ساخته نشده</div>`;
  } catch(e) {
    toast(e.message);
  }
}

async function createTeam() {
  const name = prompt("نام تیم را وارد کنید:");

  if (!name) return;

  try {
    await api("/teams", {
      method:"POST",
      body:JSON.stringify({name})
    });

    toast("تیم ساخته شد");
    render();
  } catch(e) {
    toast(e.message);
  }
}

async function renderShop(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>🛒 فروشگاه</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div id="shopList">
      <div class="loading">در حال دریافت...</div>
    </div>
  `;

  try {
    const data = await api("/shop");
    const items = data.items || data.products || data || [];

    document.getElementById("shopList").innerHTML =
      items.length
      ? `<div class="shop-grid">
          ${items.map(item=>`
            <div class="product">
              <div class="product-img">🎮</div>

              <h3>${escapeHtml(item.title || item.name || "محصول")}</h3>

              <small>
                ${escapeHtml(item.description || "محصول DARK GAME")}
              </small>

              <div class="product-bottom">
                <strong class="money">
                  ${money(item.price || 0)}
                </strong>

                <button class="btn btn-small btn-primary">
                  خرید
                </button>
              </div>
            </div>
          `).join("")}
        </div>`
      : `<div class="empty">فروشگاه خالی است</div>`;
  } catch(e) {
    toast(e.message);
  }
}

async function renderWallet(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>💰 کیف پول</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div class="loading">در حال دریافت اطلاعات مالی...</div>
  `;

  try {
    const data = await api("/wallet");

    const gameBalance = Number(data.gameBalance || 0);
    const withdrawable = Number(data.withdrawableBalance || 0);
    const transactions = data.transactions || [];

    el.innerHTML = `
      <div class="balance-main">
        <small>مجموع موجودی</small>
        <strong>${money(gameBalance + withdrawable)}</strong>
      </div>

      <div class="wallet-grid">
        <div class="wallet-card">
          <small>موجودی بازی</small>
          <strong class="money">${money(gameBalance)}</strong>
        </div>

        <div class="wallet-card">
          <small>قابل برداشت</small>
          <strong class="money">${money(withdrawable)}</strong>
        </div>
      </div>

      <div class="section-title">
        <h2>💳 عملیات مالی</h2>
      </div>

      <div class="admin-grid">
        <button class="admin-action" onclick="topup()">
          <b>➕</b>
          افزایش موجودی
        </button>

        <button class="admin-action" onclick="withdrawMoney()">
          <b>💸</b>
          برداشت وجه
        </button>
      </div>

      <div class="section-title">
        <h2>📋 تراکنش‌ها</h2>
      </div>

      <div class="card">
        ${
          transactions.length
          ? transactions.map(tx=>`
              <div class="transaction">
                <div class="tx-icon">💰</div>

                <div class="tx-info">
                  <b>${escapeHtml(tx.description || tx.type || "تراکنش")}</b>
                  <small>${escapeHtml(tx.createdAt || "")}</small>
                </div>

                <div class="tx-amount ${Number(tx.amount || 0) >= 0 ? "plus":"minus"}">
                  ${money(Math.abs(Number(tx.amount || 0)))}
                </div>
              </div>
            `).join("")
          : `<div class="empty">تراکنشی وجود ندارد</div>`
        }
      </div>
    `;
  } catch(e) {
    toast(e.message);
  }
}

async function topup() {
  const amount = prompt(
    "مبلغ افزایش موجودی را وارد کنید:\nحداقل 100,000 تومان"
  );

  if (!amount) return;

  const value = Number(String(amount).replace(/,/g,""));

  if (!Number.isInteger(value) || value <= 0) {
    toast("مبلغ نامعتبر است");
    return;
  }

  try {
    const data = await api("/wallet/topup", {
      method:"POST",
      body:JSON.stringify({amount:value})
    });

    toast(data.message || "درخواست پرداخت ثبت شد");

    navigate("wallet");
  } catch(e) {
    toast(e.message);
  }
}

async function withdrawMoney() {
  const amount = prompt(
    "مبلغ برداشت را وارد کنید:\nحداقل 100,000 و حداکثر 5,000,000 تومان"
  );

  if (!amount) return;

  const value = Number(String(amount).replace(/,/g,""));

  if (!Number.isInteger(value) || value <= 0) {
    toast("مبلغ نامعتبر است");
    return;
  }

  try {
    const data = await api("/wallet/withdraw", {
      method:"POST",
      body:JSON.stringify({amount:value})
    });

    toast(data.message || "درخواست برداشت ثبت شد");

    navigate("wallet");
  } catch(e) {
    toast(e.message);
  }
}

async function renderProfile(el) {
  try {
    const data = await api("/auth/me");
    currentUser = data.user || data;
  } catch {}

  const xp = Number(currentUser.xp || 0);
  const level = Number(currentUser.level || 1);

  el.innerHTML = `
    <div class="page-head">
      <h2>👤 پروفایل</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div class="profile-card">
      <div class="profile-avatar">
        ${escapeHtml((currentUser.name || "K").charAt(0))}
      </div>

      <h2>${escapeHtml(currentUser.name || "بازیکن")}</h2>

      <small>
        ${escapeHtml(currentUser.phone || "")}
      </small>

      <div style="margin-top:10px">
        <span class="badge">LEVEL ${level}</span>
      </div>

      <div class="level-bar">
        <div class="level-progress"
             style="width:${Math.min(100, xp % 100)}%">
        </div>
      </div>

      <small>XP: ${xp}</small>

      <div class="profile-stats">
        <div class="profile-stat">
          <b>${level}</b>
          <small>سطح</small>
        </div>

        <div class="profile-stat">
          <b>${money(currentUser.gameBalance || 0)}</b>
          <small>موجودی بازی</small>
        </div>

        <div class="profile-stat">
          <b>${money(currentUser.withdrawableBalance || 0)}</b>
          <small>قابل برداشت</small>
        </div>
      </div>
    </div>

    <div class="menu-list">

      <button class="menu-item" onclick="editProfile()">
        <span>✏️ ویرایش پروفایل</span>
        <small>›</small>
      </button>

      <button class="menu-item" onclick="navigate('wallet')">
        <span>💰 کیف پول و افزایش موجودی</span>
        <small>›</small>
      </button>

      <button class="menu-item" onclick="navigate('teams')">
        <span>👥 تیم‌های من</span>
        <small>›</small>
      </button>

      <button class="menu-item" onclick="navigate('support')">
        <span>🎫 پشتیبانی</span>
        <small>›</small>
      </button>

      ${
        currentUser.role === "owner"
        ? `
        <button class="menu-item" onclick="navigate('owner')">
          <span>👑 مرکز کنترل مالک</span>
          <small>›</small>
        </button>`
        : ""
      }

      <button class="menu-item" onclick="logout()">
        <span style="color:#ff7180">🚪 خروج از حساب</span>
        <small>›</small>
      </button>

    </div>
  `;
}

async function editProfile() {
  const name = prompt(
    "نام نمایشی جدید:",
    currentUser.name || ""
  );

  if (!name) return;

  try {
    const data = await api("/profile", {
      method:"PUT",
      body:JSON.stringify({name})
    });

    currentUser = data.user || data;
    toast("پروفایل بروزرسانی شد");
    render();
  } catch(e) {
    toast(e.message);
  }
}

async function logout() {
  try {
    await api("/auth/logout", {method:"POST"});
  } catch {}

  localStorage.removeItem("killzone_token");
  currentUser = null;
  currentPage = "home";

  render();

  toast("از حساب خارج شدید");
}

async function renderSupport(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>🎫 پشتیبانی</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <button class="btn btn-primary"
            style="width:100%;margin-bottom:15px"
            onclick="createSupportTicket()">
      ➕ ایجاد تیکت جدید
    </button>

    <div id="supportList">
      <div class="loading">در حال دریافت...</div>
    </div>
  `;

  try {
    const data = await api("/support/tickets");
    const tickets = data.tickets || data || [];

    document.getElementById("supportList").innerHTML =
      tickets.length
      ? tickets.map(t=>`
        <button class="card"
                style="width:100%;text-align:right;color:white"
                onclick="openSupportTicket('${escapeHtml(t.id)}')">

          <div class="row">
            <strong>${escapeHtml(t.subject || "تیکت")}</strong>
            <span class="badge">${escapeHtml(t.status || "open")}</span>
          </div>

          <p>${escapeHtml(t.createdAt || "")}</p>
        </button>
      `).join("")
      : `<div class="empty">تیکتی ندارید</div>`;
  } catch(e) {
    toast(e.message);
  }
}

async function createSupportTicket() {
  const subject = prompt("موضوع تیکت:");

  if (!subject) return;

  const message = prompt("پیام شما:");

  if (!message) return;

  try {
    await api("/support/tickets", {
      method:"POST",
      body:JSON.stringify({subject,message})
    });

    toast("تیکت ایجاد شد");
    render();
  } catch(e) {
    toast(e.message);
  }
}

async function openSupportTicket(id) {
  try {
    const data = await api("/support/tickets/" + encodeURIComponent(id));
    const ticket = data.ticket || data;

    app.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <div class="brand-logo">KZ</div>
          <div class="brand-text">
            <b>DARK GAME</b>
            <small>SUPPORT</small>
          </div>
        </div>
      </div>

      <main class="container">

        <div class="page-head">
          <h2>${escapeHtml(ticket.subject || "تیکت")}</h2>
          <button class="back" onclick="navigate('support')">‹</button>
        </div>

        <div class="card" id="ticketMessages">
          ${
            (ticket.messages || []).map(m=>`
              <div class="support-message ${m.userId === currentUser.id ? "me":""}">
                ${escapeHtml(m.message || m.text || "")}
              </div>
            `).join("")
          }
        </div>

        <div class="form-group">
          <textarea id="supportMessage"
                    class="input"
                    rows="4"
                    placeholder="پیام خود را بنویسید..."></textarea>
        </div>

        <button class="btn btn-primary"
                style="width:100%"
                onclick="sendSupportMessage('${escapeHtml(id)}')">
          ارسال پیام
        </button>

      </main>
    `;
  } catch(e) {
    toast(e.message);
  }
}

async function sendSupportMessage(id) {
  const input = document.getElementById("supportMessage");
  const message = input.value.trim();

  if (!message) return;

  try {
    await api("/support/tickets/" + encodeURIComponent(id) + "/messages", {
      method:"POST",
      body:JSON.stringify({message})
    });

    toast("پیام ارسال شد");
    openSupportTicket(id);
  } catch(e) {
    toast(e.message);
  }
}

async function renderOwner(el) {
  if (currentUser.role !== "owner") {
    el.innerHTML = `
      <div class="empty">
        دسترسی غیرمجاز
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="page-head">
      <h2>👑 مرکز کنترل مالک</h2>
      <button class="back" onclick="navigate('home')">⌂</button>
    </div>

    <div id="ownerContent">
      <div class="loading">در حال دریافت اطلاعات...</div>
    </div>
  `;

  try {
    const data = await api("/owner/dashboard");
    const s = data.stats || {};

    document.getElementById("ownerContent").innerHTML = `

      <div class="stat-grid">
        <div class="stat-box">
          <b>${s.users || 0}</b>
          <small>کاربران</small>
        </div>

        <div class="stat-box">
          <b>${s.rooms || 0}</b>
          <small>مسابقات</small>
        </div>

        <div class="stat-box">
          <b>${s.tournaments || 0}</b>
          <small>تورنمنت‌ها</small>
        </div>

        <div class="stat-box">
          <b>${s.teams || 0}</b>
          <small>تیم‌ها</small>
        </div>
      </div>

      <div class="section-title">
        <h2>🎮 مدیریت مسابقات</h2>
      </div>

      <div class="admin-box">
        <div class="admin-grid">

          <button class="admin-action"
                  onclick="ownerCreateRoom()">
            <b>⚔️</b>
            ساخت مسابقه
          </button>

          <button class="admin-action"
                  onclick="navigate('matches')">
            <b>🔥</b>
            مدیریت روم‌ها
          </button>

          <button class="admin-action"
                  onclick="ownerCreateTournament()">
            <b>🏆</b>
            ساخت تورنمنت
          </button>

          <button class="admin-action"
                  onclick="navigate('tournaments')">
            <b>🎯</b>
            تورنمنت‌ها
          </button>

        </div>
      </div>

      <div class="section-title">
        <h2>👥 مدیریت کاربران</h2>
      </div>

      <div class="admin-box">
        <div class="admin-grid">

          <button class="admin-action"
                  onclick="ownerUsers()">
            <b>👤</b>
            کاربران
          </button>

          <button class="admin-action"
                  onclick="ownerManagers()">
            <b>🛡️</b>
            مدیران
          </button>

          <button class="admin-action"
                  onclick="ownerReward()">
            <b>🎁</b>
            پاداش دستی
          </button>

          <button class="admin-action"
                  onclick="navigate('teams')">
            <b>👥</b>
            تیم‌ها
          </button>

        </div>
      </div>

      <div class="section-title">
        <h2>💰 مرکز مالی</h2>
      </div>

      <div class="admin-box">
        <div class="admin-grid">

          <button class="admin-action"
                  onclick="ownerWithdrawals()">
            <b>💸</b>
            برداشت‌ها
          </button>

          <button class="admin-action"
                  onclick="ownerFinanceSettings()">
            <b>⚙️</b>
            تنظیمات مالی
          </button>

          <button class="admin-action"
                  onclick="ownerDeposits()">
            <b>💳</b>
            واریزی‌ها
          </button>

          <button class="admin-action"
                  onclick="ownerTransactions()">
            <b>🧾</b>
            تراکنش‌ها
          </button>

          <button class="admin-action"
                  onclick="ownerPaymentGateway()">
            <b>🏦</b>
            درگاه و کارت تسویه
          </button>

        </div>
      </div>

      <div class="section-title">
        <h2>📢 محتوا و خدمات</h2>
      </div>

      <div class="admin-box">
        <div class="admin-grid">

          <button class="admin-action"
                  onclick="ownerNews()">
            <b>📰</b>
            اخبار
          </button>

          <button class="admin-action"
                  onclick="ownerAds()">
            <b>📣</b>
            تبلیغات
          </button>

          <button class="admin-action"
                  onclick="ownerNotifications()">
            <b>🔔</b>
            اعلان‌ها
          </button>

          <button class="admin-action"
                  onclick="navigate('support')">
            <b>🎫</b>
            پشتیبانی
          </button>

        </div>
      </div>

      <div class="section-title">
        <h2>🛡️ سیستم</h2>
      </div>

      <div class="admin-box">
        <div class="admin-grid">

          <button class="admin-action"
                  onclick="ownerSecurity()">
            <b>🔐</b>
            امنیت
          </button>

          <button class="admin-action"
                  onclick="ownerSettings()">
            <b>⚙️</b>
            تنظیمات
          </button>

          <button class="admin-action"
                  onclick="ownerLogs()">
            <b>📋</b>
            گزارش فعالیت
          </button>

          <button class="admin-action"
                  onclick="ownerProfile()">
            <b>👑</b>
            پروفایل مالک
          </button>

        </div>
      </div>

      <div class="card">
        <div class="row">
          <span>موجودی بازی کاربران</span>
          <strong class="money">
            ${money(s.totalGameBalance || 0)}
          </strong>
        </div>

        <div class="row" style="margin-top:12px">
          <span>قابل برداشت کاربران</span>
          <strong class="money">
            ${money(s.totalWithdrawableBalance || 0)}
          </strong>
        </div>

        <div class="row" style="margin-top:12px">
          <span>برداشت‌های در انتظار</span>
          <strong>
            ${s.pendingWithdrawals || 0}
          </strong>
        </div>
      </div>
    `;
  } catch(e) {
    toast(e.message);
  }
}

async function ownerCreateRoom() {
  const title = prompt("عنوان مسابقه:");
  if (!title) return;

  const entry = prompt("هزینه ورود به تومان:\nبرای رایگان 0 وارد کنید","0");
  const capacity = prompt("ظرفیت بازیکنان:","2");
  const mode = prompt("حالت بازی:","Multiplayer");

  try {
    await api("/owner/rooms", {
      method:"POST",
      body:JSON.stringify({
        title,
        entryFee:Number(entry || 0),
        capacity:Number(capacity || 2),
        mode
      })
    });

    toast("مسابقه ساخته شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerCreateTournament() {
  const title = prompt("نام تورنمنت:");
  if (!title) return;

  const entryFee = prompt("هزینه ورود:");
  const prize = prompt("جایزه:");
  const capacity = prompt("ظرفیت:");

  try {
    await api("/owner/tournaments", {
      method:"POST",
      body:JSON.stringify({
        title,
        entryFee:Number(entryFee || 0),
        prize:Number(prize || 0),
        capacity:Number(capacity || 16)
      })
    });

    toast("تورنمنت ساخته شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerUsers() {
  try {
    const data = await api("/owner/users");
    const users = data.users || [];

    app.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <div class="brand-logo">KZ</div>
          <div class="brand-text">
            <b>DARK GAME</b>
            <small>USERS</small>
          </div>
        </div>
      </div>

      <main class="container">
        <div class="page-head">
          <h2>👤 کاربران</h2>
          <button class="back" onclick="navigate('owner')">‹</button>
        </div>

        ${
          users.length
          ? users.map(u=>`
            <div class="card">
              <div class="row">
                <div>
                  <strong>${escapeHtml(u.name || "بدون نام")}</strong>
                  <p>${escapeHtml(u.phone || "")}</p>
                </div>

                <span class="badge">
                  ${escapeHtml(u.role || "user")}
                </span>
              </div>
            </div>
          `).join("")
          : `<div class="empty">کاربری وجود ندارد</div>`
        }
      </main>
    `;
  } catch(e) {
    toast(e.message);
  }
}

async function ownerManagers() {
  const role = prompt(
    "نقش مدیر را وارد کنید:\nadmin یا finance_manager"
  );

  if (!role) return;

  const phone = prompt("شماره موبایل کاربر:");

  if (!phone) return;

  try {
    await api("/owner/users/role", {
      method:"POST",
      body:JSON.stringify({phone,role})
    });

    toast("دسترسی کاربر تغییر کرد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerReward() {
  const phone = prompt("شماره موبایل کاربر:");
  if (!phone) return;

  const amount = prompt("مبلغ پاداش:");
  if (!amount) return;

  const description = prompt("دلیل پاداش:","پاداش دستی");

  try {
    await api("/owner/rewards", {
      method:"POST",
      body:JSON.stringify({
        phone,
        amount:Number(amount),
        description
      })
    });

    toast("پاداش اضافه شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerWithdrawals() {
  try {
    const data = await api("/owner/withdrawals");
    const withdrawals = data.withdrawals || [];

    app.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <div class="brand-logo">KZ</div>
          <div class="brand-text">
            <b>DARK GAME</b>
            <small>WITHDRAWALS</small>
          </div>
        </div>
      </div>

      <main class="container">

        <div class="page-head">
          <h2>💸 برداشت‌ها</h2>
          <button class="back" onclick="navigate('owner')">‹</button>
        </div>

        ${
          withdrawals.length
          ? withdrawals.map(w=>`
            <div class="card">
              <h3>${money(w.amount)}</h3>

              <p>
                کاربر: ${escapeHtml(w.userId || "")}
                <br>
                وضعیت: ${escapeHtml(w.status || "")}
              </p>

              ${
                w.status === "pending"
                ? `
                <div class="hero-actions">

                  <button class="btn btn-success btn-small"
                          onclick="changeWithdrawal('${escapeHtml(w.id)}','approved')">
                    تأیید
                  </button>

                  <button class="btn btn-danger btn-small"
                          onclick="changeWithdrawal('${escapeHtml(w.id)}','rejected')">
                    رد
                  </button>

                </div>
                `
                : ""
              }
            </div>
          `).join("")
          : `<div class="empty">برداشت در انتظاری وجود ندارد</div>`
        }

      </main>
    `;
  } catch(e) {
    toast(e.message);
  }
}

async function changeWithdrawal(id,status) {
  try {
    await api("/owner/withdrawals/" + encodeURIComponent(id), {
      method:"PATCH",
      body:JSON.stringify({status})
    });

    toast("وضعیت برداشت تغییر کرد");
    ownerWithdrawals();
  } catch(e) {
    toast(e.message);
  }
}

async function ownerFinanceSettings() {
  try {
    const data = await api("/owner/finance-settings");
    const f = data.finance || data.settings || data;

    const minTopup = prompt("حداقل افزایش موجودی:",f.minTopup);
    const maxTopup = prompt("حداکثر افزایش موجودی:",f.maxTopup);
    const minWithdraw = prompt("حداقل برداشت:",f.minWithdraw);
    const maxWithdraw = prompt("حداکثر برداشت:",f.maxWithdraw);

    if (minTopup === null) return;

    await api("/owner/finance-settings", {
      method:"PUT",
      body:JSON.stringify({
        minTopup:Number(minTopup),
        maxTopup:Number(maxTopup),
        minWithdraw:Number(minWithdraw),
        maxWithdraw:Number(maxWithdraw)
      })
    });

    toast("تنظیمات مالی ذخیره شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerPaymentGateway() {
  try {
    const data = await api("/owner/payment-settings");
    const p = data.payment || data.settings || data;

    const card = prompt(
      "شماره کارت تسویه جدید:\nاطلاعات حساس را فقط در محیط امن وارد کنید.",
      p.settlementCardMasked || ""
    );

    if (card === null) return;

    await api("/owner/payment-settings", {
      method:"PUT",
      body:JSON.stringify({
        settlementCard:card
      })
    });

    toast("تنظیمات تسویه ذخیره شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerNews() {
  const title = prompt("عنوان خبر:");
  if (!title) return;

  const body = prompt("متن خبر:");
  if (!body) return;

  try {
    await api("/owner/news", {
      method:"POST",
      body:JSON.stringify({title,body})
    });

    toast("خبر منتشر شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerAds() {
  toast("بخش تبلیغات در Backend آماده اتصال است");
}

async function ownerNotifications() {
  const title = prompt("عنوان اعلان:");
  if (!title) return;

  const body = prompt("متن اعلان:");
  if (!body) return;

  try {
    await api("/owner/notifications", {
      method:"POST",
      body:JSON.stringify({title,body})
    });

    toast("اعلان ارسال شد");
  } catch(e) {
    toast(e.message);
  }
}

async function ownerSecurity() {
  toast("تنظیمات امنیتی در حال آماده‌سازی است");
}

async function ownerSettings() {
  toast("تنظیمات برنامه در مرکز کنترل قرار می‌گیرد");
}

async function ownerLogs() {
  toast("گزارش فعالیت‌ها در Backend ثبت می‌شود");
}

async function ownerProfile() {
  try {
    const data = await api("/owner/profile");
    const user = data.user || data;

    const name = prompt(
      "نام نمایشی مالک:",
      user.name || ""
    );

    if (!name) return;

    await api("/owner/profile", {
      method:"PUT",
      body:JSON.stringify({name})
    });

    toast("پروفایل مالک بروزرسانی شد");
    render();
  } catch(e) {
    toast(e.message);
  }
}

window.navigate = navigate;
window.render = render;
window.requestLoginOtp = requestLoginOtp;
window.verifyLoginOtp = verifyLoginOtp;
window.openRoom = openRoom;
window.joinRoom = joinRoom;
window.filterRooms = filterRooms;
window.createTeam = createTeam;
window.topup = topup;
window.withdrawMoney = withdrawMoney;
window.editProfile = editProfile;
window.logout = logout;
window.createSupportTicket = createSupportTicket;
window.openSupportTicket = openSupportTicket;
window.sendSupportMessage = sendSupportMessage;
window.ownerCreateRoom = ownerCreateRoom;
window.ownerCreateTournament = ownerCreateTournament;
window.ownerUsers = ownerUsers;
window.ownerManagers = ownerManagers;
window.ownerReward = ownerReward;
window.ownerWithdrawals = ownerWithdrawals;
window.changeWithdrawal = changeWithdrawal;
window.ownerFinanceSettings = ownerFinanceSettings;
window.ownerPaymentGateway = ownerPaymentGateway;
window.ownerNews = ownerNews;
window.ownerAds = ownerAds;
window.ownerNotifications = ownerNotifications;
window.ownerSecurity = ownerSecurity;
window.ownerSettings = ownerSettings;
window.ownerLogs = ownerLogs;
window.ownerProfile = ownerProfile;

boot();

/* ===== DARK GAME OWNER FINANCE ===== */

async function ownerDeposits() {
  try {
    const data = await api("/owner/transactions");
    const transactions = (data.transactions || []).filter(t =>
      ["TOPUP", "DEPOSIT", "PAYMENT", "TOP_UP"].includes(String(t.type || "").toUpperCase())
    );

    const page = document.getElementById("page");
    if (!page) return;

    page.innerHTML = `
      <div class="page-head">
        <button class="back-btn" onclick="navigate('owner')">‹</button>
        <div>
          <h2>💳 واریزی‌های کاربران</h2>
          <p>آخرین واریزی‌های ثبت‌شده</p>
        </div>
      </div>

      <div class="card">
        ${
          transactions.length
          ? transactions.map(t => `
            <div class="transaction-row">
              <div>
                <strong>${escapeHtml(t.userName || t.name || "کاربر")}</strong>
                <small>${escapeHtml(t.description || "افزایش موجودی")}</small>
                <small>${formatDate(t.createdAt)}</small>
              </div>
              <strong class="money">+${money(t.amount)} تومان</strong>
            </div>
          `).join("")
          : `<div class="empty">هنوز واریزی‌ای ثبت نشده است.</div>`
        }
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function ownerTransactions() {
  try {
    const data = await api("/owner/transactions");
    const transactions = data.transactions || [];

    const page = document.getElementById("page");
    if (!page) return;

    page.innerHTML = `
      <div class="page-head">
        <button class="back-btn" onclick="navigate('owner')">‹</button>
        <div>
          <h2>🧾 تمام تراکنش‌ها</h2>
          <p>تاریخچه کامل گردش مالی کاربران</p>
        </div>
      </div>

      <div class="card">
        ${
          transactions.length
          ? transactions.map(t => {
              const amount = Number(t.amount || 0);
              const positive = amount >= 0;

              return `
                <div class="transaction-row">
                  <div>
                    <strong>${escapeHtml(t.userName || t.name || t.userId || "کاربر")}</strong>
                    <small>${escapeHtml(t.type || "TRANSACTION")}</small>
                    <small>${escapeHtml(t.description || "")}</small>
                    <small>${formatDate(t.createdAt)}</small>
                  </div>

                  <strong class="money">
                    ${positive ? "+" : ""}${money(amount)} تومان
                  </strong>
                </div>
              `;
            }).join("")
          : `<div class="empty">هیچ تراکنشی ثبت نشده است.</div>`
        }
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

window.ownerDeposits = ownerDeposits;
window.ownerTransactions = ownerTransactions;

console.log("DARK GAME OWNER FINANCE UI READY");

