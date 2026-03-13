import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { wsClient } from "@/lib/ws";

interface PermissionDialogProps {
  requestId: string;
  description: string;
  onDismiss: () => void;
}

export function PermissionDialog({
  requestId,
  description,
  onDismiss,
}: PermissionDialogProps) {
  function respond(approved: boolean) {
    wsClient.sendPermissionResponse(requestId, approved);
    onDismiss();
  }

  return (
    <AlertDialog open onOpenChange={() => respond(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permission Required</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => respond(false)}>
            Deny
          </Button>
          <Button
            className="bg-green-700 hover:bg-green-600 text-white"
            onClick={() => respond(true)}
          >
            Allow
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
