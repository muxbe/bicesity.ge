"use client";

import Image from "next/image";
import { Bike, MapPin, MessageCircle, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type RentViewProps = {
  onBrowseBicycles: () => void;
  onMessageSeller: () => void;
  messengerError: string | null;
  messengerMessage: string | null;
};

export function RentView(props: RentViewProps) {
  const {
    onBrowseBicycles,
    onMessageSeller,
    messengerError,
    messengerMessage,
  } = props;
  const { t } = useI18n();

  return (
    <section id="rent" className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 items-center gap-8 lg:min-h-[calc(100vh-190px)] lg:grid-cols-[1.05fr,0.95fr] lg:gap-10">
        <div>
          <p className="mb-4 text-sm font-black uppercase tracking-widest text-[var(--brand-cyan-dark)]">
            {t('rent.eyebrow')}
          </p>
          <h1 className="mb-5 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:mb-6 sm:text-5xl lg:text-6xl">
            {t('rent.title')}
          </h1>
          <p className="mb-6 max-w-2xl text-base leading-7 text-slate-600 sm:mb-8 sm:text-lg sm:leading-8">
            {t('rent.copy')}
          </p>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onMessageSeller}
              className="brand-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition sm:w-auto"
            >
              <MessageCircle className="h-5 w-5" />
              {t('rent.messageSeller')}
            </button>
            <button
              type="button"
              onClick={onBrowseBicycles}
              className="brand-control inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-5 text-sm font-bold text-slate-800 transition hover:bg-cyan-50 sm:w-auto"
            >
              <Bike className="h-5 w-5" />
              {t('rent.browseBicycles')}
            </button>
          </div>

          {messengerMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {messengerMessage}
            </div>
          )}
          {messengerError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {messengerError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-cyan-100 bg-white p-5">
              <MapPin className="mb-4 h-6 w-6 text-[var(--brand-cyan-dark)]" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.localPickup')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.localPickupCopy')}
              </p>
            </div>
            <div className="rounded-lg border border-cyan-100 bg-white p-5">
              <Route className="mb-4 h-6 w-6 text-[var(--brand-blue-strong)]" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.travelRoutes')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.travelRoutesCopy')}
              </p>
            </div>
            <div className="rounded-lg border border-cyan-100 bg-white p-5">
              <MessageCircle className="mb-4 h-6 w-6 text-amber-600" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.directContact')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.directContactCopy')}
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:min-h-[420px] sm:rounded-2xl">
          <Image
            src="/product-bicycle.svg"
            alt={t('home.productImageAlt')}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-contain p-6 sm:p-10"
          />
        </div>
      </div>
    </section>
  );
}
