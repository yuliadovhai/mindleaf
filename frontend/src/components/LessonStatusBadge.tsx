import { Badge } from "./ui/badge";
import type { LessonStatus } from "../api/types";

const STATUS_LABEL: Record<LessonStatus, string> = {
  planned: "Заплановано",
  done: "Проведено",
  cancelled: "Скасовано",
  missed: "Пропуск",
};

type BadgeVariant =
  | "default"
  | "success"
  | "destructive"
  | "warning"
  | "secondary"
  | "outline"
  | "muted";

const STATUS_VARIANT: Record<LessonStatus, BadgeVariant> = {
  planned: "default",
  done: "success",
  cancelled: "muted",
  missed: "warning",
};

interface LessonStatusBadgeProps {
  status: LessonStatus;
}

export function LessonStatusBadge({ status }: LessonStatusBadgeProps) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export { STATUS_LABEL };
