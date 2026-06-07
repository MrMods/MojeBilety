function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

export async function onRequestGet(context) {
  const { DB } = context.env;
  const eventId = context.params.eventId;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
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
    ORDER BY row_label ASC, seat_number ASC
  `).bind(eventId).all();

  return Response.json({
    event,
    seats: seats.results
  });
}

export async function onRequestPost(context) {
  const { DB } = context.env;
  const eventId = context.params.eventId;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const data = await context.request.json();

  if (!data.seat_id) {
    return Response.json({ error: "Brak ID miejsca." }, { status: 400 });
  }

  const allowedStatus = ["available", "reserved", "blocked"];
  const allowedType = ["standard", "vip", "balcony"];

  if (data.status && !allowedStatus.includes(data.status)) {
    return Response.json({ error: "Nieprawidłowy status miejsca." }, { status: 400 });
  }

  if (data.seat_type && !allowedType.includes(data.seat_type)) {
    return Response.json({ error: "Nieprawidłowy typ miejsca." }, { status: 400 });
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
    data.price !== undefined ? Number(data.price) : Number(seat.price),
    data.seat_id,
    eventId
  ).run();

  return Response.json({
    success: true,
    message: "Miejsce zostało zaktualizowane."
  });
}
