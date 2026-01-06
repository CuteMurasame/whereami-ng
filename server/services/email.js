const nodemailer = require('nodemailer');
const { Settings } = require('../models');

// Configure Transport (Put credentials in .env later)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: 587,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER || "user",
        pass: process.env.SMTP_PASS || "pass"
    }
});

const sendEmail = async (to, subject, text) => {
    try {
        // 1. Check DB: Is feature enabled?
        // findOrCreate ensures row ID 1 always exists
        const [settings] = await Settings.findOrCreate({ where: { id: 1 } });
        
        if (!settings.email_enabled) {
            console.log(`🚫 Email to ${to} blocked (Feature Disabled in Admin)`);
            return false;
        }

        // 2. Send
        const info = await transporter.sendMail({
            from: '"WhereAmI Game" <no-reply@whereami.com>',
            to,
            subject,
            text
        });

        console.log("✅ Email sent: %s", info.messageId);
        return true;
    } catch (err) {
        console.error("❌ Email Error:", err.message);
        return false;
    }
};

module.exports = { sendEmail };
