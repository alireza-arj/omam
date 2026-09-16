import {
  Badge,
  Button,
  Card,
  ColorInput,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Table,
  TableScroll,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { createProjectInputSchema } from "@omam/contracts";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { PageHeader } from "./layout";

const DEFAULT_COLOR = createProjectInputSchema.shape.color.parse(undefined);

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

  const collection = useCollection(projects.data?.projects ?? [], (row) => row.name);

  return (
    <>
      <PageHeader
        title={t("admin.nav.projects")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t("admin.projects.newProject")}
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
          {collection.search && !collection.total && projects.data ? (
            <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
          ) : null}

          {projects.isPending ? <Loading /> : null}
          {projects.isError ? (
            <ErrorState message={translateError(projects.error, t)} onRetry={() => projects.refetch()} />
          ) : null}

          {collection.total > 0 ? (
            <TableScroll>
              <Table>
                <Table.Content aria-label={t("common.records")} className="omam-data">
                  <Table.Header>
                    <Table.Column isRowHeader>{t("admin.projects.project")}</Table.Column>
                    <Table.Column>{t("admin.projects.status")}</Table.Column>
                    <Table.Column className="tight" />
                  </Table.Header>
                  <Table.Body>
                    {collection.rows.map((project) => (
                      <Table.Row id={project.id} key={project.id}>
                        <Table.Cell>
                          <span className="row gap-5">
                            <span className="dot" style={{ color: project.color }} aria-hidden />
                            {project.name}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {project.archived ? (
                            <Badge>{t("admin.projects.archived")}</Badge>
                          ) : (
                            <Badge tone="success" dot>
                              {t("admin.projects.active")}
                            </Badge>
                          )}
                        </Table.Cell>
                        <Table.Cell className="tight">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={archive.isPending}
                            onClick={() => archive.mutate({ id: project.id, archived: !project.archived })}
                          >
                            {project.archived ? t("admin.projects.restore") : t("admin.projects.archive")}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table>
            </TableScroll>
          ) : projects.data && !collection.search ? (
            <EmptyState title={t("admin.projects.empty")} hint={t("admin.projects.emptyHint")} />
          ) : null}
          <Pagination {...collection} />
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
              <ColorInput value={color} onChange={setColor} label={t("admin.projects.colourLabel")} />
              <span className="code">{color}</span>
            </div>
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
