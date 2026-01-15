import { useBlocklist } from "./blocklist.mjs";
import { useWorkarea } from "./workarea.mjs";
import { useTiles } from "./tiles.mjs";

export function useWindows(workspace, config) {
  const apiTiles = useTiles(workspace, config);
  const apiBlocklist = useBlocklist(config.appsBlocklist, config.modalsIgnore);
  const apiWorkarea = useWorkarea(workspace);

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
  function setWindowsTiles(windowMain, desktops, screens, mode) {
    const indexStartDesktop = desktops.findIndex(
      (d) => d === workspace.currentDesktop,
    );
    const indexStartScreen = screens.findIndex(
      (s) => s === workspace.activeScreen,
    );

    let indexDesktop = indexStartDesktop;
    let indexScreen = indexStartScreen;

    do {
      const itemDesktop = desktops[indexDesktop];
      do {
        const itemScreen = screens[indexScreen];
        const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
        const tilesOrdered = apiTiles.getOrderedTiles(itemDesktop, itemScreen);

        if (tilesOrdered.length === 0) {
          return { continueProcess: true, windows: [], counter: 0 };
        }

        if (mode === 0 && windowsOther.length + 1 <= tilesOrdered.length) {
          //Set tile if the custom mosaic has space

          workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];

          for (let x = 0; x < windowsOther.length; x++) {
            windowsOther[x].desktops = [itemDesktop];
            windowsOther[x].setMaximize(false, false);
            windowsOther[x]._avoidTileChangedTrigger = true;

            if (config.windowsOrderOpen === true) {
              tilesOrdered[x + 1].manage(windowsOther[x]);
            } else if (windowsOther[x].tile === null) {
              tilesOrdered[x].manage(windowsOther[x]);
            }

            updateShadows(windowsOther[x]);
          }

          windowMain._avoidTileChangedTrigger = true;
          windowMain._avoidMaximizeTrigger =
            windowsOther.length === 0 ||
            (windowsOther.length === 1 && config.maximizeExtend === true);

          //Set tile for main window
          if (config.windowsOrderOpen === true) {
            tilesOrdered[0].manage(windowMain);
          } else {
            const tileEmpty = tilesOrdered.find(
              (tile) => tile.windows.length === 0,
            );

            if (tileEmpty !== undefined) {
              tileEmpty.manage(windowMain);
            }
          }

          updateShadows(windowMain);

          extendWindows(
            [windowMain, ...windowsOther],
            apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
          );

          return {
            continueProcess: false,
          };
        } else if (mode === 1 && windowsOther.length !== 0) {
          if (config.windowsOrderClose === true) {
            for (let x = 0; x < windowsOther.length; x++) {
              windowsOther[x]._avoidTileChangedTrigger = true;
              windowsOther[x].setMaximize(false, false);
              tilesOrdered[x].manage(windowsOther[x]);
              updateShadows(windowsOther[x]);
            }
          }

          extendWindows(
            windowsOther,
            apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
          );

          return {
            continueProcess: false,
          };
        }

        indexScreen = (indexScreen + 1) % screens.length;
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    return { continueProcess: true };
  }

  //Extend window if empty space is available
  function extendWindows(windows, panelsSize) {
    console.log("extendwindow");

    if (
      config.maximizeExtend === true &&
      windows.length === 1 &&
      windows[0].minimized === false &&
      windows[0]._avoidMaximizeExtend !== true
    ) {
      console.log("window maximized");
      windows[0]._avoidMaximizeTrigger = true;
      windows[0]._avoidMaximizeExtend = false;
      windows[0].setMaximize(true, true);
      return;
    }

    resetWindowGeometry(windows, panelsSize);

    for (const window of windows) {
      window._maximizedByExtend = undefined;

      if (
        window.tile === null ||
        window._shadows === undefined ||
        window.minimized === true
      ) {
        continue;
      }

      const windowGeometry = getRealGeometry(window);
      const windowsOther = windows
        .filter(
          (wo) =>
            wo !== window &&
            (wo.tile !== null || wo._shadows !== undefined) &&
            wo.minimized === false,
        )
        .map((wo) => getRealGeometry(wo));

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

        const sameColumn = checkSameColumn(windowGeometry, windowItem);

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

        console.log(key, item.length);
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
      const tileVirtual = setGeometryWindow(window, newGeometry, panelsSize);
      window._tileVirtual = tileVirtual;
    }
  }

  //Set default tile size
  function resetWindowGeometry(windows, panelsSize) {
    for (const window of windows) {
      window._tileVirtual = undefined;

      if (
        window.minimized === true ||
        (window.tile === null && window._shadows === undefined)
      ) {
        continue;
      }

      window.setMaximize(false, false);
      setGeometryWindow(window, {}, panelsSize);
    }
  }

  //Get geometry from tiles
  function getRealGeometry(window) {
    return (
      window._tileVirtual ??
      (window.tile !== null
        ? window.tile.absoluteGeometry
        : window._shadows.tile.absoluteGeometry)
    );
  }

  //Set window size and return `virtualTile`
  function setGeometryWindow(window, geometry, panelsSize) {
    const tileRef = window.tile !== null ? window.tile : window._shadows.tile;
    const tileRefGeometry = getRealGeometry(window);

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

  //Focus window in the workspace
  function focusWindow(window) {
    if (window === undefined) {
      const windows = getWindows(
        undefined,
        workspace.currentDesktop,
        workspace.activeScreen,
      );

      if (windows.length === 0) {
        return null;
      }

      if (windows[0].minimized === true) {
        return null;
      }

      workspace.activeWindow = windows[0];

      return windows[0];
    } else {
      workspace.activeWindow = window;
      return window;
    }
  }

  //Check if the tile is in the same column
  function checkSameColumn(windowGeometry, windowGeometryOther) {
    return (
      (windowGeometry.left >= windowGeometryOther.left &&
        windowGeometry.left < windowGeometryOther.right) ||
      (windowGeometry.right <= windowGeometryOther.right &&
        windowGeometry.right > windowGeometryOther.left)
    );
  }

  //Extend all windows in the current desktop
  function extendWindowsCurrentDesktop(screenAll = false) {
    let screens = [workspace.activeScreen];

    if (screenAll === true) {
      screens = workspace.screens;
    }

    for (const screen of screens) {
      const windows = getWindows(undefined, workspace.currentDesktop, screen);

      if (windows.length === 0) {
        continue;
      }

      extendWindows(
        windows,
        apiWorkarea.getPanelsSize(screen, workspace.currentDesktop),
      );
    }
  }

  //Save references window's tile, desktop, screen
  function updateShadows(window, tile, desktop, screen) {
    console.log(
      "update shadows main",
      window,
      tile,
      window.tile,
      window._shadows?.tile,
    );
    window._shadows = {
      tile: tile ?? window.tile ?? window._shadows?.tile,
      desktop: desktop ?? window.desktops[0],
      screen: screen ?? window.output,
    };
  }

  return {
    setWindowsTiles,
    getWindows,
    extendWindows,
    extendWindowsCurrentDesktop,
    focusWindow,
    updateShadows,
  };
}
