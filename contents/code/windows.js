//TODO:
// Get all windows from the virtual desktop except the given window
function getWindows(windowMain, desktop, screen) {
  const windows = [];

  for (const windowItem of Workspace.stackingOrder) {
    if (
      windowItem !== windowMain &&
      windowItem.output === screen &&
      windowItem.desktops.includes(desktop) === true &&
      Util.checkBlocklist(
        windowItem,
        config.appsBlocklist,
        config.modalsIgnore,
      ) === false
    ) {
      windows.push(windowItem);
    }
  }

  return windows;
}

//TODO:
// Set window tiles
// mode: 0 => addWindow
// mode: 1 => removeWindow
function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
  for (const itemDesktop of desktops) {
    for (const itemScreen of screens) {
      const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
      const tilesOrdered = getOrderedTiles(itemDesktop, itemScreen);

      if (
        mode === 1 &&
        config.windowsOrderClose === false &&
        windowsOther.length > 1
      ) {
        return true;
      }

      if (mode === 0) {
        //Set tile if the custom mosaic has space
        if (windowsOther.length + 1 <= tilesOrdered.length) {
          for (let x = 0; x < windowsOther.length; x++) {
            windowsOther[x].desktops = [itemDesktop];
            windowsOther[x].setMaximize(false, false);
            tilesOrdered[x + 1].manage(windowsOther[x]);
          }

          Workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];
          tilesOrdered[0].manage(windowMain);

          if (maximize === true && windowsOther.length === 0) {
            windowMain.setMaximize(true, true);
          } else {
            windowMain.setMaximize(false, false);
            if (config.windowsExtend === true) {
              Util.extendWindows(
                tilesOrdered,
                [windowMain, ...windowsOther],
                getSizePanels(itemScreen, itemDesktop),
              );
            }
          }

          return false;
        }
      } else if (mode === 1 && windowsOther.length !== 0) {
        for (let x = 0; x < windowsOther.length; x++) {
          if (maximize === true && windowsOther.length === 1) {
            windowsOther[x].setMaximize(true, true);
          } else {
            windowsOther[x].setMaximize(false, false);
            tilesOrdered[x].manage(windowsOther[x]);
          }
        }
        if (config.windowsExtend === true) {
          Util.extendWindows(
            tilesOrdered,
            windowsOther,
            getSizePanels(itemScreen, itemDesktop),
          );
        }
        return false;
      }
    }
  }
  return true;
}

//Extend window if empty space is available
function extendWindows(tilesLayout, windows, panelsSize) {
  resetWindowGeometry(windows, panelsSize);

  for (const window of windows) {
    if (window.tile === null) {
      continue;
    }

    window.tileVirtual = undefined;

    const tilesAround = {
      left: [],
      top: [],
      right: [],
      bottom: [],
    };

    const windowGeometry = window.tile.absoluteGeometry;

    for (const tile of tilesLayout) {
      if (tile.windows.length !== 0) {
        continue;
      }

      if (
        windowGeometry.x > tile.absoluteGeometry.x &&
        checkSameRow(windowGeometry, tile) === true
      ) {
        tilesAround.left.push(tile);
      } else if (
        windowGeometry.y > tile.absoluteGeometry.y &&
        checkSameColumn(windowGeometry, tile) === true
      ) {
        tilesAround.top.push(tile);
      } else if (
        windowGeometry.x < tile.absoluteGeometry.x &&
        checkSameRow(windowGeometry, tile) === true
      ) {
        tilesAround.right.push(tile);
      } else if (
        windowGeometry.y < tile.absoluteGeometry.y &&
        checkSameColumn(windowGeometry, tile) === true
      ) {
        tilesAround.bottom.push(tile);
      }
    }

    for (const tileType in tilesAround) {
      const tiles = tilesAround[tileType];

      if (tiles.length === 0) {
        continue;
      }

      tiles.sort((a, b) => {
        switch (tileType) {
          case "left":
          case "right":
            return b.tile.absoluteGeometry.x - a.tile.absoluteGeometry.x;

          case "top":
          case "bottom":
            return b.tile.absoluteGeometry.y - a.tile.absoluteGeometry.y;
        }
      });

      loopTiles: for (const tile of tiles) {
        for (const windowOther of windows) {
          if (windowOther === window) {
            continue;
          }

          if (checkConflicts(window, windowOther, tileType) === true) {
            break loopTiles;
          }
        }

        const finalWidth = tile.absoluteGeometry.width + windowGeometry.width;
        const finalHeight =
          tile.absoluteGeometry.height + windowGeometry.height;

        let newGeometry = null;

        switch (tileType) {
          case "left":
            newGeometry = {
              x: tile.absoluteGeometry.x,
              width: finalWidth,
            };
            break;
          case "top":
            newGeometry = {
              y: tile.absoluteGeometry.y,
              height: finalHeight,
            };
            break;
          case "right":
            newGeometry = {
              width: finalWidth,
            };
            break;
          case "bottom":
            newGeometry = {
              height: finalHeight,
            };
            break;
        }

        if (newGeometry === null) {
          continue;
        }

        const tileVirtual = setGeometryWindow(window, newGeometry, panelsSize);
        window.tileVirtual = tileVirtual;
      }
    }
  }
}

//Set default tile size
function resetWindowGeometry(windows, panelsSize) {
  for (const window of windows) {
    if (window.tile === null) {
      continue;
    }

    setGeometryWindow(
      window,
      {
        x: window.tile.absoluteGeometry.x,
        y: window.tile.absoluteGeometry.y,
        width: window.tile.absoluteGeometry.width,
        height: window.tile.absoluteGeometry.height,
      },
      panelsSize,
    );
  }
}

function checkSameRow(windowGeometry, tile) {
  return (
    (windowGeometry.top >= tile.absoluteGeometry.top &&
      windowGeometry.top < tile.absoluteGeometry.bottom) ||
    (windowGeometry.bottom > tile.absoluteGeometry.top &&
      windowGeometry.bottom <= tile.absoluteGeometry.bottom)
  );
}

function checkConflicts(windowMain, windowOther, type) {
  const geometryMain =
    windowMain.tileVirtual !== undefined
      ? windowMain.tileVirtual
      : windowMain.tile.absoluteGeometry;

  const geometryOther =
    windowOther.tileVirtual !== undefined
      ? windowOther.tileVirtual
      : windowOther.tile.absoluteGeometry;

  const noConflictRow =
    (geometryMain.top <= geometryOther.top &&
      geometryMain.bottom <= geometryOther.top) ||
    (geometryMain.top >= geometryOther.bottom &&
      geometryMain.bottom >= geometryOther.bottom);

  const noConflictColumn =
    (geometryMain.left <= geometryOther.left &&
      geometryMain.right <= geometryOther.left) ||
    (geometryMain.left >= geometryOther.right &&
      geometryMain.right >= geometryOther.right);

  switch (type) {
    case "left":
      return geometryMain.left === geometryOther.right && !noConflictRow;

    case "right":
      return geometryMain.right === geometryOther.left && !noConflictRow;

    case "top":
      return geometryMain.top === geometryOther.bottom && !noConflictColumn;

    case "bottom":
      return geometryMain.bottom === geometryOther.top && !noConflictColumn;
  }
}

function checkSameColumn(windowGeometry, tile) {
  return (
    (windowGeometry.left >= tile.absoluteGeometry.left &&
      windowGeometry.left < tile.absoluteGeometry.right) ||
    (windowGeometry.right <= tile.absoluteGeometry.right &&
      windowGeometry.right > tile.absoluteGeometry.left)
  );
}

function setGeometryWindow(window, geometry, panelsSize) {
  const x = geometry.x ?? window.tile.absoluteGeometry.x;
  const y = geometry.y ?? window.tile.absoluteGeometry.y;
  const width = geometry.width ?? window.tile.absoluteGeometry.width;
  const height = geometry.height ?? window.tile.absoluteGeometry.height;

  window.frameGeometry = {
    x: x + window.tile.padding + (x === 0 ? panelsSize.left : 0),
    y: y + window.tile.padding + (y === 0 ? panelsSize.top : 0),
    width:
      width -
      (x === 0 ? panelsSize.left : 0) -
      (width + x - panelsSize.right - panelsSize.left ===
      panelsSize.workarea.width
        ? panelsSize.right
        : 0) -
      window.tile.padding * 2,
    height:
      height -
      (y === 0 ? panelsSize.top : 0) -
      (height + y - panelsSize.top - panelsSize.bottom ===
      panelsSize.workarea.height
        ? panelsSize.bottom
        : 0) -
      window.tile.padding * 2,
  };

  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
  };
}

//TODO:
//Trigger when a window is added to the desktop
function onWindowAdded(windowNew) {
  if (
    Util.checkBlocklist(
      windowNew,
      config.appsBlocklist,
      config.modalsIgnore,
    ) === true
  ) {
    return;
  }

  const continueProcess = setWindowsTiles(
    windowNew,
    Workspace.desktops,
    Workspace.screens,
    config.maximizeOpen,
    0,
  );

  if (config.desktopAdd === true && continueProcess === true) {
    Workspace.createDesktop(Workspace.desktops.length, "");
    Workspace.currentDesktop =
      Workspace.desktops[Workspace.desktops.length - 1];
    windowNew.desktops = [Workspace.currentDesktop];

    if (config.maximizeOpen === true) {
      windowNew.setMaximize(true, true);
    }

    let layout = Util.getDefaultLayouts(config.layoutDefault - 1);

    if (config.layoutCustom !== undefined) {
      layout = config.layoutCustom;
    }

    setLayout(Workspace.currentDesktop, layout);

    if (config.maximizeOpen === false) {
      const tilesOrdered = getTilesFromActualDesktop();

      windowNew.setMaximize(false, false);
      tilesOrdered[0].manage(windowNew);
    }
  }
}

//TODO:
//Trigger when a window is remove to the desktop
function onWindowRemoved(windowClosed) {
  if (
    Util.checkBlocklist(
      windowClosed,
      config.appsBlocklist,
      config.modalsIgnore,
    ) === true
  ) {
    return;
  }

  const continueProcess = setWindowsTiles(
    windowClosed,
    windowClosed.desktops,
    [windowClosed.output],
    config.maximizeClose,
    1,
  );

  if (
    continueProcess === false ||
    config.desktopRemove === false ||
    Workspace.desktops.length === 1 ||
    Workspace.desktops.length <= config.desktopRemoveMin
  ) {
    return;
  }

  removeDesktopInfo.desktopsId = windowClosed.desktops.map((d) => d.id);
  removeDesktopInfo.windowClosed = windowClosed;
  timerRemoveDesktop.start();
}

//TODO:
//Set signals to all Windows
function setWindowsSignals() {
  for (const windowItem of Workspace.stackingOrder) {
    setSignalsToWindow(windowItem);
  }
}

//TODO:
//Set signals to window
function setSignalsToWindow(windowMain) {
  if (
    Util.checkBlocklist(
      windowMain,
      config.appsBlocklist,
      config.modalsIgnore,
    ) === false
  ) {
    if (config.UIEnable === true) {
      windowMain.interactiveMoveResizeStarted.connect(onUserMoveStart);
      windowMain.interactiveMoveResizeStepped.connect(onUserMoveStepped);
      windowMain.interactiveMoveResizeFinished.connect(() => {
        onUserMoveFinished(windowMain);
      });
    }

    if (config.windowsOrderMove === true) {
      windowMain.activeChanged.connect(() => {
        onUserFocusWindow(windowMain);
      });
      windowMain.tileChanged.connect((tile) => {
        exchangeTiles(windowMain, tile);
      });
    }
  }
}
