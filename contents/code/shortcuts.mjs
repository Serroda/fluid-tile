export class Shortcuts {
  constructor(
    workspace,
    config,
    root,
    { blocklist, windows, tiles, ui },
    timerResetAll,
  ) {
    this.layoutIndex = config.layoutDefault - 1;
    root.shortcuts = [
      {
        name: "FluidtileToggleWindowBlocklist",
        text: "Fluid tile | Toggle window to blocklist",
        sequence: "Meta+F",
        callback: () => {
          ui.hide(3, true);
          const added = blocklist.toggleWindow(workspace.activeWindow);
          if (added === false) {
            windows.setEmptyTile();
          } else {
            windows.extendCurrentDesktop();
          }
        },
      },
      {
        name: "FluidtileChangeTileLayout",
        text: "Fluid tile | Change tile layout",
        sequence: "Meta+Alt+F",
        callback: () => {
          windows.disconnectSignals();
          tiles.disconnectSignals();

          const layouts = tiles.getDefaultLayouts();
          tiles.setLayout(
            workspace.currentDesktop,
            layouts[this.layoutIndex],
            false,
          );

          this.layoutIndex =
            this.layoutIndex >= layouts.length - 1 ? 0 : this.layoutIndex + 1;

          ui.show(2);
          timerResetAll.screenAll = false;
          timerResetAll.start();
        },
      },
    ];
  }
}
