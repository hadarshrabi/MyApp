const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const forbidden = () => json({ error: "אין הרשאה לבצע פעולה זו" }, 403);
const unauthorized = () => json({ error: "נדרשת התחברות למערכת" }, 401);

function isAdmin(session) { return session?.role === "ADMIN"; }
function validCoordinates(body) {
  return Number.isFinite(body.latitude) && Number.isFinite(body.longitude) && body.latitude >= -90 && body.latitude <= 90 && body.longitude >= -180 && body.longitude <= 180;
}

export function createApi(repository, now = () => new Date().toISOString()) {
  return async function handle(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return null;
    const session = await repository.authenticate(request);
    if (!session) return unauthorized();

    if (request.method === "GET" && url.pathname === "/api/me") return json({ user: session });
    if (request.method === "GET" && url.pathname === "/api/attendance/me") {
      return json({ records: await repository.getAttendanceForEmployee(session.employeeId) });
    }
    if (request.method === "GET" && url.pathname === "/api/attendance") {
      if (!isAdmin(session)) return forbidden();
      return json({ records: await repository.getAllAttendance() });
    }
    if (request.method === "GET" && url.pathname.match(/^\/api\/stations\/\d+\/inventory$/)) {
      const stationId = Number(url.pathname.split("/")[3]);
      if (!isAdmin(session) && session.stationId !== stationId) return forbidden();
      return json({ inventory: await repository.getInventory(stationId) });
    }

    if (request.method === "POST" && url.pathname === "/api/attendance/clock") {
      if (!session.employeeId) return forbidden();
      const body = await request.json();
      if (!["CLOCK_IN", "CLOCK_OUT"].includes(body.action) || !validCoordinates(body)) return json({ error: "פרטי הדיווח אינם תקינים" }, 400);
      const stationId = session.stationId;
      if (!stationId || (body.stationId && body.stationId !== stationId)) return forbidden();
      const station = await repository.getStation(stationId);
      if (!station) return json({ error: "העמדה לא נמצאה" }, 404);
      const distanceMeters = calculateDistance(body, station);
      const record = await repository.createAttendance({
        id: crypto.randomUUID(), employeeId: session.employeeId, stationId, action: body.action,
        serverTimestamp: now(), latitude: body.latitude, longitude: body.longitude,
        gpsAccuracy: Number.isFinite(body.gpsAccuracy) ? body.gpsAccuracy : null,
        distanceMeters, deviceInfo: typeof body.deviceInfo === "string" ? body.deviceInfo.slice(0, 300) : null,
        exceptional: distanceMeters > station.allowedRadiusMeters,
      });
      return json({ record }, 201);
    }

    if (request.method === "POST" && url.pathname === "/api/attendance/manual") {
      if (!isAdmin(session)) return forbidden();
      const body = await request.json();
      if (!body.reason) return json({ error: "חובה לציין סיבה לשינוי" }, 400);
      const record = await repository.createManualAttendance(body, session.userId, now());
      return json({ record }, 201);
    }

    if (request.method === "PATCH" && url.pathname.match(/^\/api\/attendance\/[^/]+$/)) {
      if (!isAdmin(session)) return forbidden();
      const body = await request.json();
      if (!body.reason) return json({ error: "חובה לציין סיבה לשינוי" }, 400);
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const result = await repository.correctAttendance(id, body.changes ?? {}, session.userId, body.reason, now());
      return result ? json({ record: result }) : json({ error: "רשומת הנוכחות לא נמצאה" }, 404);
    }

    if (request.method === "POST" && url.pathname === "/api/sales") {
      if (!session.employeeId || !session.stationId) return forbidden();
      const body = await request.json();
      if (!body.productId || !Number.isInteger(body.quantity) || body.quantity < 1) return json({ error: "פרטי המכירה אינם תקינים" }, 400);
      try {
        const sale = await repository.createSaleAtomic({
          id: crypto.randomUUID(), employeeId: session.employeeId, stationId: session.stationId,
          productId: body.productId, quantity: body.quantity, serverTimestamp: now(),
        });
        return json({ sale }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "לא ניתן לשמור את המכירה" }, 409);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/inventory/adjust") {
      if (!isAdmin(session)) return forbidden();
      const body = await request.json();
      if (!body.reason || !Number.isInteger(body.quantityDelta)) return json({ error: "חובה לציין כמות וסיבה" }, 400);
      const transaction = await repository.adjustInventory(body, session.userId, now());
      return json({ transaction }, 201);
    }

    return json({ error: "הנתיב לא נמצא" }, 404);
  };
}

export function calculateDistance(from, to) {
  const radius = 6371e3;
  const φ1 = from.latitude * Math.PI / 180;
  const φ2 = to.latitude * Math.PI / 180;
  const Δφ = (to.latitude - from.latitude) * Math.PI / 180;
  const Δλ = (to.longitude - from.longitude) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
