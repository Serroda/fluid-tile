function getDefaultLayouts(index) {
  return [
    [{ x: 0, y: 0 }],
    [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 0.5 },
    ],
    [
      {
        x: 0,
        y: 0,
        tiles: [
          { x: 0, y: 0 },
          { x: 0, y: 0.5 },
        ],
      },
      {
        x: 0.5,
        y: 0,
      },
    ],
    [
      { x: 0, y: 0 },
      {
        x: 0.5,
        y: 0,
        tiles: [
          { x: 0, y: 0 },
          { x: 0, y: 0.5 },
        ],
      },
    ],
    [
      {
        x: 0,
        y: 0,
        tiles: [
          { x: 0, y: 0 },
          { x: 0, y: 0.5 },
        ],
      },
      {
        x: 0.5,
        y: 0,
        tiles: [
          { x: 0, y: 0 },
          { x: 0, y: 0.5 },
        ],
      },
    ],
  ][index];
}

//Block apps
function checkBlocklist(windowItem, appsBlocklist, modalsIgnore) {
  return (
    windowItem.normalWindow === false ||
    windowItem.resizeable === false ||
    windowItem.maximizable === false ||
    (modalsIgnore === true ? windowItem.transient === true : false) ||
    appsBlocklist
      .toLowerCase()
      .includes(windowItem.resourceClass.toLowerCase()) === true
  );
}

//Set tile layout
function setTiles(tileParent, layout) {
  if (layout.length === 1) {
    return true;
  }

  let splitMode = null;

  if (layout.every((item) => item.x === 0)) {
    splitMode = 2;
  } else if (layout.every((item) => item.y === 0)) {
    splitMode = 1;
  } else if (layout.every((item) => item.x !== 0 && item.y !== 0)) {
    splitMode = 0;
  }

  if (splitMode === null) {
    return false;
  }

  //Create childs
  if (tileParent.tiles.length === 0) {
    tileParent.layoutDirection = splitMode;
    tileParent.split(tileParent.layoutDirection);
  }

  for (let index = 0; index < layout.length; index++) {
    if (splitMode === 0 && index > 0) {
      layout[index].ref = tileParent.split(splitMode)[0];
    } else {
      layout[index].ref = tileParent.tiles[index];
    }

    setGeometryTile(layout[index]);
  }

  for (let x = 0; x < layout.length; x++) {
    if (layout[x].tiles !== undefined) {
      setTiles(layout[x].ref, layout[x].tiles);
    }
  }

  return true;
}

// Set tile size and position
function setGeometryTile(item) {
  if (item.width !== undefined) {
    const delta =
      item.width * item.ref.parent.absoluteGeometry.width -
      item.ref.absoluteGeometry.width;
    item.ref.resizeByPixels(delta, Qt.RightEdge);
  }

  if (item.height !== undefined) {
    const delta =
      item.height * item.ref.parent.absoluteGeometry.height -
      item.ref.absoluteGeometry.height;
    item.ref.resizeByPixels(delta, Qt.BottomEdge);
  }

  item.ref.relativeGeometry.x = item.x;
  item.ref.relativeGeometry.y = item.y;
}

//Get tiles, ordered by tilesPriority
function orderTiles(tiles, tilesPriority) {
  let tilesOrdered = [];

  for (let tile of tiles) {
    if (tile.tiles.length !== 0) {
      tilesOrdered = tilesOrdered.concat(orderTiles(tile.tiles, tilesPriority));
    } else {
      tilesOrdered.push(tile);
    }
  }

  return tilesOrdered.sort((a, b) => {
    for (const priority of tilesPriority) {
      let comparison = 0;
      switch (priority) {
        case "Width":
          comparison = b.absoluteGeometry.width - a.absoluteGeometry.width;
          break;
        case "Height":
          comparison = b.absoluteGeometry.height - a.absoluteGeometry.height;
          break;
        case "Top":
          comparison = a.absoluteGeometry.y - b.absoluteGeometry.y;
          break;
        case "Right":
          comparison = b.absoluteGeometry.x - a.absoluteGeometry.x;
          break;
        case "Left":
          comparison = a.absoluteGeometry.x - b.absoluteGeometry.x;
          break;
        case "Bottom":
          comparison = b.absoluteGeometry.y - a.absoluteGeometry.y;
          break;
      }
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });
}

//Delete reverse tile layout
function deleteTiles(tiles) {
  for (let index = tiles.length; index > 0; index--) {
    tiles[index - 1].remove();
  }
}

//Extend window if empty space is available
function extendWindows(tilesLayout, windows, panelsSize) {
  resetWindowGeometry(windows, panelsSize);

  const tilesQueue = tilesLayout.map((tile) => ({ tile, windowsExtended: [] }));

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

    const windowGeometry = window.tile.absoluteGeometry;

    for (const tileItem of tilesQueue) {
      if (tileItem.tile.windows.length !== 0) {
        continue;
      }

      if (
        windowGeometry.x > tileItem.tile.absoluteGeometry.x &&
        checkSameRow(windowGeometry, tileItem.tile) === true &&
        checkWindows(windows, tileItem.tile, window, "left", "left") === false
      ) {
        tilesAround.left.push(tileItem);
      } else if (
        windowGeometry.y > tileItem.tile.absoluteGeometry.y &&
        checkSameColumn(windowGeometry, tileItem.tile) === true &&
        checkWindows(windows, tileItem.tile, window, "top", "top") === false
      ) {
        tilesAround.top.push(tileItem);
      } else if (
        windowGeometry.x < tileItem.tile.absoluteGeometry.x &&
        checkSameRow(windowGeometry, tileItem.tile) === true &&
        checkWindows(windows, tileItem.tile, window, "right", "right") === false
      ) {
        tilesAround.right.push(tileItem);
      } else if (
        windowGeometry.y < tileItem.tile.absoluteGeometry.y &&
        checkSameColumn(windowGeometry, tileItem.tile) === true &&
        checkWindows(windows, tileItem.tile, window, "bottom", "bottom") ===
          false
      ) {
        tilesAround.bottom.push(tileItem);
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

      console.log(tileType + ": " + tiles.length);

      loopTile: for (const tileItem of tiles) {
        const finalWidth =
          tileItem.tile.absoluteGeometry.width + windowGeometry.width;
        const finalHeight =
          tileItem.tile.absoluteGeometry.height + windowGeometry.height;

        console.log(JSON.stringify(tileItem.windowsExtended));

        if (tileItem.windowsExtended.length !== 0) {
          const windowFuture = getBorders(
            windowGeometry.x,
            windowGeometry.y,
            finalWidth,
            finalHeight,
          );

          for (const windowExtended of tileItem.windowsExtended) {
            if (
              (windowFuture.left > windowExtended.left &&
                windowFuture.left < windowExtended.right) ||
              (windowFuture.right > windowExtended.left &&
                windowFuture.right < windowExtended.right) ||
              (windowFuture.top < windowExtended.bottom &&
                windowFuture.top > windowExtended.top) ||
              (windowFuture.bottom < windowExtended.bottom &&
                windowFuture.bottom > windowExtended.top)
            ) {
              console.log(
                "Area detectada con la ventana nueva:" +
                  JSON.stringify(windowFuture),
              );
              console.log(
                "Area detectada en el tile:" + JSON.stringify(windowExtended),
              );
              break loopTile;
            }
          }
        }

        console.log("new geometry");
        let newGeometry = null;

        switch (tileType) {
          case "left":
            newGeometry = {
              x: tileItem.tile.absoluteGeometry.x,
              width: finalWidth,
            };
            break;
          case "top":
            newGeometry = {
              y: tileItem.tile.absoluteGeometry.y,
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

        setGeometryWindow(window, newGeometry, panelsSize);
        const areaOccupied = calculateOccupiedArea(
          window.frameGeometry,
          tileItem.tile.absoluteGeometry,
        );

        tileItem.windowsExtended.push(areaOccupied);
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

function checkWindows(windows, tile, windowIgnore, modeWindow, modeTile) {
  return windows.some(
    (window) =>
      window !== windowIgnore &&
      window.tile.absoluteGeometry[modeWindow] ===
        tile.absoluteGeometry[modeTile],
  );
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
}

function calculateOccupiedArea(windowLimits, tileLimits) {
  const area = {
    left: tileLimits.left,
    top: tileLimits.top,
    right: tileLimits.right,
    bottom: tileLimits.bottom,
  };

  if (windowLimits.left > area.left && windowLimits.left < area.right) {
    area.left = windowLimits.left;
  }
  if (windowLimits.right > area.left && windowLimits.right < area.right) {
    area.right = windowLimits.right;
  }
  if (windowLimits.top > area.top && windowLimits.top < area.bottom) {
    area.top = windowLimits.top;
  }
  if (windowLimits.bottom > area.top && windowLimits.bottom < area.bottom) {
    area.bottom = windowLimits.bottom;
  }

  return area;
}

function getBorders(x, y, width, height) {
  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
  };
}
