const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const fs = require("fs"); // For file system operations

const BOT_TOKEN = process.env.BOT_TOKEN || "7643040634:AAG6Awteg8uUDrVkOlcnAXuYTRQn6J-zgA0";
const DRIVERS_CHAT_ID = process.env.DRIVERS_CHAT_ID || -1002449294078; // Guruh ID
const ADMIN_ID = 7341387002; // Adminning Telegram ID
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

// Start bosganda
bot.start((ctx) => {
  const db = readDb();
  const userId = ctx.from.id;

  // Foydalanuvchini bazaga qo'shish
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

// Telefon raqam olish
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

// "Qayerdan" tugmasi bosilganda
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

// "Qayerga" tugmasi bosilganda
bot.action(/to_(.+)/, (ctx) => {
  const id = ctx.from.id;
  const toCity = ctx.match[1];
  userData[id].to = toCity;

  ctx.editMessageText("⏰ Jo‘nab ketish vaqtini yozing (masalan: 15:30)");
});

// ✅ To‘g‘ri formatdagi vaqt
bot.hears(/^\d{1,2}:\d{2}$/, (ctx) => {
  const id = ctx.from.id;

  userData[id].time = ctx.message.text;

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

// ❌ Agar boshqa narsa yozsa
bot.on("text", (ctx) => {
  const id = ctx.from.id;
  if (!userData[id]) return;

  if (!userData[id].from || !userData[id].to) {
    return ctx.reply("❌ Iltimos, tugmalardan foydalaning!");
  }

  if (!userData[id].time) {
    return ctx.reply("⏰ Vaqtni to‘g‘ri formatda yozing! Masalan: 15:30");
  }
});

// Admin panel
bot.command("admin", (ctx) => {
  // Faqat admin ID'ga ruxsat berish
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("❌ Siz admin emassiz.");
  }

  const db = readDb();
  const totalUsers = Object.keys(db.users).length;
  const totalOrders = db.orders.length;

  // Eng ko'p buyurtma qilgan foydalanuvchini topish
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


// ---------------- WEBHOOK QISMI ----------------
const app = express();
app.use(express.json());

// Telegram webhook
app.use(bot.webhookCallback("/secret-path"));

// Render yoki Vercel uchun PORT
const PORT = process.env.PORT || 3000;

// Webhook URL
bot.telegram.setWebhook(`https://taxibot-fqot.onrender.com/secret-path`);

app.get("/", (req, res) => {
  res.send("🚖 Taxi bot is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});