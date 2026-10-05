import { StorefrontShell } from '@/components/layout/storefront-shell';
import { BookingForm } from '@/components/booking/booking-form';

/** Public booking page (US7.1). */
export default function BookPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl tracking-tight text-bone">
            Reserve your evening
          </h1>
          <p className="mt-3 max-w-2xl text-bone-dim">
            Pick a day and party size to see open times for lunch or dinner. We&apos;ll confirm your
            booking by email. For groups over twelve, give us a call.
          </p>
        </div>

        <div className="mt-8 sm:mt-9">
          <BookingForm />
        </div>
      </section>
    </StorefrontShell>
  );
}