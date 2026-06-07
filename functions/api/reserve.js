function makeCode() {
  return "R-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function validateReservation(data) {
  const seatIds = Array.isArray(data.seat_ids)
    ? data.seat_ids
    : data.seat_id
      ? [data.seat_id]
      : [];

  if (!data.event_id || seatIds.length === 0) {
    return "Wybierz wydarzenie i przynajmniej jedno miejsce.";
  }

  if (!data.first_name || !data.last_name) {
    return "Imię i nazwisko są wymagane.";
  }

  if (!data.email || !data.email.includes("@")) {
    return "Podaj poprawny adres e-mail.";
  }

  if (!data.phone || data.phone.length < 7) {
    return "Podaj poprawny numer telefonu.";
  }

  return null;
}

async function makeUniqueCode(DB) {
  for (let i = 0; i < 20; i++) {
    const code = makeCode();
    const existing = await DB.prepare(
      `SELECT id FROM reservations WHERE reservation_code = ?`
    ).bind(code).first();

    if (!existing) return code;
  }

  throw new Error("Nie udało się wygenerować unikalnego kodu rezerwacji.");
}

function reservationFromRows(rows) {
  const first = rows[0];
  const seats = rows.map(r => ({
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

export async function onRequestPost(context) {
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
    return Response.json({ error: "Nie wybrano żadnego miejsca." }, { status: 400 });
  }

  const event = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(eventId).first();

  if (!event || event.status !== "active") {
    return Response.json({ error: "Tego wydarzenia nie można zarezerwować." }, { status: 400 });
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
        error: `Miejsce ${seat.row_label}${seat.seat_number} jest już zajęte albo niedostępne.`
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
        throw new Error(`Nie udało się zarezerwować miejsca ${seat.row_label}${seat.seat_number}.`);
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
