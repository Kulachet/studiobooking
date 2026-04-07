import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: ["https://a1studioobooking.netlify.app", "http://localhost:3000", "https://ais-dev-aqqhr6xqevgql3kfzig33w-166049909817.asia-east1.run.app"],
    credentials: true
  }));
  app.use(express.json());

  // API routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    const centralEmail = process.env.CENTRAL_EMAIL;
    const centralEmailPassword = process.env.CENTRAL_EMAIL_PASSWORD;

    if (!centralEmail || !centralEmailPassword) {
      console.error("Central email credentials not configured in environment variables.");
      return res.status(500).json({ error: "Email service not configured. Please check environment variables." });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: centralEmail,
        pass: centralEmailPassword,
      },
    });

    const mailOptions = {
      from: `"Studio Booking System" <${centralEmail}>`,
      to,
      subject,
      html: body,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent from ${centralEmail} to ${to}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email via Nodemailer:", error);
      res.status(500).json({ error: "Failed to send email." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
