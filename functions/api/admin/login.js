export async function onRequestPost(context) {
  const { DB, ADMIN_TOKEN } = context.env;
  const data = await context.request.json();

  const admin = await DB.prepare(`
    SELECT id, email, role FROM admins
    WHERE email = ? AND password = ?
  `).bind(data.email, data.password).first();

  if (!admin) {
    return Response.json({ error: "Nieprawidłowy login lub hasło." }, { status: 401 });
  }

  return Response.json({
    success: true,
    admin,
    token: ADMIN_TOKEN || "demo-admin-token"
  });
}
