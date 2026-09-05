import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { PageHeader } from "./layout";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
} from "../components/ui";

const DEFAULT_COLOR = "#B4213C";

export function ProjectsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  const projects = useQuery({
    queryKey: ["projects", "all"],
    queryFn: () => api.projects(true),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const create = useMutation({
    mutationFn: () => api.createProject({ name: name.trim(), color }),
    onSuccess: () => {
      toast(t("admin.projects.created"), "success");
      setCreating(false);
      setName("");
      setColor(DEFAULT_COLOR);
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const archive = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      api.updateProject(input.id, { archived: input.archived }),
    onSuccess: () => {
      toast(t("admin.projects.updated"), "success");
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  return (
    <>
      <PageHeader
        title={t("admin.nav.projects")}
        subtitle={t("admin.projects.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t("admin.projects.newProject")}
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={t("admin.projects.count", { count: projects.data?.projects.length ?? 0 })} />

          {projects.isPending ? <Loading /> : null}
          {projects.isError ? (
            <ErrorState message={translateError(projects.error, t)} onRetry={() => projects.refetch()} />
          ) : null}

          {projects.data?.projects.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("admin.projects.project")}</th>
                    <th>{t("admin.projects.status")}</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {projects.data.projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <span className="row gap-5">
                          <span className="dot" style={{ color: project.color }} aria-hidden />
                          {project.name}
                        </span>
                      </td>
                      <td>
                        {project.archived ? (
                          <Badge>{t("admin.projects.archived")}</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            {t("admin.projects.active")}
                          </Badge>
                        )}
                      </td>
                      <td className="tight">
                        <Button
                          size="sm"
                          onClick={() =>
                            archive.mutate({ id: project.id, archived: !project.archived })
                          }
                        >
                          {project.archived ? t("admin.projects.restore") : t("admin.projects.archive")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : projects.data ? (
            <EmptyState
              title={t("admin.projects.empty")}
              hint={t("admin.projects.emptyHint")}
            />
          ) : null}
        </Card>
      </div>

      {creating ? (
        <Modal
          title={t("admin.projects.newProject")}
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={create.isPending}
                disabled={!name.trim()}
                onClick={() => create.mutate()}
              >
                {t("admin.projects.create")}
              </Button>
            </>
          }
        >
          <Field label={t("admin.projects.name")}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("admin.projects.namePlaceholder")}
              autoFocus
            />
          </Field>

          <Field label={t("admin.projects.colour")}>
            <div className="row gap-5">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                style={{ width: 44, height: 34, border: "none", background: "none" }}
                aria-label={t("admin.projects.colourLabel")}
              />
              <span className="code">{color}</span>
            </div>
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
