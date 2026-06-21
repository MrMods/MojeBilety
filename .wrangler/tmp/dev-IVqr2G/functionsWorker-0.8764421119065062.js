var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-LRn7w5/functionsWorker-0.8764421119065062.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}
__name(isAdmin, "isAdmin");
__name2(isAdmin, "isAdmin");
function rowLetter(index) {
  let n = Number(index);
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}
__name(rowLetter, "rowLetter");
__name2(rowLetter, "rowLetter");
async function rebuildSeats(DB, eventId, rows, seatsPerRow, basePrice) {
  await DB.prepare(`
        DELETE FROM reservation_seats
        WHERE reservation_id IN (
            SELECT id FROM reservations WHERE event_id = ? AND status = 'cancelled'
        )
    `).bind(eventId).run();
  await DB.prepare(`
        DELETE FROM reservations
        WHERE event_id = ? AND status = 'cancelled'
    `).bind(eventId).run();
  await DB.prepare(`DELETE FROM seats WHERE event_id = ?`).bind(eventId).run();
  for (let r = 1; r <= rows; r++) {
    for (let n = 1; n <= seatsPerRow; n++) {
      const isVip = r === 1 && n <= Math.min(4, seatsPerRow);
      await DB.prepare(`
        INSERT INTO seats (event_id, sector, row_label, seat_number, seat_type, price, status)
        VALUES (?, 'A', ?, ?, ?, ?, 'available')
      `).bind(
        eventId,
        rowLetter(r),
        n,
        isVip ? "vip" : "standard",
        isVip ? Number(basePrice || 0) + 50 : Number(basePrice || 0)
      ).run();
    }
  }
}
__name(rebuildSeats, "rebuildSeats");
__name2(rebuildSeats, "rebuildSeats");
async function onRequestPut(context) {
  const { DB } = context.env;
  const id = context.params.id;
  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const data = await context.request.json();
  const existing = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();
  if (!existing) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }
  const targetStatus = data.status || existing.status;
  const targetPrice = Number(data.price ?? existing.price);
  const rows = Number(data.rows_count ?? existing.rows_count ?? 6);
  const seatsPerRow = Number(data.seats_per_row ?? existing.seats_per_row ?? 10);
  if (rows < 1 || rows > 30 || seatsPerRow < 1 || seatsPerRow > 40) {
    return Response.json({ error: "Nieprawid\u0142owa liczba rz\u0119d\xF3w albo miejsc w rz\u0119dzie." }, { status: 400 });
  }
  const layoutChanged = rows !== Number(existing.rows_count) || seatsPerRow !== Number(existing.seats_per_row);
  const priceChanged = targetPrice !== Number(existing.price);
  if (layoutChanged) {
    if (targetStatus !== "draft") {
      return Response.json({
        error: "Uk\u0142ad miejsc mo\u017Cna zmienia\u0107 tylko wtedy, gdy wydarzenie ma status draft."
      }, { status: 400 });
    }
    const reservations = await DB.prepare(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE event_id = ? AND status != 'cancelled'
    `).bind(id).first();
    if (Number(reservations?.count || 0) > 0) {
      return Response.json({
        error: "Nie mo\u017Cna przebudowa\u0107 miejsc, bo wydarzenie ma ju\u017C rezerwacje."
      }, { status: 400 });
    }
  }
  await DB.prepare(`
    UPDATE events SET
      title = ?,
      description = ?,
      category = ?,
      event_date = ?,
      event_time = ?,
      location = ?,
      address = ?,
      price = ?,
      image_url = ?,
      template = ?,
      status = ?,
      rows_count = ?,
      seats_per_row = ?
    WHERE id = ?
  `).bind(
    data.title || existing.title,
    data.description ?? existing.description,
    data.category || existing.category,
    data.event_date || existing.event_date,
    data.event_time || existing.event_time,
    data.location || existing.location,
    data.address || existing.address,
    targetPrice,
    data.image_url || existing.image_url,
    data.template || existing.template,
    targetStatus,
    layoutChanged ? rows : Number(existing.rows_count || rows),
    layoutChanged ? seatsPerRow : Number(existing.seats_per_row || seatsPerRow),
    id
  ).run();
  if (layoutChanged) {
    await rebuildSeats(DB, id, rows, seatsPerRow, targetPrice);
  } else if (priceChanged) {
    await DB.prepare(`
            UPDATE seats
            SET price = CASE
                WHEN seat_type = 'vip' THEN ?
                ELSE ?
            END
            WHERE event_id = ?
              AND status != 'reserved'
              AND seat_type IN ('standard', 'vip')
        `).bind(targetPrice + 50, targetPrice, id).run();
  }
  const updated = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();
  return Response.json({
    success: true,
    message: layoutChanged ? "Wydarzenie zosta\u0142o zaktualizowane, a uk\u0142ad miejsc przebudowany." : "Wydarzenie zosta\u0142o zaktualizowane.",
    event: updated
  });
}
__name(onRequestPut, "onRequestPut");
__name2(onRequestPut, "onRequestPut");
async function onRequestDelete(context) {
  const { DB } = context.env;
  const id = context.params.id;
  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "deactivate";
  const event = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();
  if (!event) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }
  if (mode === "delete") {
    await DB.prepare(`
            DELETE FROM reservation_seats
            WHERE reservation_id IN (SELECT id FROM reservations WHERE event_id = ?)
        `).bind(id).run();
    await DB.prepare(`DELETE FROM reservations WHERE event_id = ?`).bind(id).run();
    await DB.prepare(`DELETE FROM seats WHERE event_id = ?`).bind(id).run();
    await DB.prepare(`DELETE FROM events WHERE id = ?`).bind(id).run();
    return Response.json({
      success: true,
      message: "Wydarzenie zosta\u0142o ca\u0142kowicie usuni\u0119te."
    });
  }
  await DB.prepare(
    `UPDATE events SET status = 'cancelled' WHERE id = ?`
  ).bind(id).run();
  return Response.json({
    success: true,
    message: "Wydarzenie zosta\u0142o dezaktywowane/anulowane."
  });
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
function isAdmin2(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}
__name(isAdmin2, "isAdmin2");
__name2(isAdmin2, "isAdmin");
async function onRequestGet(context) {
  const { DB } = context.env;
  const eventId = context.params.eventId;
  if (!isAdmin2(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const event = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(eventId).first();
  if (!event) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }
  const seats = await DB.prepare(`
    SELECT *
    FROM seats
    WHERE event_id = ?
    ORDER BY LENGTH(row_label) ASC, row_label ASC, seat_number ASC
  `).bind(eventId).all();
  return Response.json({
    event,
    seats: seats.results
  });
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost(context) {
  const { DB } = context.env;
  const eventId = context.params.eventId;
  if (!isAdmin2(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const data = await context.request.json();
  if (!data.seat_id) {
    return Response.json({ error: "Brak ID miejsca." }, { status: 400 });
  }
  const allowedStatus = ["available", "reserved", "blocked"];
  const allowedType = ["standard", "vip", "balcony"];
  if (data.status && !allowedStatus.includes(data.status)) {
    return Response.json({ error: "Nieprawid\u0142owy status miejsca." }, { status: 400 });
  }
  if (data.seat_type && !allowedType.includes(data.seat_type)) {
    return Response.json({ error: "Nieprawid\u0142owy typ miejsca." }, { status: 400 });
  }
  const seat = await DB.prepare(`
    SELECT *
    FROM seats
    WHERE id = ? AND event_id = ?
  `).bind(data.seat_id, eventId).first();
  if (!seat) {
    return Response.json({ error: "Nie znaleziono miejsca." }, { status: 404 });
  }
  await DB.prepare(`
    UPDATE seats SET
      status = ?,
      seat_type = ?,
      price = ?
    WHERE id = ? AND event_id = ?
  `).bind(
    data.status || seat.status,
    data.seat_type || seat.seat_type,
    data.price !== void 0 ? Number(data.price) : Number(seat.price),
    data.seat_id,
    eventId
  ).run();
  return Response.json({
    success: true,
    message: "Miejsce zosta\u0142o zaktualizowane."
  });
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
function isAdmin3(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}
__name(isAdmin3, "isAdmin3");
__name2(isAdmin3, "isAdmin");
function rowLetter2(index) {
  let n = Number(index);
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}
__name(rowLetter2, "rowLetter2");
__name2(rowLetter2, "rowLetter");
async function onRequestGet2(context) {
  const { DB } = context.env;
  if (!isAdmin3(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu do panelu administratora." }, { status: 401 });
  }
  const result = await DB.prepare(`
    SELECT 
      e.*,
      COUNT(s.id) AS seats_total,
      SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS seats_available,
      SUM(CASE WHEN s.status = 'reserved' THEN 1 ELSE 0 END) AS seats_reserved
    FROM events e
    LEFT JOIN seats s ON s.event_id = e.id
    GROUP BY e.id
    ORDER BY e.event_date ASC, e.event_time ASC
  `).all();
  return Response.json(result.results || []);
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestPost2(context) {
  const { DB } = context.env;
  if (!isAdmin3(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const data = await context.request.json();
  if (!data.title || !data.event_date || !data.event_time) {
    return Response.json({ error: "Nazwa, data i godzina s\u0105 wymagane." }, { status: 400 });
  }
  const insert = await DB.prepare(`
    INSERT INTO events
    (title, description, category, event_date, event_time, location, address, price, image_url, template, status, rows_count, seats_per_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.description || "",
    data.category || "Inne",
    data.event_date,
    data.event_time,
    data.location || "",
    data.address || "",
    Number(data.price || 0),
    data.image_url || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80",
    data.template || "classic",
    data.status || "active",
    Number(data.rows_count || 6),
    Number(data.seats_per_row || 10)
  ).run();
  const eventId = insert.meta.last_row_id;
  const rows = Number(data.rows_count || 6);
  const seatsPerRow = Number(data.seats_per_row || 10);
  const basePrice = Number(data.price || 0);
  for (let r = 1; r <= rows; r++) {
    for (let n = 1; n <= seatsPerRow; n++) {
      const isVip = r === 1 && n <= Math.min(4, seatsPerRow);
      await DB.prepare(`
        INSERT INTO seats (event_id, sector, row_label, seat_number, seat_type, price, status)
        VALUES (?, 'A', ?, ?, ?, ?, 'available')
      `).bind(
        eventId,
        rowLetter2(r),
        n,
        isVip ? "vip" : "standard",
        isVip ? basePrice + 50 : basePrice
      ).run();
    }
  }
  return Response.json({ success: true, id: eventId });
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
async function onRequestPost3(context) {
  const { DB, ADMIN_TOKEN } = context.env;
  const data = await context.request.json();
  const admin = await DB.prepare(`
    SELECT id, email, role FROM admins
    WHERE email = ? AND password = ?
  `).bind(data.email, data.password).first();
  if (!admin) {
    return Response.json({ error: "Nieprawid\u0142owy login lub has\u0142o." }, { status: 401 });
  }
  return Response.json({
    success: true,
    admin,
    token: ADMIN_TOKEN || "demo-admin-token"
  });
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
function isAdmin4(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}
__name(isAdmin4, "isAdmin4");
__name2(isAdmin4, "isAdmin");
async function onRequestGet3(context) {
  const { DB } = context.env;
  if (!isAdmin4(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu do rezerwacji." }, { status: 401 });
  }
  const result = await DB.prepare(`
    SELECT
      r.reservation_code,
      r.id,
      r.first_name,
      r.last_name,
      r.email,
      r.phone,
      r.status,
      r.created_at,
      e.title AS event_title,
      e.event_date,
      e.event_time,
      e.location,
      COUNT(s.id) AS seats_count,
      SUM(s.price) AS total_price,
      GROUP_CONCAT(s.sector || '-' || s.row_label || '-' || s.seat_number, ', ') AS seats_label
    FROM reservations r
    JOIN events e ON e.id = r.event_id
    JOIN reservation_seats rs ON rs.reservation_id = r.id
    JOIN seats s ON s.id = rs.seat_id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all();
  return Response.json(result.results || []);
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
async function onRequestPost4(context) {
  const { DB } = context.env;
  if (!isAdmin4(context.request, context.env)) {
    return Response.json({ error: "Brak dost\u0119pu." }, { status: 401 });
  }
  const data = await context.request.json();
  if (data.action !== "cancel" || !data.reservation_code) {
    return Response.json({ error: "Nieprawid\u0142owa akcja." }, { status: 400 });
  }
  const reservation = await DB.prepare(`
    SELECT * FROM reservations WHERE reservation_code = ?
  `).bind(data.reservation_code).first();
  if (!reservation) {
    return Response.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });
  }
  const seats = await DB.prepare(`
    SELECT seat_id FROM reservation_seats WHERE reservation_id = ?
  `).bind(reservation.id).all();
  for (const seat of seats.results) {
    await DB.prepare(`
      UPDATE seats SET status = 'available'
      WHERE id = ?
    `).bind(seat.seat_id).run();
  }
  await DB.prepare(`
    UPDATE reservations SET status = 'cancelled'
    WHERE id = ?
  `).bind(reservation.id).run();
  return Response.json({
    success: true,
    message: "Rezerwacja zosta\u0142a anulowana, a wszystkie miejsca zwolnione."
  });
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
function isAdmin5(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}
__name(isAdmin5, "isAdmin5");
__name2(isAdmin5, "isAdmin");
async function onRequestGet4(context) {
  const { DB } = context.env;
  const id = context.params.id;
  const admin = isAdmin5(context.request, context.env);
  const event = await DB.prepare(`
    SELECT 
      e.*,
      COUNT(s.id) AS seats_total,
      SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS seats_available
    FROM events e
    LEFT JOIN seats s ON s.event_id = e.id
    WHERE e.id = ? ${admin ? "" : "AND e.status = 'active'"}
    GROUP BY e.id
  `).bind(id).first();
  if (!event) {
    return Response.json({ error: "Nie znaleziono aktywnego wydarzenia." }, { status: 404 });
  }
  const seats = await DB.prepare(`
    SELECT * FROM seats
    WHERE event_id = ?
    ORDER BY LENGTH(row_label) ASC, row_label ASC, seat_number ASC
  `).bind(id).all();
  return Response.json({ event, seats: seats.results || [] });
}
__name(onRequestGet4, "onRequestGet4");
__name2(onRequestGet4, "onRequestGet");
async function onRequestGet5(context) {
  const { DB } = context.env;
  const code = context.params.code;
  const rows = await DB.prepare(`
    SELECT
      r.reservation_code,
      r.first_name,
      r.last_name,
      r.email,
      r.phone,
      r.status,
      r.created_at,
      e.title AS event_title,
      e.event_date,
      e.event_time,
      e.location,
      s.id AS seat_id,
      s.row_label,
      s.seat_number,
      s.sector,
      s.price,
      s.seat_type
    FROM reservations r
    JOIN events e ON e.id = r.event_id
    JOIN reservation_seats rs ON rs.reservation_id = r.id
    JOIN seats s ON s.id = rs.seat_id
    WHERE UPPER(r.reservation_code) = UPPER(?)
    ORDER BY s.row_label ASC, s.seat_number ASC
  `).bind(code).all();
  if (!rows.results.length) {
    return Response.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });
  }
  const first = rows.results[0];
  const seats = rows.results.map((r) => ({
    seat_id: r.seat_id,
    row_label: r.row_label,
    seat_number: r.seat_number,
    sector: r.sector,
    price: r.price,
    seat_type: r.seat_type
  }));
  return Response.json({
    reservation_code: first.reservation_code,
    first_name: first.first_name,
    last_name: first.last_name,
    email: first.email,
    phone: first.phone,
    status: first.status,
    created_at: first.created_at,
    event_title: first.event_title,
    event_date: first.event_date,
    event_time: first.event_time,
    location: first.location,
    seats,
    seats_count: seats.length,
    total_price: seats.reduce((sum, s) => sum + Number(s.price || 0), 0)
  });
}
__name(onRequestGet5, "onRequestGet5");
__name2(onRequestGet5, "onRequestGet");
async function onRequestGet6(context) {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const category = url.searchParams.get("category") || "all";
  let sql = `
    SELECT 
      e.*,
      COUNT(s.id) AS seats_total,
      SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS seats_available
    FROM events e
    LEFT JOIN seats s ON s.event_id = e.id
    WHERE e.status = 'active'
  `;
  const params = [];
  if (q) {
    sql += ` AND (LOWER(e.title) LIKE ? OR LOWER(e.location) LIKE ? OR LOWER(e.category) LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category !== "all") {
    sql += ` AND e.category = ?`;
    params.push(category);
  }
  sql += ` GROUP BY e.id ORDER BY e.event_date ASC, e.event_time ASC`;
  const result = await DB.prepare(sql).bind(...params).all();
  return Response.json(result.results);
}
__name(onRequestGet6, "onRequestGet6");
__name2(onRequestGet6, "onRequestGet");
function makeCode() {
  return "R-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}
__name(makeCode, "makeCode");
__name2(makeCode, "makeCode");
function validateReservation(data) {
  const seatIds = Array.isArray(data.seat_ids) ? data.seat_ids : data.seat_id ? [data.seat_id] : [];
  if (!data.event_id || seatIds.length === 0) {
    return "Wybierz wydarzenie i przynajmniej jedno miejsce.";
  }
  if (!data.first_name || !data.last_name) {
    return "Imi\u0119 i nazwisko s\u0105 wymagane.";
  }
  if (!data.email || !data.email.includes("@")) {
    return "Podaj poprawny adres e-mail.";
  }
  if (!data.phone || data.phone.length < 7) {
    return "Podaj poprawny numer telefonu.";
  }
  return null;
}
__name(validateReservation, "validateReservation");
__name2(validateReservation, "validateReservation");
async function makeUniqueCode(DB) {
  for (let i = 0; i < 20; i++) {
    const code = makeCode();
    const existing = await DB.prepare(
      `SELECT id FROM reservations WHERE reservation_code = ?`
    ).bind(code).first();
    if (!existing) return code;
  }
  throw new Error("Nie uda\u0142o si\u0119 wygenerowa\u0107 unikalnego kodu rezerwacji.");
}
__name(makeUniqueCode, "makeUniqueCode");
__name2(makeUniqueCode, "makeUniqueCode");
function reservationFromRows(rows) {
  const first = rows[0];
  const seats = rows.map((r) => ({
    seat_id: r.seat_id,
    row_label: r.row_label,
    seat_number: r.seat_number,
    sector: r.sector,
    price: r.price,
    seat_type: r.seat_type
  }));
  return {
    reservation_code: first.reservation_code,
    first_name: first.first_name,
    last_name: first.last_name,
    email: first.email,
    phone: first.phone,
    status: first.status,
    created_at: first.created_at,
    event_title: first.event_title,
    event_date: first.event_date,
    event_time: first.event_time,
    location: first.location,
    seats,
    seats_count: seats.length,
    total_price: seats.reduce((sum, s) => sum + Number(s.price || 0), 0)
  };
}
__name(reservationFromRows, "reservationFromRows");
__name2(reservationFromRows, "reservationFromRows");
async function onRequestPost5(context) {
  const { DB } = context.env;
  const data = await context.request.json();
  const error = validateReservation(data);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  const eventId = Number(data.event_id);
  const seatIdsRaw = Array.isArray(data.seat_ids) ? data.seat_ids : [data.seat_id];
  const seatIds = [...new Set(seatIdsRaw.map(Number).filter(Boolean))];
  if (seatIds.length === 0) {
    return Response.json({ error: "Nie wybrano \u017Cadnego miejsca." }, { status: 400 });
  }
  const event = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(eventId).first();
  if (!event || event.status !== "active") {
    return Response.json({ error: "Tego wydarzenia nie mo\u017Cna zarezerwowa\u0107." }, { status: 400 });
  }
  const selectedSeats = [];
  for (const seatId of seatIds) {
    const seat = await DB.prepare(`
      SELECT * FROM seats
      WHERE id = ? AND event_id = ?
    `).bind(seatId, eventId).first();
    if (!seat) {
      return Response.json({ error: `Nie znaleziono miejsca ID ${seatId}.` }, { status: 404 });
    }
    if (seat.status !== "available") {
      return Response.json({
        error: `Miejsce ${seat.row_label}${seat.seat_number} jest ju\u017C zaj\u0119te albo niedost\u0119pne.`
      }, { status: 409 });
    }
    selectedSeats.push(seat);
  }
  let reservationId = null;
  const updatedSeatIds = [];
  try {
    const code = await makeUniqueCode(DB);
    const insertReservation = await DB.prepare(`
      INSERT INTO reservations
      (reservation_code, event_id, seat_id, first_name, last_name, email, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      code,
      eventId,
      selectedSeats[0].id,
      data.first_name.trim(),
      data.last_name.trim(),
      data.email.trim(),
      data.phone.trim()
    ).run();
    reservationId = insertReservation.meta.last_row_id;
    for (const seat of selectedSeats) {
      const update = await DB.prepare(`
        UPDATE seats SET status = 'reserved'
        WHERE id = ? AND event_id = ? AND status = 'available'
      `).bind(seat.id, eventId).run();
      if (!update.meta || update.meta.changes !== 1) {
        throw new Error(`Nie uda\u0142o si\u0119 zarezerwowa\u0107 miejsca ${seat.row_label}${seat.seat_number}.`);
      }
      updatedSeatIds.push(seat.id);
      await DB.prepare(`
        INSERT INTO reservation_seats (reservation_id, seat_id)
        VALUES (?, ?)
      `).bind(reservationId, seat.id).run();
    }
    const rows = await DB.prepare(`
      SELECT
        r.reservation_code,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.status,
        r.created_at,
        e.title AS event_title,
        e.event_date,
        e.event_time,
        e.location,
        s.id AS seat_id,
        s.row_label,
        s.seat_number,
        s.sector,
        s.price,
        s.seat_type
      FROM reservations r
      JOIN events e ON e.id = r.event_id
      JOIN reservation_seats rs ON rs.reservation_id = r.id
      JOIN seats s ON s.id = rs.seat_id
      WHERE r.id = ?
      ORDER BY s.row_label ASC, s.seat_number ASC
    `).bind(reservationId).all();
    return Response.json({
      success: true,
      reservation: reservationFromRows(rows.results)
    });
  } catch (err) {
    for (const seatId of updatedSeatIds) {
      await DB.prepare(`
        UPDATE seats SET status = 'available'
        WHERE id = ? AND event_id = ?
      `).bind(seatId, eventId).run();
    }
    if (reservationId) {
      await DB.prepare(`DELETE FROM reservation_seats WHERE reservation_id = ?`).bind(reservationId).run();
      await DB.prepare(`DELETE FROM reservations WHERE id = ?`).bind(reservationId).run();
    }
    return Response.json({ error: err.message }, { status: 409 });
  }
}
__name(onRequestPost5, "onRequestPost5");
__name2(onRequestPost5, "onRequestPost");
var routes = [
  {
    routePath: "/api/admin/event/:id",
    mountPath: "/api/admin/event",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/admin/event/:id",
    mountPath: "/api/admin/event",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/admin/seats/:eventId",
    mountPath: "/api/admin/seats",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/seats/:eventId",
    mountPath: "/api/admin/seats",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/events",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/events",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/login",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/admin/reservations",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/admin/reservations",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/event/:id",
    mountPath: "/api/event",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/reservation/:code",
    mountPath: "/api/reservation",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/events",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/reserve",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-c6X8fn/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-c6X8fn/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.8764421119065062.js.map
