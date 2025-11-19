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

  const windowQueue = [...windows];
  const tileQueue = tilesLayout.map((tile) => ({ tile, completed: false }));

  for (const window of windowQueue) {
    if (window.tile === null) {
      continue;
    }

    let windowChanged = false;

    for (const tileItem of tileQueue) {
      const tile = tileItem.tile;

      if (tile.windows.length !== 0 || tileItem.completed === true) {
        continue;
      }

      const tileEndpointX =
        tile.absoluteGeometry.x + tile.absoluteGeometry.width;
      const tileEndpointY =
        tile.absoluteGeometry.y + tile.absoluteGeometry.height;

      const windowEndpointX =
        window.tile.absoluteGeometry.x + window.tile.absoluteGeometry.width;
      const windowEndpointY =
        window.tile.absoluteGeometry.y + window.tile.absoluteGeometry.height;

      //left
      if (
        tile.absoluteGeometry.x < window.frameGeometry.x &&
        tileEndpointX === window.frameGeometry.x
      ) {
        setGeometryWindow(
          window,
          {
            x: tile.absoluteGeometry.x,
            y: window.tile.absoluteGeometry.y,
            width:
              tile.absoluteGeometry.width + window.tile.absoluteGeometry.width,
            height: window.tile.absoluteGeometry.height,
          },
          panelsSize,
        );

        tileItem.completed = true;
        windowChanged = true;
        console.log("left");
      }

      //top
      if (
        tile.absoluteGeometry.y < window.frameGeometry.y &&
        tileEndpointY === window.frameGeometry.y
      ) {
        setGeometryWindow(
          window,
          {
            x: window.tile.absoluteGeometry.x,
            y: tile.absoluteGeometry.y,
            width: tile.absoluteGeometry.width,
            height:
              tile.absoluteGeometry.height +
              window.tile.absoluteGeometry.height,
          },
          panelsSize,
        );

        tileItem.completed = true;
        windowChanged = true;
        console.log("top");
      }

      //right
      if (
        tile.absoluteGeometry.x > window.frameGeometry.x &&
        tile.absoluteGeometry.x === windowEndpointX
      ) {
        setGeometryWindow(
          window,
          {
            x: window.tile.absoluteGeometry.x,
            y: window.tile.absoluteGeometry.y,
            width:
              tile.absoluteGeometry.width + window.tile.absoluteGeometry.width,
            height: tile.absoluteGeometry.height,
          },
          panelsSize,
        );

        tileItem.completed = true;
        windowChanged = true;
        console.log("right");
      }

      //bottom
      if (
        tile.absoluteGeometry.y > window.frameGeometry.y &&
        tile.absoluteGeometry.y === windowEndpointY
      ) {
        setGeometryWindow(
          window,
          {
            x: window.tile.absoluteGeometry.x,
            y: window.tile.absoluteGeometry.y,
            width: tile.absoluteGeometry.width,
            height:
              tile.absoluteGeometry.height +
              window.tile.absoluteGeometry.height,
          },
          panelsSize,
        );

        tileItem.completed = true;
        windowChanged = true;
        console.log("bottom");
      }
    }

    if (windowChanged === true) windowQueue.push(window);
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

//Wrapper
function setGeometryWindow(window, geometry, panelsSize) {
  window.frameGeometry = {
    x:
      geometry.x +
      window.tile.padding +
      (window.tile.absoluteGeometry.x === 0 ? panelsSize.left : 0),
    y:
      geometry.y +
      window.tile.padding +
      (window.tile.absoluteGeometry.y === 0 ? panelsSize.top : 0),
    width:
      geometry.width -
      (window.tile.absoluteGeometry.x === 0 ? panelsSize.left : 0) -
      (window.tile.absoluteGeometry.width +
        window.tile.absoluteGeometry.x -
        panelsSize.right -
        panelsSize.left ===
      panelsSize.workarea.width
        ? panelsSize.right
        : 0) -
      window.tile.padding * 2,
    height:
      geometry.height -
      (window.tile.absoluteGeometry.y === 0 ? panelsSize.top : 0) -
      (window.tile.absoluteGeometry.height +
        window.tile.absoluteGeometry.y -
        panelsSize.bottom -
        panelsSize.top ===
      panelsSize.workarea.height
        ? panelsSize.bottom
        : 0) -
      window.tile.padding * 2,
  };
}
