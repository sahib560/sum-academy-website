export const PAYMENT_CONFIG = {
  jazzcash: {
    enabled: true,
    merchantId: process.env.JAZZCASH_MERCHANT_ID || "",
    accountTitle: process.env.JAZZCASH_ACCOUNT_TITLE || "SUM Academy",
    password: process.env.JAZZCASH_PASSWORD || "",
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || "",
    instructions:
      process.env.JAZZCASH_INSTRUCTIONS ||
      "Send payment to JazzCash merchant and upload the transaction receipt.",
    sandboxUrl:
      "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Generate/GenerateTransactionID",
    productionUrl:
      "https://payments.jazzcash.com.pk/ApplicationAPI/API/2.0/Generate/GenerateTransactionID",
    returnUrl: `${process.env.CLIENT_URL || ""}/payment/callback/jazzcash`,
  },
  easypaisa: {
    enabled: true,
    accountNumber: process.env.EASYPAISA_ACCOUNT || "",
    accountTitle: process.env.EASYPAISA_ACCOUNT_TITLE || "SUM Academy",
    username: process.env.EASYPAISA_USERNAME || "",
    password: process.env.EASYPAISA_PASSWORD || "",
    instructions:
      process.env.EASYPAISA_INSTRUCTIONS ||
      "Send payment to EasyPaisa account and upload the transaction receipt.",
    sandboxUrl: "https://easypaisa.com.pk/easypaisaPayment/v2/Login",
    productionUrl: "https://easypaisa.com.pk/easypaisaPayment/v2/Login",
    returnUrl: `${process.env.CLIENT_URL || ""}/payment/callback/easypaisa`,
  },
  bankTransfer: {
    enabled: true,
    bankName: process.env.BANK_NAME || "Meezan Bank",
    accountTitle: process.env.BANK_ACCOUNT_TITLE || "SUM Academy",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    iban: process.env.BANK_IBAN || "",
  },
};

