import https from "node:https";

const baseUrl = new URL(process.env.APP_ORIGIN);
const tailscaleIp = process.env.TAILSCALE_VERIFY_IP;
if (!tailscaleIp || !process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_EMPLOYEE_PASSWORD) {
  throw new Error("TAILSCALE_VERIFY_IP and development seed passwords are required");
}

function call(path, { method = "GET", token, cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: baseUrl.hostname,
      port: 443,
      path,
      method,
      servername: baseUrl.hostname,
      lookup: (_hostname, _options, callback) => callback(null, [{ address: tailscaleIp, family: 4 }]),
      headers: {
        origin: baseUrl.origin,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
    }, response => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { text += chunk; });
      response.on("end", () => {
        let parsed = text;
        try { parsed = text ? JSON.parse(text) : null; } catch { /* HTML response */ }
        resolve({
          status: response.statusCode,
          body: parsed,
          cookie: response.headers["set-cookie"]?.[0]?.split(";")[0],
        });
      });
    });
    request.on("error", reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

const loginPage = await call("/login");
const admin = await call("/api/auth/login", { method: "POST", body: { email: "owner@linoy-designs.example", password: process.env.SEED_ADMIN_PASSWORD } });
const adminData = await call("/api/admin/bootstrap", { token: admin.body?.accessToken });
const refresh = await call("/api/auth/refresh", { method: "POST", cookie: admin.cookie, body: {} });
const logout = await call("/api/auth/logout", { method: "POST", cookie: refresh.cookie ?? admin.cookie, body: {} });
const employee = await call("/api/auth/login", { method: "POST", body: { email: "maya@linoy-designs.example", password: process.env.SEED_EMPLOYEE_PASSWORD } });
const employeeHome = await call("/api/employee/home", { token: employee.body?.accessToken });

const checks = {
  login: loginPage.status === 200,
  admin: admin.status === 200 && admin.body?.user?.systemRole === "ADMIN",
  adminApi: adminData.status === 200 && Array.isArray(adminData.body?.stations),
  refresh: refresh.status === 200 && Boolean(refresh.body?.accessToken),
  logout: logout.status === 204,
  employee: employee.status === 200 && employee.body?.user?.systemRole === "EMPLOYEE",
  employeeApi: employeeHome.status === 200 && Boolean(employeeHome.body?.station),
};
console.log(checks);
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
