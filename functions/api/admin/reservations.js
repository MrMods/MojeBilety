function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

export async function onRequestGet(context) {
  const { DB } = context.env;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu do rezerwacji." }, { status: 401 });
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

export async function onRequestPost(context) {
  const { DB } = context.env;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const data = await context.request.json();

  if (data.action !== "cancel" || !data.reservation_code) {
    return Response.json({ error: "Nieprawidłowa akcja." }, { status: 400 });
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
    message: "Rezerwacja została anulowana, a wszystkie miejsca zwolnione."
  });
}
