export class UI {
  constructor(
    workspace,
    config,
    rootUI,
    state,
    { tiles, windows, blocklist },
    timerRemoveDesktop,
  ) {
    this.workspace = workspace;
    this.config = config;
    this.rootUI = rootUI;
    this.tiles = tiles;
    this.blocklist = blocklist;
    this.windows = windows;
    this.state = state;
    this.timerRemoveDesktop = timerRemoveDesktop;
  }

  //Paint tiles
  resetLayout() {
    this.rootUI.layoutOrdered = [];
    this.rootUI.layoutOrdered = this.tiles.getTilesCurrentDesktop();
  }

  // When a window start move with the cursor, reset ui
  onUserMoveStart(window) {
    if (this.blocklist.check(window) === true) {
      return;
    }

    this.resetLayout();
    window._avoidMaximizeTrigger = true;
  }

  // When a window is moving with the cursor
  onUserMoveStepped(window, windowGeometry) {
    if (this.blocklist.check(window) === true) {
      return;
    }

    this.rootUI.visible = true;
    const cursor = this.getPosition(windowGeometry);
    this.rootUI.tileActived = this.rootUI.layoutOrdered.findIndex((tile) => {
      const limitX = tile.absoluteGeometry.x + tile.absoluteGeometry.width;
      const limitY = tile.absoluteGeometry.y + tile.absoluteGeometry.height;
      return (
        tile.absoluteGeometry.x <= cursor.x &&
        limitX >= cursor.x &&
        tile.absoluteGeometry.y <= cursor.y &&
        limitY >= cursor.y
      );
    });
  }

  //When the user release the window
  //and return if the UI was enable
  onUserMoveFinished(window) {
    if (this.blocklist.check(window) === true) {
      return;
    }

    if (this.rootUI.visible === true) {
      this.rootUI.visible = false;

      const changed = this.windows.checkDesktopChanged(window);

      if (changed === true) {
        this.state.removeDesktopInfo = {
          desktopsId: window._tileShadow._desktop.id,
          // disableExtend: true,
        };

        this.timerRemoveDesktop.start();
      }

      const tile = this.rootUI.layoutOrdered[this.rootUI.tileActived];

      if (tile !== undefined) {
        window._avoidTileChangedTrigger = false;
        tile.manage(window);
      }

      this.rootUI.tileActived = -1;
      return;
    }

    //If window is resized or layout resized
    if (window._tileShadow !== undefined && window.tile === null) {
      window._tileShadow.manage(window);
    } else if (window.tile !== null) {
      this.windows.extendCurrentDesktop();
    }
  }

  //Get cursor position or window position
  getPosition(windowGeometry) {
    if (this.config.UIWindowCursor === true) {
      return {
        x: (windowGeometry.x + windowGeometry.right) / 2,
        y: windowGeometry.y,
      };
    }

    return { x: this.workspace.cursorPos.x, y: this.workspace.cursorPos.y };
  }
}
