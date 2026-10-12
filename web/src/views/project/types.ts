export interface ProjectsViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string | null, spaceId: string | null) => void;
}
