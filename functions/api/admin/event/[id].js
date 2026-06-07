function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  return token && token === (env.ADMIN_TOKEN || "demo-admin-token");
}

export async function onRequestPut(context) {
  const { DB } = context.env;
  const id = context.params.id;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const data = await context.request.json();

  const existing = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();

  if (!existing) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }

  await DB.prepare(`
    UPDATE events SET
      title = ?,
      description = ?,
      category = ?,
      event_date = ?,
      event_time = ?,
      location = ?,
      address = ?,
      price = ?,
      image_url = ?,
      template = ?,
      status = ?
    WHERE id = ?
  `).bind(
    data.title || existing.title,
    data.description ?? existing.description,
    data.category || existing.category,
    data.event_date || existing.event_date,
    data.event_time || existing.event_time,
    data.location || existing.location,
    data.address || existing.address,
    Number(data.price ?? existing.price),
    data.image_url || existing.image_url,
    data.template || existing.template,
    data.status || existing.status,
    id
  ).run();

  const updated = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();

  return Response.json({
    success: true,
    message: "Wydarzenie zostało zaktualizowane.",
    event: updated
  });
}

export async function onRequestDelete(context) {
  const { DB } = context.env;
  const id = context.params.id;

  if (!isAdmin(context.request, context.env)) {
    return Response.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode") || "deactivate";

  const event = await DB.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).bind(id).first();

  if (!event) {
    return Response.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
  }

  if (mode === "delete") {
    // Najpierw usuwamy rezerwacje i miejsca, potem wydarzenie.
    // Dzięki temu nie wywali się na relacjach w bazie.
    await DB.prepare(`DELETE FROM reservations WHERE event_id = ?`).bind(id).run();
    await DB.prepare(`DELETE FROM seats WHERE event_id = ?`).bind(id).run();
    await DB.prepare(`DELETE FROM events WHERE id = ?`).bind(id).run();

    return Response.json({
      success: true,
      message: "Wydarzenie zostało całkowicie usunięte."
    });
  }

  await DB.prepare(
    `UPDATE events SET status = 'cancelled' WHERE id = ?`
  ).bind(id).run();

  return Response.json({
    success: true,
    message: "Wydarzenie zostało dezaktywowane/anulowane."
  });
}
