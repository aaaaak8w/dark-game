const API = "/api";

let state = {
  token: localStorage.getItem("killzone_token") || "",
  user: JSON.parse(localStorage.getItem("killzone_user") || "null"),
  page: "home"
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
  }
}

/* =========================
   Login
========================= */

function renderLogin() {
  document.body.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="brand">
          <div class="brand-logo">KZ</div>
          <h1>KILL ZONE</h1>
          <p>میدان رقابت بازیکنان</p>
        </div>

        <div id="loginStep">
          <label>نام کاربری</label>
          <input id="username" placeholder="مثلاً Nima45">

          <label>شماره موبایل</label>
          <input id="phone" type="tel" placeholder="+98...">

          <button class="primary-btn" onclick="requestOtp()">
            دریافت کد تأیید
          </button>
        </div>

        <div id="otpStep" class="hidden">
          <div class="otp-title">
            کد تأیید برای شما ارسال شد
          </div>

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

        <div id="authMessage"></div>
      </div>
    </div>
  `;
}

async function requestOtp() {
  const username =
    document.querySelector("#username").value.trim();

  const phone =
    document.querySelector("#phone").value.trim();

  if (!username || !phone) {
    return toast("نام کاربری و شماره موبایل را وارد کنید");
  }

  try {
    await api("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ username, phone })
    });

    document.querySelector("#loginStep")
      .classList.add("hidden");

    document.querySelector("#otpStep")
      .classList.remove("hidden");

    toast("کد تأیید ارسال شد");
  } catch (e) {
    toast(e.message);
  }
}

async function verifyOtp() {
  const phone =
    document.querySelector("#phone").value.trim();

  const code =
    document.querySelector("#otp").value.trim();

  try {
    const data = await api("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code })
    });

    state.token = data.token;

    localStorage.setItem(
      "killzone_token",
      data.token
    );

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
   Main App
========================= */

function renderApp() {
  document.body.innerHTML = `
    <div class="app-shell">

      <header class="topbar">
        <div>
          <div class="small-text">خوش آمدی</div>
          <div class="top-name">
            ${escapeHtml(state.user?.name || "بازیکن")}
          </div>
        </div>

        <button class="avatar"
                onclick="navigate('profile')">
          ${(state.user?.name || "K").charAt(0).toUpperCase()}
        </button>
      </header>

      <main id="content"></main>

      <nav class="bottom-nav">
        <button onclick="navigate('home')">
          <span>⌂</span>
          خانه
        </button>

        <button onclick="navigate('matches')">
          <span>⚔</span>
          مسابقات
        </button>

        <button class="nav-plus"
                onclick="navigate('create')">
          +
        </button>

        <button onclick="navigate('teams')">
          <span>♟</span>
          تیم‌ها
        </button>

        <button onclick="navigate('profile')">
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

  const content =
    document.querySelector("#content");

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
}

/* =========================
   Home
========================= */

async function renderHome(el) {
  const user = state.user;

  let rooms = [];

  try {
    rooms = (await api("/rooms")).rooms || [];
  } catch {}

  el.innerHTML = `
    <section class="hero">
      <div>
        <div class="hero-label">KILL ZONE</div>
        <h2>آماده‌ای برای رقابت؟</h2>
        <p>
          وارد مسابقه شو، مهارتت را ثابت کن و رتبه بگیر.
        </p>
      </div>

      <button onclick="navigate('matches')">
        مشاهده مسابقات
      </button>
    </section>

    <section class="wallet-card"
             onclick="navigate('wallet')">

      <div class="section-head">
        <span>کیف پول</span>
        <span>›</span>
      </div>

      <div class="wallet-total">
        ${money(
          Number(user?.gameBalance || 0) +
          Number(user?.withdrawableBalance || 0)
        )}
      </div>

      <div class="wallet-grid">
        <div>
          <small>موجودی بازی</small>
          <strong>${money(user?.gameBalance)}</strong>
        </div>

        <div>
          <small>قابل برداشت</small>
          <strong>${money(user?.withdrawableBalance)}</strong>
        </div>
      </div>
    </section>

    <section>
      <div class="section-title">
        مسابقات فعال
        <button onclick="navigate('matches')">
          همه
        </button>
      </div>

      ${
        rooms.length
          ? rooms.slice(0, 3).map(roomCard).join("")
          : emptyCard(
              "هنوز مسابقه‌ای ایجاد نشده",
              "به‌زودی مسابقات جدید اضافه می‌شوند."
            )
      }
    </section>

    <section class="quick-grid">

      <button onclick="navigate('matches')">
        <b>⚔</b>
        <span>مسابقات</span>
      </button>

      <button onclick="navigate('tournaments')">
        <b>🏆</b>
        <span>تورنمنت‌ها</span>
      </button>

      <button onclick="navigate('teams')">
        <b>👥</b>
        <span>تیم‌ها</span>
      </button>

      <button onclick="navigate('shop')">
        <b>🛒</b>
        <span>فروشگاه</span>
      </button>

      <button onclick="navigate('wallet')">
        <b>💰</b>
        <span>کیف پول</span>
      </button>

      <button onclick="navigate('profile')">
        <b>👤</b>
        <span>پروفایل</span>
      </button>

    </section>

    <section class="news-box">
      <div class="section-title">اخبار و رویدادها</div>
      <div class="news-placeholder">
        اخبار، تخفیف‌ها و رویدادهای KILL ZONE اینجا نمایش داده می‌شوند.
      </div>
    </section>
  `;
}

/* =========================
   Matches
========================= */

async function renderMatches(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>مسابقات</h2>
      <p>مسابقه موردنظرت را انتخاب کن</p>
    </div>

    <div class="tabs">
      <button class="active">همه</button>
      <button>کال آو دیوتی</button>
      <button>بتل رویال</button>
    </div>

    <div id="roomsList">
      <div class="loading">در حال دریافت مسابقات...</div>
    </div>
  `;

  try {
    const data = await api("/rooms");

    document.querySelector("#roomsList").innerHTML =
      data.rooms.length
        ? data.rooms.map(roomCard).join("")
        : emptyCard(
            "مسابقه‌ای موجود نیست",
            "منتظر ایجاد مسابقات جدید باشید."
          );
  } catch (e) {
    document.querySelector("#roomsList").innerHTML =
      emptyCard("خطا", e.message);
  }
}

function roomCard(room) {
  return `
    <article class="match-card">

      <div class="match-top">
        <span class="game-tag">
          ${escapeHtml(room.game || "Call of Duty")}
        </span>

        <span class="status-dot">
          ${room.status === "open" ? "● باز" : "● بسته"}
        </span>
      </div>

      <h3>${escapeHtml(room.title)}</h3>

      <div class="match-info">
        <span>🎮 ${escapeHtml(room.mode || "Multiplayer")}</span>
        <span>👥 ${(room.players || []).length}/${room.capacity || 0}</span>
      </div>

      <div class="match-bottom">
        <strong>
          ${
            Number(room.entryFee || 0) === 0
              ? "رایگان"
              : money(room.entryFee)
          }
        </strong>

        <button onclick="joinRoom('${room.id}')">
          ورود
        </button>
      </div>

    </article>
  `;
}

async function joinRoom(id) {
  try {
    const data = await api(`/rooms/${id}/join`, {
      method: "POST"
    });

    saveUser(data.user);
    toast(data.message);
    navigate("matches");
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   Tournaments
========================= */

async function renderTournaments(el) {
  el.innerHTML = `
    <div class="page-head">
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
              <p>${escapeHtml(t.game)}</p>
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
   Teams
========================= */

async function renderTeams(el) {
  let teams = [];

  try {
    teams = (await api("/teams")).teams || [];
  } catch {}

  el.innerHTML = `
    <div class="page-head">
      <h2>تیم‌ها</h2>
      <p>تیم خودت را بساز و رقابت کن</p>
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
   Shop
========================= */

async function renderShop(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>فروشگاه</h2>
      <p>آیتم‌ها و پیشنهادهای KILL ZONE</p>
    </div>

    <div id="shopList">
      <div class="loading">در حال دریافت...</div>
    </div>
  `;

  try {
    const data = await api("/shop");

    document.querySelector("#shopList").innerHTML =
      data.items.length
        ? data.items.map(item => `
          <article class="shop-card">
            <div class="shop-image">
              ${item.image ? `<img src="${escapeHtml(item.image)}">` : "🎮"}
            </div>

            <h3>${escapeHtml(item.name)}</h3>

            <p>${escapeHtml(item.description || "")}</p>

            <strong>${money(item.price)}</strong>
          </article>
        `).join("")
        : emptyCard(
            "فروشگاه در حال آماده‌سازی است",
            "محصولات به‌زودی اضافه می‌شوند."
          );
  } catch (e) {
    toast(e.message);
  }
}

/* =========================
   Wallet
========================= */

async function renderWallet(el) {
  try {
    const data = await api("/wallet");

    const w = data.wallet;
    const l = data.limits;

    el.innerHTML = `
      <div class="page-head">
        <h2>کیف پول</h2>
        <p>مدیریت موجودی KILL ZONE</p>
      </div>

      <div class="big-wallet">
        <small>مجموع موجودی</small>
        <strong>
          ${money(w.totalBalance)}
        </strong>
      </div>

      <div class="balance-cards">

        <div>
          <small>موجودی بازی</small>
          <strong>${money(w.gameBalance)}</strong>
          <p>برای ورود به مسابقات</p>
        </div>

        <div>
          <small>قابل برداشت</small>
          <strong>${money(w.withdrawableBalance)}</strong>
          <p>درآمد مسابقات پولی</p>
        </div>

      </div>

      <div class="wallet-actions">
        <button onclick="topup()">
          + افزایش موجودی
        </button>

        <button onclick="withdraw()">
          برداشت
        </button>

        <button onclick="transactions()">
          تاریخچه تراکنش‌ها
        </button>
      </div>

      <div class="limits-box">
        <h3>محدودیت‌ها</h3>
        <p>
          شارژ:
          ${money(l.minTopup)}
          تا
          ${money(l.maxTopup)}
        </p>
        <p>
          برداشت:
          ${money(l.minWithdraw)}
          تا
          ${money(l.maxWithdraw)}
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
  const amount = Number(
    prompt("مبلغ شارژ به تومان:")
  );

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
  const amount = Number(
    prompt("مبلغ برداشت به تومان:")
  );

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
        .slice(0, 20)
        .map(t => `
          <div class="transaction">
            <span>${escapeHtml(t.description)}</span>
            <strong>
              ${Number(t.amount) >= 0 ? "+" : ""}
              ${money(Math.abs(t.amount))}
            </strong>
          </div>
        `)
        .join("");

    document.querySelector("#content").innerHTML = `
      <div class="page-head">
        <h2>تراکنش‌ها</h2>
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
   Profile
========================= */

function renderProfile(el) {
  const user = state.user;

  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">
        ${(user?.name || "K").charAt(0).toUpperCase()}
      </div>

      <h2>${escapeHtml(user?.name || "بازیکن")}</h2>

      <p>سطح ${user?.level || 1}</p>
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
        <strong>${money(user?.withdrawableBalance)}</strong>
        <span>قابل برداشت</span>
      </div>
    </div>

    <div class="settings-list">

      <button onclick="editProfile()">
        ✏️ ویرایش پروفایل
      </button>

      <button onclick="navigate('wallet')">
        💰 کیف پول
      </button>

      ${
        user?.role === "owner"
          ? `
            <button onclick="navigate('owner')">
              👑 پنل مالک
            </button>
          `
          : ""
      }

      <button onclick="logout()">
        🚪 خروج از حساب
      </button>

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
   Owner
========================= */

async function renderOwner(el) {
  try {
    const data =
      await api("/owner/dashboard");

    const s = data.stats;

    el.innerHTML = `
      <div class="page-head">
        <h2>پنل مالک</h2>
        <p>مدیریت KILL ZONE</p>
      </div>

      <div class="admin-grid">

        <div>
          <strong>${s.users}</strong>
          <span>کاربران</span>
        </div>

        <div>
          <strong>${s.rooms}</strong>
          <span>مسابقات</span>
        </div>

        <div>
          <strong>${s.tournaments}</strong>
          <span>تورنمنت‌ها</span>
        </div>

        <div>
          <strong>${s.teams}</strong>
          <span>تیم‌ها</span>
        </div>

        <div>
          <strong>${s.pendingWithdrawals}</strong>
          <span>برداشت‌های در انتظار</span>
        </div>

        <div>
          <strong>${s.pendingPayments}</strong>
          <span>پرداخت‌های در انتظار</span>
        </div>

      </div>

      <div class="admin-actions">

        <button onclick="ownerReward()">
          🎁 پاداش دستی کاربر
        </button>

        <button onclick="ownerCreateRoom()">
          ⚔️ ساخت مسابقه
        </button>

        <button onclick="ownerCreateTournament()">
          🏆 ساخت تورنمنت
        </button>

        <button onclick="ownerWithdrawals()">
          💵 مدیریت برداشت‌ها
        </button>

        <button onclick="ownerFinanceSettings()">
          ⚙️ تنظیمات مالی
        </button>

      </div>
    `;
  } catch (e) {
    toast(e.message);
  }
}

async function ownerReward() {
  const userId =
    prompt("شناسه کاربر:");

  if (!userId) return;

  const amount =
    Number(prompt("مبلغ پاداش:"));

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
    Number(prompt("ظرفیت:", "2"));

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
  const title =
    prompt("عنوان تورنمنت:");

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
        <h2>برداشت‌ها</h2>
      </div>

      ${
        data.withdrawals.length
          ? data.withdrawals.map(w => `
            <article class="withdraw-card">

              <strong>
                ${money(w.amount)}
              </strong>

              <p>
                کاربر:
                ${escapeHtml(w.userId)}
              </p>

              <p>
                مقصد:
                ${escapeHtml(w.destination)}
              </p>

              <span>
                وضعیت: ${escapeHtml(w.status)}
              </span>

              ${
                w.status === "pending"
                  ? `
                    <div class="row-buttons">
                      <button onclick="changeWithdrawal('${w.id}','approved')">
                        تأیید
                      </button>

                      <button onclick="changeWithdrawal('${w.id}','rejected')">
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
    await api(
      `/owner/withdrawals/${id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status })
      }
    );

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
      Number(prompt(
        "حداقل برداشت:",
        f.minWithdraw
      ));

    const maxWithdraw =
      Number(prompt(
        "حداکثر برداشت:",
        f.maxWithdraw
      ));

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
   Create
========================= */

function renderCreate(el) {
  el.innerHTML = `
    <div class="page-head">
      <h2>ایجاد</h2>
      <p>چه کاری می‌خواهی انجام دهی؟</p>
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
   Helpers
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

start();
