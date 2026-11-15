import type { ReactNode } from "react";
import { useRouter } from "../lib/router";
import { PageHeader } from "./common/PageHeader";
import { ClipboardCheck, FolderOpen, ListChecks, type LucideIcon } from "lucide-react";

type Section = "homework" | "quizzes" | "materials";

const SECTIONS: {
  id: Section;
  label: string;
  short: string;
  path: string;
  icon: LucideIcon;
  help: string;
}[] = [
  {
    id: "homework",
    label: "Домашні завдання",
    short: "ДЗ",
    path: "/homework",
    icon: ClipboardCheck,
    help: "Перевіряйте здані ДЗ і задавайте нові.",
  },
  {
    id: "quizzes",
    label: "Тести",
    short: "Тести",
    path: "/quizzes",
    icon: ListChecks,
    help: "Створюйте тести, призначайте учням і перевіряйте письмові відповіді.",
  },
  {
    id: "materials",
    label: "Матеріали",
    short: "Матеріали",
    path: "/materials",
    icon: FolderOpen,
    help: "Файли й тексти для учнів. З матеріалу ШІ може зробити чернетку тесту.",
  },
];

/** "Навчання": one menu item, three sections as page tabs. */
export function LearningHeader({ section, actions }: { section: Section; actions?: ReactNode }) {
  const { navigate } = useRouter();
  const current = SECTIONS.find((s) => s.id === section)!;
  return (
    <div className="space-y-4">
      <PageHeader title="Навчання" subtitle={current.help} actions={actions} />
      <nav
        aria-label="Розділи навчання"
        className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-1">
          {SECTIONS.map(({ id, label, short, path, icon: Icon }) => {
            const active = id === section;
            return (
              <li key={id}>
                <button
                  onClick={() => navigate(path)}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
