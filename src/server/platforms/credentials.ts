import type { PlatformId } from "./types";

export interface CredentialField {
  /** Key used in the credentials map sent to the adapter. */
  name: string;
  /** Label as it appears on the platform's developer portal. */
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
}

export interface PlatformCredentialSchema {
  /** Where the user gets these credentials. */
  helpUrl: string;
  helpText: string;
  fields: CredentialField[];
}

export const PLATFORM_CREDENTIALS: Record<PlatformId, PlatformCredentialSchema> = {
  UberEats: {
    helpUrl: "https://developer.uber.com/docs/eats",
    helpText: "Create an Eats app at developer.uber.com and copy these from the app dashboard.",
    fields: [
      { name: "client_id", label: "Client ID", type: "text", required: true },
      { name: "client_secret", label: "Client Secret", type: "password", required: true },
      { name: "store_uuid", label: "Store UUID", type: "text", required: true },
    ],
  },
  DoorDash: {
    helpUrl: "https://developer.doordash.com/portal",
    helpText: "Find these under your DoorDash Developer Portal app credentials.",
    fields: [
      { name: "developer_id", label: "Developer ID", type: "text", required: true },
      { name: "key_id", label: "Key ID", type: "text", required: true },
      { name: "signing_secret", label: "Signing Secret", type: "password", required: true },
      { name: "store_id", label: "Store ID", type: "text", required: true },
    ],
  },
  Grubhub: {
    helpUrl: "https://restaurants.grubhub.com/",
    helpText: "Request API access from Grubhub for Restaurants, then paste credentials below.",
    fields: [
      { name: "client_id", label: "Client ID", type: "text", required: true },
      { name: "client_secret", label: "Client Secret", type: "password", required: true },
      { name: "restaurant_id", label: "Restaurant ID", type: "text", required: true },
    ],
  },
  Zomato: {
    helpUrl: "https://www.zomato.com/partners",
    helpText: "Use the API key from your Zomato Partner dashboard.",
    fields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "restaurant_id", label: "Restaurant ID", type: "text", required: true },
    ],
  },
  Swiggy: {
    helpUrl: "https://partner.swiggy.com/",
    helpText: "Available under Integrations in your Swiggy Partner portal.",
    fields: [
      { name: "partner_api_key", label: "Partner API Key", type: "password", required: true },
      { name: "restaurant_id", label: "Restaurant ID", type: "text", required: true },
    ],
  },
};

export function getCredentialSchema(platform: PlatformId): PlatformCredentialSchema {
  return PLATFORM_CREDENTIALS[platform];
}