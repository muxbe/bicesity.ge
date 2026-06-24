"use client";

import { useCallback, useState } from "react";
import {
  buildMessengerUrl,
  buildRentMessage,
} from "@/features/shop/home/home-helpers";
import type {
  RentMessengerResult,
  Translate,
} from "@/features/shop/home/home-types";

export function useRentMessenger(
  messengerUrl: string,
  t: Translate
): RentMessengerResult {
  const [messengerError, setMessengerError] = useState<string | null>(null);
  const [messengerMessage, setMessengerMessage] = useState<string | null>(null);

  const clearRentMessengerNotices = useCallback(() => {
    setMessengerError(null);
    setMessengerMessage(null);
  }, []);

  const openMessengerForRent = useCallback(async () => {
    clearRentMessengerNotices();

    const rentUrl =
      typeof window === "undefined"
        ? "/#rent"
        : `${window.location.origin}/#rent`;
    const message = buildRentMessage(rentUrl, t);
    const targetMessengerUrl = buildMessengerUrl(messengerUrl, message);

    if (!targetMessengerUrl) {
      setMessengerError(t("rent.messageLinkMissing"));
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      const opened = window.open(
        targetMessengerUrl,
        "_blank",
        "noopener,noreferrer"
      );
      setMessengerMessage(
        opened ? t("rent.messageOpened") : t("rent.messageCopied")
      );
    } catch (caughtError) {
      setMessengerError(
        caughtError instanceof Error
          ? caughtError.message
          : t("rent.messageError")
      );
    }
  }, [clearRentMessengerNotices, messengerUrl, t]);

  return {
    messengerError,
    messengerMessage,
    openMessengerForRent,
    clearRentMessengerNotices,
  };
}