export class UI {
  constructor(
    workspace,
    config,
    root,
    { tiles, windows, blocklist, desktops, userspace },
    windowFullscreen,
    windowCompact,
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
    this.userspace = userspace;
    this.timerHideUI = hideUI;
    this.windowFullscreen = windowFullscreen;
    this.windowCompact = windowCompact;
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
    this.root.visible = !rootHide;
    this.root.tileActive = undefined;

    switch (ui) {
      //Fullscreen
      case 0:
        this.resetRoot();
        this.windowFullscreen.visible = value;
        break;

      //Compact
      case 1:
        this.windowCompact.visible = true;
        this.adaptRootGeometry(
          this.windowCompact,
          this.config.UIWindowCompactPosition,
        );

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
          this.adaptRootGeometry(this.windowPopup, 0);
          this.timerHideUI.ui = 2;
          this.timerHideUI.rootHide = true;
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
        this.windowCompact.visible = value;
        break;
    }
  }

  resetRoot() {
    this.root.width = this.workspace.virtualScreenSize.width;
    this.root.height = this.workspace.virtualScreenSize.height;
    this.root.x = 0;
    this.root.y = 0;
  }

  adaptRootGeometry(windowUI, position) {
    const activeScreenGeometry = this.workspace.activeScreen.geometry;

    const padding = 8;
    this.root.width = windowUI.width;
    this.root.height = windowUI.height;
    this.root.x =
      activeScreenGeometry.x +
      (activeScreenGeometry.width - this.root.width) / 2;

    const panelsSize = this.userspace.getPanelsSize();

    switch (position) {
      //Center
      case 0:
        this.root.y =
          activeScreenGeometry.y +
          (activeScreenGeometry.height - this.root.height) / 2;
        break;
      //Top
      case 1:
        this.root.y = padding + activeScreenGeometry.y + panelsSize.top;
        break;
      //Bottom
      case 2:
        this.root.y =
          activeScreenGeometry.y +
          (activeScreenGeometry.height - this.root.height) -
          padding -
          panelsSize.bottom;
        break;
      //Cursor
      case 3:
        const cursor = this.getPosition(this.workspace.activeWindow);
        let y = cursor.y - this.windowCompact.height / 2;
        let x = cursor.x - this.windowCompact.width / 2;

        if (y <= panelsSize.top) {
          y = activeScreenGeometry.y + padding + panelsSize.top;
        }

        if (x <= panelsSize.left) {
          x = activeScreenGeometry.x + padding + panelsSize.left;
        }

        this.root.y = y;
        this.root.x = x;
        break;
    }
  }

  //Return if fullscreen or compact ui is open
  checkIfUIVisible() {
    return (
      this.windowFullscreen.visible === true ||
      this.windowCompact.visible === true
    );
  }

  //Paint tiles
  resetLayout() {
    const tiles = this.tiles.getTilesCurrentDesktop();
    this.root.layouts = {
      fullscreen: tiles,
      popup: tiles.filter((t) => t._screen === this.workspace.activeScreen),
      compact: tiles.sort(
        (a, b) => a._screen.geometry.x - b._screen.geometry.x,
      ),
    };
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
      this.windowGeometryBefore = {
        width: parseInt(windowGeometry.width),
        height: parseInt(windowGeometry.height),
      };
      return;
    }

    if (
      parseInt(windowGeometry.height) !== this.windowGeometryBefore.height ||
      parseInt(windowGeometry.width) !== this.windowGeometryBefore.width
    ) {
      return;
    }

    if (this.checkIfUIVisible() === false) {
      this.show(this.config.UIMode);
    }

    const cursor = this.getPosition(windowGeometry);

    if (this.config.UIMode === 0) {
      this.root.tileActive = this.root.layouts.fullscreen.find((tile) => {
        let tileGeometry = {
          x: tile.absoluteGeometry.x,
          y: tile.absoluteGeometry.y,
          right: tile.absoluteGeometry.x + tile.absoluteGeometry.width,
          bottom: tile.absoluteGeometry.y + tile.absoluteGeometry.height,
        };

        return (
          tileGeometry.x <= cursor.x &&
          tileGeometry.right >= cursor.x &&
          tileGeometry.y <= cursor.y &&
          tileGeometry.bottom >= cursor.y
        );
      });
    } else if (this.config.UIMode === 1) {
      const screensSort = this.workspace.screens
        .map((s) => s)
        .sort((a, b) => a.geometry.x - b.geometry.x);

      const sizeSection = this.windowCompact.sizePerSection;

      this.root.tileActive = this.root.layouts.compact.find((tile) => {
        const indexScreen = screensSort.indexOf(tile._screen);
        const x =
          this.root.x +
          indexScreen * sizeSection +
          indexScreen * this.windowCompact.spacingRow +
          tile.relativeGeometry.x * sizeSection;

        let tileGeometry = {
          x: x,
          y: this.root.y + tile.relativeGeometry.y * this.windowCompact.height,
          right: x + tile.relativeGeometry.width * sizeSection,
          bottom:
            this.root.y +
            tile.relativeGeometry.height * this.windowCompact.height +
            tile.relativeGeometry.y * this.windowCompact.height,
        };

        return (
          tileGeometry.x <= cursor.x &&
          tileGeometry.right >= cursor.x &&
          tileGeometry.y <= cursor.y &&
          tileGeometry.bottom >= cursor.y
        );
      });
    }
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

      const layouts =
        this.config.UIMode === 0
          ? this.root.layouts.fullscreen
          : this.root.layouts.compact;

      const tile = layouts.find((t) => t === this.root.tileActive);

      this.hide(3, true);

      if (tile !== undefined) {
        window._avoidTileChangedTrigger = false;

        if (tile._screen !== this.workspace.activeScreen) {
          this.workspace.sendClientToScreen(window, tile._screen);
        }

        tile.manage(window);
      } else if (window._tileShadow !== undefined) {
        window._tileShadow.manage(window);
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
