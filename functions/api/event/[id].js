function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

export async function onRequestGet(context) {
  const { DB } = context.env;
  const id = context.params.id;
  const admin = isAdmin(context.request, context.env);

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
