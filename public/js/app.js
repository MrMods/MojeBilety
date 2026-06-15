const app = document.querySelector("#app");

let selectedSeatId = null;
let currentEvent = null;
let currentSeats = [];
let adminToken = localStorage.getItem("adminToken") || "";

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
    const isMutation = options && options.method && options.method !== "GET";

    if (isMutation && typeof showLoader === "function") showLoader();

    try {
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
    } finally {
        if (isMutation && typeof hideLoader === "function") hideLoader();
    }
}

function setHash(name) {
    location.hash = name;
}

/* =========================
   USER
========================= */
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

    const adminPreview = isAdminPreviewMode();
    const canReserve = currentEvent.status === "active";
    const panelClass = currentEvent.template === "concert" ? "concert-panel" : "classic-panel";
    const reserveButton = canReserve || adminPreview
        ? `<button class="primary" style="width:100%" onclick="location.hash='reserve/${currentEvent.id}'">${canReserve ? "Wybierz miejsce" : "Podgląd wyboru miejsc"}</button>`
        : `<button class="primary" style="width:100%" disabled>Rezerwacja niedostępna</button>`;

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
        ${adminPreview && !canReserve ? `
          <div class="notice">
            <b>Podgląd admina</b><br>
            To wydarzenie ma status <b>${currentEvent.status}</b>. Użytkownicy go nie widzą i nie mogą robić rezerwacji, ale możesz podejrzeć stronę oraz układ miejsc.
          </div>
        ` : ""}

        <h2>${currentEvent.template === "concert" ? "Koncertowy opis wydarzenia" : "Opis wydarzenia"}</h2>
        <p>${currentEvent.description}</p>

        <div class="info-grid">
          <div class="info"><small>Data</small><b>${datePL(currentEvent.event_date)}</b></div>
          <div class="info"><small>Godzina</small><b>${currentEvent.event_time}</b></div>
          <div class="info"><small>Lokalizacja</small><b>${currentEvent.location}</b></div>
          <div class="info"><small>Adres</small><b>${currentEvent.address}</b></div>
          <div class="info"><small>Wolne miejsca</small><b>${currentEvent.seats_available}</b></div>
          <div class="info"><small>Status</small><b>${currentEvent.status}</b></div>
          <div class="info"><small>Szablon</small><b>${currentEvent.template === "concert" ? "Koncertowy" : "Klasyczny"}</b></div>
        </div>

        <h3>Informacje organizacyjne</h3>
        <p>Po rezerwacji miejsce zostaje oznaczone jako zajęte w bazie danych. System blokuje ponowną rezerwację tego samego miejsca.</p>
      </article>

      <aside class="panel">
        <h2>${canReserve ? "Rezerwacja" : "Podgląd"}</h2>
        <p class="meta">${canReserve ? "Wybierz konkretne miejsce na interaktywnej mapie sali." : "Wydarzenie nie jest aktywne, więc rezerwacja jest wyłączona."}</p>
        <div class="price">
          <span>Cena od</span>
          <span>${money(currentEvent.price)}</span>
        </div>
        <br>
        ${reserveButton}
      </aside>
    </section>
  `;
}

function seatClass(s) {
    if (s.status === "available" && s.seat_type === "vip") return "vip";
    if (s.status === "available" && s.seat_type === "balcony") return "balcony";
    return s.status;
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

            const target = "admin/dashboard";

            if (location.hash.replace("#", "") === target) {
                await router();
            } else {
                location.hash = target;
            }
        } catch (err) {
            alert(err.message);
        }
    };
}

function renderAdmin() {
    if (!adminToken) return renderAdminLogin();

    const hash = location.hash.replace("#", "") || "admin/dashboard";
    const parts = hash.split("/");
    const view = parts[1] || "dashboard";
    const id = parts[2];

    app.innerHTML = `
    <section class="admin-layout">
      <aside class="sidebar">
        <h3>Panel admina</h3>
        <button onclick="location.hash='admin/dashboard'">Dashboard</button>
        <button onclick="location.hash='admin/events'">Wydarzenia</button>
        <button onclick="location.hash='admin/add'">Dodaj wydarzenie</button>
        <button onclick="location.hash='admin/reservations'">Rezerwacje</button>
        <button onclick="localStorage.removeItem('adminToken');adminToken='';location.hash='home'">Wyloguj</button>
      </aside>

      <main class="admin-main" id="adminMain"></main>
    </section>
  `;

    if (view === "dashboard") return adminDashboard();
    if (view === "events") return adminEvents();
    if (view === "add") return adminAdd();
    if (view === "reservations") return adminReservations();
    if (view === "seats" && id) return adminManageSeats(id);
    if (view === "edit" && id) return adminEditEvent(id);

    location.hash = "admin/dashboard";
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
    const appEl = document.querySelector("#app");

    try {
        if (appEl) {
            appEl.classList.add("page-transition-out");
            await new Promise(resolve => setTimeout(resolve, 120));
            appEl.classList.remove("page-transition-out");
        }

        if (hash === "home") await renderHome();
        else if (hash === "lookup") renderLookup();
        else if (hash.startsWith("event/")) await renderEvent(hash.split("/")[1]);
        else if (hash.startsWith("reserve/")) await renderReserve(hash.split("/")[1]);
        else if (hash === "admin") {
            location.hash = "admin/dashboard";
            return;
        }
        else if (hash.startsWith("admin/")) await renderAdmin();
        else await renderHome();

        enhanceAfterRender();
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

window.addEventListener("hashchange", () => router());
window.addEventListener("popstate", () => router());
router();

async function adminManageSeats(id) {
    try {
        const data = await api(`/api/admin/seats/${id}`);

        document.querySelector("#adminMain").innerHTML = `
      <button class="secondary" onclick="location.hash='admin/events'">← Wróć</button>
      <h1>Miejsca: ${data.event.title}</h1>
      <p class="meta">Kliknij miejsce, aby zmienić status, typ lub cenę.</p>

      <div class="admin-seat-box">
        ${data.seats.map(s => `
          <button class="admin-seat ${seatClass(s)}" onclick="adminEditSeat(${id}, ${s.id}, '${s.status}', '${s.seat_type}', ${s.price})">
            ${s.row_label}${s.seat_number}<br>${s.status}
          </button>
        `).join("")}
      </div>
    `;
    } catch (err) {
        alert("Błąd pobierania miejsc: " + err.message);
    }
}

async function adminEditSeat(eventId, seatId, oldStatus, oldType, oldPrice) {
    const status = prompt("Status miejsca: available / reserved / blocked", oldStatus || "available");
    if (!status) return;

    const type = prompt("Typ miejsca: standard / vip / balcony", oldType || "standard");
    if (!type) return;

    const price = prompt("Cena miejsca", oldPrice || "0");
    if (price === null) return;

    try {
        const result = await api(`/api/admin/seats/${eventId}`, {
            method: "POST",
            body: JSON.stringify({
                seat_id: seatId,
                status: status,
                seat_type: type,
                price: Number(price || 0)
            })
        });

        alert(result.message || "Miejsce zaktualizowane.");
        await adminManageSeats(eventId);
    } catch (err) {
        console.error(err);
        alert("Błąd edycji miejsca: " + err.message);
    }
}

let multiSeatIds = [];

function seatButtonHtml(s) {
    const selected = multiSeatIds.includes(Number(s.id)) ? "selected" : "";

    return `
    <button
      class="seat ${seatClass(s)} ${selected}"
      ${s.status !== "available" ? "disabled" : ""}
      onclick="selectSeat(${s.id})"
      title="Rząd ${s.row_label}, miejsce ${s.seat_number}">
    </button>
  `;
}

function buildSportStadiumHtml() {
    const seats = currentSeats || [];
    const total = seats.length;

    const topCount = Math.ceil(total * 0.28);
    const bottomCount = Math.ceil(total * 0.28);
    const sideCount = Math.floor((total - topCount - bottomCount) / 2);

    const topSeats = seats.slice(0, topCount);
    const leftSeats = seats.slice(topCount, topCount + sideCount);
    const rightSeats = seats.slice(topCount + sideCount, topCount + sideCount + sideCount);
    const bottomSeats = seats.slice(topCount + sideCount + sideCount);

    return `
    <div class="sport-stadium-layout">
      <div class="sport-stand top">
        ${topSeats.map(seatButtonHtml).join("")}
      </div>

      <div class="sport-stand left">
        ${leftSeats.map(seatButtonHtml).join("")}
      </div>

      <div class="sport-field-premium">
        BOISKO / ARENA
        <small>układ sportowy — miejsca rozmieszczone dookoła</small>
      </div>

      <div class="sport-stand right">
        ${rightSeats.map(seatButtonHtml).join("")}
      </div>

      <div class="sport-stand bottom">
        ${bottomSeats.map(seatButtonHtml).join("")}
      </div>
    </div>
  `;
}

function drawSeats() {
    const layout = currentEvent ? getVenueLayout(currentEvent) : { type: "concert" };

    if (layout.type === "sport") {
        const box = document.querySelector("#venueDynamic");
        if (box) box.innerHTML = buildSportStadiumHtml();
        return;
    }

    const grid = document.querySelector("#seatsGrid");
    if (!grid) return;

    grid.innerHTML = currentSeats.map(seatButtonHtml).join("");
}

async function submitReservation(e) {
    e.preventDefault();

    if (isAdminPreviewMode() && currentEvent?.status !== "active") {
        alert("To jest tylko podgląd szkicu. Rezerwacja jest wyłączona, dopóki wydarzenie nie będzie aktywne.");
        return;
    }

    if (!multiSeatIds.length) {
        alert("Najpierw wybierz przynajmniej jedno miejsce.");
        return;
    }

    const form = new FormData(e.target);

    try {
        const data = await api("/api/reserve", {
            method: "POST",
            body: JSON.stringify({
                event_id: currentEvent.id,
                seat_ids: multiSeatIds,
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

async function lookupReservation() {
    const code = document.querySelector("#lookupCode").value.trim().toUpperCase();

    if (!code) {
        document.querySelector("#lookupResult").innerHTML = `<div class="notice">Wpisz numer rezerwacji.</div>`;
        return;
    }

    try {
        const r = await api(`/api/reservation/${code}`);
        const seats = r.seats || [];

        const seatsHtml = seats.map(s => `
      Sektor ${s.sector}, rząd ${s.row_label}, miejsce ${s.seat_number}
    `).join("<br>");

        document.querySelector("#lookupResult").innerHTML = `
      <div class="notice">
        <b>${r.event_title}</b><br>
        ${datePL(r.event_date)}, ${r.event_time}<br>
        <br>
        <b>Liczba miejsc:</b> ${r.seats_count}<br>
        <b>Miejsca:</b><br>
        ${seatsHtml}<br>
        <br>
        <b>Razem:</b> ${money(r.total_price)}<br>
        <b>Status:</b> ${r.status}
      </div>
    `;
    } catch (err) {
        document.querySelector("#lookupResult").innerHTML = `<div class="notice">${err.message}</div>`;
    }
}

function reservationsTable(rows) {
    if (!rows || !rows.length) {
        return `
      <div class="empty-state">
        <h3>Brak rezerwacji</h3>
        <p>Gdy użytkownik zarezerwuje miejsce, pojawi się tutaj.</p>
      </div>
    `;
    }

    return `
    <table class="table">
      <thead>
        <tr>
          <th>Numer</th>
          <th>Osoba</th>
          <th>E-mail</th>
          <th>Wydarzenie</th>
          <th>Miejsca</th>
          <th>Liczba</th>
          <th>Razem</th>
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
            <td>${r.seats_label || "-"}</td>
            <td>${r.seats_count || 1}</td>
            <td>${money(r.total_price || 0)}</td>
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

function getVenueLayout(event) {
    const category = (event.category || "").toLowerCase();
    const template = (event.template || "").toLowerCase();

    if (category.includes("sport")) {
        return {
            type: "sport",
            name: "Układ sportowy",
            description: "Arena lub boisko znajduje się na środku, a miejsca są rozmieszczone po bokach."
        };
    }

    if (category.includes("konferencja")) {
        return {
            type: "conference",
            name: "Układ konferencyjny",
            description: "Miejsca skierowane są w stronę sceny/prelegenta umieszczonego po prawej stronie."
        };
    }

    if (category.includes("warsztat")) {
        return {
            type: "workshop",
            name: "Układ warsztatowy",
            description: "Układ przypomina salę szkoleniową z przestrzenią roboczą dla prowadzącego."
        };
    }

    if (category.includes("teatr")) {
        return {
            type: "theatre",
            name: "Układ teatralny",
            description: "Klasyczna scena z przodu i rzędy miejsc skierowane w stronę występu."
        };
    }

    if (template.includes("concert") || category.includes("koncert")) {
        return {
            type: "concert",
            name: "Układ koncertowy",
            description: "Scena znajduje się z przodu, a miejsca rozmieszczone są przed sceną."
        };
    }

    return {
        type: "concert",
        name: "Układ standardowy",
        description: "Standardowy układ sali z główną sceną z przodu."
    };
}

function buildSeatGridHtml() {
    return `
    <div id="seatsGrid" class="seats-grid" style="grid-template-columns:repeat(${currentEvent.seats_per_row},25px)"></div>
  `;
}

function renderVenueLayoutShell() {
    const layout = getVenueLayout(currentEvent);

    if (layout.type === "sport") {
        return `<div id="venueDynamic">${buildSportStadiumHtml()}</div>`;
    }

    if (layout.type === "conference") {
        return `
      <div class="venue-layout-wrapper conference-layout">
        ${buildSeatGridHtml()}

        <div class="conference-stage">
          PRELEGENT
          <small>scena / ekran</small>
        </div>
      </div>
    `;
    }

    if (layout.type === "workshop") {
        return `
      <div class="venue-layout-wrapper workshop-layout">
        ${buildSeatGridHtml()}

        <div class="workshop-zone">
          STREFA PROWADZĄCEGO
          <br>
          <small>warsztat / szkolenie</small>
        </div>
      </div>
    `;
    }

    if (layout.type === "theatre") {
        return `
      <div class="venue-layout-wrapper theatre-layout">
        <div class="stage">SCENA TEATRALNA</div>
        ${buildSeatGridHtml()}
      </div>
    `;
    }

    return `
    <div class="venue-layout-wrapper concert-layout">
      <div class="stage">SCENA</div>
      ${buildSeatGridHtml()}
    </div>
  `;
}

function showToast(message, type = "success") {
    let box = document.querySelector(".toast-box");

    if (!box) {
        box = document.createElement("div");
        box.className = "toast-box";
        document.body.appendChild(box);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    box.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3200);
}

function safeText(value, fallback = "-") {
    return value === undefined || value === null || value === "" ? fallback : value;
}

function validateEventPayload(body) {
    if (!body.title || body.title.trim().length < 3) {
        return "Nazwa wydarzenia musi mieć co najmniej 3 znaki.";
    }

    if (!body.event_date) {
        return "Wybierz datę wydarzenia.";
    }

    if (!body.event_time) {
        return "Wybierz godzinę wydarzenia.";
    }

    if (!body.location || body.location.trim().length < 2) {
        return "Podaj lokalizację wydarzenia.";
    }

    if (!body.address || body.address.trim().length < 2) {
        return "Podaj adres wydarzenia.";
    }

    if (Number(body.price) < 0) {
        return "Cena nie może być ujemna.";
    }

    if (Number(body.rows_count || 1) < 1 || Number(body.rows_count || 1) > 30) {
        return "Liczba rzędów musi być od 1 do 30.";
    }

    if (Number(body.seats_per_row || 1) < 1 || Number(body.seats_per_row || 1) > 40) {
        return "Liczba miejsc w rzędzie musi być od 1 do 40.";
    }

    if (body.image_url && !body.image_url.startsWith("http")) {
        return "Link do zdjęcia powinien zaczynać się od http lub https.";
    }

    return null;
}

function statusPill(status) {
    const s = status || "draft";
    return `<span class="status-pill ${s}">${s}</span>`;
}

function updateImagePreview() {
    const input = document.querySelector("[name='image_url']");
    const preview = document.querySelector("#imagePreview");

    if (!input || !preview) return;

    const url = input.value.trim();

    if (!url) {
        preview.style.display = "none";
        return;
    }

    preview.src = url;
    preview.style.display = "block";
}

function setQuickStatus(value) {
    const select = document.querySelector("[name='status']");
    if (select) {
        select.value = value;
        showToast("Ustawiono status: " + value, "success");
    }
}

function isAdminPreviewMode() {
    return new URLSearchParams(location.search).get("adminPreview") === "1" && !!adminToken;
}

function previewUrlForEvent(id) {
    return `${location.origin}${location.pathname}?adminPreview=1#event/${id}`;
}

function openEventPreview(id) {
    const url = `${location.pathname}?adminPreview=1#event/${id}`;
    history.pushState(null, "", url);
    router();
}

async function adminEvents() {
    try {
        const events = await api("/api/admin/events");

        if (!events.length) {
            document.querySelector("#adminMain").innerHTML = `
        <div class="section-head">
          <h1>Wydarzenia</h1>
          <button class="primary" onclick="location.hash='admin/add'">+ Dodaj wydarzenie</button>
        </div>

        <div class="empty-state">
          <h3>Brak wydarzeń</h3>
          <p>Dodaj pierwsze wydarzenie, aby rozpocząć pracę z systemem.</p>
        </div>
      `;
            return;
        }

        document.querySelector("#adminMain").innerHTML = `
      <div class="section-head">
        <h1>Wydarzenia</h1>
        <button class="primary" onclick="location.hash='admin/add'">+ Dodaj wydarzenie</button>
      </div>

      <div class="admin-toolbar">
        <button class="secondary" onclick="adminEvents()">Odśwież listę</button>
        <button class="secondary" onclick="location.hash='admin/reservations'">Zobacz rezerwacje</button>
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
              <td>
                <b>${safeText(e.title)}</b><br>
                <small>${safeText(e.category)}</small>
              </td>
              <td>${datePL(e.event_date)}<br><small>${e.event_time}</small></td>
              <td>${safeText(e.location)}</td>
              <td>${statusPill(e.status)}</td>
              <td>${e.seats_available}/${e.seats_total}</td>
              <td class="actions">
                <button class="secondary preview-btn" onclick="openEventPreview(${e.id})">Podgląd</button>
                <button class="secondary" onclick="location.hash='admin/edit/${e.id}'">Edytuj</button>
                <button class="secondary" onclick="location.hash='admin/seats/${e.id}'">Miejsca</button>
                <button class="danger" onclick="adminDeactivateEvent(${e.id})">Dezaktywuj</button>
                <button class="danger" onclick="adminDeleteEvent(${e.id})">Usuń</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    } catch (err) {
        showToast("Błąd pobierania wydarzeń: " + err.message, "error");
    }
}

function adminEventForm(e = {}) {
    return `
    <form id="eventForm" class="panel">
      <div class="admin-warning">
        Pola nazwa, data, godzina, lokalizacja i adres są wymagane. Status <b>active</b> oznacza, że wydarzenie jest widoczne dla użytkowników.
      </div>

      <div class="info-grid">
        <div class="form-group">
          <label>Nazwa wydarzenia</label>
          <input name="title" required value="${e.title || ""}">
        </div>

        <div class="form-group">
          <label>Kategoria</label>
          <select name="category">
            ${["Koncert", "Warsztat", "Konferencja", "Sport", "Teatr", "Inne"].map(c => `
              <option value="${c}" ${e.category === c ? "selected" : ""}>${c}</option>
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
          <label>Szablon strony wydarzenia</label>
          <select name="template">
            <option value="classic" ${e.template === "classic" ? "selected" : ""}>Klasyczny</option>
            <option value="concert" ${e.template === "concert" ? "selected" : ""}>Koncertowy</option>
          </select>
        </div>

        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="draft" ${e.status === "draft" ? "selected" : ""}>draft</option>
            <option value="active" ${e.status === "active" ? "selected" : ""}>active</option>
            <option value="sold_out" ${e.status === "sold_out" ? "selected" : ""}>sold_out</option>
            <option value="ended" ${e.status === "ended" ? "selected" : ""}>ended</option>
            <option value="cancelled" ${e.status === "cancelled" ? "selected" : ""}>cancelled</option>
          </select>

          <div class="quick-status">
            <button type="button" onclick="setQuickStatus('draft')">Szkic</button>
            <button type="button" onclick="setQuickStatus('active')">Aktywne</button>
            <button type="button" onclick="setQuickStatus('cancelled')">Anulowane</button>
          </div>
        </div>

        <div class="form-group">
          <label>Liczba rzędów</label>
          <input name="rows_count" type="number" min="1" max="30" value="${e.rows_count ?? 6}">
          <div class="form-hint">${e.id ? "Zmiana układu miejsc działa tylko przy statusie draft i przebuduje miejsca od nowa." : "Te wartości utworzą początkowy układ miejsc."}</div>
        </div>

        <div class="form-group">
          <label>Miejsc w rzędzie</label>
          <input name="seats_per_row" type="number" min="1" max="40" value="${e.seats_per_row ?? 10}">
        </div>
      </div>

      <div class="form-group">
        <label>Link do zdjęcia</label>
        <input name="image_url" oninput="updateImagePreview()" value="${e.image_url || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80"}">
        <div class="form-hint">Wklej bezpośredni link do grafiki zaczynający się od https://</div>
        <img id="imagePreview" class="preview-img" src="${e.image_url || ""}" style="${e.image_url ? "" : "display:none"}">
      </div>

      <div class="form-group">
        <label>Opis</label>
        <textarea name="description">${e.description || ""}</textarea>
      </div>

      <button class="primary" type="submit">${e.id ? "Zapisz zmiany" : "Utwórz wydarzenie"}</button>
    </form>
  `;
}

async function adminAdd() {
    document.querySelector("#adminMain").innerHTML = `
    <button class="secondary" onclick="location.hash='admin/events'">← Wróć</button>
    <h1>Dodaj wydarzenie</h1>
    ${adminEventForm()}
  `;

    document.querySelector("#eventForm").onsubmit = async function (ev) {
        ev.preventDefault();

        const fd = Object.fromEntries(new FormData(ev.target).entries());

        const body = {
            title: fd.title?.trim(),
            description: fd.description?.trim(),
            category: fd.category,
            event_date: fd.event_date,
            event_time: fd.event_time,
            location: fd.location?.trim(),
            address: fd.address?.trim(),
            price: Number(fd.price || 0),
            image_url: fd.image_url?.trim(),
            template: fd.template,
            status: fd.status || "active",
            rows_count: Number(fd.rows_count || 6),
            seats_per_row: Number(fd.seats_per_row || 10)
        };

        const validationError = validateEventPayload(body);

        if (validationError) {
            showToast(validationError, "warning");
            return;
        }

        try {
            await api("/api/admin/events", {
                method: "POST",
                body: JSON.stringify(body)
            });

            showToast("Dodano wydarzenie.", "success");
            location.hash = "admin/events";
        } catch (err) {
            console.error(err);
            showToast("Błąd dodawania wydarzenia: " + err.message, "error");
        }
    };
}

async function adminEditEvent(id) {
    try {
        const data = await api(`/api/event/${id}`);
        const e = data.event;

        document.querySelector("#adminMain").innerHTML = `
      <button class="secondary" onclick="location.hash='admin/events'">← Wróć</button>
      <h1>Edytuj wydarzenie</h1>
      ${adminEventForm(e)}
    `;

        document.querySelector("#eventForm").onsubmit = async function (ev) {
            ev.preventDefault();

            const fd = Object.fromEntries(new FormData(ev.target).entries());

            const body = {
                title: fd.title?.trim(),
                description: fd.description?.trim(),
                category: fd.category,
                event_date: fd.event_date,
                event_time: fd.event_time,
                location: fd.location?.trim(),
                address: fd.address?.trim(),
                price: Number(fd.price || 0),
                image_url: fd.image_url?.trim(),
                template: fd.template,
                status: fd.status,
                rows_count: Number(fd.rows_count || 6),
                seats_per_row: Number(fd.seats_per_row || 10)
            };

            const validationError = validateEventPayload(body);

            if (validationError) {
                showToast(validationError, "warning");
                return;
            }

            try {
                const result = await api(`/api/admin/event/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(body)
                });

                showToast(result.message || "Zapisano zmiany.", "success");
                location.hash = "admin/events";
            } catch (err) {
                console.error(err);
                showToast("Błąd zapisu wydarzenia: " + err.message, "error");
            }
        };
    } catch (err) {
        showToast("Błąd otwierania edycji: " + err.message, "error");
    }
}

async function adminDeactivateEvent(id) {
    if (!confirm("Na pewno dezaktywować/anulować wydarzenie? Nie będzie widoczne na stronie głównej.")) {
        return;
    }

    try {
        const result = await api(`/api/admin/event/${id}`, {
            method: "DELETE"
        });

        showToast(result.message || "Wydarzenie zostało dezaktywowane.", "success");
        await adminEvents();
    } catch (err) {
        console.error(err);
        showToast("Błąd dezaktywacji: " + err.message, "error");
    }
}

async function adminDeleteEvent(id) {
    if (!confirm("Na pewno całkowicie usunąć wydarzenie? Ta akcja usunie też jego miejsca i rezerwacje.")) {
        return;
    }

    const secondConfirm = prompt("Wpisz USUN, aby potwierdzić trwałe usunięcie wydarzenia.");

    if (secondConfirm !== "USUN") {
        showToast("Usuwanie anulowane.", "warning");
        return;
    }

    try {
        const result = await api(`/api/admin/event/${id}?mode=delete`, {
            method: "DELETE"
        });

        showToast(result.message || "Wydarzenie zostało usunięte.", "success");
        await adminEvents();
    } catch (err) {
        console.error(err);
        showToast("Błąd usuwania: " + err.message, "error");
    }
}

function updateSelectedSeatsInfo() {
    const selectedSeats = currentSeats.filter(s => multiSeatIds.includes(Number(s.id)));

    if (!selectedSeats.length) {
        document.querySelector("#seatInfo").innerHTML = "Kliknij jedno lub kilka dostępnych miejsc.";
        document.querySelector("#selectedSummary").innerHTML = "Nie wybrano miejsc.";
        return;
    }

    const labels = selectedSeats.map(s => `Sektor ${s.sector}, rząd ${s.row_label}, miejsce ${s.seat_number}`);
    const total = selectedSeats.reduce((sum, s) => sum + Number(s.price || 0), 0);

    document.querySelector("#seatInfo").innerHTML = `
    <span class="selected-counter">Wybrano miejsc: ${selectedSeats.length}</span><br>
    ${labels.join("<br>")}
  `;

    document.querySelector("#selectedSummary").innerHTML = `
    <b>Liczba miejsc:</b> ${selectedSeats.length}<br>
    <b>Miejsca:</b><br>
    ${labels.join("<br>")}<br>
    <br>
    <b>Razem:</b> ${money(total)}
  `;
}

async function renderHome() {
    app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <span class="pill">KONCERTY • WARSZTATY • KONFERENCJE • SPORT</span>
        <h1>Odkrywaj wydarzenia i rezerwuj miejsca online.</h1>
        <p>Aplikacja umożliwia przeglądanie wydarzeń, wybór wielu miejsc na mapie sali oraz zapis rezerwacji w bazie Cloudflare D1.</p>

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
      </div>

      <div id="events" class="grid"></div>
</section>
  `;

    document.querySelector("#searchBtn").onclick = loadEvents;
    document.querySelector("#category").onchange = loadEvents;

    await loadEvents();
}

function showLoader() {
    if (document.querySelector(".loading-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(overlay);
}

function hideLoader() {
    const overlay = document.querySelector(".loading-overlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 150);
    }
}

function addRippleEffect() {
    document.addEventListener("click", function (e) {
        const btn = e.target.closest("button");
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const circle = document.createElement("span");
        const size = Math.max(rect.width, rect.height);

        circle.className = "ripple";
        circle.style.width = circle.style.height = size + "px";
        circle.style.left = (e.clientX - rect.left - size / 2) + "px";
        circle.style.top = (e.clientY - rect.top - size / 2) + "px";

        btn.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    });
}

function revealElements() {
    const items = document.querySelectorAll(".card, .panel, .info, .stat");

    items.forEach(el => {
        el.classList.add("reveal", "revealed");
    });

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: .12 });

    items.forEach(el => observer.observe(el));
}

function runConfetti() {
    const colors = ["#6d28d9", "#2563eb", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

    for (let i = 0; i < 38; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * .45) + "s";
        piece.style.transform = `rotate(${Math.random() * 180}deg)`;

        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 2300);
    }
}

function enhanceAfterRender() {
    setTimeout(() => {
        revealElements();
        enhanceAdminScroll();
    }, 40);
}

addRippleEffect();
enhanceAfterRender();

function premiumSteps(active) {
    const steps = [
        ['1', 'Wydarzenie'],
        ['2', 'Miejsca i dane'],
        ['3', 'Potwierdzenie']
    ];

    return `
    <div class="progress-steps">
      ${steps.map(([n, label], i) => {
        const num = i + 1;
        return `<div class="step ${num < active ? 'done' : num === active ? 'active' : ''}">
          <strong>${n}</strong>${label}
        </div>`;
    }).join('')}
    </div>
  `;
}

function closeSeatModal() {
    const modal = document.querySelector(".seat-modal-backdrop");
    if (modal) modal.remove();
}

function showSeatModal(seat) {
    const isSelected = multiSeatIds.includes(Number(seat.id));

    closeSeatModal();

    const modal = document.createElement("div");
    modal.className = "seat-modal-backdrop";
    modal.innerHTML = `
    <div class="seat-modal">
      <h3>Miejsce ${seat.row_label}${seat.seat_number}</h3>
      <p class="meta">Sprawdź szczegóły miejsca przed dodaniem do rezerwacji.</p>

      <div class="seat-modal-grid">
        <div><small>Sektor</small><b>${seat.sector}</b></div>
        <div><small>Rząd</small><b>${seat.row_label}</b></div>
        <div><small>Numer</small><b>${seat.seat_number}</b></div>
        <div><small>Typ</small><b>${seat.seat_type}</b></div>
        <div><small>Status</small><b>${seat.status}</b></div>
        <div><small>Cena</small><b>${money(seat.price)}</b></div>
      </div>

      <div class="actions">
        <button class="primary" onclick="toggleSeatFromModal(${seat.id})">
          ${isSelected ? "Usuń z rezerwacji" : "Dodaj do rezerwacji"}
        </button>
        <button class="secondary" onclick="closeSeatModal()">Zamknij</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
        if (e.target.classList.contains("seat-modal-backdrop")) {
            closeSeatModal();
        }
    });
}

function toggleSeatFromModal(id) {
    id = Number(id);

    if (multiSeatIds.includes(id)) {
        multiSeatIds = multiSeatIds.filter(x => x !== id);
    } else {
        multiSeatIds.push(id);
    }

    drawSeats();
    updateSelectedSeatsInfo();
    closeSeatModal();
}

function selectSeat(id) {
    id = Number(id);

    const seat = currentSeats.find(s => Number(s.id) === id);

    if (!seat || seat.status !== "available") return;

    showSeatModal(seat);
}

async function renderReserve(id) {
    const data = await api(`/api/event/${id}`);

    currentEvent = data.event;
    currentSeats = data.seats;
    multiSeatIds = [];

    const adminPreview = isAdminPreviewMode();
    const canReserve = currentEvent.status === "active";

    if (!canReserve && !adminPreview) {
        app.innerHTML = `
      <section class="container">
        <div class="panel glass-panel">
          <h1>Rezerwacja niedostępna</h1>
          <p>To wydarzenie nie jest aktywne.</p>
        </div>
      </section>
    `;
        return;
    }

    const layout = getVenueLayout(currentEvent);

    app.innerHTML = `
    <section class="seat-layout">
      <div class="seat-map glass-panel">
        <button class="secondary" onclick="location.hash='event/${currentEvent.id}'">← Wróć</button>
        <h2>${currentEvent.title}</h2>

        ${premiumSteps(2)}

        ${adminPreview && !canReserve ? `
          <div class="notice">
            <b>Podgląd admina</b><br>
            Wydarzenie ma status <b>${currentEvent.status}</b>, więc formularz rezerwacji jest wyłączony. Możesz jednak sprawdzić układ miejsc i wygląd wyboru miejsc.
          </div>
        ` : ""}

        <div class="venue-layout-info">
          <b>${layout.name}</b><br>
          ${layout.description}
        </div>

        <div class="legend">
          <span><i class="dot" style="background:#7bd957"></i>Dostępne</span>
          <span><i class="dot" style="background:#2563eb"></i>Wybrane</span>
          <span><i class="dot" style="background:#cfd3da"></i>Zarezerwowane</span>
          <span><i class="dot" style="background:#ef4444"></i>Zablokowane</span>
          <span><i class="dot" style="background:#f59e0b"></i>VIP</span>
          <span><i class="dot" style="background:#a855f7"></i>Balkon</span>
        </div>

        ${renderVenueLayoutShell()}

        <div id="seatInfo" class="notice">
          Kliknij miejsce, aby zobaczyć szczegóły i dodać je do rezerwacji.
        </div>
      </div>

      <aside class="panel glass-panel floating-summary">
        <h2>${canReserve ? "Twoja rezerwacja" : "Podgląd wyboru"}</h2>

        <div id="selectedSummary" class="notice">
          Nie wybrano miejsc.
        </div>

        ${canReserve ? `
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

            <button class="primary" style="width:100%">Zarezerwuj wybrane miejsca</button>
          </form>
        ` : `
          <div class="notice">
            To jest szkic, więc prawdziwa rezerwacja jest zablokowana. Po zmianie statusu na <b>active</b> formularz pojawi się normalnie.
          </div>
        `}
      </aside>
    </section>
  `;

    drawSeats();

    const form = document.querySelector("#reservationForm");
    if (form) form.onsubmit = submitReservation;
}

function renderConfirm(r) {
    const seats = r.seats || [];
    const seatsHtml = seats.map(s => `
    Sektor ${s.sector}, rząd ${s.row_label}, miejsce ${s.seat_number}
  `).join("<br>");

    app.innerHTML = `
    <section class="ticket-wrap">
      ${premiumSteps(3)}

      <div class="ticket">
        <div class="ticket-main">
          <span class="pill">BILET / POTWIERDZENIE</span>
          <h1 class="ticket-title">${r.event_title}</h1>

          <p class="meta">
            Rezerwacja została zapisana w bazie danych. Zachowaj numer rezerwacji.
          </p>

          <div class="ticket-meta">
            <div><small>Data</small><b>${datePL(r.event_date)}, ${r.event_time}</b></div>
            <div><small>Lokalizacja</small><b>${r.location}</b></div>
            <div><small>Osoba</small><b>${r.first_name} ${r.last_name || ""}</b></div>
            <div><small>Liczba miejsc</small><b>${r.seats_count}</b></div>
            <div><small>Razem</small><b>${money(r.total_price)}</b></div>
            <div><small>Status</small><b>${r.status}</b></div>
          </div>

          <div class="ticket-seats">
            <b>Wybrane miejsca:</b><br>
            ${seatsHtml}
          </div>

          <br>

          <button class="primary" onclick="location.hash='home'">Wróć do wydarzeń</button>
          <button class="secondary" onclick="location.hash='lookup'">Sprawdź rezerwację</button>
        </div>

        <aside class="ticket-side">
          <div class="fake-qr"></div>
          <div class="ticket-code">${r.reservation_code}</div>
          <small>Kod demonstracyjny</small>
        </aside>
      </div>
    </section>
  `;

    setTimeout(runConfetti, 180);
    enhanceAfterRender();
}

async function adminDashboard() {
    const events = await api("/api/admin/events");
    const reservations = await api("/api/admin/reservations");

    const free = events.reduce((s, e) => s + Number(e.seats_available || 0), 0);
    const active = events.filter(e => e.status === "active").length;
    const totalRevenue = reservations.reduce((s, r) => s + Number(r.total_price || 0), 0);

    document.querySelector("#adminMain").innerHTML = `
    <h1>Dashboard</h1>
    <p class="meta">Szybki podgląd działania systemu rezerwacji.</p>

    <div class="premium-stat-grid">
      <div class="premium-stat"><strong>${events.length}</strong><span>Wydarzenia</span></div>
      <div class="premium-stat"><strong>${active}</strong><span>Aktywne eventy</span></div>
      <div class="premium-stat"><strong>${reservations.length}</strong><span>Rezerwacje</span></div>
      <div class="premium-stat"><strong>${free}</strong><span>Wolne miejsca</span></div>
      <div class="premium-stat"><strong>${money(totalRevenue)}</strong><span>Suma rezerwacji</span></div>
      <div class="premium-stat"><strong>D1</strong><span>Baza danych online</span></div>
    </div>

    <div class="panel glass-panel">
      <h2>Ostatnie rezerwacje</h2>
      ${reservationsTable(reservations.slice(0, 5))}
    </div>
  `;

    enhanceAfterRender();
}


function scrollAdminTop() {
    const adminMain = document.querySelector(".admin-main");
    if (adminMain) {
        adminMain.scrollTo({ top: 0, behavior: "smooth" });
    } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function ensureAdminScrollButton() {
    let btn = document.querySelector("#adminScrollTopBtn");

    if (!btn) {
        btn = document.createElement("button");
        btn.id = "adminScrollTopBtn";
        btn.className = "scroll-top-btn";
        btn.innerHTML = "↑ Góra";
        btn.onclick = scrollAdminTop;
        document.body.appendChild(btn);
    }

    const adminMain = document.querySelector(".admin-main");

    if (!adminMain) {
        btn.classList.remove("visible");
        return;
    }

    adminMain.onscroll = function () {
        if (adminMain.scrollTop > 280) btn.classList.add("visible");
        else btn.classList.remove("visible");
    };
}

function wrapAdminTables() {
    const adminMain = document.querySelector("#adminMain");
    if (!adminMain) return;

    adminMain.querySelectorAll("table.table").forEach(table => {
        if (table.parentElement && table.parentElement.classList.contains("table-scroll")) return;

        const wrapper = document.createElement("div");
        wrapper.className = "table-scroll";
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
}

function enhanceAdminScroll() {
    setTimeout(() => {
        wrapAdminTables();
        ensureAdminScrollButton();
    }, 80);
}
