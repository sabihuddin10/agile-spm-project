'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/modal';

type Reply = { question: string; answer: string; href?: string; linkLabel?: string };

const FAQS: Array<Reply & { keys: string[] }> = [
  {
    question: 'How do I book a table?',
    keys: ['book', 'booking', 'reserve', 'reservation', 'table'],
    answer: 'Use the booking page to choose a date, party size and an available time.',
    href: '/book',
    linkLabel: 'Book a table',
  },
  {
    question: 'Can I order online?',
    keys: ['order', 'online', 'pickup', 'pick up', 'delivery', 'dine in', 'menu'],
    answer: 'Browse the menu to place an order for pickup, delivery or dine-in.',
    href: '/menu',
    linkLabel: 'View the menu',
  },
  {
    question: 'Where can I check allergens and dietary notes?',
    keys: ['allerg', 'diet', 'vegan', 'vegetarian', 'gluten', 'ingredient'],
    answer: 'Each dish on the menu lists its recorded allergens and dietary notes. If you have a serious allergy or need cross-contact information, please confirm with restaurant staff before ordering.',
    href: '/menu',
    linkLabel: 'Check the menu',
  },
  {
    question: 'Where is the restaurant?',
    keys: ['where', 'address', 'location', 'located'],
    answer: 'You can find us at 12 Ember Lane, Old Town.',
  },
  {
    question: 'What are the opening hours?',
    keys: ['hour', 'hours', 'open', 'close', 'opening', 'closing'],
    answer: 'We are open all week from 12:00 to 22:00.',
  },
];

function getReply(question: string): Reply {
  const normalized = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = FAQS.find((faq) => faq.keys.some((key) => normalized.includes(key)));
  return match ?? {
    question,
    answer: 'I don’t have that answer yet. You can browse the menu or start a table booking from these pages.',
    href: '/menu',
    linkLabel: 'Visit the menu',
  };
}

export function FaqAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replies, setReplies] = useState<Reply[]>([]);

  function ask(question: string) {
    const cleaned = question.trim();
    if (!cleaned) return;
    setReplies((current) => [...current, getReply(cleaned)]);
    setQuery('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(query);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Sits above the floating cart bar (bottom-16 on phones, bottom-6 at the right on desktop,
        // see components/menu/cart-drawer.tsx) so the two never overlap: the browser tests caught the
        // assistant covering "View your order".
        className="fixed bottom-32 right-4 z-[60] inline-flex h-12 items-center gap-2 rounded-full border border-char-hairline bg-ember px-5 text-sm font-semibold text-bone shadow-lg transition hover:bg-ember-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-soft lg:bottom-28 lg:right-6"
      >
        <span aria-hidden="true">?</span> Ask a question
      </button>

      {open ? (
        <Modal title="Frequently asked questions" onClose={() => setOpen(false)} dark>
          <p className="text-sm leading-relaxed text-bone-dim">
            Ask about bookings, ordering, allergens, location or opening hours. Answers come from the restaurant’s published information.
          </p>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
            {['How do I book a table?', 'Can I order online?', 'Where can I check allergens?'].map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => ask(question)}
                className="rounded-full border border-char-hairline px-3 py-2 text-left text-xs text-bone-dim transition hover:border-ember hover:text-bone"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-char-hairline bg-char p-3" aria-live="polite" aria-label="FAQ answers">
            {replies.length === 0 ? (
              <p className="text-sm text-bone-dim">Choose a suggested question or type your own below.</p>
            ) : replies.map((reply, index) => (
              <article key={`${reply.question}-${index}`} className="rounded-md bg-char-raised p-3">
                <p className="text-xs font-semibold text-ember">{reply.question}</p>
                <p className="mt-1 text-sm leading-relaxed text-bone">{reply.answer}</p>
                {reply.href && reply.linkLabel ? (
                  <Link href={reply.href} onClick={() => setOpen(false)} className="mt-2 inline-flex text-sm font-semibold text-ember underline-offset-4 hover:underline">
                    {reply.linkLabel}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 flex gap-2">
            <label className="sr-only" htmlFor="faq-question">Your question</label>
            <input
              id="faq-question"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a question…"
              maxLength={240}
              className="min-w-0 flex-1 rounded-lg border border-char-hairline bg-char px-3 py-2.5 text-sm text-bone placeholder:text-bone-faint focus:border-ember focus:outline-none"
            />
            <button type="submit" disabled={!query.trim()} className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-bone transition hover:bg-ember-soft disabled:cursor-not-allowed disabled:opacity-50">
              Ask
            </button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
