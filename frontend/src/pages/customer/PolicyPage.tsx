// Sample text for the school project, replace with the group's final wording.
const pages = {
  terms: {
    title: 'Terms & Conditions',
    sections: [
      ['Orders', 'An order is confirmed once you receive an order number. We may cancel an order if an item runs out of stock, and we will let you know if that happens.'],
      ['Prices', 'All prices are in Philippine Peso (₱). Sale prices are valid only within the dates shown on the product page.'],
      ['Payment', 'We accept GCash and Cash on Delivery. For COD, please prepare the exact amount when your order arrives.'],
      ['Delivery', 'Delivery times depend on your location. Someone must be present to receive and check the items.'],
      ['Returns', 'Items that arrive damaged can be reported within 7 days of delivery for a replacement.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we collect', 'Your name, email, mobile number, birthdate and delivery address, plus your orders, cart, likes and reviews.'],
      ['Why we collect it', 'To process and deliver your orders, keep your cart and likes saved, and show your reviews to other shoppers.'],
      ['Sharing', 'We only share your name, address and mobile number with the courier delivering your order.'],
      ['Your choices', 'You can update your details anytime at checkout. Contact us if you want your account removed.'],
    ],
  },
};

export default function PolicyPage({ page }: { page: keyof typeof pages }) {
  const { title, sections } = pages[page];
  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="text-4xl font-semibold text-forest">{title}</h1>
      <div className="mt-8 space-y-6">
        {sections.map(([heading, text]) => (
          <section key={heading}>
            <h2 className="font-sans text-lg font-semibold text-ink">{heading}</h2>
            <p className="mt-1 leading-relaxed text-muted">{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
