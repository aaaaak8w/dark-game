const API = "/api";

let state = {
  token: localStorage.getItem("killzone_token") || "",
  user: JSON.parse(localStorage.getItem("killzone_user") || "null"),
  page: "home",
  rooms: [],
  deposits: [],
  freeMatches: []
};

const money = n =>
  Number(n || 0).toLocaleString("fa-IR") + " تومان";

function saveUser(user) {
  state.user = user;
  localStorage.setItem("killzone_user", JSON.stringify(user));
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(API + path, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({
    success: false,
    message: "پاسخ نامعتبر از سرور"
  }));

  if (res.status === 401) {
    logout(false);
  }

  if (!res.ok) {
    throw new Error(data.message || "خطا");
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(text) {
  let el = document.querySelector(".toast");

  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }

  el.textContent = text;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2500);
}

async function start() {
  if (!state.token) {
    renderLogin();
    return;
  }

  try {
    const data = await api("/auth/me");
    saveUser(data.user);
    renderApp();
  } catch {
    logout(false);
    renderLogin();
  }
}

/* =========================
   LOGIN
========================= */

function renderLogin() {
  document.body.innerHTML = `
    <div class="auth-screen">
      <div class="auth-glow"></div>

      <div class="auth-card">
        <div class="brand">
          <div class="brand-logo">KZ</div>
          <h1>KILL ZONE</h1>
          <p>میدان رقابت حرفه‌ای‌ها</p>
        </div>

        <div id="loginStep">
          <label>نام کاربری</label>
          <input id="username" placeholder="مثلاً Nima45">

          <label>شماره موبایل</label>
          <input id="phone" type="tel" inputmode="tel"
                 placeholder="09xxxxxxxxx">

          <button class="primary-btn" onclick="requestOtp()">
            ورود به KILL ZONE
          </button>
        </div>

        <div id="otpStep" class="hidden">
          <div class="otp-title">کد تأیید را وارد کن</div>
          <p class="muted">کد ارسال‌شده را وارد کنید.</p>

          <input id="otp"
                 inputmode="numeric"
                 maxlength="6"
                 placeholder="••••••">

          <button class="primary-btn" onclick="verifyOtp()">
            تأیید و ورود
          </button>

          <button class="ghost-btn" onclick="backLogin()">
            تغییر شماره
          </button>
        </div>

        <div class="auth-footer">
          KILL ZONE • PLAY • COMPETE • WIN
        </div>
      </div>
    </div>
  `;
}

async function requestOtp() {
  const username = document.querySelector("#username").value.trim();
  const phone = document.querySelector("#phone").value.trim();

  if (!username || !phone) {
    return toast("نام کاربری و شماره موبایل را وارد کنید");
  }

  try {
    await api("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ username, phone })
    });

    document.querySelector("#loginStep").classList.add("hidden");
    document.querySelector("#otpStep").classList.remove("hidden");

    toast("کد تأیید ارسال شد");
  } catch (e) {
    toast(e.message);
  }
}

async function verifyOtp() {
  const phone = document.querySelector("#phone").value.trim();
  const code = document.querySelector("#otp").value.trim();

  try {
    const data = await api("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code })
    });

    state.token = data.token;
    localStorage.setItem("killzone_token", data.token);

    saveUser(data.user);
    renderApp();

    toast("خوش آمدید به KILL ZONE");
  } catch (e) {
    toast(e.message);
  }
}

function backLogin() {
  renderLogin();
}

/* =========================
   APP SHELL
========================= */

function renderApp() {
  document.body.innerHTML = `
    <div class="app-shell">

      <header class="topbar">
        <div class="top-user">
          <div class="small-text">خوش آمدی 👋</div>
          <div class="top-name">
            ${escapeHtml(state.user?.name || "بازیکن")}
          </div>
        </div>

        <div class="top-actions">
          <button class="top-icon" onclick="navigate('notifications')">
            🔔
          </button>

          <button class="avatar" onclick="navigate('profile')">
            ${(state.user?.name || "K").charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <main id="content"></main>

      <nav class="bottom-nav">
        <button onclick="navigate('home')" data-nav="home">
          <span>⌂</span>
          خانه
        </button>

        <button onclick="navigate('matches')" data-nav="matches">
          <span>⚔</span>
          مسابقات
        </button>

        <button class="nav-plus" onclick="navigate('create')">
          +
        </button>

        <button onclick="navigate('teams')" data-nav="teams">
          <span>♟</span>
          تیم‌ها
        </button>

        <button onclick="navigate('profile')" data-nav="profile">
          <span>◉</span>
          پروفایل
        </button>
      </nav>
    </div>
  `;

  navigate(state.page || "home");
}

async function navigate(page) {
  state.page = page;

  const content = document.querySelector("#content");
  if (!content) return;

  if (page === "home") return renderHome(content);
  if (page === "matches") return renderMatches(content);
  if (page === "teams") return renderTeams(content);
  if (page === "shop") return renderShop(content);
  if (page === "wallet") return renderWallet(content);
  if (page === "profile") return renderProfile(content);
  if (page === "tournaments") return renderTournaments(content);
  if (page === "create") return renderCreate(content);
  if (page === "owner") return renderOwner(content);
  if (page === "support") return renderSupport(content);
  if (page === "notifications") return renderNotifications(content);
}

/* =========================
   HOME
========================= */

async function renderHome(el) {
  const user = state.user;
  let rooms = [];

  try {
    rooms = (await api("/rooms")).rooms || [];
    state.rooms = rooms;
  } catch {}

  let transactions = [];

  try {
    transactions = (await api("/wallet/transactions")).transactions || [];
  } catch {}

  const deposits = transactions
    .filter(t =>
      Number(t.amount) > 0 ||
      String(t.type || "").toUpperCase().includes("TOP")
    )
    .slice(0, 10);

  state.deposits = deposits;

  el.innerHTML = `
    <section class="home-hero">
      <div class="hero-content">
        <span class="hero-kicker">KILL ZONE</span>
        <h1>آماده‌ای وارد میدان بشی؟</h1>
        <p>
          مسابقه انتخاب کن، وارد روم شو و رتبه خودت رو بساز.
        </p>

        <div class="hero-buttons">
          <button onclick="navigate('matches')">
            🎮 مشاهده مسابقات
          </button>

          <button class="hero-secondary"
                  onclick="navigate('wallet')">
            💰 کیف پول
          </button>
        </div>
      </div>

      <div class="hero-symbol">⚡</div>
    </section>

    <section class="latest-money">
      <div class="section-title-row">
        <div>
          <span class="eyebrow">ACTIVITY</span>
          <h2>آخرین واریزی‌ها</h2>
        </div>
        <button onclick="navigate('wallet')">همه ›</button>
      </div>

      <div class="horizontal-scroll money-scroll">
        ${
          deposits.length
            ? deposits.map(depositCard).join("")
            : `
              <div class="deposit-card empty">
                <strong>💰</strong>
                <span>هنوز واریزی ثبت نشده</span>
              </div>
            `
        }
      </div>
    </section>

    <section class="quick-section">
      <div class="section-title-row">
        <div>
          <span class="eyebrow">DISCOVER</span>
          <h2>دسترسی سریع</h2>
        </div>
      </div>

      <div class="home-quick-grid">

        <button class="quick-big"
                onclick="navigate('notifications')">
          <span>🔔</span>
          <strong>اطلاع‌رسانی</strong>
          <small>اخبار و پیام‌ها</small>
        </button>

        <button class="quick-big"
                onclick="showLeaderboard()">
          <span>🏆</span>
          <strong>لیدربرد</strong>
          <small>رتبه بازیکنان</small>
        </button>

        <button class="quick-big"
                onclick="navigate('teams')">
          <span>👥</span>
          <strong>تیم شما</strong>
          <small>تیم و اعضا</small>
        </button>

        <button class="quick-big"
                onclick="navigate('shop')">
          <span>🛒</span>
          <strong>فروشگاه</strong>
          <small>محصولات و تخفیف‌ها</small>
        </button>

        <button class="quick-big"
                onclick="navigate('support')">
          <span>🎫</span>
          <strong>پشتیبانی</strong>
          <small>تیکت و ارتباط با مدیریت</small>
        </button>

        <button class="quick-big"
                onclick="navigate('wallet')">
          <span>💳</span>
          <strong>کیف پول</strong>
          <small>شارژ و برداشت</small>
        </button>

      </div>
    </section>

    <section class="advanced-search-box">
      <div>
        <span class="eyebrow">SMART SEARCH</span>
        <h2>جست‌وجوی پیشرفته روم‌ها</h2>
        <p>روم مناسب خودت را با فیلترهای مختلف پیدا کن.</p>
      </div>

      <button onclick="advancedRoomSearch()">
        🔎 جست‌وجوی روم
      </button>
    </section>

    <section class="free-section">
      <div class="section-title-row">
        <div>
          <span class="eyebrow">FREE ZONE</span>
          <h2>مسابقات رایگان</h2>
        </div>

        <button onclick="navigate('matches')">
          همه ›
        </button>
      </div>

      <div class="horizontal-scroll">
        ${
          rooms.filter(r =>
            Number(r.entryFee || 0) === 0
          ).length
            ? rooms
                .filter(r => Number(r.entryFee || 0) === 0)
                .slice(0, 8)
                .map(freeMatchCard)
                .join("")
            : `
              <div class="empty-horizontal">
                🆓
                <strong>مسابقه رایگان جدیدی نیست</strong>
                <span>به‌زودی برنامه‌های رایگان اضافه می‌شوند.</span>
              </div>
            `
        }
      </div>
    </section>

    <section class="rooms-section">
      <div class="section-title-row">
        <div>
          <span class="eyebrow">LIVE MATCHES</span>
          <h2>روم‌های فعال</h2>
        </div>

        <button onclick="navigate('matches')">
          همه ›
        </button>
      </div>

      <div class="horizontal-scroll room-horizontal">
        ${
          rooms.length
            ? rooms.slice(0, 8).map(roomCardSquare).join("")
            : `
              <div class="empty-horizontal">
                🎮
                <strong>هنوز رومی ساخته نشده</strong>
                <span>منتظر مسابقات جدید باشید.</span>
              </div>
            `
        }
      </div>
    </section>

    <section class="home-wallet-mini"
             onclick="navigate('wallet')">
      <div>
        <span>موجودی کل</span>
        <strong>
          ${money(
            Number(user?.gameBalance || 0) +
            Number(user?.withdrawableBalance || 0)
          )}
        </strong>
      </div>
      <span class="wallet-arrow">‹</span>
    </section>
  `;
}

function depositCard(t) {
  return `
    <article class="deposit-card">
      <div class="deposit-icon">↗</div>
      <div>
        <strong>+${money(Math.abs(t.amount))}</strong>
        <span>${escapeHtml(t.description || "واریزی")}</span>
      </div>
    </article>
  `;
}

function freeMatchCard(room) {
  return `
    <article class="free-match-card"
             onclick="openRoom('${escapeHtml(room.id)}')">

      <div class="free-match-image">
        ${
          room.image
            ? `<img src="${escapeHtml(room.image)}" alt="">`
            : `<span>🆓</span>`
        }

        <b>رایگان</b>
      </div>

      <div class="free-match-body">
        <h3>${escapeHtml(room.title || "مسابقه رایگان")}</h3>
        <p>
          🕐 ${escapeHtml(
            room.startTime || room.time || "زمان اعلام نشده"
          )}
        </p>
      </div>
    </article>
  `;
}

function roomCardSquare(room) {
  const players = (room.players || []).length;
  const capacity = room.capacity || 0;

  return `
    <article class="room-square"
             onclick="openRoom('${escapeHtml(room.id)}')">

      <div class="room-cover">
        ${
          room.image
            ? `<img src="${escapeHtml(room.image)}" alt="">`
            : `<div class="room-cover-placeholder">⚡</div>`
        }

        <span class="room-status">
          ${room.status === "open" ? "🟢 باز" : "🔒 بسته"}
        </span>
      </div>

      <div class="room-square-body">
        <span class="game-tag">
          ${escapeHtml(room.game || "Call of Duty")}
        </span>

        <h3>${escapeHtml(room.title || "روم KILL ZONE")}</h3>

        <div class="room-mini-info">
          <span>👥 ${players}/${capacity}</span>
          <strong>
            ${
              Number(room.entryFee || 0) === 0
                ? "رایگان"
                : money(room.entryFee)
            }
          </strong>
        </div>
      </div>
    </article>
  `;
}

/* =========================
   MATCHES
========================= */

async function renderMatches(el) {
  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">KILL ZONE ARENA</span>
      <h2>مسابقات</h2>
      <p>مسابقه مناسب خودت را پیدا کن.</p>
    </div>

    <div class="match-search">
      <input id="matchSearch"
             placeholder="🔎 جست‌وجوی نام روم..."
             oninput="filterRooms()">

      <button onclick="advancedRoomSearch()">⚙</button>
    </div>

    <div class="tabs">
      <button class="active" onclick="filterMatchTab('all', this)">
        همه
      </button>
      <button onclick="filterMatchTab('free', this)">
        🆓 رایگان
      </button>
      <button onclick="filterMatchTab('paid', this)">
        💰 پولی
      </button>
      <button onclick="filterMatchTab('battle', this)">
        🔥 بتل
      </button>
    </div>

    <div id="roomsList">
      <div class="loading">در حال دریافت مسابقات...</div>
    </div>
  `;

  try {
    const data = await api("/rooms");
    state.rooms = data.rooms || [];

    document.querySelector("#roomsList").innerHTML =
      state.rooms.length
        ? state.rooms.map(roomCardLarge).join("")
        : emptyCard(
            "مسابقه‌ای موجود نیست",
            "منتظر ایجاد مسابقات جدید باشید."
          );
  } catch (e) {
    document.querySelector("#roomsList").innerHTML =
      emptyCard("خطا", e.message);
  }
}

function roomCardLarge(room) {
  const players = (room.players || []).length;

  return `
    <article class="match-card-large"
             data-title="${escapeHtml(room.title || "")}">

      <div class="large-cover">
        ${
          room.image
            ? `<img src="${escapeHtml(room.image)}" alt="">`
            : `<div class="large-cover-placeholder">🎮</div>`
        }

        <span>
          ${room.status === "open" ? "🟢 ثبت‌نام" : "🔒 بسته"}
        </span>
      </div>

      <div class="large-body">
        <div class="match-top">
          <span class="game-tag">
            ${escapeHtml(room.game || "Call of Duty")}
          </span>
          <span>${escapeHtml(room.mode || "Multiplayer")}</span>
        </div>

        <h3>${escapeHtml(room.title || "روم KILL ZONE")}</h3>

        <div class="large-info">
          <span>👥 ${players}/${room.capacity || 0}</span>
          <span>🕐 ${escapeHtml(room.startTime || "زمان اعلام نشده")}</span>
        </div>

        <div class="match-bottom">
          <strong>
            ${
              Number(room.entryFee || 0) === 0
                ? "رایگان"
                : money(room.entryFee)
            }
          </strong>

          <button onclick="openRoom('${escapeHtml(room.id)}')">
            مشاهده روم
          </button>
        </div>
      </div>
    </article>
  `;
}

function filterRooms() {
  const q =
    document.querySelector("#matchSearch")?.value
      .trim()
      .toLowerCase() || "";

  document.querySelectorAll(".match-card-large").forEach(card => {
    const title =
      card.dataset.title?.toLowerCase() || "";

    card.style.display =
      !q || title.includes(q) ? "" : "none";
  });
}

function filterMatchTab(type, btn) {
  document.querySelectorAll(".tabs button")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");

  document.querySelectorAll(".match-card-large")
    .forEach(card => {
      const text = card.textContent.toLowerCase();

      let show = true;

      if (type === "free") show = text.includes("رایگان");
      if (type === "paid") show = !text.includes("رایگان");
      if (type === "battle") show = text.includes("بتل");

      card.style.display = show ? "" : "none";
    });
}

/* =========================
   ROOM DETAIL
========================= */

async function openRoom(id) {
  try {
    const data = await api(`/rooms/${id}`);
    const room = data.room || data;

    const el = document.querySelector("#content");

    el.innerHTML = `
      <div class="room-detail">

        <button class="back-button"
                onclick="navigate('matches')">
          → بازگشت
        </button>

        <div class="room-detail-cover">
          ${
            room.image
              ? `<img src="${escapeHtml(room.image)}" alt="">`
              : `<div>⚡</div>`
          }
        </div>

        <div class="room-detail-main">

          <div class="room-detail-tags">
            <span>${escapeHtml(room.game || "Call of Duty")}</span>
            <span>${escapeHtml(room.mode || "Multiplayer")}</span>
          </div>

          <h1>${escapeHtml(room.title || "روم KILL ZONE")}</h1>

          <div class="room-status-big">
            ${roomStatus(room)}
          </div>

          <div class="room-detail-grid">
            <div>
              <span>ظرفیت</span>
              <strong>
                ${(room.players || []).length}/${room.capacity || 0}
              </strong>
            </div>

            <div>
              <span>ورودی</span>
              <strong>
                ${
                  Number(room.entryFee || 0) === 0
                    ? "رایگان"
                    : money(room.entryFee)
                }
              </strong>
            </div>

            <div>
              <span>زمان شروع</span>
              <strong>${escapeHtml(room.startTime || "—")}</strong>
            </div>

            <div>
              <span>مدل تیم</span>
              <strong>
                ${escapeHtml(
                  room.teamMode ||
                  room.teamSize
                    ? `تیمی ${room.teamSize || ""} نفره`
                    : "تکی"
                )}
              </strong>
            </div>
          </div>

          ${
            room.codePublished && room.roomCode
              ? `
                <div class="cod-code-box">
                  <span>🔐 کد روم کالاف</span>
                  <strong>${escapeHtml(room.roomCode)}</strong>
                  <small>
                    کد را داخل Call of Duty وارد کنید.
                  </small>
                </div>
              `
              : `
                <div class="cod-wait-box">
                  🔐 کد روم هنوز توسط مالک/مدیر منتشر نشده است.
                </div>
              `
          }

          <div class="room-detail-actions">
            ${
              room.status === "open"
                ? `
                  <button class="primary-btn"
                          onclick="joinRoom('${escapeHtml(room.id)}')">
                    🎮 ورود به مسابقه
                  </button>
                `
                : `
                  <button class="disabled-btn">
                    🔒 ثبت‌نام بسته است
                  </button>
                `
            }
          </div>

          <section class="players-section">
            <h2>بازیکنان</h2>

            ${
              (room.players || []).length
                ? `
                  <div class="players-list">
                    ${(room.players || [])
                      .map((p, i) => `
                        <div class="player-row">
                          <span>${i + 1}</span>
                          <strong>
                            ${escapeHtml(
                              typeof p === "string"
                                ? p
                                : p.name || p.username || p.id
                            )}
                          </strong>
                        </div>
                      `)
                      .join("")}
                  </div>
                `
                : emptyCard(
                    "هنوز بازیکنی وارد نشده",
                    "اولین نفر باش."
                  )
            }
          </section>

        </div>
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

function roomStatus(room) {
  if (room.resultsPublished) return "🏆 اعلام نتایج";
  if (room.status === "finished") return "🏁 پایان مسابقه";
  if (room.status === "running") return "🔴 در حال اجرا";
  if (room.codePublished) return "🔐 کد روم منتشر شد";
  if (room.status === "ready") return "🟡 آماده شروع";
  return "🟢 ثبت‌نام";
}

async function joinRoom(id) {
  try {
    const data = await api(`/rooms/${id}/join`, {
      method: "POST"
    });

    saveUser(data.user);
    toast(data.message || "با موفقیت وارد شدید");
    openRoom(id);
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   ADVANCED ROOM SEARCH
========================= */

function advancedRoomSearch() {
  const type = prompt(
    "نوع مسابقه:\nall = همه\nfree = رایگان\npaid = پولی\nbattle = بتل\nmulti = مولتی",
    "all"
  );

  if (type === null) return;

  const teamSize = prompt(
    "تیمی چند نفره؟\n1 = تکی\n2 = دو نفره\n4 = چهار نفره\n5 = پنج نفره",
    ""
  );

  const maxFee = prompt(
    "حداکثر مبلغ ورود به تومان:\nبرای بدون محدودیت خالی بگذارید.",
    ""
  );

  const q = prompt(
    "نام روم یا بازی:",
    ""
  );

  const result = state.rooms.filter(room => {
    const fee = Number(room.entryFee || 0);

    if (type === "free" && fee !== 0) return false;
    if (type === "paid" && fee === 0) return false;

    if (
      type === "battle" &&
      !String(room.mode || room.game || "")
        .toLowerCase()
        .includes("battle")
    ) {
      return false;
    }

    if (
      type === "multi" &&
      !String(room.mode || "")
        .toLowerCase()
        .includes("multi")
    ) {
      return false;
    }

    if (
      teamSize &&
      String(room.teamSize || "") !== String(teamSize)
    ) {
      return false;
    }

    if (maxFee && fee > Number(maxFee)) return false;

    if (
      q &&
      !`${room.title || ""} ${room.game || ""}`
        .toLowerCase()
        .includes(q.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const content = document.querySelector("#content");

  content.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">SMART SEARCH</span>
      <h2>نتایج جست‌وجو</h2>
      <p>${result.length} روم پیدا شد.</p>
    </div>

    <div class="search-result-list">
      ${
        result.length
          ? result.map(roomCardLarge).join("")
          : emptyCard(
              "رومی پیدا نشد",
              "فیلترها را تغییر دهید و دوباره جست‌وجو کنید."
            )
      }
    </div>
  `;
}

/* =========================
   PROFILE
========================= */

function renderProfile(el) {
  const user = state.user;

  el.innerHTML = `
    <div class="profile-page">

      <section class="profile-card-reference">

        <button class="profile-more"
                onclick="profileMenu()">
          ⋮
        </button>

        <div class="profile-main-avatar">
          ${(user?.name || "K").charAt(0).toUpperCase()}
        </div>

        <h1>${escapeHtml(user?.name || "بازیکن")}</h1>

        <p>
          سطح ${user?.level || 1}
        </p>

        <div class="profile-level">
          <span>LV ${user?.level || 1}</span>
          <div>
            <i style="width:${Math.min(
              100,
              Number(user?.xp || 0) % 100
            )}%"></i>
          </div>
          <span>${user?.xp || 0} XP</span>
        </div>

        <div class="profile-stats">
          <div>
            <strong>${user?.level || 1}</strong>
            <span>سطح</span>
          </div>

          <div>
            <strong>${user?.xp || 0}</strong>
            <span>XP</span>
          </div>

          <div>
            <strong>
              ${money(user?.withdrawableBalance)}
            </strong>
            <span>قابل برداشت</span>
          </div>
        </div>
      </section>

      <div class="profile-section-title">
        گزینه‌ها
      </div>

      <div class="profile-menu-list">

        <button onclick="navigate('support')">
          <span class="profile-menu-icon">➤</span>
          <div>
            <strong>پشتیبانی</strong>
            <small>پیشنهاد، انتقاد، سؤال، گزارش مشکل</small>
          </div>
          <b>‹</b>
        </button>

        <button onclick="accountMarket()">
          <span class="profile-menu-icon">◉</span>
          <div>
            <strong>خرید و فروش اکانت</strong>
            <small>به‌زودی فعال می‌شود...</small>
          </div>
          <b>‹</b>
        </button>

        <button onclick="rulesPage()">
          <span class="profile-menu-icon">▤</span>
          <div>
            <strong>شرایط و قوانین</strong>
            <small>قوانین استفاده، حریم خصوصی و امنیت</small>
          </div>
          <b>‹</b>
        </button>

        <button onclick="navigate('wallet')">
          <span class="profile-menu-icon">💳</span>
          <div>
            <strong>کیف پول</strong>
            <small>موجودی، واریز و برداشت</small>
          </div>
          <b>‹</b>
        </button>

        ${
          user?.role === "owner"
            ? `
              <button onclick="navigate('owner')">
                <span class="profile-menu-icon">♛</span>
                <div>
                  <strong>پنل مالک</strong>
                  <small>مدیریت کامل KILL ZONE</small>
                </div>
                <b>‹</b>
              </button>
            `
            : ""
        }

        <button onclick="editProfile()">
          <span class="profile-menu-icon">✎</span>
          <div>
            <strong>ویرایش پروفایل</strong>
            <small>نام و اطلاعات حساب</small>
          </div>
          <b>‹</b>
        </button>

        <button class="logout-profile"
                onclick="logout()">
          <span class="profile-menu-icon">⇥</span>
          <div>
            <strong>خروج از حساب</strong>
            <small>خروج امن از KILL ZONE</small>
          </div>
          <b>‹</b>
        </button>

      </div>
    </div>
  `;
}

function profileMenu() {
  toast("منوی پروفایل");
}

function accountMarket() {
  toast("بخش خرید و فروش اکانت به‌زودی فعال می‌شود");
}

function rulesPage() {
  const content = document.querySelector("#content");

  content.innerHTML = `
    <div class="page-head">
      <h2>شرایط و قوانین</h2>
      <p>قوانین استفاده از KILL ZONE</p>
    </div>

    <div class="rules-card">
      <h3>قوانین مسابقات</h3>
      <p>
        قوانین هر مسابقه توسط مالک مسابقه اعلام می‌شود.
        ورود به مسابقه به معنی پذیرش قوانین آن است.
      </p>

      <h3>امنیت حساب</h3>
      <p>
        اطلاعات ورود و حساب خود را در اختیار دیگران قرار ندهید.
      </p>

      <h3>پرداخت‌ها</h3>
      <p>
        تراکنش‌های مالی طبق وضعیت ثبت‌شده در سیستم KILL ZONE
        بررسی و پردازش می‌شوند.
      </p>
    </div>
  `;
}

async function editProfile() {
  const name = prompt(
    "نام جدید:",
    state.user?.name || ""
  );

  if (!name) return;

  try {
    const data = await api("/profile", {
      method: "PUT",
      body: JSON.stringify({ name })
    });

    saveUser(data.user);
    renderApp();
    toast("پروفایل به‌روزرسانی شد");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   SUPPORT / TICKETS
========================= */

async function renderSupport(el) {
  let tickets = [];

  try {
    tickets =
      (await api("/support/tickets")).tickets || [];
  } catch {}

  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">HELP CENTER</span>
      <h2>پشتیبانی</h2>
      <p>ارتباط مستقیم با تیم مدیریت KILL ZONE</p>
    </div>

    <button class="support-new-btn"
            onclick="newTicket()">
      🎫 ایجاد تیکت جدید
    </button>

    <div class="support-info-card">
      <div>💬</div>
      <div>
        <strong>نیاز به کمک داری؟</strong>
        <p>
          پیام خودت را ارسال کن؛ مدیران از داخل پنل
          پاسخ خواهند داد.
        </p>
      </div>
    </div>

    <h3 class="sub-heading">تیکت‌های شما</h3>

    <div class="tickets-list">
      ${
        tickets.length
          ? tickets.map(ticketCard).join("")
          : emptyCard(
              "هنوز تیکتی نداری",
              "اگر مشکلی داشتی یک تیکت جدید ایجاد کن."
            )
      }
    </div>
  `;
}

function ticketCard(t) {
  const status = {
    OPEN: "🟢 باز",
    WAITING_USER: "🟡 منتظر پاسخ شما",
    CLOSED: "⚫ بسته"
  }[t.status] || t.status;

  return `
    <button class="ticket-card"
            onclick="openTicket('${escapeHtml(t.id)}')">

      <div class="ticket-icon">🎫</div>

      <div>
        <strong>${escapeHtml(t.subject)}</strong>
        <small>
          ${escapeHtml(t.category || "عمومی")}
        </small>
      </div>

      <span>${status}</span>
    </button>
  `;
}

async function newTicket() {
  const subject = prompt("موضوع تیکت:");

  if (!subject) return;

  const message = prompt("پیام خود را بنویس:");

  if (!message) return;

  const category =
    prompt(
      "دسته‌بندی:\nفنی / مالی / مسابقات / حساب / عمومی",
      "عمومی"
    ) || "عمومی";

  try {
    await api("/support/tickets", {
      method: "POST",
      body: JSON.stringify({
        userId: state.user?.id,
        subject,
        message,
        category
      })
    });

    toast("تیکت با موفقیت ایجاد شد");
    renderSupport(document.querySelector("#content"));
  } catch (e) {
    toast(e.message);
  }
}

async function openTicket(id) {
  try {
    const data = await api(
      `/support/tickets/${id}?userId=${encodeURIComponent(
        state.user?.id || ""
      )}`
    );

    const ticket = data.ticket;
    const el = document.querySelector("#content");

    el.innerHTML = `
      <div class="ticket-page">

        <button class="back-button"
                onclick="navigate('support')">
          → بازگشت
        </button>

        <div class="ticket-header">
          <span>🎫</span>
          <div>
            <small>${escapeHtml(ticket.id)}</small>
            <h2>${escapeHtml(ticket.subject)}</h2>
          </div>
        </div>

        <div class="ticket-messages">
          ${(ticket.messages || [])
            .map(m => `
              <div class="ticket-message ${
                m.senderType === "ADMIN"
                  ? "admin-message"
                  : "user-message"
              }">
                <small>
                  ${
                    m.senderType === "ADMIN"
                      ? "مدیریت KILL ZONE"
                      : "شما"
                  }
                </small>
                <p>${escapeHtml(m.message)}</p>
              </div>
            `)
            .join("")}
        </div>

        ${
          ticket.status !== "CLOSED"
            ? `
              <div class="ticket-reply">
                <textarea id="ticketReply"
                  placeholder="پیام خود را بنویس..."></textarea>

                <button onclick="sendTicketMessage(
                  '${escapeHtml(ticket.id)}'
                )">
                  ارسال پیام
                </button>
              </div>
            `
            : `
              <div class="closed-ticket">
                🔒 این تیکت بسته شده است.
              </div>
            `
        }

      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function sendTicketMessage(id) {
  const message =
    document.querySelector("#ticketReply")?.value.trim();

  if (!message) return toast("پیام را وارد کنید");

  try {
    await api(`/support/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        userId: state.user?.id,
        message
      })
    });

    toast("پیام ارسال شد");
    openTicket(id);
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   NOTIFICATIONS
========================= */

async function renderNotifications(el) {
  let notifications = [];

  try {
    notifications =
      (await api("/notifications")).notifications || [];
  } catch {}

  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">NOTIFICATIONS</span>
      <h2>اطلاع‌رسانی</h2>
      <p>آخرین پیام‌ها و رویدادهای KILL ZONE</p>
    </div>

    <div class="notifications-list">
      ${
        notifications.length
          ? notifications.map(n => `
              <article class="notification-card">
                <div>🔔</div>
                <div>
                  <strong>
                    ${escapeHtml(n.title || "اعلان")}
                  </strong>
                  <p>
                    ${escapeHtml(n.message || "")}
                  </p>
                </div>
              </article>
            `).join("")
          : emptyCard(
              "اعلانی وجود ندارد",
              "وقتی خبری داشته باشیم اینجا نمایش داده می‌شود."
            )
      }
    </div>
  `;
}

/* =========================
   LEADERBOARD
========================= */

function showLeaderboard() {
  const content = document.querySelector("#content");

  content.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">TOP PLAYERS</span>
      <h2>لیدربرد</h2>
      <p>برترین بازیکنان KILL ZONE</p>
    </div>

    <div class="leaderboard">
      <div class="leader top">
        <span>🥇</span>
        <strong>به‌زودی</strong>
        <small>رتبه اول</small>
      </div>

      <div class="leader">
        <span>🥈</span>
        <strong>به‌زودی</strong>
        <small>رتبه دوم</small>
      </div>

      <div class="leader">
        <span>🥉</span>
        <strong>به‌زودی</strong>
        <small>رتبه سوم</small>
      </div>
    </div>
  `;
}

/* =========================
   TEAMS
========================= */

async function renderTeams(el) {
  let teams = [];

  try {
    teams = (await api("/teams")).teams || [];
  } catch {}

  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">YOUR SQUAD</span>
      <h2>تیم‌ها</h2>
      <p>تیم خودت را بساز و با دوستانت رقابت کن.</p>
    </div>

    <button class="primary-btn"
            onclick="createTeam()">
      + ساخت تیم جدید
    </button>

    <div class="list">
      ${
        teams.length
          ? teams.map(team => `
              <article class="list-card">
                <div class="list-icon">👥</div>
                <div>
                  <h3>${escapeHtml(team.name)}</h3>
                  <p>${(team.members || []).length} عضو</p>
                </div>
              </article>
            `).join("")
          : emptyCard(
              "تیمی وجود ندارد",
              "اولین تیم KILL ZONE را بساز."
            )
      }
    </div>
  `;
}

async function createTeam() {
  const name = prompt("نام تیم:");

  if (!name) return;

  try {
    await api("/teams", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    toast("تیم ساخته شد");
    navigate("teams");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   SHOP
========================= */

async function renderShop(el) {
  let items = [];

  try {
    items = (await api("/shop")).items || [];
  } catch {}

  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">KILL ZONE STORE</span>
      <h2>فروشگاه</h2>
      <p>آیتم‌ها، پیشنهادها و محصولات KILL ZONE</p>
    </div>

    <div class="shop-categories">
      <button class="active">همه</button>
      <button>CP</button>
      <button>اکانت</button>
      <button>آیتم</button>
      <button>ویژه</button>
    </div>

    <div class="shop-grid">
      ${
        items.length
          ? items.map(shopItem).join("")
          : `
            <div class="shop-coming">
              <div>🛒</div>
              <h3>فروشگاه در حال آماده‌سازی</h3>
              <p>
                محصولات، CP، تخفیف‌ها و پیشنهادهای ویژه
                به‌زودی اضافه می‌شوند.
              </p>
            </div>
          `
      }
    </div>
  `;
}

function shopItem(item) {
  return `
    <article class="shop-product"
             onclick="shopDetails('${escapeHtml(item.id || "")}')">

      <div class="shop-product-image">
        ${
          item.image
            ? `<img src="${escapeHtml(item.image)}" alt="">`
            : "🎮"
        }

        ${
          item.discount
            ? `<b>${escapeHtml(item.discount)}٪-</b>`
            : ""
        }
      </div>

      <div class="shop-product-body">
        <small>${escapeHtml(item.category || "محصول")}</small>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <strong>${money(item.price)}</strong>
      </div>
    </article>
  `;
}

function shopDetails(id) {
  toast("صفحه خرید محصول به‌زودی فعال می‌شود");
}

/* =========================
   WALLET
========================= */

async function renderWallet(el) {
  try {
    const data = await api("/wallet");

    const w = data.wallet;
    const l = data.limits;

    el.innerHTML = `
      <div class="page-head modern-page-head">
        <span class="eyebrow">MY WALLET</span>
        <h2>کیف پول</h2>
        <p>مدیریت موجودی KILL ZONE</p>
      </div>

      <div class="big-wallet premium-wallet">
        <small>مجموع موجودی</small>
        <strong>${money(w.totalBalance)}</strong>

        <div class="wallet-balance-line">
          <span>
            موجودی بازی
            <b>${money(w.gameBalance)}</b>
          </span>

          <span>
            قابل برداشت
            <b>${money(w.withdrawableBalance)}</b>
          </span>
        </div>
      </div>

      <div class="wallet-actions">
        <button onclick="topup()">＋ افزایش موجودی</button>
        <button onclick="withdraw()">↙ برداشت</button>
        <button onclick="transactions()">☷ تراکنش‌ها</button>
      </div>

      <div class="limits-box">
        <h3>محدودیت‌های حساب</h3>

        <p>
          شارژ:
          <b>${money(l.minTopup)}</b>
          تا
          <b>${money(l.maxTopup)}</b>
        </p>

        <p>
          برداشت:
          <b>${money(l.minWithdraw)}</b>
          تا
          <b>${money(l.maxWithdraw)}</b>
        </p>

        <p>
          هر ${l.withdrawalCooldownHours} ساعت یک درخواست برداشت
        </p>
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function topup() {
  const amount =
    Number(prompt("مبلغ شارژ به تومان:"));

  if (!amount) return;

  try {
    const data = await api("/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount })
    });

    toast(data.message);
  } catch (e) {
    toast(e.message);
  }
}

async function withdraw() {
  const amount =
    Number(prompt("مبلغ برداشت به تومان:"));

  if (!amount) return;

  const destination =
    prompt("شماره/شناسه مقصد پرداخت:");

  if (!destination) return;

  try {
    const data = await api("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({
        amount,
        destination
      })
    });

    saveUser(data.user);
    toast(data.message);
    renderWallet(document.querySelector("#content"));
  } catch (e) {
    toast(e.message);
  }
}

async function transactions() {
  try {
    const data =
      await api("/wallet/transactions");

    const lines =
      data.transactions
        .slice(0, 30)
        .map(t => `
          <div class="transaction">
            <span>
              ${escapeHtml(t.description || "تراکنش")}
            </span>

            <strong>
              ${Number(t.amount) >= 0 ? "+" : "-"}
              ${money(Math.abs(t.amount))}
            </strong>
          </div>
        `)
        .join("");

    document.querySelector("#content").innerHTML = `
      <div class="page-head">
        <h2>تراکنش‌ها</h2>
        <p>آخرین فعالیت‌های مالی حساب</p>
      </div>

      <div class="transactions">
        ${
          lines ||
          emptyCard(
            "تراکنشی نیست",
            "هنوز تراکنشی ثبت نشده است."
          )
        }
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   TOURNAMENTS
========================= */

async function renderTournaments(el) {
  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">CHAMPIONSHIP</span>
      <h2>تورنمنت‌ها</h2>
      <p>رقابت‌های بزرگ KILL ZONE</p>
    </div>

    <div id="tournaments">
      <div class="loading">در حال دریافت...</div>
    </div>
  `;

  try {
    const data = await api("/tournaments");

    document.querySelector("#tournaments").innerHTML =
      data.tournaments.length
        ? data.tournaments.map(t => `
            <article class="tournament-card">
              <div class="trophy">🏆</div>

              <div>
                <h3>${escapeHtml(t.title)}</h3>
                <p>${escapeHtml(t.game || "Call of Duty")}</p>
                <span>
                  جایزه: ${money(t.prize)}
                </span>
              </div>
            </article>
          `).join("")
        : emptyCard(
            "تورنمنتی وجود ندارد",
            "به‌زودی تورنمنت‌های جدید ساخته می‌شوند."
          );
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   OWNER
========================= */

async function renderOwner(el) {
  try {
    const data = await api("/owner/dashboard");
    const s = data.stats;

    el.innerHTML = `
      <div class="page-head modern-page-head">
        <span class="eyebrow">CONTROL CENTER</span>
        <h2>پنل مالک</h2>
        <p>مدیریت KILL ZONE</p>
      </div>

      <div class="admin-grid">
        <div><strong>${s.users}</strong><span>کاربران</span></div>
        <div><strong>${s.rooms}</strong><span>مسابقات</span></div>
        <div><strong>${s.tournaments}</strong><span>تورنمنت‌ها</span></div>
        <div><strong>${s.teams}</strong><span>تیم‌ها</span></div>
        <div><strong>${s.pendingWithdrawals}</strong><span>برداشت‌ها</span></div>
        <div><strong>${s.pendingPayments}</strong><span>پرداخت‌ها</span></div>
      </div>

      <div class="admin-actions">
        <button onclick="ownerReward()">🎁 پاداش دستی</button>
        <button onclick="ownerCreateRoom()">⚔️ ساخت مسابقه</button>
        <button onclick="ownerCreateTournament()">🏆 ساخت تورنمنت</button>
        <button onclick="ownerWithdrawals()">💵 برداشت‌ها</button>
        <button onclick="ownerFinanceSettings()">⚙️ تنظیمات مالی</button>
        <button onclick="navigate('support')">🎫 پشتیبانی</button>
      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function ownerReward() {
  const userId = prompt("شناسه کاربر:");
  if (!userId) return;

  const amount = Number(prompt("مبلغ پاداش:"));
  if (!amount) return;

  const description =
    prompt("دلیل پاداش:", "پاداش دستی");

  try {
    const data =
      await api(`/owner/users/${userId}/reward`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          description
        })
      });

    toast(data.message);
  } catch (e) {
    toast(e.message);
  }
}

async function ownerCreateRoom() {
  const title = prompt("عنوان مسابقه:");
  if (!title) return;

  const entryFee =
    Number(prompt("هزینه ورود:", "0"));

  const prize =
    Number(prompt("جایزه:", "0"));

  const capacity =
    Number(prompt("ظرفیت:", "10"));

  try {
    await api("/owner/rooms", {
      method: "POST",
      body: JSON.stringify({
        title,
        entryFee,
        prize,
        capacity
      })
    });

    toast("مسابقه ساخته شد");
    renderOwner(document.querySelector("#content"));
  } catch (e) {
    toast(e.message);
  }
}

async function ownerCreateTournament() {
  const title = prompt("عنوان تورنمنت:");
  if (!title) return;

  const prize =
    Number(prompt("جایزه:", "0"));

  try {
    await api("/owner/tournaments", {
      method: "POST",
      body: JSON.stringify({
        title,
        prize
      })
    });

    toast("تورنمنت ساخته شد");
  } catch (e) {
    toast(e.message);
  }
}

async function ownerWithdrawals() {
  try {
    const data =
      await api("/owner/withdrawals");

    document.querySelector("#content").innerHTML = `
      <div class="page-head">
        <h2>مدیریت برداشت‌ها</h2>
      </div>

      ${
        data.withdrawals.length
          ? data.withdrawals.map(w => `
              <article class="withdraw-card">
                <strong>${money(w.amount)}</strong>

                <p>
                  کاربر:
                  ${escapeHtml(w.userId)}
                </p>

                <p>
                  مقصد:
                  ${escapeHtml(w.destination)}
                </p>

                <span>
                  وضعیت:
                  ${escapeHtml(w.status)}
                </span>

                ${
                  w.status === "pending"
                    ? `
                      <div class="row-buttons">
                        <button onclick="changeWithdrawal(
                          '${escapeHtml(w.id)}',
                          'approved'
                        )">
                          تأیید
                        </button>

                        <button onclick="changeWithdrawal(
                          '${escapeHtml(w.id)}',
                          'rejected'
                        )">
                          رد
                        </button>
                      </div>
                    `
                    : ""
                }
              </article>
            `).join("")
          : emptyCard(
              "درخواستی وجود ندارد",
              "هیچ برداشت در انتظاری نیست."
            )
      }
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function changeWithdrawal(id, status) {
  try {
    await api(`/owner/withdrawals/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });

    toast("وضعیت تغییر کرد");
    ownerWithdrawals();
  } catch (e) {
    toast(e.message);
  }
}

async function ownerFinanceSettings() {
  try {
    const data =
      await api("/owner/finance/settings");

    const f = data.finance;

    const minTopup =
      Number(prompt("حداقل شارژ:", f.minTopup));

    const maxTopup =
      Number(prompt("حداکثر شارژ:", f.maxTopup));

    const minWithdraw =
      Number(prompt("حداقل برداشت:", f.minWithdraw));

    const maxWithdraw =
      Number(prompt("حداکثر برداشت:", f.maxWithdraw));

    await api("/owner/finance/settings", {
      method: "PUT",
      body: JSON.stringify({
        minTopup,
        maxTopup,
        minWithdraw,
        maxWithdraw
      })
    });

    toast("تنظیمات مالی ذخیره شد");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   CREATE
========================= */

function renderCreate(el) {
  el.innerHTML = `
    <div class="page-head modern-page-head">
      <span class="eyebrow">CREATE</span>
      <h2>ایجاد</h2>
      <p>چه چیزی می‌خواهی بسازی؟</p>
    </div>

    <div class="create-grid">
      <button onclick="navigate('matches')">
        ⚔️
        <b>مسابقه</b>
      </button>

      <button onclick="createTeam()">
        👥
        <b>تیم</b>
      </button>

      <button onclick="navigate('tournaments')">
        🏆
        <b>تورنمنت</b>
      </button>
    </div>
  `;
}

/* =========================
   HELPERS
========================= */

function emptyCard(title, text) {
  return `
    <div class="empty-card">
      <div>◎</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function logout(reload = true) {
  state.token = "";
  state.user = null;

  localStorage.removeItem("killzone_token");
  localStorage.removeItem("killzone_user");

  if (reload) {
    renderLogin();
  }
}

window.requestOtp = requestOtp;
window.verifyOtp = verifyOtp;
window.backLogin = backLogin;
window.navigate = navigate;
window.joinRoom = joinRoom;
window.openRoom = openRoom;
window.createTeam = createTeam;
window.topup = topup;
window.withdraw = withdraw;
window.transactions = transactions;
window.editProfile = editProfile;
window.logout = logout;
window.ownerReward = ownerReward;
window.ownerCreateRoom = ownerCreateRoom;
window.ownerCreateTournament = ownerCreateTournament;
window.ownerWithdrawals = ownerWithdrawals;
window.changeWithdrawal = changeWithdrawal;
window.ownerFinanceSettings = ownerFinanceSettings;
window.advancedRoomSearch = advancedRoomSearch;
window.filterRooms = filterRooms;
window.filterMatchTab = filterMatchTab;
window.showLeaderboard = showLeaderboard;
window.accountMarket = accountMarket;
window.rulesPage = rulesPage;
window.newTicket = newTicket;
window.openTicket = openTicket;
window.sendTicketMessage = sendTicketMessage;
window.shopDetails = shopDetails;

start();
