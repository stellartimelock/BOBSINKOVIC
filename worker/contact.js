// bobsinkovic-contact: handles POST /api/contact and GET/POST /api/views
const TO = "robertwsinkovic@yahoo.com";
const FROM = "website@bobsinkovic.com";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const clean = (v, n) => String(v || "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|headless|lighthouse|monitor|uptime/i;
async function views(req, env) {
  if (!env.VIEWS) return json({ ok: false }, 503);
  let n = parseInt((await env.VIEWS.get("count")) || "0", 10) || 0;
  if (req.method === "POST") {
    const ua = req.headers.get("user-agent") || "";
    if (ua && !BOT.test(ua)) { n += 1; await env.VIEWS.put("count", String(n)); }
  } else if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
  return json({ ok: true, count: n });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/views")) return views(req, env);
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    let f;
    try { f = await req.formData(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
    if (f.get("website")) return json({ ok: true }); // honeypot: silently drop bots
    const name = clean(f.get("name"), 100), email = clean(f.get("email"), 150), phone = clean(f.get("phone"), 40);
    const message = String(f.get("message") || "").trim().slice(0, 4000);
    if (!name || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid" }, 400);
    if (!env.EMAIL || env.DELIVERY_ENABLED !== "true") return json({ ok: false, error: "delivery_not_configured" }, 503);
    const text = `New message from BobSinkovic.com\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "-"}\n\n${message}\n`;
    try {
      await env.EMAIL.send({ from: { email: FROM, name: "BobSinkovic.com" }, to: TO, replyTo: email, subject: `Website message from ${name}`, text });
      return json({ ok: true });
    } catch (e) {
      console.log("send failed", String(e));
      return json({ ok: false, error: "send_failed" }, 502);
    }
  },
};
