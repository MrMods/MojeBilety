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
