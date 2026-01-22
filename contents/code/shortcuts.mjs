export class Shortcuts {
  constructor(
    workspace,
    config,
    root,
    { blocklist, windows, tiles },
    timerResetAll,
  ) {
    this.layoutIndex = config.layoutDefault - 1;
    root.shortcuts = [
      {
        name: "FluidtileToggleWindowBlocklist",
        text: "Fluid tile | Toggle window to blocklist",
        sequence: "Meta+F",
        callback: () => {
          blocklist.toggleWindow(workspace.activeWindow);
        },
      },
      {
        name: "FluidtileChangeTileLayout",
        text: "Fluid tile | Change tile layout",
        sequence: "Meta+Alt+F",
        callback: () => {
          tiles.disconnectSignals();
          windows.disconnectSignals();

          const layouts = tiles.getDefaultLayouts();
          tiles.setLayout(workspace.currentDesktop, layouts[this.layoutIndex]);

          this.layoutIndex =
            this.layoutIndex >= layouts.length - 1 ? 0 : this.layoutIndex + 1;

          timerResetAll.start();
        },
      },
    ];
  }
}
