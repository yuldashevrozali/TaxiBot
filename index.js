const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN || "7643040634:AAG6Awteg8uUDrVkOlcnAXuYTRQn6J-zgA0";
const DRIVERS_CHAT_ID = process.env.DRIVERS_CHAT_ID || -1002449294078;
const ADMIN_ID = 7341387002;
const DB_FILE = "db.json";
const bot = new Telegraf(BOT_TOKEN);

let userData = {};
const cities = ["Qo'qon", "Toshkent", "Farg'ona"];

// Database functions
function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file:", err);
    return { users: {}, orders: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing to database file:", err);
  }
}

// Admin panel (bu buyruqni boshqalardan oldin yozish muhim)
bot.command("admin", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("❌ Siz admin emassiz.");
  }

  const db = readDb();
  const totalUsers = Object.keys(db.users).length;
  const totalOrders = db.orders.length;

  let mostOrdersUser = null;
  let maxOrders = 0;
  for (const userId in db.users) {
    if (db.users[userId].order_count > maxOrders) {
      maxOrders = db.users[userId].order_count;
      mostOrdersUser = db.users[userId];
    }
  }

  let mostOrdersText = "Hech kim buyurtma qilmagan.";
  if (mostOrdersUser) {
    mostOrdersText = `@${mostOrdersUser.username || "username yo'q"} - ${mostOrdersUser.order_count} ta buyurtma`;
  }

  const adminMessage = `
📊 **Admin Paneli**

👤 **Jami foydalanuvchilar:** ${totalUsers} ta
🚖 **Jami buyurtmalar:** ${totalOrders} ta

🏆 **Eng ko'p buyurtma bergan foydalanuvchi:**
${mostOrdersText}
    `;

  ctx.replyWithMarkdown(adminMessage);
});

// Start bosganda
bot.start((ctx) => {
  const db = readDb();
  const userId = ctx.from.id;

  if (!db.users[userId]) {
    db.users[userId] = {
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      order_count: 0,
    };
    writeDb(db);
  }

  userData[userId] = {};
  ctx.reply(
    `Salom, ${ctx.from.first_name}! 🚖\nTaxi bron qilish uchun telefon raqamingizni yuboring.`,
    Markup.keyboard([
      Markup.button.contactRequest("📱 Telefon raqamni yuborish"),
    ])
      .oneTime()
      .resize()
  );
});

// Qolgan kod o'zgarmaydi...
bot.on("contact", (ctx) => {
  const id = ctx.from.id;
  userData[id] = { phone: ctx.message.contact.phone_number };
  ctx.reply(
    "📍 Qayerdan jo‘nab ketmoqchisiz?",
    Markup.inlineKeyboard(
      cities.map((c) => Markup.button.callback(c + "dan", `from_${c}`))
    )
  );
});

bot.action(/from_(.+)/, (ctx) => {
  const id = ctx.from.id;
  const fromCity = ctx.match[1];
  userData[id].from = fromCity;

  const toCities = cities.filter((c) => c !== fromCity);

  ctx.editMessageText(
    `📌 Qayerga borasiz?`,
    Markup.inlineKeyboard(
      toCities.map((c) => Markup.button.callback(c, `to_${c}`))
    )
  );
});

bot.action(/to_(.+)/, (ctx) => {
  const id = ctx.from.id;
  const toCity = ctx.match[1];
  userData[id].to = toCity;

  ctx.editMessageText("⏰ Jo‘nab ketish vaqtini yozing (masalan: 15:30, 5da, yoki ertalab 8da)");
});

bot.hears(/.+/, (ctx) => {
  const id = ctx.from.id;

  if (!userData[id] || !userData[id].from || !userData[id].to) {
    return ctx.reply("❌ Iltimos, tugmalardan foydalaning!");
  }

  const userMessage = ctx.message.text.trim().toLowerCase();

  const timeRegex = /^(?:[0-1]?[0-9]|2[0-3])(?::?([0-5]?[0-9]))?|^(\d+)?\s*(?:da|de|ta|ertalab|kechqurun|abetda|hozir)?$/;

  if (!timeRegex.test(userMessage)) {
    ctx.reply("❌ Iltimos, vaqtni to'g'ri formatda kiriting (masalan: 15:30, 5da yoki ertalab 8).");
    return;
  }

  userData[id].time = userMessage;
  const db = readDb();

  if (db.users[id]) {
    db.users[id].order_count++;
  }
  db.orders.push({
    userId: id,
    username: ctx.from.username,
    from: userData[id].from,
    to: userData[id].to,
    time: userData[id].time,
    date: new Date().toISOString(),
  });
  writeDb(db);

  bot.telegram.sendMessage(
    DRIVERS_CHAT_ID,
    `🚖 Yangi mijoz!\n\n👤 Foydalanuvchi: @${ctx.from.username || "username yo‘q"}\n📱 Tel: ${userData[id].phone}\n📍 Qayerdan: ${userData[id].from}\n🏁 Qayerga: ${userData[id].to}\n⏰ Vaqt: ${userData[id].time}`
  );

  ctx.reply("✅ Buyurtmangiz qabul qilindi! Tez orada taksichi siz bilan bog‘lanadi. 🙌");

  delete userData[id];
});

// ---------------- WEBHOOK QISMI ----------------
const app = express();
app.use(express.json());
app.use(bot.webhookCallback("/secret-path"));

const PORT = process.env.PORT || 3000;
bot.telegram.setWebhook(`https://taxibot-fqot.onrender.com/secret-path`);

app.get("/", (req, res) => {
  res.send("🚖 Taxi bot is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});