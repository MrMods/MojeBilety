const app = document.querySelector("#app");

let selectedSeatId = null;
let currentEvent = null;
let currentSeats = [];
let adminToken = localStorage.getItem("adminToken") || "";
let adminView = "dashboard";

function money(v) {
  return Number(v) === 0 ? "Darmowe" : Number(v).toFixed(2).replace(".", ",") + " zł";
}

function datePL(v) {
  return new Date(v + "T00:00:00").toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function eventStatus(e) {
  if (e.seats_available <= 0) return ["Brak miejsc", "bad"];
  if (e.seats_available < 5) return ["Mało miejsc", "warn"];
  return ["Dostępne", "ok"];
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { "Authorization": "Bearer " + adminToken } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Wystąpił błąd.");
  }

  return data;
}

function setHash(name) {
  location.hash = name;
}

/* =========================
   USER
========================= */
async function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <span class="pill">KONCERTY • WARSZTATY • KONFERENCJE</span>
        <h1>Odkrywaj wydarzenia i rezerwuj miejsca online.</h1>
        <p>Aplikacja pozwala przeglądać eventy, wybierać miejsca na mapie sali i zapisywać rezerwacje w bazie D1.</p>

        <div class="searchbar">
          <input id="search" placeholder="Szukaj wydarzenia, miejsca lub kategorii..." />
          <select id="category">
            <option value="all">Wszystkie kategorie</option>
            <option>Koncert</option>
            <option>Warsztat</option>
            <option>Konferencja</option>
            <option>Sport</option>
            <option>Teatr</option>
          </select>
          <button class="primary" id="searchBtn">Szukaj</button>
        </div>
      </div>
    </section>

    <section class="container">
      <div class="section-head">
        <h2>Nadchodzące wydarzenia</h2>
        <button class="secondary" onclick="setHash('admin')">Panel administratora</button>
      </div>

      <div id="events" class="grid"></div>
    </section>
  `;

  document.querySelector("#searchBtn").onclick = loadEvents;
  document.querySelector("#category").onchange = loadEvents;

  await loadEvents();
}

async function loadEvents() {
  const q = document.querySelector("#search")?.value || "";
  const category = document.querySelector("#category")?.value || "all";

  const events = await api(`/api/events?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);

  document.querySelector("#events").innerHTML = events.map(e => {
    const [label, cls] = eventStatus(e);

    return `
      <article class="card">
        <div class="card-img" style="background-image:url('${e.image_url}')">
          <span class="badge">${e.category}</span>
        </div>

        <div class="card-body">
          <h3>${e.title}</h3>

          <div class="meta">
            <span>📅 ${datePL(e.event_date)}, ${e.event_time}</span>
            <span>📍 ${e.location}</span>
            <span>💰 ${money(e.price)}</span>
            <span>🪑 wolne: ${e.seats_available}/${e.seats_total}</span>
          </div>

          <div class="card-bottom">
            <span class="status ${cls}">● ${label}</span>
            <button class="secondary" onclick="location.hash='event/${e.id}'">Szczegóły</button>
          </div>
        </div>
      </article>
    `;
  }).join("") || `<p>Brak wydarzeń.</p>`;
}

async function renderEvent(id) {
  const data = await api(`/api/event/${id}`);

  currentEvent = data.event;
  currentSeats = data.seats;

  const panelClass = currentEvent.template === "concert" ? "concert-panel" : "classic-panel";

  app.innerHTML = `
    <section class="details-hero ${currentEvent.template}" style="background-image:url('${currentEvent.image_url}')">
      <div class="details-inner">
        <span class="pill">${currentEvent.category}</span>
        <h1>${currentEvent.title}</h1>
        <p>📅 ${datePL(currentEvent.event_date)}, ${currentEvent.event_time} &nbsp; 📍 ${currentEvent.location}</p>
      </div>
    </section>

    <section class="two-col">
      <article class="panel ${panelClass}">
        <h2>${currentEvent.template === "concert" ? "Koncertowy opis wydarzenia" : "Opis wydarzenia"}</h2>
        <p>${currentEvent.description}</p>

        <div class="info-grid">
          <div class="info"><small>Data</small><b>${datePL(currentEvent.event_date)}</b></div>
          <div class="info"><small>Godzina</small><b>${currentEvent.event_time}</b></div>
          <div class="info"><small>Lokalizacja</small><b>${currentEvent.location}</b></div>
          <div class="info"><small>Adres</small><b>${currentEvent.address}</b></div>
          <div class="info"><small>Wolne miejsca</small><b>${currentEvent.seats_available}</b></div>
          <div class="info"><small>Szablon</small><b>${currentEvent.template === "concert" ? "Koncertowy" : "Klasyczny"}</b></div>
        </div>

        <h3>Informacje organizacyjne</h3>
        <p>Po rezerwacji miejsce zostaje oznaczone jako zajęte w bazie danych. System blokuje ponowną rezerwację tego samego miejsca.</p>
      </article>

      <aside class="panel">
        <h2>Rezerwacja</h2>
        <p class="meta">Wybierz konkretne miejsce na interaktywnej mapie sali.</p>
        <div class="price">
          <span>Cena od</span>
          <span>${money(currentEvent.price)}</span>
        </div>
        <br>
        <button class="primary" style="width:100%" onclick="location.hash='reserve/${currentEvent.id}'">Wybierz miejsce</button>
      </aside>
    </section>
  `;
}

async function renderReserve(id) {
  const data = await api(`/api/event/${id}`);

  currentEvent = data.event;
  currentSeats = data.seats;
  selectedSeatId = null;

  if (currentEvent.status !== "active") {
    app.innerHTML = `
      <section class="container">
        <div class="panel">
          <h1>Rezerwacja niedostępna</h1>
          <p>To wydarzenie nie jest aktywne.</p>
        </div>
      </section>
    `;
    return;
  }

  app.innerHTML = `
    <section class="seat-layout">
      <div class="seat-map">
        <button class="secondary" onclick="location.hash='event/${currentEvent.id}'">← Wróć</button>
        <h2>${currentEvent.title}</h2>

        <div class="legend">
          <span><i class="dot" style="background:#7bd957"></i>Dostępne</span>
          <span><i class="dot" style="background:#2563eb"></i>Wybrane</span>
          <span><i class="dot" style="background:#cfd3da"></i>Zarezerwowane</span>
          <span><i class="dot" style="background:#ef4444"></i>Zablokowane</span>
          <span><i class="dot" style="background:#f59e0b"></i>VIP</span>
          <span><i class="dot" style="background:#a855f7"></i>Balkon</span>
        </div>

        <div class="stage">SCENA</div>

        <div id="seatsGrid" class="seats-grid" style="grid-template-columns:repeat(${currentEvent.seats_per_row},25px)"></div>

        <div id="seatInfo" class="notice">Kliknij dostępne miejsce.</div>
      </div>

      <aside class="panel">
        <h2>Formularz rezerwacji</h2>

        <form id="reservationForm">
          <div class="form-group">
            <label>Imię</label>
            <input name="first_name" required>
          </div>

          <div class="form-group">
            <label>Nazwisko</label>
            <input name="last_name" required>
          </div>

          <div class="form-group">
            <label>E-mail</label>
            <input name="email" type="email" required>
          </div>

          <div class="form-group">
            <label>Telefon</label>
            <input name="phone" minlength="7" required>
          </div>

          <label style="display:flex;gap:8px;margin:12px 0 16px">
            <input type="checkbox" required> Akceptuję regulamin.
          </label>

          <button class="primary" style="width:100%">Zarezerwuj</button>
        </form>
      </aside>
    </section>
  `;

  drawSeats();

  document.querySelector("#reservationForm").onsubmit = submitReservation;
}

function seatClass(s) {
  if (s.status === "available" && s.seat_type === "vip") return "vip";
  if (s.status === "available" && s.seat_type === "balcony") return "balcony";
  return s.status;
}

function drawSeats() {
  document.querySelector("#seatsGrid").innerHTML = currentSeats.map(s => `
    <button 
      class="seat ${seatClass(s)}"
      ${s.status !== "available" ? "disabled" : ""}
      onclick="selectSeat(${s.id})"
      title="Rząd ${s.row_label}, miejsce ${s.seat_number}">
    </button>
  `).join("");
}

function selectSeat(id) {
  selectedSeatId = id;

  const seat = currentSeats.find(s => s.id === id);

  document.querySelectorAll(".seat").forEach(x => x.classList.remove("selected"));

  const idx = currentSeats.findIndex(s => s.id === id);
  document.querySelectorAll(".seat")[idx].classList.add("selected");

  document.querySelector("#seatInfo").innerHTML = `
    <b>Wybrane miejsce:</b> sektor ${seat.sector}, rząd ${seat.row_label}, miejsce ${seat.seat_number}<br>
    Typ: ${seat.seat_type.toUpperCase()} • Cena: ${money(seat.price)}
  `;
}

async function submitReservation(e) {
  e.preventDefault();

  if (!selectedSeatId) {
    alert("Najpierw wybierz miejsce.");
    return;
  }

  const form = new FormData(e.target);

  try {
    const data = await api("/api/reserve", {
      method: "POST",
      body: JSON.stringify({
        event_id: currentEvent.id,
        seat_id: selectedSeatId,
        first_name: form.get("first_name"),
        last_name: form.get("last_name"),
        email: form.get("email"),
        phone: form.get("phone")
      })
    });

    renderConfirm(data.reservation);
  } catch (err) {
    alert(err.message);
  }
}

function renderConfirm(r) {
  app.innerHTML = `
    <section class="confirm panel">
      <span class="pill">REZERWACJA POTWIERDZONA</span>
      <h1>Dziękujemy, ${r.first_name}!</h1>
      <p>Rezerwacja została zapisana w bazie danych.</p>

      <div class="info-grid">
        <div class="info"><small>Numer rezerwacji</small><b>${r.reservation_code}</b></div>
        <div class="info"><small>Wydarzenie</small><b>${r.event_title}</b></div>
        <div class="info"><small>Data</small><b>${datePL(r.event_date)}, ${r.event_time}</b></div>
        <div class="info"><small>Lokalizacja</small><b>${r.location}</b></div>
        <div class="info"><small>Miejsce</small><b>Sektor ${r.sector}, rząd ${r.row_label}, miejsce ${r.seat_number}</b></div>
        <div class="info"><small>Status</small><b>${r.status}</b></div>
      </div>

      <br>

      <button class="primary" onclick="location.hash='home'">Wróć do wydarzeń</button>
    </section>
  `;
}

function renderLookup() {
  app.innerHTML = `
    <section class="container">
      <div class="panel" style="max-width:680px;margin:auto">
        <h1>Sprawdź rezerwację</h1>
        <p class="meta">Wpisz numer rezerwacji, np. R-ABC123.</p>

        <div class="searchbar" style="box-shadow:none;border:1px solid var(--line);grid-template-columns:1fr 150px">
          <input id="lookupCode" placeholder="Numer rezerwacji">
          <button class="primary" onclick="lookupReservation()">Sprawdź</button>
        </div>

        <div id="lookupResult"></div>
      </div>
    </section>
  `;
}

async function lookupReservation() {
  const code = document.querySelector("#lookupCode").value.trim().toUpperCase();

  try {
    const r = await api(`/api/reservation/${code}`);

    document.querySelector("#lookupResult").innerHTML = `
      <div class="notice">
        <b>${r.event_title}</b><br>
        ${datePL(r.event_date)}, ${r.event_time}<br>
        Sektor ${r.sector}, rząd ${r.row_label}, miejsce ${r.seat_number}<br>
        Status: ${r.status}
      </div>
    `;
  } catch (err) {
    document.querySelector("#lookupResult").innerHTML = `<div class="notice">${err.message}</div>`;
  }
}

/* =========================
   ADMIN
========================= */
function renderAdminLogin() {
  app.innerHTML = `
    <section class="container">
      <div class="panel" style="max-width:430px;margin:auto">
        <h1>Logowanie administratora</h1>
        <div class="notice">Demo: <b>admin@demo.pl</b> / <b>admin123</b></div>

        <form id="loginForm">
          <div class="form-group">
            <label>E-mail</label>
            <input name="email" type="email" required>
          </div>

          <div class="form-group">
            <label>Hasło</label>
            <input name="password" type="password" required>
          </div>

          <button class="primary" style="width:100%">Zaloguj</button>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#loginForm").onsubmit = async e => {
    e.preventDefault();

    const fd = new FormData(e.target);

    try {
      const res = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password")
        })
      });

      adminToken = res.token;
      localStorage.setItem("adminToken", adminToken);

      renderAdmin();
    } catch (err) {
      alert(err.message);
    }
  };
}

function renderAdmin() {
  if (!adminToken) return renderAdminLogin();

  app.innerHTML = `
    <section class="admin-layout">
      <aside class="sidebar">
        <h3>Panel admina</h3>
        <button onclick="adminView='dashboard';renderAdmin()">Dashboard</button>
        <button onclick="adminView='events';renderAdmin()">Wydarzenia</button>
        <button onclick="adminView='add';renderAdmin()">Dodaj wydarzenie</button>
        <button onclick="adminView='reservations';renderAdmin()">Rezerwacje</button>
        <button onclick="localStorage.removeItem('adminToken');adminToken='';location.hash='home'">Wyloguj</button>
      </aside>

      <main class="admin-main" id="adminMain"></main>
    </section>
  `;

  if (adminView === "dashboard") adminDashboard();
  if (adminView === "events") adminEvents();
  if (adminView === "add") adminAdd();
  if (adminView === "reservations") adminReservations();
}

async function adminDashboard() {
  const events = await api("/api/admin/events");
  const reservations = await api("/api/admin/reservations");

  const free = events.reduce((s, e) => s + Number(e.seats_available || 0), 0);

  document.querySelector("#adminMain").innerHTML = `
    <h1>Dashboard</h1>

    <div class="stats">
      <div class="stat"><strong>${events.length}</strong><span>Wydarzenia</span></div>
      <div class="stat"><strong>${reservations.length}</strong><span>Rezerwacje</span></div>
      <div class="stat"><strong>${free}</strong><span>Wolne miejsca</span></div>
      <div class="stat"><strong>${events.filter(e => e.status === "active").length}</strong><span>Aktywne</span></div>
    </div>

    <div class="panel">
      <h2>Ostatnie rezerwacje</h2>
      ${reservationsTable(reservations.slice(0, 5))}
    </div>
  `;
}

async function adminEvents() {
  const events = await api("/api/admin/events");

  document.querySelector("#adminMain").innerHTML = `
    <div class="section-head">
      <h1>Wydarzenia</h1>
      <button class="primary" onclick="adminView='add';renderAdmin()">+ Dodaj</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Nazwa</th>
          <th>Data</th>
          <th>Miejsce</th>
          <th>Status</th>
          <th>Miejsca</th>
          <th>Akcje</th>
        </tr>
      </thead>

      <tbody>
        ${events.map(e => `
          <tr>
            <td>${e.title}</td>
            <td>${datePL(e.event_date)} ${e.event_time}</td>
            <td>${e.location}</td>
            <td>${e.status}</td>
            <td>${e.seats_available}/${e.seats_total}</td>
            <td class="actions">
              <button class="secondary" onclick="adminEditEvent(${e.id})">Edytuj</button>
              <button class="secondary" onclick="adminManageSeats(${e.id})">Miejsca</button>
              <button class="danger" onclick="adminDeactivateEvent(${e.id})">Dezaktywuj</button>
              <button class="danger" onclick="adminDeleteEvent(${e.id})">Usuń</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function eventFormHtml(e = {}) {
  return `
    <form id="eventForm" class="panel">
      <div class="info-grid">
        <div class="form-group">
          <label>Nazwa</label>
          <input name="title" required value="${e.title || ""}">
        </div>

        <div class="form-group">
          <label>Kategoria</label>
          <select name="category">
            ${["Koncert", "Warsztat", "Konferencja", "Sport", "Teatr", "Inne"].map(c => `
              <option ${e.category === c ? "selected" : ""}>${c}</option>
            `).join("")}
          </select>
        </div>

        <div class="form-group">
          <label>Data</label>
          <input name="event_date" type="date" required value="${e.event_date || ""}">
        </div>

        <div class="form-group">
          <label>Godzina</label>
          <input name="event_time" type="time" required value="${e.event_time || ""}">
        </div>

        <div class="form-group">
          <label>Lokalizacja</label>
          <input name="location" required value="${e.location || ""}">
        </div>

        <div class="form-group">
          <label>Adres</label>
          <input name="address" required value="${e.address || ""}">
        </div>

        <div class="form-group">
          <label>Cena bazowa</label>
          <input name="price" type="number" min="0" value="${e.price ?? 0}">
        </div>

        <div class="form-group">
          <label>Szablon</label>
          <select name="template">
            <option value="classic" ${e.template === "classic" ? "selected" : ""}>Klasyczny</option>
            <option value="concert" ${e.template === "concert" ? "selected" : ""}>Koncertowy</option>
          </select>
        </div>

        <div class="form-group">
          <label>Status</label>
          <select name="status">
            ${["draft", "active", "sold_out", "ended", "cancelled"].map(s => `
              <option value="${s}" ${e.status === s ? "selected" : ""}>${s}</option>
            `).join("")}
          </select>
        </div>

        ${e.id ? "" : `
          <div class="form-group">
            <label>Liczba rzędów</label>
            <input name="rows_count" type="number" min="1" value="6">
          </div>

          <div class="form-group">
            <label>Miejsc w rzędzie</label>
            <input name="seats_per_row" type="number" min="1" value="10">
          </div>
        `}
      </div>

      <div class="form-group">
        <label>Link do zdjęcia</label>
        <input name="image_url" value="${e.image_url || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80"}">
      </div>

      <div class="form-group">
        <label>Opis</label>
        <textarea name="description">${e.description || ""}</textarea>
      </div>

      <button class="primary">${e.id ? "Zapisz zmiany" : "Utwórz wydarzenie"}</button>
    </form>
  `;
}

function adminAdd() {
  document.querySelector("#adminMain").innerHTML = `
    <h1>Dodaj wydarzenie</h1>
    ${eventFormHtml()}
  `;

  document.querySelector("#eventForm").onsubmit = async e => {
    e.preventDefault();

    const fd = Object.fromEntries(new FormData(e.target).entries());

    try {
      await api("/api/admin/events", {
        method: "POST",
        body: JSON.stringify(fd)
      });

      alert("Dodano wydarzenie.");
      adminView = "events";
      renderAdmin();
    } catch (err) {
      alert(err.message);
    }
  };
}

async function adminEditEvent(id) {
  const data = await api(`/api/event/${id}`);
  const e = data.event;

  document.querySelector("#adminMain").innerHTML = `
    <h1>Edytuj wydarzenie</h1>
    ${eventFormHtml(e)}
  `;

  document.querySelector("#eventForm").onsubmit = async ev => {
    ev.preventDefault();

    const fd = Object.fromEntries(new FormData(ev.target).entries());

    try {
      await api(`/api/admin/event/${id}`, {
        method: "PUT",
        body: JSON.stringify(fd)
      });

      alert("Zapisano zmiany.");
      adminView = "events";
      renderAdmin();
    } catch (err) {
      alert(err.message);
    }
  };
}

async function adminDeactivateEvent(id) {
  if (!confirm("Dezaktywować/anulować wydarzenie?")) return;

  await api(`/api/admin/event/${id}`, {
    method: "DELETE"
  });

  adminEvents();
}

async function adminDeleteEvent(id) {
  if (!confirm("Usunąć wydarzenie całkowicie?")) return;

  await api(`/api/admin/event/${id}?mode=delete`, {
    method: "DELETE"
  });

  adminEvents();
}

async function adminManageSeats(id) {
  const data = await api(`/api/admin/seats/${id}`);

  document.querySelector("#adminMain").innerHTML = `
    <button class="secondary" onclick="adminEvents()">← Wróć</button>
    <h1>Miejsca: ${data.event.title}</h1>
    <p class="meta">Kliknij miejsce, aby zmienić status, typ lub cenę.</p>

    <div class="admin-seat-box">
      ${data.seats.map(s => `
        <button class="admin-seat ${seatClass(s)}" onclick="adminEditSeat(${id},${s.id})">
          ${s.row_label}${s.seat_number}<br>${s.status}
        </button>
      `).join("")}
    </div>
  `;
}

async function adminEditSeat(eventId, seatId) {
  const status = prompt("Status miejsca: available / reserved / blocked", "blocked");
  if (!status) return;

  const type = prompt("Typ miejsca: standard / vip / balcony", "standard");
  if (!type) return;

  const price = prompt("Cena miejsca", "0");
  if (price === null) return;

  try {
    await api(`/api/admin/seats/${eventId}`, {
      method: "POST",
      body: JSON.stringify({
        seat_id: seatId,
        status,
        seat_type: type,
        price
      })
    });

    await adminManageSeats(eventId);
  } catch (err) {
    alert(err.message);
  }
}

async function adminReservations() {
  const reservations = await api("/api/admin/reservations");

  document.querySelector("#adminMain").innerHTML = `
    <h1>Rezerwacje</h1>

    <div class="panel">
      <input 
        id="resSearch" 
        placeholder="Szukaj po nazwisku, e-mailu lub wydarzeniu..."
        style="width:100%;padding:13px;border:1px solid var(--line);border-radius:10px;margin-bottom:12px"
        oninput="filterReservations()">

      <div id="resTable">${reservationsTable(reservations)}</div>
    </div>
  `;

  window.__reservations = reservations;
}

function filterReservations() {
  const q = document.querySelector("#resSearch").value.toLowerCase();

  const rows = (window.__reservations || []).filter(r => {
    return `${r.first_name} ${r.last_name} ${r.email} ${r.event_title}`.toLowerCase().includes(q);
  });

  document.querySelector("#resTable").innerHTML = reservationsTable(rows);
}

function reservationsTable(rows) {
  if (!rows.length) return `<p>Brak rezerwacji.</p>`;

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Numer</th>
          <th>Osoba</th>
          <th>E-mail</th>
          <th>Wydarzenie</th>
          <th>Miejsce</th>
          <th>Status</th>
          <th>Akcja</th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.reservation_code}</td>
            <td>${r.first_name} ${r.last_name}</td>
            <td>${r.email}</td>
            <td>${r.event_title}</td>
            <td>${r.sector}-${r.row_label}-${r.seat_number}</td>
            <td>${r.status}</td>
            <td>
              ${r.status === "active" ? `
                <button class="danger" onclick="cancelReservation('${r.reservation_code}')">Anuluj</button>
              ` : "—"}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function cancelReservation(code) {
  if (!confirm("Anulować rezerwację?")) return;

  await api("/api/admin/reservations", {
    method: "POST",
    body: JSON.stringify({
      action: "cancel",
      reservation_code: code
    })
  });

  adminReservations();
}

/* =========================
   ROUTER
========================= */
async function router() {
  const hash = location.hash.replace("#", "") || "home";

  try {
    if (hash === "home") return renderHome();
    if (hash === "lookup") return renderLookup();
    if (hash.startsWith("event/")) return renderEvent(hash.split("/")[1]);
    if (hash.startsWith("reserve/")) return renderReserve(hash.split("/")[1]);
    if (hash === "admin") return renderAdmin();

    return renderHome();
  } catch (err) {
    app.innerHTML = `
      <section class="container">
        <div class="panel">
          <h1>Błąd</h1>
          <p>${err.message}</p>
          <button class="primary" onclick="location.hash='home'">Wróć</button>
        </div>
      </section>
    `;
  }
}

window.addEventListener("hashchange", router);
router();
