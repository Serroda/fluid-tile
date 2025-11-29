export function useWorkarea(workspace) {
  //Get panel sizes in the workspace
  function getPanelsSize(screen, desktop) {
    const workArea = workspace.clientArea(
      workspace.MaximizeArea,
      screen,
      desktop,
    );
    return {
      left: workArea.x,
      top: workArea.y,
      right: workspace.virtualScreenSize.width - (workArea.width + workArea.x),
      bottom:
        workspace.virtualScreenSize.height - (workArea.height + workArea.y),
      workarea: workArea,
    };
  }

  return { getPanelsSize };
}
