export class UI {
  constructor(
    workspace,
    config,
    root,
    { tiles, windows, blocklist, desktops },
    windowFullscreen,
    windowPopup,
    hideUI,
  ) {
    this.workspace = workspace;
    this.config = config;
    this.root = root;
    this.tiles = tiles;
    this.blocklist = blocklist;
    this.windows = windows;
    this.desktops = desktops;
    this.timerHideUI = hideUI;
    this.windowFullscreen = windowFullscreen;
    this.windowPopup = windowPopup;
    this.windowGeometryBefore = null;
  }

  show(ui) {
    this.toggleVisibility(ui, true, false);
  }

  hide(ui, rootHide) {
    this.toggleVisibility(ui, false, rootHide);
  }

  toggleVisibility(ui, value, rootHide) {
    this.root.tileActived = -1;
    this.root.visible = !rootHide;

    switch (ui) {
      //Fullscreen
      case 0:
        this.resetRoot();
        this.windowFullscreen.visible = value;
        break;

      //Compact
      case 1:
        break;

      //Popup
      case 2:
        this.resetLayout();
        this.windowPopup.visible = value;
        if (value === true) {
          if (this.timerHideUI.ui !== -1) {
            this.timerHideUI.restart();
            return;
          }

          const activeScreenGeometry = this.workspace.activeScreen.geometry;
          this.root.width = this.windowPopup.width;
          this.root.height = this.windowPopup.height;
          this.root.x =
            activeScreenGeometry.x +
            (activeScreenGeometry.width - this.root.width) / 2;
          this.root.y =
            activeScreenGeometry.y +
            (activeScreenGeometry.height - this.root.height) / 2;
          this.timerHideUI.ui = ui;
          this.timerHideUI.rootHide = !rootHide;
          this.timerHideUI.start();
        } else {
          this.resetRoot();
          this.timerHideUI.ui = -1;
          this.timerHideUI.rootHide = true;
        }
        break;

      //All windows
      case 3:
        this.windowPopup.visible = value;
        this.windowFullscreen.visible = value;
        break;
    }
  }

  resetRoot() {
    this.root.width = this.workspace.virtualScreenSize.width;
    this.root.height = this.workspace.virtualScreenSize.height;
    this.root.x = 0;
    this.root.y = 0;
  }

  //Return if fullscreen or compact ui is open
  checkIfUIVisible() {
    return this.windowFullscreen.visible;
  }

  //Paint tiles
  resetLayout() {
    this.root.layoutOrdered = [];
    this.root.layoutOrderedScreen = [];
    this.root.layoutOrdered = this.tiles.getTilesCurrentDesktop();
    this.root.layoutOrderedScreen = this.root.layoutOrdered.filter(
      (t) => t._screen === this.workspace.activeScreen,
    );
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

    if (this.windowGeometryBefore === null) {
      this.windowGeometryBefore = windowGeometry;
      return;
    }

    if (
      windowGeometry.height !== this.windowGeometryBefore.height ||
      windowGeometry.width !== this.windowGeometryBefore.width
    ) {
      return;
    }

    this.show(0);
    const cursor = this.getPosition(windowGeometry);
    this.root.tileActived = this.root.layoutOrdered.findIndex((tile) => {
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
    this.windowGeometryBefore = null;

    if (this.blocklist.check(window) === true) {
      return;
    }

    if (this.checkIfUIVisible() === true) {
      const changed = this.windows.checkDesktopChanged(window);

      if (changed === true) {
        this.desktops.remove({
          desktopsId: [window._tileShadow._desktop.id],
        });
      }

      const tile = this.root.layoutOrdered[this.root.tileActived];
      this.hide(3, true);

      if (tile !== undefined) {
        window._avoidTileChangedTrigger = false;
        tile.manage(window);
      }

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
