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

async function rebuildSeats(DB, eventId, rows, seatsPerRow, basePrice) {
    await DB.prepare(`
        DELETE FROM reservation_seats
        WHERE reservation_id IN (
            SELECT id FROM reservations WHERE event_id = ? AND status = 'cancelled'
        )
    `).bind(eventId).run();

    await DB.prepare(`
        DELETE FROM reservations
        WHERE event_id = ? AND status = 'cancelled'
    `).bind(eventId).run();

    await DB.prepare(`DELETE FROM seats WHERE event_id = ?`).bind(eventId).run();

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
                isVip ? Number(basePrice || 0) + 50 : Number(basePrice || 0)
            ).run();
        }
    }
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

    const targetStatus = data.status || existing.status;
    const targetPrice = Number(data.price ?? existing.price);
    const rows = Number(data.rows_count ?? existing.rows_count ?? 6);
    const seatsPerRow = Number(data.seats_per_row ?? existing.seats_per_row ?? 10);

    if (rows < 1 || rows > 30 || seatsPerRow < 1 || seatsPerRow > 40) {
        return Response.json({ error: "Nieprawidłowa liczba rzędów albo miejsc w rzędzie." }, { status: 400 });
    }

    const layoutChanged = rows !== Number(existing.rows_count) || seatsPerRow !== Number(existing.seats_per_row);
    const priceChanged = targetPrice !== Number(existing.price);

    if (layoutChanged) {
        if (targetStatus !== "draft") {
            return Response.json({
                error: "Układ miejsc można zmieniać tylko wtedy, gdy wydarzenie ma status draft."
            }, { status: 400 });
        }

        const reservations = await DB.prepare(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE event_id = ? AND status != 'cancelled'
    `).bind(id).first();

        if (Number(reservations?.count || 0) > 0) {
            return Response.json({
                error: "Nie można przebudować miejsc, bo wydarzenie ma już rezerwacje."
            }, { status: 400 });
        }
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
      status = ?,
      rows_count = ?,
      seats_per_row = ?
    WHERE id = ?
  `).bind(
        data.title || existing.title,
        data.description ?? existing.description,
        data.category || existing.category,
        data.event_date || existing.event_date,
        data.event_time || existing.event_time,
        data.location || existing.location,
        data.address || existing.address,
        targetPrice,
        data.image_url || existing.image_url,
        data.template || existing.template,
        targetStatus,
        layoutChanged ? rows : Number(existing.rows_count || rows),
        layoutChanged ? seatsPerRow : Number(existing.seats_per_row || seatsPerRow),
        id
    ).run();

    if (layoutChanged) {
        await rebuildSeats(DB, id, rows, seatsPerRow, targetPrice);
    } else if (priceChanged) {
        await DB.prepare(`
            UPDATE seats
            SET price = CASE
                WHEN seat_type = 'vip' THEN ?
                ELSE ?
            END
            WHERE event_id = ?
              AND status != 'reserved'
              AND seat_type IN ('standard', 'vip')
        `).bind(targetPrice + 50, targetPrice, id).run();
    }

    const updated = await DB.prepare(
        `SELECT * FROM events WHERE id = ?`
    ).bind(id).first();

    return Response.json({
        success: true,
        message: layoutChanged
            ? "Wydarzenie zostało zaktualizowane, a układ miejsc przebudowany."
            : "Wydarzenie zostało zaktualizowane.",
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
        await DB.prepare(`
            DELETE FROM reservation_seats
            WHERE reservation_id IN (SELECT id FROM reservations WHERE event_id = ?)
        `).bind(id).run();
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
