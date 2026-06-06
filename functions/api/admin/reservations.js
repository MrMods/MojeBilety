function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

export async function onRequestGet(context) {
  const { DB } = context.env;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const result = await DB.prepare(`
    SELECT 
      r.*,
      e.title AS event_title,
      e.event_date,
      e.event_time,
      e.location,
      s.row_label,
      s.seat_number,
      s.sector,
      s.seat_type,
      s.price
    FROM reservations r
    JOIN events e ON e.id = r.event_id
    JOIN seats s ON s.id = r.seat_id
    ORDER BY r.created_at DESC
  `).all();

  return Response.json(result.results);
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

  await DB.prepare(`
    UPDATE reservations SET status = 'cancelled'
    WHERE reservation_code = ?
  `).bind(data.reservation_code).run();

  await DB.prepare(`
    UPDATE seats SET status = 'available'
    WHERE id = ?
  `).bind(reservation.seat_id).run();

  return Response.json({ success: true });
}
