const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'binmasud.co.ke',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'kuku@binmasud.co.ke',
    pass: process.env.SMTP_PASS || 'Masterofnone052@'
  },
  // Helpful for some hosts with custom certs; consider removing in prod if not needed
  tls: process.env.SMTP_REJECT_UNAUTH === 'false' ? { rejectUnauthorized: false } : undefined
});

async function verifyTransport() {
  try {
    await transporter.verify();
    console.log('✉️  SMTP connection verified');
  } catch (err) {
    console.error('✉️  SMTP verify failed:', err.message);
  }
}

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'BinMasudKuku <kuku@binmasud.co.ke>',
    to,
    subject,
    html
  });
}

module.exports = { sendMail, verifyTransport };
