export async function onRequestGet(context) {
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
