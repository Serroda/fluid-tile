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
          if (maximize === true && windowsOther.length === 1) {
            windowsOther[0].setMaximize(true, true);
          } else {
            for (let x = 0; x < windowsOther.length; x++) {
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

        indexScreen = (indexScreen + 1) % screens.length;
      } while (indexScreen !== indexStartScreen);
      indexDesktop = (indexDesktop + 1) % desktops.length;
    } while (indexDesktop !== indexStartDesktop);

    return true;
  }

  //Extend window if empty space is available
  function extendWindows(tilesLayout, windows, panelsSize) {
    resetWindowGeometry(windows, panelsSize);

    for (const window of windows) {
      if (window.tile === null) {
        continue;
      }

      const tilesAround = {
        left: [],
        top: [],
        right: [],
        bottom: [],
      };

      const windowGeometry = window.tileVirtual ?? window.tile.absoluteGeometry;

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
              return b.absoluteGeometry.x - a.absoluteGeometry.x;

            case "top":
            case "bottom":
              return b.absoluteGeometry.y - a.absoluteGeometry.y;
          }
        });

        for (const tile of tiles) {
          if (checkConflictsAllWindows(window, windows, tileType) === true) {
            break;
          }

          let finalWidth = tile.absoluteGeometry.width + windowGeometry.width;

          let finalHeight =
            tile.absoluteGeometry.height + windowGeometry.height;

          if (tile.absoluteGeometry.x === windowGeometry.left) {
            finalWidth = windowGeometry.width;
          }
          if (tile.absoluteGeometry.y === windowGeometry.top) {
            finalHeight = windowGeometry.height;
          }

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
      window.tileVirtual = undefined;

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
      if (
        windowOther === windowMain ||
        (windowOther.tile === null && windowOther.tileVirtual === undefined)
      ) {
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
    const tileRef = window.tileVirtual ?? window.tile.absoluteGeometry;

    const x = geometry.x !== undefined ? geometry.x : tileRef.left;
    const y = geometry.y !== undefined ? geometry.y : tileRef.top;

    const width = geometry.width !== undefined ? geometry.width : tileRef.width;
    const height =
      geometry.height !== undefined ? geometry.height : tileRef.height;

    let offsetX = window.tile.padding;
    let offsetY = window.tile.padding;

    if (x === 0) {
      offsetX += panelsSize.left + window.tile.padding;
    }

    if (y === 0) {
      offsetY += panelsSize.top + window.tile.padding;
    }

    if (x + width === panelsSize.workarea.right + panelsSize.right) {
      offsetX += panelsSize.right;
    }

    if (y + height === panelsSize.workarea.bottom + panelsSize.bottom) {
      offsetY += panelsSize.bottom;
    }

    window.frameGeometry = {
      x: x + (x === 0 ? panelsSize.left + window.tile.padding : 0),
      y: y + (y === 0 ? panelsSize.top + window.tile.padding : 0),
      width: width - offsetX,
      height: height - offsetY,
    };

    return {
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
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

  return {
    setWindowsTiles,
    getWindows,
    extendWindows,
    focusWindow,
  };
}
