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
  function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
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
          return true;
        }

        if (mode === 0) {
          //Set tile if the custom mosaic has space
          if (windowsOther.length + 1 <= tilesOrdered.length) {
            workspace.currentDesktop = itemDesktop;
            windowMain.desktops = [itemDesktop];

            for (let x = 0; x < windowsOther.length; x++) {
              windowsOther[x].desktops = [itemDesktop];
              windowsOther[x].setMaximize(false, false);

              if (config.windowsOrderOpen === true) {
                tilesOrdered[x + 1].manage(windowsOther[x]);
                windowsOther[x].tilePrevious = tilesOrdered[x + 1];
              } else if (windowsOther[x].tile === null) {
                tilesOrdered[x].manage(windowsOther[x]);
                windowsOther[x].tilePrevious = tilesOrdered[x];
              }
            }

            if (config.windowsOrderOpen === true) {
              tilesOrdered[0].manage(windowMain);
              windowMain.tilePrevious = tilesOrdered[0];
            } else {
              const tileEmpty = tilesOrdered.find(
                (tile) => tile.windows.length === 0,
              );

              if (tileEmpty !== undefined) {
                tileEmpty.manage(windowMain);
                windowMain.tilePrevious = tileEmpty;
              }
            }

            if (maximize === true && windowsOther.length === 0) {
              windowMain.setMaximize(true, true);
            } else {
              windowMain.setMaximize(false, false);

              if (config.windowsExtendOpen === true) {
                extendWindows(
                  [windowMain, ...windowsOther],
                  apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
                );
              }
            }

            return false;
          }
        } else if (mode === 1 && windowsOther.length !== 0) {
          if (maximize === true && windowsOther.length === 1) {
            windowsOther[0].tilePrevious = tilesOrdered[1];
            windowsOther[0].setMaximize(true, true);
          } else if (config.windowsOrderClose === true) {
            for (let x = 0; x < windowsOther.length; x++) {
              windowsOther[x].setMaximize(false, false);
              tilesOrdered[x].manage(windowsOther[x]);
              windowsOther[x].tilePrevious = tilesOrdered[x];
            }
          }

          if (
            config.windowsExtendClose === true &&
            windowsOther.length > 1 &&
            config.windowsOrderClose === false
          ) {
            extendWindows(
              windowsOther,
              apiWorkarea.getPanelsSize(itemScreen, itemDesktop),
            );
          }

          return false;
        }

        indexScreen = (indexScreen + 1) % screens.length;
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    return true;
  }

  //Extend window if empty space is available
  function extendWindows(windows, panelsSize) {
    resetWindowGeometry(windows, panelsSize);

    for (const window of windows) {
      if (window.tile === null || window.tilePrevious === undefined) {
        continue;
      }

      const windowGeometry = getRealGeometry(window);
      const windowsOther = windows
        .filter(
          (w) =>
            w !== window && (w.tile !== null || w.tilePrevious !== undefined),
        )
        .map((w) => getRealGeometry(w));

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
      //thus being more restrictive when establishing the window size.

      const windowsConflict = {
        left: windowsOther.filter((wo) => wo.right <= windowGeometry.left),
        top: windowsOther.filter(
          (wo) =>
            wo.bottom <= windowGeometry.top &&
            checkSameColumn(windowGeometry, wo) === true,
        ),
        right: windowsOther.filter((wo) => wo.left >= windowGeometry.right),
        bottom: windowsOther.filter(
          (wo) =>
            wo.top >= windowGeometry.bottom &&
            checkSameColumn(windowGeometry, wo) === true,
        ),
      };
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
      const tileVirtual = setGeometryWindow(window, newGeometry, panelsSize);
      window.tileVirtual = tileVirtual;
    }
  }

  //Set default tile size
  function resetWindowGeometry(windows, panelsSize) {
    for (const window of windows) {
      window.tileVirtual = undefined;

      if (window.tile === null && window.tilePrevious === undefined) {
        continue;
      }

      setGeometryWindow(window, {}, panelsSize);
    }
  }

  function getRealGeometry(window) {
    return (
      window.tileVirtual ??
      (window.tile !== null
        ? window.tile.absoluteGeometry
        : window.tilePrevious.absoluteGeometry)
    );
  }

  //Set window size and return `virtualTile`
  function setGeometryWindow(window, geometry, panelsSize) {
    const tileRef = window.tile !== null ? window.tile : window.tilePrevious;
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

  function focusWindow(window) {
    if (window === undefined) {
      const windows = getWindows(
        undefined,
        workspace.currentDesktop,
        workspace.activeScreen,
      );

      if (windows.length > 0) {
        workspace.activeWindow = windows[0];
        return windows[0];
      }
    } else {
      workspace.activeWindow = window;
      return window;
    }
    return null;
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

  function extendWindowsCurrentDesktop() {
    if (
      config.windowsExtendClose === false &&
      config.windowsExtendOpen === false
    ) {
      return;
    }

    const windows = getWindows(
      undefined,
      workspace.currentDesktop,
      workspace.activeScreen,
    );

    if (windows.length === 0) {
      return;
    }

    extendWindows(
      windows,
      apiWorkarea.getPanelsSize(
        workspace.activeScreen,
        workspace.currentDesktop,
      ),
    );
  }

  return {
    setWindowsTiles,
    getWindows,
    extendWindows,
    extendWindowsCurrentDesktop,
    focusWindow,
  };
}
