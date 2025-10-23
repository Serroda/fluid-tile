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

    setGeometry(layout[index]);
  }

  for (let x = 0; x < layout.length; x++) {
    if (layout[x].tiles !== undefined) {
      setTiles(layout[x].ref, layout[x].tiles);
    }
  }

  return true;
}

// Set tile size and position
function setGeometry(item) {
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

//Extendes window on empty space
function extendsWindow(tile, window) {
  if (
    tile?.parent?.tiles.every((t) => t.windows.length === 0) &&
    tile?.parent?.windows.length === 0
  ) {
    extendsWindow(tile.parent, window);
  } else {
    tile.manage(window);
  }
}

//Conditional wrapper
function extendsOrDefault(conditional, tile, window) {
  if (conditional === true) {
    extendsWindow(tile, window);
  } else {
    tile.manage(window);
  }
}
