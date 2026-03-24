export const PAYMENT_CONFIG = {
  jazzcash: {
    enabled: false,
    merchantId: process.env.JAZZCASH_MERCHANT_ID || "",
    password: process.env.JAZZCASH_PASSWORD || "",
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || "",
    sandboxUrl:
      "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Generate/GenerateTransactionID",
    productionUrl:
      "https://payments.jazzcash.com.pk/ApplicationAPI/API/2.0/Generate/GenerateTransactionID",
    returnUrl: `${process.env.CLIENT_URL || ""}/payment/callback/jazzcash`,
  },
  easypaisa: {
    enabled: false,
    accountNumber: process.env.EASYPAISA_ACCOUNT || "",
    username: process.env.EASYPAISA_USERNAME || "",
    password: process.env.EASYPAISA_PASSWORD || "",
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

