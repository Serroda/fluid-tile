import { useBlocklist } from "./blocklist.mjs";
import { useWorkarea } from "./workarea.mjs";
import { useTiles } from "./tiles.mjs";
import { useUI } from "./ui.mjs";

export function useWindows(workspace, config, rootUI) {
  const apiTiles = useTiles(workspace, config);
  const apiBlocklist = useBlocklist(config.appsBlocklist, config.modalsIgnore);
  const apiWorkarea = useWorkarea(workspace);
  const apiUI = useUI(workspace, config, rootUI);
  let windowFocused = {};

  // Get all windows from the virtual desktop except the given window
  function getWindows(windowMain, desktop, screen) {
    const windows = [];

    for (const windowItem of workspace.stackingOrder) {
      if (
        windowItem !== windowMain &&
        windowItem.output === screen &&
        windowItem.desktops.includes(desktop) === true &&
        apiBlocklist.checkBlocklist(windowItem) === false
      ) {
        windows.push(windowItem);
      }
    }

    return windows;
  }

  // Set window tiles
  // mode: 0 => addWindow
  // mode: 1 => removeWindow
  function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
    for (const itemDesktop of desktops) {
      for (const itemScreen of screens) {
        const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
        const tilesOrdered = apiTiles.getOrderedTiles(itemDesktop, itemScreen);

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

            workspace.currentDesktop = itemDesktop;
            windowMain.desktops = [itemDesktop];
            tilesOrdered[0].manage(windowMain);

            if (maximize === true && windowsOther.length === 0) {
              windowMain.setMaximize(true, true);
            } else {
              windowMain.setMaximize(false, false);
              if (config.windowsExtendOpen === true) {
                extendWindows(
                  tilesOrdered,
                  [windowMain, ...windowsOther],
                  apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
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
          if (config.windowsExtendClose === true) {
            extendWindows(
              tilesOrdered,
              windowsOther,
              apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
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

        for (const tile of tiles) {
          if (checkConflictsAllWindows(window, windows, tileType) === true) {
            break;
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

          const tileVirtual = setGeometryWindow(
            window,
            newGeometry,
            panelsSize,
          );
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

  //Check if the tile is in the same row
  function checkSameRow(windowGeometry, tile) {
    return (
      (windowGeometry.top >= tile.absoluteGeometry.top &&
        windowGeometry.top < tile.absoluteGeometry.bottom) ||
      (windowGeometry.bottom > tile.absoluteGeometry.top &&
        windowGeometry.bottom <= tile.absoluteGeometry.bottom)
    );
  }

  //Check if the tile is in the same column
  function checkSameColumn(windowGeometry, tile) {
    return (
      (windowGeometry.left >= tile.absoluteGeometry.left &&
        windowGeometry.left < tile.absoluteGeometry.right) ||
      (windowGeometry.right <= tile.absoluteGeometry.right &&
        windowGeometry.right > tile.absoluteGeometry.left)
    );
  }

  //Check if the window collides with other windows
  function checkConflictsAllWindows(windowMain, windows, type) {
    for (const windowOther of windows) {
      if (windowOther === windowMain) {
        continue;
      }

      if (checkConflicts(windowMain, windowOther, type) === true) {
        return true;
      }
    }
    return false;
  }

  //Check if the windowMain collides with windowOther
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

  //Set window size and return `virtualTile`
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

  //Trigger when a window is added to the desktop
  function onWindowAdded(windowNew) {
    if (apiBlocklist.checkBlocklist(windowNew) === true) {
      return;
    }

    const continueProcess = setWindowsTiles(
      windowNew,
      workspace.desktops,
      workspace.screens,
      config.maximizeOpen,
      0,
    );

    if (config.desktopAdd === true && continueProcess === true) {
      workspace.createDesktop(workspace.desktops.length, "");
      workspace.currentDesktop =
        workspace.desktops[workspace.desktops.length - 1];
      windowNew.desktops = [workspace.currentDesktop];

      if (config.maximizeOpen === true) {
        windowNew.setMaximize(true, true);
      }

      let layout = apiTiles.getDefaultLayouts(config.layoutDefault - 1);

      if (config.layoutCustom !== undefined) {
        layout = config.layoutCustom;
      }

      apiTiles.setLayout(workspace.currentDesktop, layout);

      if (config.maximizeOpen === false) {
        const tilesOrdered = apiTiles.getTilesFromActualDesktop();

        windowNew.setMaximize(false, false);
        tilesOrdered[0].manage(windowNew);
      }
    }
  }

  //Trigger when a window is remove to the desktop
  function onWindowRemoved(windowClosed) {
    if (apiBlocklist.checkBlocklist(windowClosed) === true) {
      return false;
    }

    const continueProcess = setWindowsTiles(
      windowClosed,
      windowClosed.desktops,
      [windowClosed.output],
      config.maximizeClose,
      1,
    );

    return (
      continueProcess === true &&
      config.desktopRemove === true &&
      workspace.desktops.length > 1 &&
      workspace.desktops.length > config.desktopRemoveMin
    );
  }

  //Set signals to all Windows
  function setWindowsSignals() {
    for (const windowItem of workspace.stackingOrder) {
      setSignalsToWindow(windowItem);
    }
  }

  //Save tile when user focus a window
  function onUserFocusWindow(windowMain) {
    if (windowMain.active === true) {
      windowFocused.tile = windowMain.tile;
      windowFocused.window = windowMain;
    }
  }

  //Set signals to window
  function setSignalsToWindow(windowMain) {
    onUserFocusWindow(windowMain);

    if (apiBlocklist.checkBlocklist(windowMain) === false) {
      let userMoveFinished = false;
      if (config.UIEnable === true) {
        windowMain.interactiveMoveResizeStarted.connect(apiUI.onUserMoveStart);
        windowMain.interactiveMoveResizeStepped.connect(
          apiUI.onUserMoveStepped,
        );
        windowMain.interactiveMoveResizeFinished.connect(() => {
          apiUI.onUserMoveFinished(windowMain);
          userMoveFinished = true;
        });
      }

      if (config.windowsOrderMove === true) {
        windowMain.activeChanged.connect(() => {
          onUserFocusWindow(windowMain);
        });
        windowMain.tileChanged.connect((tile) => {
          apiTiles.exchangeTiles(windowMain, tile, windowFocused);

          if (config.windowsExtendMove === true && userMoveFinished === true) {
            const tilesOrdered = apiTiles.getTilesFromActualDesktop();
            const windows = getWindows(
              windowMain,
              workspace.currentDesktop,
              workspace.activeScreen,
            );

            extendWindows(
              tilesOrdered,
              [windowMain, ...windows],
              apiWorkarea.getPanelsSize(
                workspace.activeScreen,
                workspace.currentDesktop,
              ),
            );

            userMoveFinished = false;
          }
        });
      }
    }
  }

  function onTimerFinished() {
    //Case: Applications that open a window and, when an action is performed,
    //close the window and open another window (Chrome profile selector).
    //This timer avoid crash wayland
    const desktopsRemove = [];

    desktopLoop: for (const desktopItem of workspace.desktops.filter((d) =>
      rootUI.removeDesktopInfo.desktopsId.includes(d.id),
    )) {
      for (const screenItem of workspace.screens) {
        const windowsOtherSpecialCases = getWindows(
          rootUI.removeDesktopInfo.windowClosed,
          desktopItem,
          screenItem,
        );

        if (windowsOtherSpecialCases.length !== 0) {
          continue desktopLoop;
        }
      }

      desktopsRemove.push(desktopItem);
    }

    for (const desktop of desktopsRemove) {
      workspace.removeDesktop(desktop);
    }

    rootUI.removeDesktopInfo = {};
  }

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerFinished,
    setWindowsSignals,
    setSignalsToWindow,
  };
}
