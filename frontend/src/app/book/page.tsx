import { StorefrontShell } from '@/components/layout/storefront-shell';
import { BookingForm } from '@/components/booking/booking-form';

export default function BookPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">
            Reserve your evening
          </h1>
          <p className="mt-3 max-w-2xl text-bone-dim">
            Book a table for dinner and we will confirm by phone or email. For groups over twelve,
            give us a call.
          </p>
        </div>

        <div className="mt-9">
          <BookingForm />
        </div>
      </section>
    </StorefrontShell>
  );
}