const app = document.querySelector("#app");

  let currentEvent = null;
  let currentSeats = [];
  let selectedSeatId = null;

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
          <p>To wydarzenie nie jest aktualnie aktywne.</p>
          <button class="primary" onclick="location.hash='event/${currentEvent.id}'">Wróć</button>
        </div>
      </section>
    `;
    return;
  }

  app.innerHTML = `
    <section class="seat-layout">
      <div class="seat-map">
        <button class="secondary" onclick="location.hash='event/${currentEvent.id}'">← Wróć do wydarzenia</button>
        <h2>${currentEvent.title}</h2>

        <div class="legend">
          <span><i class="dot available-dot"></i>Dostępne</span>
          <span><i class="dot selected-dot"></i>Wybrane</span>
          <span><i class="dot reserved-dot"></i>Zarezerwowane</span>
          <span><i class="dot blocked-dot"></i>Zablokowane</span>
          <span><i class="dot vip-dot"></i>VIP</span>
        </div>

        <div class="stage">SCENA</div>

        <div 
          id="seatsGrid" 
          class="seats-grid" 
          style="grid-template-columns: repeat(${currentEvent.seats_per_row}, 34px)"
        ></div>

        <div id="seatInfo" class="notice">
          Kliknij dostępne miejsce, aby je wybrać.
        </div>
      </div>

      <aside class="panel">
        <h2>Formularz rezerwacji</h2>
        <p>Wybierz miejsce, a następnie uzupełnij dane.</p>

        <p>
          Wybrane miejsce:
          <strong id="selectedSeatLabel">brak</strong>
        </p>

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

          <label class="checkbox">
            <input type="checkbox" required>
            Akceptuję regulamin.
          </label>

          <button class="primary" style="width:100%">
            Zarezerwuj
          </button>
        </form>
      </aside>
    </section>
  `;

  drawSeats();
  document.querySelector("#reservationForm").onsubmit = submitReservation;
}

function seatClass(seat) {
  if (seat.status === "reserved") return "reserved";
  if (seat.status === "blocked") return "blocked";
  if (seat.type === "vip") return "vip";
  return "available";
}

function drawSeats() {
  const seatsGrid = document.querySelector("#seatsGrid");

  seatsGrid.innerHTML = currentSeats.map(seat => {
    const cls = seatClass(seat);
    const disabled = seat.status !== "available" ? "disabled" : "";

    return `
      <button 
        class="seat ${cls}" 
        ${disabled}
        onclick="selectSeat(${seat.id})"
        title="Rząd ${seat.row_label}, miejsce ${seat.seat_number}"
      >
        ${seat.row_label}${seat.seat_number}
      </button>
    `;
  }).join("");
}

function selectSeat(id) {
  const seat = currentSeats.find(s => s.id === id);

  if (!seat || seat.status !== "available") {
    return;
  }

  selectedSeatId = id;

  document.querySelectorAll(".seat").forEach(btn => {
    btn.classList.remove("selected");
  });

  const selectedButton = [...document.querySelectorAll(".seat")]
    .find(btn => btn.textContent.trim() === `${seat.row_label}${seat.seat_number}`);

  if (selectedButton) {
    selectedButton.classList.add("selected");
  }

  document.querySelector("#selectedSeatLabel").textContent = `${seat.row_label}${seat.seat_number}`;
  document.querySelector("#seatInfo").innerHTML = `
    Wybrano miejsce <strong>${seat.row_label}${seat.seat_number}</strong>.
  `;
}
async function submitReservation(e) {
  e.preventDefault();

  if (!selectedSeatId) {
    alert("Najpierw wybierz miejsce.");
    return;
  }

  const form = new FormData(e.target);

  const payload = {
    event_id: currentEvent.id,
    seat_id: selectedSeatId,
    first_name: form.get("first_name"),
    last_name: form.get("last_name"),
    email: form.get("email"),
    phone: form.get("phone")
  };

  try {
    const reservation = await api("/api/reserve", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    renderConfirm(reservation);
  } catch (err) {
    alert(err.message);
  }
}
function renderConfirm(reservation) {
  app.innerHTML = `
    <section class="container">
      <div class="confirm">
        <div class="notice">
          Rezerwacja została utworzona.
        </div>

        <h1>Potwierdzenie rezerwacji</h1>

        <p>
          Zachowaj kod rezerwacji. Będzie potrzebny do sprawdzenia statusu.
        </p>

        <div class="info-grid">
          <div class="info">
            <small>Kod rezerwacji</small>
            <b>${reservation.reservation_code || reservation.code}</b>
          </div>

          <div class="info">
            <small>Wydarzenie</small>
            <b>${currentEvent.title}</b>
          </div>

          <div class="info">
            <small>Status</small>
            <b>${reservation.status || "confirmed"}</b>
          </div>

          <div class="info">
            <small>ID rezerwacji</small>
            <b>${reservation.id}</b>
          </div>
        </div>

        <div class="actions">
          <button class="primary" onclick="location.hash='home'">
            Wróć do wydarzeń
          </button>

          <button class="secondary" onclick="location.hash='lookup'">
            Sprawdź rezerwację
          </button>
        </div>
      </div>
    </section>
  `;
}
function renderLookup() {
  app.innerHTML = `
    <section class="container">
      <div class="panel">
        <h1>Sprawdź rezerwację</h1>
        <p>Wpisz kod rezerwacji, aby zobaczyć jej status.</p>

        <div class="form-group">
          <label>Kod rezerwacji</label>
          <input id="lookupCode" placeholder="np. ABC123">
        </div>

        <button class="primary" onclick="lookupReservation()">
          Sprawdź
        </button>

        <div id="lookupResult"></div>
      </div>
    </section>
  `;
}
async function lookupReservation() {
  const code = document.querySelector("#lookupCode").value.trim();
  const result = document.querySelector("#lookupResult");

  if (!code) {
    result.innerHTML = `<p class="bad">Podaj kod rezerwacji.</p>`;
    return;
  }

  try {
    const reservation = await api(`/api/reservation/${code}`);

    result.innerHTML = `
      <div class="confirm lookup-card">
        <h2>Rezerwacja znaleziona</h2>

        <div class="info-grid">
          <div class="info">
            <small>Kod</small>
            <b>${reservation.reservation_code || reservation.code}</b>
          </div>

          <div class="info">
            <small>Status</small>
            <b>${reservation.status}</b>
          </div>

          <div class="info">
            <small>Imię</small>
            <b>${reservation.first_name || "-"}</b>
          </div>

          <div class="info">
            <small>Nazwisko</small>
            <b>${reservation.last_name || "-"}</b>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    result.innerHTML = `
      <div class="notice error">
        Nie znaleziono rezerwacji o podanym kodzie.
      </div>
    `;
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
              <button class="secondary" disabled>Edytuj</button>
              <button class="secondary" disabled>Miejsca</button>
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

        <div class="form-group">
          <label>Liczba rzędów</label>
          <input name="rows_count" type="number" min="1" value="6">
        </div>

        <div class="form-group">
          <label>Miejsc w rzędzie</label>
          <input name="seats_per_row" type="number" min="1" value="10">
        </div>
      </div>

      <div class="form-group">
        <label>Link do zdjęcia</label>
        <input 
          name="image_url" 
          value="${e.image_url || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80"}"
        >
      </div>

      <div class="form-group">
        <label>Opis</label>
        <textarea name="description">${e.description || ""}</textarea>
      </div>

      <button class="primary">
        Utwórz wydarzenie
      </button>
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
