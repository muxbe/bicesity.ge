export type AppSettingsDTO = {
  shopName: string;
  currency: string;
  messengerUrl: string;
  publicContactInfo: string;
  updatedAt: string | null;
};

export const DEFAULT_APP_SETTINGS: AppSettingsDTO = {
  shopName: "VeloHub",
  currency: "GEL",
  messengerUrl: "",
  publicContactInfo: "",
  updatedAt: null,
};
