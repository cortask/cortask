export interface TrustedContact {
  phone: string;
  name?: string;
  permission: "read" | "write" | "admin";
}

export interface WhatsAppConfig {
  authDir?: string;
  allowedUsers?: string[];
  trustedContacts?: TrustedContact[];
}

export interface QRCodeResult {
  qrDataUrl?: string;
  success: boolean;
  message: string;
}
