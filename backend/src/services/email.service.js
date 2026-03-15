import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendRegistrationOTP = async (email, name, otp) => {
  try {
    console.log("Sending OTP email to:", email);
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
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
            © 2026 SUM Academy — Karachi, Pakistan
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
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
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
            © 2026 SUM Academy — Karachi, Pakistan
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
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      email,
      subject: "New login detected — SUM Academy",
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
            © 2026 SUM Academy — Karachi, Pakistan
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
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      email,
      subject: "Payment confirmed — SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #16a34a;">Payment Confirmed ✓</h2>
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
            © 2026 SUM Academy — Karachi, Pakistan
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
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      email,
      subject: "Your certificate is ready — SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #4a63f5;">🎓 Certificate Ready!</h2>
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
            © 2026 SUM Academy — Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Certificate email failed:", error.message);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name, role) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
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
            © 2026 SUM Academy — Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Welcome email failed:", error.message);
    throw error;
  }
};

export const sendAnnouncementEmail = async (email, title, message) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: title || "New Announcement — SUM Academy",
      html: `
        <div style="font-family: sans-serif; max-width: 480px;
             margin: 0 auto; padding: 32px; background: #f8f9fe;
             border-radius: 16px;">
          <h2 style="color: #1a1a2e;">${title || "New Announcement"}</h2>
          <p style="color: #64748b; white-space: pre-line;">${message || ""}</p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            © 2026 SUM Academy — Karachi, Pakistan
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Announcement email failed:", error.message);
    throw error;
  }
};
