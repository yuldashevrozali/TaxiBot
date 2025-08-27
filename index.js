const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN || "7406628940:AAHV3QK4wOSq_yZuWP0zHCuFWrD6TDMdxLw";
const DRIVERS_CHAT_ID = process.env.DRIVERS_CHAT_ID || -4979091008; // Guruh ID
const bot = new Telegraf(BOT_TOKEN);

let userData = {};
const cities = ["Qo'qon", "Toshkent", "Farg'ona"];

// Start bosganda
bot.start((ctx) => {
  userData[ctx.from.id] = {};
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
  if (!userData[id] || !userData[id].from || !userData[id].to) return;

  userData[id].time = ctx.message.text;

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
