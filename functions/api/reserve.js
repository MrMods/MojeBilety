function makeCode() {
  return "R-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function validateReservation(data) {
  if (!data.event_id || !data.seat_id) return "Wybierz wydarzenie i miejsce.";
  if (!data.first_name || !data.last_name) return "Imię i nazwisko są wymagane.";
  if (!data.email || !data.email.includes("@")) return "Podaj poprawny adres e-mail.";
  if (!data.phone || data.phone.length < 7) return "Podaj poprawny numer telefonu.";
  return null;
}

export async function onRequestPost(context) {
  const { DB } = context.env;
  const data = await context.request.json();

  const error = validateReservation(data);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  const event = await DB.prepare(`SELECT * FROM events WHERE id = ?`).bind(data.event_id).first();
  if (!event || event.status !== "active") {
    return Response.json({ error: "Tego wydarzenia nie można zarezerwować." }, { status: 400 });
  }

  const seat = await DB.prepare(`
    SELECT * FROM seats WHERE id = ? AND event_id = ?
  `).bind(data.seat_id, data.event_id).first();

  if (!seat || seat.status !== "available") {
    return Response.json({ error: "To miejsce jest już zajęte albo niedostępne." }, { status: 409 });
  }

  const update = await DB.prepare(`
    UPDATE seats SET status = 'reserved'
    WHERE id = ? AND event_id = ? AND status = 'available'
  `).bind(data.seat_id, data.event_id).run();

  if (!update.meta || update.meta.changes !== 1) {
    return Response.json({ error: "Nie udało się zarezerwować miejsca. Wybierz inne." }, { status: 409 });
  }

  const code = makeCode();

  await DB.prepare(`
    INSERT INTO reservations
    (reservation_code, event_id, seat_id, first_name, last_name, email, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).bind(
    code,
    data.event_id,
    data.seat_id,
    data.first_name.trim(),
    data.last_name.trim(),
    data.email.trim(),
    data.phone.trim()
  ).run();

  const reservation = await DB.prepare(`
    SELECT 
      r.*,
      e.title AS event_title,
      e.event_date,
      e.event_time,
      e.location,
      s.row_label,
      s.seat_number,
      s.sector,
      s.price,
      s.seat_type
    FROM reservations r
    JOIN events e ON e.id = r.event_id
    JOIN seats s ON s.id = r.seat_id
    WHERE r.reservation_code = ?
  `).bind(code).first();

  return Response.json({ success: true, reservation });
}
