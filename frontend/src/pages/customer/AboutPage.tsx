import { Armchair, Leaf, Truck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

const values = [
  { icon: Armchair, title: 'Made for small spaces', text: 'Space-saving pieces that fit condos, apartments and family rooms.' },
  { icon: Leaf, title: 'Durable materials', text: 'Solid wood finishes and fabrics picked to last through everyday life.' },
  { icon: Truck, title: 'Delivered around Manila', text: 'Pay with GCash or cash on delivery, right at your door.' },
];

export default function AboutPage() {
  return (
    <>
      <section className="checker-mint py-16 sm:py-24">
        <div className="container-page max-w-3xl text-center">
          <h1 className="text-4xl font-semibold text-forest sm:text-6xl">about comfy&amp;co</h1>
          <p className="mt-5 text-lg text-ink">Making every corner feel like home.</p>
        </div>
      </section>

      <section className="container-page grid max-w-5xl items-center gap-10 py-14 md:grid-cols-2">
        <img src="/images/living-room.svg" alt="" className="rounded-3xl" />
        <div className="space-y-4 leading-relaxed text-ink">
          <h2 className="text-3xl font-semibold text-forest">Our Philosophy</h2>
          <p>
            At Comfy&amp;Co., we believe home furnishings should feel soft and easy to live with. We select durable wood finishes and
            practical space-saving pieces built to fit apartments and family rooms alike.
          </p>
          <p>
            We started in Manila with a simple idea: good furniture shouldn't be hard to find or hard to afford. From sofas and bed
            frames to the small side table next to your reading chair, every piece is chosen to make your space warmer.
          </p>
        </div>
      </section>

      <section className="bg-butter-light py-14">
        <div className="container-page grid max-w-5xl gap-6 sm:grid-cols-3">
          {values.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-card bg-white p-6 text-center shadow-card">
              <Icon className="mx-auto size-8 text-forest" />
              <h3 className="mt-3 text-xl font-semibold text-forest">{title}</h3>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-14 text-center">
        <h2 className="text-3xl font-semibold text-forest">Find your next favorite piece</h2>
        <ButtonLink to="/products" size="lg" className="mt-6">
          Shop all products
        </ButtonLink>
      </section>
    </>
  );
}
