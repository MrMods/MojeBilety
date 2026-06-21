function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

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

export async function onRequestGet(context) {
  const { DB } = context.env;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu do panelu administratora." }, { status: 401 });
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

export async function onRequestPost(context) {
  const { DB } = context.env;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const data = await context.request.json();

  if (!data.title || !data.event_date || !data.event_time) {
    return Response.json({ error: "Nazwa, data i godzina są wymagane." }, { status: 400 });
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
        rowLetter(r),
        n,
        isVip ? "vip" : "standard",
        isVip ? basePrice + 50 : basePrice
      ).run();
    }
  }

  return Response.json({ success: true, id: eventId });
}
