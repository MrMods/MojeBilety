export async function onRequestGet(context) {
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

  const seats = rows.results.map(r => ({
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
