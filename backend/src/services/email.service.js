import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const pickFirst = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const EMAIL_HOST = pickFirst(process.env.EMAIL_HOST, process.env.SMTP_HOST);
const EMAIL_PORT = Number(
  pickFirst(process.env.EMAIL_PORT, process.env.SMTP_PORT, "587")
);
const EMAIL_USER = pickFirst(
  process.env.EMAIL_USER,
  process.env.SMTP_USER,
  process.env.SMTP_EMAIL
);
const EMAIL_PASS = pickFirst(
  process.env.EMAIL_PASS,
  process.env.SMTP_PASS,
  process.env.SMTP_PASSWORD
);
const MAIL_FROM =
  pickFirst(process.env.EMAIL_FROM, process.env.SMTP_FROM) ||
  (EMAIL_USER ? `SUM Academy <${EMAIL_USER}>` : "SUM Academy");
const EMAIL_CONFIGURED = Boolean(
  EMAIL_HOST && Number.isFinite(EMAIL_PORT) && EMAIL_USER && EMAIL_PASS
);

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST || "smtp.gmail.com",
  port: EMAIL_PORT || 587,
  secure: EMAIL_PORT === 465,
  requireTLS: EMAIL_PORT !== 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendMail = async (options = {}) => {
  if (!EMAIL_CONFIGURED) {
    throw new Error(
      "Email service is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS."
    );
  }
  return transporter.sendMail(options);
};

if (EMAIL_CONFIGURED) {
  transporter
    .verify()
    .then(() => {
      console.log("[Email] SMTP connection verified");
    })
    .catch((error) => {
      console.error("[Email] SMTP verify failed:", error.message);
    });
} else {
  console.warn(
    "[Email] SMTP config missing. Email sending will fail until EMAIL_* or SMTP_* env vars are set."
  );
}

export const sendRegistrationOTP = async (email, name, otp) => {
  try {
    console.log("Sending OTP email to:", email);
    await sendMail({
      from:    MAIL_FROM,
      to:      email,
      subject: "Verify your SUM Academy account",
      html: `
        <div style="font-family: DM Sans, sans-serif; max-width: 480px; 
             margin: 0 auto; padding: 32px; background: #f8f9fe; 
             border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; background: #4a63f5; 
                 border-radius: 12px; display: inline-flex; 
                 align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px; 
                    font-weight: bold;">S</span>
            </div>
            <h2 style="color: #1a1a2e; margin-top: 12px;">SUM Academy</h2>
          </div>
          <h3 style="color: #1a1a2e;">Hi ${name}, verify your email</h3>
          <p style="color: #64748b;">
            Use this OTP code to verify your SUM Academy account.
            It expires in 5 minutes.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <span style="font-size: 36px; font-weight: bold; 
                  letter-spacing: 8px; color: #4a63f5; 
                  background: #f0f4ff; padding: 16px 32px; 
                  border-radius: 12px;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            If you did not create a SUM Academy account, ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; 
               margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
    console.log("OTP email sent successfully to:", email);
  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw error;
  }
};

export const sendForgotPasswordOTP = async (email, name, otp) => {
  try {
    await sendMail({
      from:    MAIL_FROM,
      to:      email,
      subject: "Reset your SUM Academy password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; 
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #1a1a2e;">Reset Your Password</h2>
          <p style="color: #64748b;">Hi ${name}, use this OTP to reset 
             your password. It expires in 5 minutes.</p>
          <div style="text-align: center; margin: 32px 0;">
            <span style="font-size: 36px; font-weight: bold;
                  letter-spacing: 8px; color: #4a63f5;
                  background: #f0f4ff; padding: 16px 32px;
                  border-radius: 12px;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
    console.log("Password reset OTP sent to:", email);
  } catch (error) {
    console.error("Password reset email failed:", error.message);
    throw error;
  }
};

export const sendNewDeviceAlert = async (email, name, ip, device, time) => {
  try {
    await sendMail({
      from:    MAIL_FROM,
      to:      email,
      subject: "New login detected â€” SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #dc2626;">New Login Detected</h2>
          <p style="color: #64748b;">Hi ${name}, your SUM Academy account 
             was accessed from a new device.</p>
          <table style="width: 100%; margin: 16px 0;">
            <tr>
              <td style="color: #64748b; padding: 8px 0;">IP Address</td>
              <td style="font-weight: bold; color: #1a1a2e;">${ip}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 8px 0;">Device</td>
              <td style="font-weight: bold; color: #1a1a2e;">${device}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 8px 0;">Time</td>
              <td style="font-weight: bold; color: #1a1a2e;">${time}</td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 13px;">
            If this was not you, please change your password immediately.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("New device alert email failed:", error.message);
    throw error;
  }
};

export const sendPaymentConfirmation = async (email, name, 
  courseName, amount) => {
  try {
    await sendMail({
      from:    MAIL_FROM,
      to:      email,
      subject: "Payment confirmed â€” SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #16a34a;">Payment Confirmed âœ“</h2>
          <p style="color: #64748b;">Hi ${name}, your payment 
             was successful.</p>
          <div style="background: white; padding: 16px; 
               border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #64748b;">Course</p>
            <p style="margin: 4px 0 0; font-weight: bold; 
               color: #1a1a2e;">${courseName}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Amount Paid</p>
            <p style="margin: 4px 0 0; font-weight: bold; 
               color: #16a34a;">PKR ${amount}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Payment confirmation email failed:", error.message);
    throw error;
  }
};

export const sendCertificateIssued = async (email, name, 
  courseName, certLink) => {
  try {
    await sendMail({
      from:    MAIL_FROM,
      to:      email,
      subject: "Your certificate is ready â€” SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #4a63f5;">ðŸŽ“ Certificate Ready!</h2>
          <p style="color: #64748b;">
            Congratulations ${name}! You have successfully completed
            <strong>${courseName}</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${certLink}" 
               style="background: #4a63f5; color: white; 
                      padding: 14px 32px; border-radius: 12px; 
                      text-decoration: none; font-weight: bold;">
              Download Certificate
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Certificate email failed:", error.message);
    throw error;
  }
};

export const sendBankTransferInitiated = async (
  email,
  name,
  payment,
  paymentDetails,
  methodLabel = "Payment"
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: `${methodLabel} Initiated - SUM Academy`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #1a1a2e;">Payment Initiated</h2>
          <p style="color: #64748b;">Hi ${name || "Student"}, your ${methodLabel} payment request has been created.</p>
          <div style="background: white; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #64748b;">Reference</p>
            <p style="margin: 4px 0 0; font-weight: bold; color: #1a1a2e;">${payment.reference || "-"}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Amount</p>
            <p style="margin: 4px 0 0; font-weight: bold; color: #1a1a2e;">PKR ${payment.amount || 0}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Method</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">${methodLabel}</p>
            ${paymentDetails?.bankName ? `<p style="margin: 8px 0 0; color: #64748b;">Bank: ${paymentDetails.bankName || "-"}</p>` : ""}
            ${paymentDetails?.merchantId ? `<p style="margin: 8px 0 0; color: #64748b;">Merchant ID: ${paymentDetails.merchantId || "-"}</p>` : ""}
            ${paymentDetails?.accountNumber ? `<p style="margin: 8px 0 0; color: #64748b;">Account Number: ${paymentDetails.accountNumber || "-"}</p>` : ""}
            ${paymentDetails?.accountTitle ? `<p style="margin: 4px 0 0; color: #64748b;">Account Title: ${paymentDetails.accountTitle || "-"}</p>` : ""}
            ${paymentDetails?.iban ? `<p style="margin: 4px 0 0; color: #64748b;">IBAN: ${paymentDetails.iban || "-"}</p>` : ""}
          </div>
          <p style="color: #64748b; font-size: 13px;">
            ${paymentDetails?.instructions || "Please transfer the amount and upload your receipt from your dashboard for verification."}
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            © 2026 SUM Academy - Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Payment initiation email failed:", error.message);
    throw error;
  }
};

export const sendPaymentRejected = async (
  email,
  name,
  courseName,
  amount,
  reference
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Payment Rejected - SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #dc2626;">Payment Rejected</h2>
          <p style="color: #64748b;">Hi ${name || "Student"}, your payment could not be verified.</p>
          <div style="background: white; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #64748b;">Course</p>
            <p style="margin: 4px 0 0; color: #1a1a2e; font-weight: bold;">${courseName || "-"}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Amount</p>
            <p style="margin: 4px 0 0; color: #1a1a2e; font-weight: bold;">PKR ${amount || 0}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Reference</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">${reference || "-"}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            Please re-upload a clear receipt or contact support for assistance.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy - Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Payment rejected email failed:", error.message);
    throw error;
  }
};

export const sendInstallmentReminder = async (
  email,
  name,
  courseName,
  amount,
  dueDate
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Installment Reminder - SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #1a1a2e;">Installment Due Soon</h2>
          <p style="color: #64748b;">Hi ${name || "Student"}, your installment is due soon.</p>
          <div style="background: white; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #64748b;">Course</p>
            <p style="margin: 4px 0 0; color: #1a1a2e; font-weight: bold;">${courseName || "-"}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Amount Due</p>
            <p style="margin: 4px 0 0; color: #1a1a2e; font-weight: bold;">PKR ${amount || 0}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Due Date</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">${dueDate || "-"}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            Please complete the payment before due date to avoid overdue status.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy - Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Installment reminder email failed:", error.message);
    throw error;
  }
};

export const sendInstallmentPaidEmail = async (
  email,
  name,
  installmentNumber,
  amount,
  courseName,
  remainingAmount,
  nextDueDate
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: `Installment ${installmentNumber} confirmed - SUM Academy`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #16a34a;">Installment Confirmed</h2>
          <p style="color: #64748b;">Hi ${name || "Student"}, we have received your installment payment.</p>
          <div style="background: white; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #64748b;">Course</p>
            <p style="margin: 4px 0 0; font-weight: bold; color: #1a1a2e;">${courseName || "-"}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Installment</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">${installmentNumber}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Amount Paid</p>
            <p style="margin: 4px 0 0; font-weight: bold; color: #16a34a;">PKR ${amount || 0}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Remaining</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">PKR ${remainingAmount || 0}</p>
            <p style="margin: 12px 0 0; color: #64748b;">Next Due Date</p>
            <p style="margin: 4px 0 0; color: #1a1a2e;">${nextDueDate || "-"}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Ã‚Â© 2026 SUM Academy - Karachi, Pakistan</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Installment paid email failed:", error.message);
    throw error;
  }
};

export const sendInstallmentReminderEmail = async (
  email,
  name,
  courseName,
  amount,
  dueDate
) =>
  sendInstallmentReminder(email, name, courseName, amount, dueDate);

export const sendInstallmentPlanCreatedEmail = async (
  email,
  name,
  courseName,
  installments = []
) => {
  try {
    const scheduleRows = (Array.isArray(installments) ? installments : [])
      .map(
        (item) =>
          `<tr>
            <td style="padding: 6px 0; color: #1a1a2e;">${item.number}</td>
            <td style="padding: 6px 0; color: #1a1a2e;">PKR ${item.amount || 0}</td>
            <td style="padding: 6px 0; color: #1a1a2e;">${item.dueDate || "-"}</td>
          </tr>`
      )
      .join("");

    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Your installment plan - SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #4a63f5;">Installment Plan Created</h2>
          <p style="color: #64748b;">Hi ${name || "Student"}, your installment plan is now active for <strong>${courseName || "Course"}</strong>.</p>
          <table style="width: 100%; background: white; border-radius: 12px; padding: 12px; margin-top: 12px;">
            <thead>
              <tr>
                <th align="left" style="padding: 6px 0; color: #64748b;">#</th>
                <th align="left" style="padding: 6px 0; color: #64748b;">Amount</th>
                <th align="left" style="padding: 6px 0; color: #64748b;">Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${scheduleRows || "<tr><td colspan='3' style='padding: 8px 0; color:#64748b;'>Schedule will appear soon.</td></tr>"}
            </tbody>
          </table>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Ã‚Â© 2026 SUM Academy - Karachi, Pakistan</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Installment plan created email failed:", error.message);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name, role) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Welcome to SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #1a1a2e;">Welcome to SUM Academy</h2>
          <p style="color: #64748b;">
            Hi ${name || "there"}, your ${role || "student"} account has been created.
          </p>
          <p style="color: #64748b;">
            You can now sign in and start using your dashboard.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Welcome email failed:", error.message);
    throw error;
  }
};

export const sendApprovalEmail = async (email, name) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Your SUM Academy account is approved!",
      html: `
        <div style="font-family:sans-serif;max-width:480px;
             margin:0 auto;padding:32px;background:#f8f9fe;
             border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="width:48px;height:48px;background:#4a63f5;
                 border-radius:12px;display:inline-flex;
                 align-items:center;justify-content:center;">
              <span style="color:white;font-size:22px;
                    font-weight:bold;">S</span>
            </div>
          </div>
          <h2 style="color:#16a34a;text-align:center;">
            Account Approved!
          </h2>
          <p style="color:#64748b;">
            Hi ${name}, your SUM Academy account has been
            approved by admin. You can now login and start
            learning!
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.CLIENT_URL}/login"
               style="background:#4a63f5;color:white;
                      padding:12px 28px;border-radius:10px;
                      text-decoration:none;font-weight:bold;">
              Login Now
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;
               text-align:center;">
            SUM Academy — sumacademy.net
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Approval email failed:", error.message);
    throw error;
  }
};

export const sendRejectionEmail = async (email, name, reason) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "SUM Academy registration update",
      html: `
        <div style="font-family:sans-serif;max-width:480px;
             margin:0 auto;padding:32px;background:#f8f9fe;
             border-radius:16px;">
          <h2 style="color:#dc2626;">Registration Not Approved</h2>
          <p style="color:#64748b;">Hi ${name},</p>
          <p style="color:#64748b;">
            Unfortunately your registration could not be
            approved at this time.
            ${reason ? "Reason: " + reason : ""}
          </p>
          <p style="color:#64748b;">
            Please contact admin for more information.
          </p>
          <p style="color:#94a3b8;font-size:12px;">
            SUM Academy — sumacademy.net
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Rejection email failed:", error.message);
    throw error;
  }
};

export const sendAnnouncementEmail = async (
  email,
  studentName,
  title,
  message,
  targetName
) => {
  try {
    const legacyMode = typeof targetName === "undefined";
    const resolvedStudentName = legacyMode
      ? "Student"
      : String(studentName || "Student");
    const resolvedTitle = legacyMode
      ? String(studentName || "New Announcement")
      : String(title || "New Announcement");
    const resolvedMessage = legacyMode
      ? String(title || "")
      : String(message || "");
    const resolvedTargetName = legacyMode
      ? "SUM Academy"
      : String(targetName || "SUM Academy");

    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: title || "New Announcement â€” SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #1a1a2e;">SUM Academy Announcement</h2>
          <p style="color: #64748b;">Hi ${resolvedStudentName},</p>
          <p style="color: #64748b;">
            New announcement from SUM Academy for
            <strong>${resolvedTargetName}</strong>.
          </p>
          <h3 style="color: #1a1a2e; margin-top: 16px;">${resolvedTitle}</h3>
          <p style="color: #64748b; white-space: pre-line;">${resolvedMessage}</p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Â© 2026 SUM Academy â€” Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Announcement email failed:", error.message);
    throw error;
  }
};

export const sendSessionScheduledEmail = async (
  email,
  studentName,
  session = {}
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "New live session scheduled â€” SUM Academy",
      html: `
        <div style="font-family: DM Sans, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #4a63f5; margin: 0 0 10px;">New Session Scheduled</h2>
          <p style="color: #334155;">Hi ${studentName || "Student"}, a new live session has been scheduled for your class.</p>
          <div style="background: white; border-radius: 12px; padding: 16px; margin-top: 14px;">
            <p style="margin: 0; color: #64748b;">Topic</p>
            <p style="margin: 4px 0 10px; font-weight: 700; color: #0f172a;">${session.topic || "-"}</p>
            <p style="margin: 0; color: #64748b;">Date</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${session.date || "-"}</p>
            <p style="margin: 0; color: #64748b;">Time</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${session.startTime || "-"} - ${session.endTime || "-"}</p>
            <p style="margin: 0; color: #64748b;">Platform</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${session.platform || "-"}</p>
            <p style="margin: 0; color: #64748b;">Meeting Link</p>
            <p style="margin: 4px 0 0;"><a href="${session.meetingLink || "#"}" style="color: #4a63f5; text-decoration: none;">${session.meetingLink || "-"}</a></p>
          </div>
          <p style="margin-top: 14px; font-size: 12px; color: #64748b;">Please join on time and stay prepared.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Session scheduled email failed:", error.message);
    throw error;
  }
};

export const sendSessionCancelledEmail = async (
  email,
  studentName,
  session = {}
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: email,
      subject: "Session cancelled â€” SUM Academy",
      html: `
        <div style="font-family: DM Sans, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #fff7f7; border-radius: 16px;">
          <h2 style="color: #dc2626; margin: 0 0 10px;">Session Cancelled</h2>
          <p style="color: #334155;">Hi ${studentName || "Student"}, the following session has been cancelled:</p>
          <div style="background: white; border-radius: 12px; padding: 16px; margin-top: 14px;">
            <p style="margin: 0; color: #64748b;">Topic</p>
            <p style="margin: 4px 0 10px; font-weight: 700; color: #0f172a;">${session.topic || "-"}</p>
            <p style="margin: 0; color: #64748b;">Original Date</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${session.date || "-"}</p>
            <p style="margin: 0; color: #64748b;">Original Time</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${session.startTime || "-"} - ${session.endTime || "-"}</p>
            <p style="margin: 0; color: #64748b;">Reason</p>
            <p style="margin: 4px 0 0; color: #0f172a;">${session.cancelReason || "No reason provided."}</p>
          </div>
          <p style="margin-top: 14px; font-size: 12px; color: #64748b;">We apologize for the inconvenience. A new schedule will be shared soon.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Session cancellation email failed:", error.message);
    throw error;
  }
};


export const sendStudentHelpSupportEmail = async (
  adminEmail,
  payload = {}
) => {
  try {
    await sendMail({
      from: MAIL_FROM,
      to: adminEmail,
      replyTo: payload.studentEmail || undefined,
      subject: `Student Help Request - ${payload.subject || "No Subject"}`,
      html: `
        <div style="font-family: DM Sans, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #f8f9fe; border-radius: 16px;">
          <h2 style="color: #4a63f5; margin: 0 0 10px;">New Student Help Request</h2>
          <p style="color: #334155; margin: 0 0 14px;">A student submitted a support request from the student portal.</p>
          <div style="background: #ffffff; border-radius: 12px; padding: 16px;">
            <p style="margin: 0; color: #64748b;">Student Name</p>
            <p style="margin: 4px 0 10px; color: #0f172a; font-weight: 700;">${payload.studentName || "Student"}</p>
            <p style="margin: 0; color: #64748b;">Student Email</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${payload.studentEmail || "-"}</p>
            <p style="margin: 0; color: #64748b;">Category</p>
            <p style="margin: 4px 0 10px; color: #0f172a;">${payload.category || "General"}</p>
            <p style="margin: 0; color: #64748b;">Subject</p>
            <p style="margin: 4px 0 10px; color: #0f172a; font-weight: 700;">${payload.subject || "-"}</p>
            <p style="margin: 0; color: #64748b;">Message</p>
            <p style="margin: 4px 0 0; color: #0f172a; white-space: pre-line;">${payload.message || "-"}</p>
          </div>
          <p style="margin-top: 14px; color: #64748b; font-size: 12px;">SUM Academy Student Help and Support</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Student help support email failed:", error.message);
    throw error;
  }
};


