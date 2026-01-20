export class Shortcuts {
  constructor(workspace, root, { blocklist }) {
    this.shortcuts = [
      {
        name: "FluidtileToggleWindowBlocklist",
        text: "Fluid tile - Toggle window to blocklist",
        sequence: "Meta+F",
        callback: () => {
          blocklist.toggleWindow(workspace.activeWindow);
        },
      },
    ];
    root.shortcuts = this.shortcuts;
  }
}
