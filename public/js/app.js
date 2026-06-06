const app = document.querySelector("#app");

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

  let currentEvent = null;
  let currentSeats = [];
  let selectedSeatId = null;

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
        <h2>Rezerwacja</h2>
        <p>Najpierw wybierz miejsce na mapie sali.</p>

        <p>
          Wybrane miejsce:
          <strong id="selectedSeatLabel">brak</strong>
        </p>

        <button class="primary" style="width:100%" disabled>
        </button>
      </aside>
    </section>
  `;

  drawSeats();
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
