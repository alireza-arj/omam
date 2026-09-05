import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { errorMessage, useToast } from "../lib/ui";
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
      toast("Project created.", "success");
      setCreating(false);
      setName("");
      setColor(DEFAULT_COLOR);
      refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const archive = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      api.updateProject(input.id, { archived: input.archived }),
    onSuccess: () => {
      toast("Project updated.", "success");
      refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="What the team tags their time against."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={`${projects.data?.projects.length ?? 0} projects`} />

          {projects.isPending ? <Loading /> : null}
          {projects.isError ? (
            <ErrorState message={errorMessage(projects.error)} onRetry={() => projects.refetch()} />
          ) : null}

          {projects.data?.projects.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
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
                          <Badge>Archived</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Active
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
                          {project.archived ? "Restore" : "Archive"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : projects.data ? (
            <EmptyState
              title="No projects yet"
              hint="Members can still track time without one — projects just make the report sharper."
            />
          ) : null}
        </Card>
      </div>

      {creating ? (
        <Modal
          title="New project"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={create.isPending}
                disabled={!name.trim()}
                onClick={() => create.mutate()}
              >
                Create project
              </Button>
            </>
          }
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Omam API"
              autoFocus
            />
          </Field>

          <Field label="Colour">
            <div className="row gap-5">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                style={{ width: 44, height: 34, border: "none", background: "none" }}
                aria-label="Project colour"
              />
              <span className="code">{color}</span>
            </div>
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
