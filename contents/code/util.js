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

  //TODO: comprobar si en esta posicion de tileVirtual existe ya una ventana
  const windowQueue = windows.map((window) => ({
    window,
    tileVirtual: window.tile.absoluteGeometry,
  }));

  for (const windowItem of windowQueue) {
    const window = windowItem.window;

    if (window.tile === null) {
      continue;
    }

    let windowChanged = false;

    for (const tile of tilesLayout) {
      if (
        tile.windows.length !== 0 ||
        checkSpace(windowQueue, tile) === false
      ) {
        continue;
      }

      const windowTileGeometry = windowItem.tileVirtual;

      // console.log(JSON.stringify(windowTileGeometry));
      // console.log(tile.absoluteGeometry);

      if (windowTileGeometry.x > tile.absoluteGeometry.x) {
        windowItem.tileVirtual = {
          x: tile.absoluteGeometry.x,
          y: windowTileGeometry.y,
          width: tile.absoluteGeometry.width + windowTileGeometry.width,
          height: windowTileGeometry.height,
          top: windowTileGeometry.top,
          bottom: windowTileGeometry.bottom,
          left: tile.absoluteGeometry.x,
          right:
            tile.absoluteGeometry.width +
            windowTileGeometry.width +
            tile.absoluteGeometry.x,
        };
        windowChanged = true;
        console.log("left");
      } else if (windowTileGeometry.y < tile.absoluteGeometry.y) {
        windowItem.tileVirtual = {
          x: windowTileGeometry.x,
          y: tile.absoluteGeometry.y,
          width: windowTileGeometry.width,
          height: tile.absoluteGeometry.height + windowTileGeometry.height,
          top: tile.absoluteGeometry.y,
          bottom:
            tile.absoluteGeometry.height +
            windowTileGeometry.height +
            tile.absoluteGeometry.y,
          left: windowTileGeometry.left,
          right: windowTileGeometry.right,
        };
        windowChanged = true;
        console.log("top");
      } else if (windowTileGeometry.x < tile.absoluteGeometry.x) {
        windowItem.tileVirtual = {
          x: windowTileGeometry.x,
          y: windowTileGeometry.y,
          width: tile.absoluteGeometry.width + windowTileGeometry.width,
          height: windowTileGeometry.height,
          top: windowTileGeometry.top,
          bottom: windowTileGeometry.bottom,
          left: windowTileGeometry.left,
          right:
            tile.absoluteGeometry.width +
            windowTileGeometry.width +
            tile.absoluteGeometry.x,
        };

        windowChanged = true;
        console.log("right");
      } else if (windowTileGeometry.y < tile.absoluteGeometry.y) {
        windowItem.tileVirtual = {
          x: windowTileGeometry.x,
          y: windowTileGeometry.y,
          width: windowTileGeometry.width,
          height: tile.absoluteGeometry.height + windowTileGeometry.height,
          top: windowTileGeometry.top,
          bottom:
            tile.absoluteGeometry.height +
            windowTileGeometry.height +
            tile.absoluteGeometry.y,
          left: windowTileGeometry.left,
          right: windowTileGeometry.right,
        };
        windowChanged = true;
        console.log("bottom");
      }

      if (windowChanged === true) {
        setGeometryWindow(window, windowItem.tileVirtual, panelsSize);
      }
    }
  }
}

//Set default tile size
function resetWindowGeometry(windows, panelsSize) {
  for (const window of windows) {
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

//Check space in the tile
function checkSpace(windows, tile) {
  for (const window of windows) {
    console.log(JSON.stringify(window.tileVirtual));
    console.log(JSON.stringify(tile.absoluteGeometry));
    //TODO: ERROR
    if (
      (tile.absoluteGeometry.left < window.tileVirtual.left ||
        tile.absoluteGeometry.left < window.tileVirtual.left ||
        tile.absoluteGeometry.right < window.tileVirtual.right) &&
      (tile.absoluteGeometry.top > window.tileVirtual.top ||
        tile.absoluteGeometry.bottom < window.tileVirtual.bottom)
    ) {
      return false;
    }
  }

  return true;
}

//Wrapper
function setGeometryWindow(window, geometry, panelsSize) {
  window.frameGeometry = {
    x:
      geometry.x +
      window.tile.padding +
      (geometry.x === 0 ? panelsSize.left : 0),
    y:
      geometry.y +
      window.tile.padding +
      (geometry.y === 0 ? panelsSize.top : 0),
    width:
      geometry.width -
      (geometry.x === 0 ? panelsSize.left : 0) -
      (geometry.width + geometry.x - panelsSize.right - panelsSize.left ===
      panelsSize.workarea.width
        ? panelsSize.right
        : 0) -
      window.tile.padding * 2,
    height:
      geometry.height -
      (geometry.y === 0 ? panelsSize.top : 0) -
      (geometry.height + geometry.y - panelsSize.bottom - panelsSize.top ===
      panelsSize.workarea.height
        ? panelsSize.bottom
        : 0) -
      window.tile.padding * 2,
  };
}
