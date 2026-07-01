import { authDictionary } from "@/lib/i18n/dictionaries/auth";
import { commonDictionary } from "@/lib/i18n/dictionaries/common";
import { fieldsDictionary } from "@/lib/i18n/dictionaries/fields";
import { inventoryDictionary } from "@/lib/i18n/dictionaries/inventory";
import { mergeDictionarySections } from "@/lib/i18n/dictionaries/merge";
import { navigationDictionary } from "@/lib/i18n/dictionaries/navigation";
import { publicShopDictionary } from "@/lib/i18n/dictionaries/public-shop";
import { reportsDictionary } from "@/lib/i18n/dictionaries/reports";
import { reservationsDictionary } from "@/lib/i18n/dictionaries/reservations";
import { salesDictionary } from "@/lib/i18n/dictionaries/sales";
import { settingsDictionary } from "@/lib/i18n/dictionaries/settings";
import { staffDictionary } from "@/lib/i18n/dictionaries/staff";

export const dictionaries = mergeDictionarySections([
  commonDictionary,
  navigationDictionary,
  publicShopDictionary,
  authDictionary,
  inventoryDictionary,
  fieldsDictionary,
  reservationsDictionary,
  reportsDictionary,
  settingsDictionary,
  staffDictionary,
  salesDictionary,
]);
