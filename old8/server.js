const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3026;
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Libera acesso à pasta views (onde está o admin.html)
app.use("/views", express.static(path.join(__dirname, "views")));

const dbDir = path.join(__dirname, "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
const db = new Database(path.join(dbDir, "rifa.db"));

// ======== TABELAS ==========================================================
db.exec(`
CREATE TABLE IF NOT EXISTS guests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT UNIQUE,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`);
db.exec(`
CREATE TABLE IF NOT EXISTS numbers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT UNIQUE,
  status TEXT DEFAULT 'free',
  items_json TEXT,
  guest_name TEXT,
  guest_phone TEXT,
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);
`);

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

// ======== WHATSAPP CLIENT ===================================================
let waClient = null;
waClient = new Client({
  authStrategy: new LocalAuth({ clientId: "cha-levi" }),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});
waClient.on("qr", (qr) => {
  console.clear();
  console.log("📱 Escaneie o QR abaixo com o WhatsApp:");
  qrcode.generate(qr, { small: true });
});
waClient.on("ready", () => console.log("WhatsApp pronto."));
waClient.initialize();

// ======== ROTAS API =========================================================

// Lista números com convidado e telefone
app.get("/api/numbers", (req, res) => {
  const rows = db.prepare("SELECT * FROM numbers ORDER BY id").all();
  res.json(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      status: r.status,
      guestName: r.guest_name || "",
      guestPhone: r.guest_phone || "",
      items: JSON.parse(r.items_json || "{}"),
    }))
  );
});


// Registro de convidado
app.post("/api/guest/register", (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ ok: false });
  db.prepare(
    "INSERT INTO guests(name,phone,updated_at) VALUES(?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at"
  ).run(name, phone, nowUnix());
  console.log(
    `[${new Date().toISOString()}] SYNC guest:${phone} status:registered`
  );
  res.json({ ok: true });
});

// Verifica se o convidado já existe por telefone
app.get("/api/guest/check", (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ exists: false });
  const row = db.prepare("SELECT name FROM guests WHERE phone=?").get(phone);
  if (row) return res.json({ exists: true, guest_name: row.name });
  return res.json({ exists: false });
});

// =============================================================
// Retorna todos os números e itens associados ao convidado
app.get("/api/my-numbers/:phone", (req, res) => {
  const phone = req.params.phone;
  if (!phone) return res.status(400).json({ ok: false, msg: "phone ausente" });

  const rows = db
    .prepare(
      "SELECT label, items_json FROM numbers WHERE guest_phone=? AND status='occupied' ORDER BY id"
    )
    .all(phone);

  const result = rows.map((r) => ({
    label: r.label,
    items: JSON.parse(r.items_json || "{}").description || "",
  }));

  console.log("[MYNUMBERS] phone:", phone, "total:", result.length);
  res.json(result);
});


// Seleciona número
app.post("/api/select", async (req, res) => {
  const { id, name, phone } = req.body;
  if (!id || !name || !phone) return res.status(400).json({ ok: false });

  const row = db.prepare("SELECT * FROM numbers WHERE id=?").get(id);
  if (!row) return res.status(404).json({ ok: false });
  if (row.status !== "free") return res.status(409).json({ ok: false });

  db.prepare(
    "UPDATE numbers SET status='occupied', guest_name=?, guest_phone=?, updated_at=? WHERE id=?"
  ).run(name, phone, nowUnix(), id);

  const item = JSON.parse(row.items_json || "{}").description || "-";
  const msg1 = `Olá ${name}!\n💙 Presença confirmada no Chá de Bebê do Levi!\n\n📅 Data: 13/12/2025 15:00\n📍 Local: Rua Caopiá, 73 - JD Guairacá\n\nAgradecemos muito seu carinho!\nCaso queira abençoar o Levi com mais itens, é só voltar no link e escolher outros números.`;
  const msg2 = `Números: ${row.label} | Itens: ${item}`;
  const msgGroup = `${name} confirmou o número ${row.label} — ${item}`;

  console.log(
    `[${new Date().toISOString()}] ACTION select: phone=${phone} id=${id} label=${row.label}`
  );

  // ======== ENVIO DE MENSAGENS ==============================================
  if (waClient && waClient.info) {
    try {
      const jaTem = db
        .prepare(
          "SELECT COUNT(*) AS c FROM numbers WHERE guest_phone=? AND status='occupied'"
        )
        .get(phone).c;

      // envia msg1 apenas se for a primeira vez
      if (jaTem === 1) {
        await waClient.sendMessage(`${phone}@c.us`, msg1);
        console.log(
          `[${new Date().toISOString()}] OUT to:${phone} msg:"${msg1}"`
        );
      }

      // sempre envia msg2 para o número recém-confirmado
      await waClient.sendMessage(`${phone}@c.us`, msg2);
      console.log(
        `[${new Date().toISOString()}] OUT to:${phone} msg:"${msg2}"`
      );

      // envia para grupo
      await waClient.sendMessage(`120363041095556496@g.us`, msgGroup);
      console.log(
        `[${new Date().toISOString()}] OUT group:ChaLevi_Euvou msg:"${msgGroup}"`
      );
    } catch (e) {
      console.error("Erro WhatsApp:", e);
    }
  }

  res.json({ ok: true, selection: { id, label: row.label, items: item } });
});

// Reset DEV
app.post("/api/reset", (req, res) => {
  db.prepare(
    "UPDATE numbers SET status='free', guest_name=NULL, guest_phone=NULL"
  ).run();
  db.prepare("DELETE FROM guests").run();
  res.json({ ok: true, msg: "Reset concluído" });
});

// =============================================================
// ADMIN ENDPOINTS
app.get("/api/admin/stats", (req, res) => {
  const totalNumbers = db.prepare("SELECT COUNT(*) AS c FROM numbers").get().c;
  const occupied = db
    .prepare("SELECT COUNT(*) AS c FROM numbers WHERE status='occupied'")
    .get().c;
  const totalGuests = db.prepare("SELECT COUNT(*) AS c FROM guests").get().c;
  const lastGuest = db
    .prepare(
      "SELECT datetime(updated_at,'unixepoch','localtime') AS last FROM guests ORDER BY updated_at DESC LIMIT 1"
    )
    .get();

  res.json({
    totalNumbers,
    occupied,
    totalGuests,
    lastGuest: lastGuest ? lastGuest.last : null,
  });
});

app.post("/api/admin/reset", (req, res) => {
  db.prepare(
    "UPDATE numbers SET status='free', guest_name=NULL, guest_phone=NULL"
  ).run();
  db.prepare("DELETE FROM guests").run();
  console.log("[ADMIN] Reset completo via painel.");
  res.json({ ok: true, msg: "Reset completo." });
});

// =============================================================
// Libera número individual (painel admin)
app.post("/api/release", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ ok: false, msg: "id ausente" });

  db.prepare(
    "UPDATE numbers SET status='free', guest_name=NULL, guest_phone=NULL WHERE id=?"
  ).run(id);

  console.log("[ADMIN] Número liberado:", id);
  res.json({ ok: true });
});



// ======== INÍCIO SERVIDOR ===================================================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
