export async function onRequestGet(context) {
  const { DB } = context.env;
  const id = context.params.id;

  const event = await DB.prepare(`
    SELECT 
      e.*,
      COUNT(s.id) AS seats_total,
      SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS seats_available
    FROM events e
    LEFT JOIN seats s ON s.event_id = e.id
    WHERE e.id = ?
    GROUP BY e.id
  `).bind(id).first();

  if (!event) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }

  const seats = await DB.prepare(`
    SELECT * FROM seats
    WHERE event_id = ?
    ORDER BY row_label ASC, seat_number ASC
  `).bind(id).all();

  return Response.json({ event, seats: seats.results });
}
