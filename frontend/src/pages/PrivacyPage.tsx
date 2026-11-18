import type { ReactNode } from "react";
import { Logo } from "../components/Logo";

const REPO = "https://github.com/yuliadovhai/mindleaf";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Public, no sign-in needed: Google's consent screen links here. */
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-8 rounded-2xl border border-border bg-card p-6 shadow-[0_4px_20px_rgba(109,93,246,0.06)] sm:p-10">
        <header className="space-y-4">
          <a href="/" aria-label="MindLeaf — на головну">
            <Logo />
          </a>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Політика конфіденційності</h1>
            <p className="text-sm text-muted-foreground">Оновлено 18 листопада 2026 року</p>
          </div>
          <p className="text-sm leading-relaxed">
            MindLeaf — навчальний прототип кабінету для приватного репетитора, його учнів і батьків,
            створений студентською командою в межах університетського курсу. Тут коротко пояснено,
            які дані ми зберігаємо і навіщо.
          </p>
        </header>

        <Section title="Які дані ми зберігаємо">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Акаунт:</b> адреса пошти та ім'я. Якщо ви входите через Google, ми отримуємо від
              Google лише пошту та ім'я — без доступу до листів, контактів чи інших даних.
            </li>
            <li>
              <b>Те, що вносить репетитор:</b> картки учнів (ім'я, предмет, контакти, нотатки),
              розклад занять, посилання на онлайн-заняття, записи про оплати, домашні завдання,
              тести та матеріали.
            </li>
            <li>
              <b>Те, що вносять учні:</b> відповіді на домашні завдання (текст і фото) та тести.
            </li>
            <li>
              <b>Telegram,</b> якщо ви підключили нагадування: ідентифікатор чату, щоб бот міг вам
              писати.
            </li>
          </ul>
        </Section>

        <Section title="Навіщо">
          <p>
            Лише щоб сервіс працював: показувати розклад, баланс, завдання й результати тим, кому
            репетитор відкрив доступ, і надсилати нагадування про заняття та дедлайни. Ми не
            продаємо дані, не показуємо рекламу і не передаємо дані третім особам для їхніх цілей.
          </p>
        </Section>

        <Section title="Хто бачить ваші дані">
          <p>
            Репетитор бачить дані своїх учнів. Учень і батьки бачать лише картку, до якої репетитор
            видав їм код доступу. Інші користувачі ваших даних не бачать.
          </p>
        </Section>

        <Section title="Де зберігаються">
          <p>
            Вхід і паролі — в Amazon Cognito (AWS, Франкфурт). База даних і сервер — на Render
            (Франкфурт). Нагадування надсилаються через Telegram Bot API. Ці сервіси обробляють дані
            лише для роботи MindLeaf.
          </p>
        </Section>

        <Section title="Як видалити дані">
          <p>
            Вимкнути нагадування можна в профілі («Нагадування») або командою /stop у боті. Щоб
            видалити акаунт і всі пов'язані дані, напишіть нам через{" "}
            <a href={`${REPO}/issues`} className="text-primary hover:underline">
              GitHub-сторінку проєкту
            </a>{" "}
            — ми видалимо їх протягом 7 днів.
          </p>
        </Section>

        <Section title="Прототип">
          <p>
            MindLeaf — навчальний проєкт, а не комерційний сервіс. Не вносьте сюди чутливі дані, які
            не потрібні для занять.
          </p>
        </Section>

        <footer className="border-t border-border pt-4 text-sm">
          <a href="/" className="font-medium text-primary hover:underline">
            ← До MindLeaf
          </a>
        </footer>
      </article>
    </div>
  );
}
