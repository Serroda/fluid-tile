export class Windows {
  constructor(
    workspace,
    config,
    rootUI,
    state,
    { blocklist, tiles, userspace },
  ) {
    this.workspace = workspace;
    this.config = config;
    this.rootUI = rootUI;
    this.state = state;
    this.blocklist = blocklist;
    this.tiles = tiles;
    this.userspace = userspace;
  }

  // Get all windows from the virtual desktop except the given window
  getWindows(
    windowIgnore,
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    const windows = [];

    for (const windowItem of this.workspace.stackingOrder) {
      if (
        windowItem !== windowIgnore &&
        windowItem.output === screen &&
        windowItem.desktops.includes(desktop) === true &&
        this.blocklist.check(windowItem) === false
      ) {
        windows.push(windowItem);
      }
    }

    return windows;
  }

  // Set window tiles on add window
  setWindowsTilesAdded(windowMain) {
    const indexStartDesktop = this.workspace.desktops.findIndex(
      (d) => d === this.workspace.currentDesktop,
    );
    const indexStartScreen = this.workspace.screens.findIndex(
      (s) => s === this.workspace.activeScreen,
    );

    if (indexStartDesktop === -1 || indexStartScreen === -1) {
      return false;
    }

    let indexDesktop = indexStartDesktop;
    let indexScreen = indexStartScreen;

    do {
      const itemDesktop = this.workspace.desktops[indexDesktop];
      do {
        const itemScreen = this.workspace.screens[indexScreen];
        const windowsOther = this.getWindows(
          windowMain,
          itemDesktop,
          itemScreen,
        );
        const tilesOrdered = this.tiles.getOrderedTiles(
          itemDesktop,
          itemScreen,
        );

        if (
          tilesOrdered.length === 0 ||
          windowsOther.length + 1 > tilesOrdered.length
        ) {
          indexScreen = (indexScreen + 1) % this.workspace.screens.length;
          continue;
        }

        this.workspace.currentDesktop = itemDesktop;
        windowMain.desktops = [itemDesktop];

        for (let x = 0; x < windowsOther.length; x++) {
          windowsOther[x].desktops = [itemDesktop];
          windowsOther[x]._avoidMaximizeTrigger = true;
          windowsOther[x]._avoidTileChangedTrigger = true;
          windowsOther[x].setMaximize(false, false);

          if (this.config.windowsOrderOpen === true) {
            tilesOrdered[x + 1].manage(windowsOther[x]);
          } else if (windowsOther[x].tile === null) {
            tilesOrdered[x].manage(windowsOther[x]);
          }

          windowsOther[x]._tileShadow = windowsOther[x].tile;
        }

        windowMain._avoidTileChangedTrigger = true;
        windowMain._avoidMaximizeTrigger = windowsOther.length === 0;

        if (this.config.windowsOrderOpen === true) {
          tilesOrdered[0].manage(windowMain);
        } else {
          const tileEmpty = tilesOrdered.find(
            (tile) => tile.windows.length === 0,
          );

          tileEmpty?.manage(windowMain);
        }

        windowMain._tileShadow = windowMain.tile;

        this.extendWindows(
          [windowMain, ...windowsOther],
          this.userspace.getPanelsSize(itemDesktop, itemScreen),
        );

        return false;
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % this.workspace.desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    return true;
  }

  // Set window tiles on remove window
  setWindowsTilesRemoved(windowMain) {
    const windowsOther = this.getWindows(windowMain);
    const tilesOrdered = this.tiles.getTilesFromActualDesktop();

    if (tilesOrdered.length === 0 || windowsOther.length === 0) {
      return true;
    }

    for (let x = 0; x < windowsOther.length; x++) {
      windowsOther[x]._avoidMaximizeExtend = false;

      if (this.config.windowsOrderClose === true) {
        windowsOther[x]._avoidTileChangedTrigger = true;
        windowsOther[x]._avoidMaximizeTrigger = true;
        windowsOther[x].setMaximize(false, false);
        tilesOrdered[x].manage(windowsOther[x]);
        windowsOther[x]._tileShadow = tilesOrdered[x];
      }
    }

    this.extendWindows(windowsOther, this.userspace.getPanelsSize());
    return false;
  }

  //Extend window if empty space is available
  extendWindows(windows, panelsSize) {
    console.log(
      "extendwindow",
      this.config.maximizeExtend === true,
      windows.length === 1,
      windows[0].minimized === false,
      windows[0]._avoidMaximizeExtend !== true,
    );

    if (
      this.config.maximizeExtend === true &&
      windows.length === 1 &&
      windows[0].minimized === false &&
      windows[0]._avoidMaximizeExtend !== true
    ) {
      console.log("extendwindow maximized");
      windows[0]._avoidMaximizeTrigger = true;
      windows[0]._avoidMaximizeExtend = false;
      windows[0].setMaximize(true, true);
      return;
    }

    this.resetWindowGeometry(windows, panelsSize);

    for (const window of windows) {
      window._avoidMaximizeExtend = false;

      if (
        window.tile === null ||
        window._tileShadow === undefined ||
        window.minimized === true
      ) {
        continue;
      }

      const windowGeometry = this.getRealGeometry(window);
      const windowsOther = windows
        .filter(
          (wo) =>
            wo !== window &&
            (wo.tile !== null || wo._tileShadow !== undefined) &&
            wo.minimized === false,
        )
        .map((wo) => this.getRealGeometry(wo));

      const newGeometry = {
        top: panelsSize.workarea.top,
        left: panelsSize.workarea.left,
        right: panelsSize.workarea.right,
        bottom: panelsSize.workarea.bottom,
      };

      //Only check windows on the vertical axis that
      //belong to the same column. This prevents windows
      //from being placed on top of each other, while
      //on the horizontal axis we search all rows
      //for windows that may cause conflicts,
      //this being more restrictive when establishing the window size.

      const windowsConflict = {
        left: [],
        top: [],
        right: [],
        bottom: [],
      };

      for (const windowItem of windowsOther) {
        if (windowItem.right <= windowGeometry.left) {
          windowsConflict.left.push(windowItem);
        }

        if (windowItem.left >= windowGeometry.right) {
          windowsConflict.right.push(windowItem);
        }

        const sameColumn = this.checkSameColumn(windowGeometry, windowItem);

        if (sameColumn === false) {
          continue;
        }

        if (windowItem.bottom <= windowGeometry.top) {
          windowsConflict.top.push(windowItem);
        }

        if (windowItem.top >= windowGeometry.bottom) {
          windowsConflict.bottom.push(windowItem);
        }
      }

      for (const key in windowsConflict) {
        const item = windowsConflict[key];

        if (item.length === 0) {
          continue;
        }

        const near = item.reduce(
          (acc, woNew) => {
            const distance = Math.hypot(
              windowGeometry.left +
                windowGeometry.width / 2 -
                (woNew.left + woNew.width / 2),
              windowGeometry.top +
                windowGeometry.height / 2 -
                (woNew.top + woNew.height / 2),
            );

            return acc.distance === -1 || distance < acc.distance
              ? { distance, geometry: woNew }
              : acc;
          },
          { distance: -1, geometry: newGeometry },
        );

        switch (key) {
          case "left":
            newGeometry.left = near.geometry.right;
            break;
          case "right":
            newGeometry.right = near.geometry.left;
            break;
          case "top":
            newGeometry.top = near.geometry.bottom;
            break;
          case "bottom":
            newGeometry.bottom = near.geometry.top;
            break;
        }
      }
      const tileVirtual = this.setGeometryWindow(
        window,
        newGeometry,
        panelsSize,
      );
      window._tileVirtual = tileVirtual;
    }
  }

  //Set default tile size
  resetWindowGeometry(windows, panelsSize) {
    for (const window of windows) {
      window._tileVirtual = undefined;

      if (
        window.minimized === true ||
        (window.tile === null && window._tileShadow === undefined)
      ) {
        continue;
      }

      window.setMaximize(false, false);
      this.setGeometryWindow(window, {}, panelsSize);
    }
  }

  //Get geometry from tiles
  getRealGeometry(window) {
    return (
      window._tileVirtual ??
      (window.tile !== null
        ? window.tile.absoluteGeometry
        : window._tileShadow.absoluteGeometry)
    );
  }

  //Set window size and return `virtualTile`
  setGeometryWindow(window, geometry, panelsSize) {
    const tileRef = window.tile !== null ? window.tile : window._tileShadow;
    const tileRefGeometry = this.getRealGeometry(window);

    const left =
      geometry.left !== undefined ? geometry.left : tileRefGeometry.left;
    const top = geometry.top !== undefined ? geometry.top : tileRefGeometry.top;

    const width =
      geometry.right !== undefined
        ? geometry.right - left
        : tileRefGeometry.width;
    const height =
      geometry.bottom !== undefined
        ? geometry.bottom - top
        : tileRefGeometry.height;

    let offsetX = tileRef.padding;
    let offsetY = tileRef.padding;

    if (left === panelsSize.left) {
      offsetX += tileRef.padding;
    }

    if (top === panelsSize.top) {
      offsetY += tileRef.padding;
    }

    if (left + width === panelsSize.workarea.right + panelsSize.right) {
      offsetX += panelsSize.right;
    }

    if (top + height === panelsSize.workarea.bottom + panelsSize.bottom) {
      offsetY += panelsSize.bottom;
    }

    window.frameGeometry = {
      x: left + (left === panelsSize.left ? tileRef.padding : 0),
      y: top + (top === panelsSize.top ? tileRef.padding : 0),
      width: width - offsetX,
      height: height - offsetY,
    };

    return {
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
    };
  }

  //TODO: Try with timer
  //Focus window in the workspace
  focusWindow(window) {
    if (window === undefined) {
      const windows = this.getWindows();

      if (windows.length === 0) {
        return null;
      }

      if (windows[0].minimized === true) {
        return null;
      }

      this.workspace.activeWindow = windows[0];
    } else {
      this.workspace.activeWindow = window;
    }
  }

  //Check if the tile is in the same column
  checkSameColumn(windowGeometry, windowGeometryOther) {
    return (
      (windowGeometry.left >= windowGeometryOther.left &&
        windowGeometry.left < windowGeometryOther.right) ||
      (windowGeometry.right <= windowGeometryOther.right &&
        windowGeometry.right > windowGeometryOther.left)
    );
  }

  //Extend all windows in the current desktop
  extendWindowsCurrentDesktop(screenAll = false) {
    let screens = [this.workspace.activeScreen];

    if (screenAll === true) {
      screens = this.workspace.screens;
    }

    for (const screen of screens) {
      const windows = this.getWindows(undefined, undefined, screen);

      if (windows.length === 0) {
        continue;
      }

      this.extendWindows(
        windows,
        this.userspace.getPanelsSize(undefined, screen),
      );
    }
  }

  //Transfer a window to another desktop with shortcuts
  adaptWindowCurrentDesktop(window = this.workspace.activeWindow) {
    if (window === null) {
      return false;
    }

    console.log("adapt");

    if (
      this.rootUI.visible === true ||
      this.blocklist.check(window) === true ||
      window._tileShadow === undefined ||
      window._tileShadow?._desktop === this.workspace.currentDesktop
    ) {
      console.log(
        "avoid",
        window._tileShadow?._desktop?.name,
        this.workspace.currentDesktop.name,
      );
      return false;
    }

    const windowsOther = this.getWindows(window);
    const tiles = this.tiles.getTilesFromActualDesktop();

    const tileEmpty = tiles.find(
      (t) => !windowsOther.some((w) => w.tile === t || w._tileShadow === t),
    );

    if (tileEmpty === undefined) {
      return false;
    }

    if (
      this.state.desktopsExtend.includes(window._tileShadow._desktop) === false
    ) {
      this.state.desktopsExtend.push(window._tileShadow._desktop);
    }

    if (this.state.desktopsExtend.includes(tileEmpty._desktop) === true) {
      this.state.desktopsExtend.splice(
        this.state.desktopsExtend.indexOf(tileEmpty._desktop),
        1,
      );
    }

    window.desktops = [tileEmpty._desktop];

    if (tileEmpty._screen !== window._tileShadow._screen) {
      this.workspace.sendClientToScreen(window, tileEmpty._screen);
    }

    window._avoidMaximizeTrigger = true;
    window._avoidTileChangedTrigger = true;

    window._tileShadow = tileEmpty;
    tileEmpty.manage(window);

    this.extendWindowsCurrentDesktop();
    return true;
  }
}
