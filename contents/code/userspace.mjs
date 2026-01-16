export class Userspace {
  constructor(workspace) {
    this.workspace = workspace;
  }

  //Get panel sizes in the workspace
  getPanelsSize(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    const workArea = this.workspace.clientArea(
      this.workspace.MaximizeArea,
      screen,
      desktop,
    );

    return {
      left: workArea.x,
      top: workArea.y,
      right:
        this.workspace.virtualScreenSize.width - (workArea.width + workArea.x),
      bottom:
        this.workspace.virtualScreenSize.height -
        (workArea.height + workArea.y),
      workarea: workArea,
    };
  }
}
