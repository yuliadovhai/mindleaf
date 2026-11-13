import { Badge } from "./ui/badge";
import type { AssignmentStatus } from "../api/types";
import { ASSIGNMENT_STATUS_LABEL } from "../lib/labels";

const VARIANT = {
  assigned: "default",
  submitted: "secondary",
  needs_review: "warning",
  graded: "success",
} as const;

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge variant={VARIANT[status]}>{ASSIGNMENT_STATUS_LABEL[status]}</Badge>;
}
