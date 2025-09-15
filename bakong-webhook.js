import { MongoClient } from 'mongodb';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Connect to MongoDB
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('bakong');
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// Send Telegram notification
async function sendTelegram(username, amount, status) {
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  const text = `✅ Payment Update!\nUser: ${username}\nAmount: $${amount}\nStatus: ${status}`;
  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id, text });
}

// Vercel API Route
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { transactionId, amount, status, username, api_key } = req.body;

    if(api_key !== process.env.CLIENT_API_KEY)
      return res.status(403).json({ error: 'Invalid API Key' });

    const { db } = await connectToDatabase();

    // Upsert payment by transactionId
    await db.collection('payments').updateOne(
      { transactionId },
      { $set: { transactionId, username, amount, status, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(`Payment updated: ${transactionId} - ${status}`);

    // Send Telegram notification
    await sendTelegram(username, amount, status);

    res.status(200).json({ message: 'Webhook processed successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
       }
