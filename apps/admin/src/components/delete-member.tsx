import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberDto } from "@omam/contracts";
import { Button, Modal } from "./ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { displayName } from "../lib/format";

export function useCanDeleteMember() {
  const { can, user } = useSession();
  return (member: Pick<MemberDto, "userId" | "role">) =>
    member.userId !== user?.id && (can("OWNER") || member.role === "MEMBER");
}

export function DeleteMemberModal({ member, onClose, onDeleted }: { member: MemberDto; onClose: () => void; onDeleted?: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const deleteMember = useMutation({
    mutationFn: (membershipId: string) => api.deleteMember(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
      queryClient.removeQueries({ queryKey: ["member-report", member.userId] });
      onClose();
      onDeleted?.();
    },
  });

  return (
    <Modal
      title={t("admin.members.deleteTitle", { name: displayName(member) })}
      onClose={() => !deleteMember.isPending && onClose()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleteMember.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            loading={deleteMember.isPending}
            onClick={() => deleteMember.mutate(member.membershipId)}
          >
            {t("admin.members.deleteAction")}
          </Button>
        </>
      }
    >
      <p className="t-body-sm muted">{t("admin.members.deleteIntro", { name: displayName(member) })}</p>
    </Modal>
  );
}
