import { useSession } from "../auth/session";
import { createQuiz } from "../api/quizzes";
import type { Quiz } from "../api/types";
import { QuizEditor } from "./QuizEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function QuizBuilderDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (quiz: Quiz) => void;
}) {
  const { token } = useSession();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новий тест</DialogTitle>
        </DialogHeader>
        {open && (
          <QuizEditor
            submitLabel="Створити тест"
            onCancel={onClose}
            onSubmit={async (data) => {
              onSaved(await createQuiz(token, data));
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
