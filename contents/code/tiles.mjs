export function useTiles(workspace, config) {
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

  //Prepare for set tile layout
  function setLayout(desktop, layout) {
    for (const screen of workspace.screens) {
      const tileRoot = workspace.rootTile(screen, desktop);
      deleteTiles(tileRoot.tiles);
      const result = setTiles(tileRoot.tiles[0] ?? tileRoot, layout);

      if (result === false) {
        console.log("Error on setLayout");
      }
    }
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

  //Get tiles from the screen and virtual desktop
  function getOrderedTiles(desktop, screen) {
    const tileRoot = workspace.rootTile(screen, desktop);

    if (tileRoot === null) {
      return [];
    }

    return orderTiles(
      tileRoot.tiles.length !== 0 ? tileRoot.tiles : [tileRoot],
      config.tilesPriority,
    );
  }

  //Get tiles, ordered by tilesPriority
  function orderTiles(tiles, tilesPriority) {
    let tilesOrdered = [];

    for (let tile of tiles) {
      if (tile.tiles.length !== 0) {
        tilesOrdered = tilesOrdered.concat(
          orderTiles(tile.tiles, tilesPriority),
        );
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

  //Get all tiles from the actual desktop with all screens
  function getTilesFromActualDesktop() {
    let tiles = [];
    for (const screen of workspace.screens) {
      tiles = tiles.concat(getOrderedTiles(workspace.currentDesktop, screen));
    }
    return tiles;
  }

  //Exchange windows tiles
  function exchangeTiles(windowsExchange, tile, desktop, screen) {
    for (const windowItem of windowsExchange) {
      windowItem.setMaximize(false, false);

      if (screen !== workspace.activeScreen) {
        workspace.sendClientToScreen(windowItem, screen);
      }

      if (desktop !== workspace.currentDesktop) {
        windowItem.desktops = [desktop];
      }

      tile.manage(windowItem);
      windowItem._shadows.tile = tile;
      windowItem._shadows.desktops = windowItem.desktops;
      windowItem._shadows.screen = windowItem.output;
    }
  }

  //Return the tile before maximize window
  function getShadowTile(window) {
    if (window.tile !== null && window.tile !== undefined) {
      return window.tile;
    }

    if (window._shadows !== undefined) {
      return window._shadows.tile;
    }

    return null;
  }

  return {
    getTilesFromActualDesktop,
    getOrderedTiles,
    getDefaultLayouts,
    exchangeTiles,
    setLayout,
    getShadowTile,
  };
}
