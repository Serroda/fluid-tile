export class Tiles {
  constructor(workspace, config) {
    this.workspace = workspace;
    this.config = config;
  }

  //Premade layouts
  getDefaultLayouts(index) {
    const layouts = [
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
    ];

    if (index === undefined) {
      return layouts;
    }

    return layouts[index];
  }

  //Delete actual layout and set new layout
  setLayout(desktop, layout) {
    for (const screen of this.workspace.screens) {
      const tileRoot = this.workspace.rootTile(screen, desktop);
      this.deleteTiles(tileRoot.tiles, tileRoot);
      const result = this.setTiles(tileRoot.tiles[0] ?? tileRoot, layout);

      if (result === false) {
        console.log("Error on set tiles layout, splitMode === null");
      }
    }
  }

  //Set tile layout
  setTiles(tileParent, layout) {
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

      this.setGeometryTile(layout[index]);
    }

    for (let x = 0; x < layout.length; x++) {
      if (layout[x].tiles !== undefined) {
        this.setTiles(layout[x].ref, layout[x].tiles);
      }
    }

    return true;
  }

  // Set tile size and position
  setGeometryTile(item) {
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

  //Get root tile
  getRootTile(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    return this.workspace.rootTile(screen, desktop);
  }

  //Get tiles from the screen and virtual desktop
  getOrderedTiles(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    const tileRoot = this.workspace.rootTile(screen, desktop);

    if (tileRoot === null) {
      return [];
    }

    const tiles = this.orderTiles(
      tileRoot.tiles.length !== 0 ? tileRoot.tiles : [tileRoot],
    );

    for (const tile of tiles) {
      tile._screen = screen;
      tile._desktop = desktop;
    }

    return tiles;
  }

  //Get tiles, ordered by tilesPriority
  orderTiles(tiles) {
    let tilesOrdered = [];

    for (let tile of tiles) {
      if (tile.tiles.length !== 0) {
        tilesOrdered = tilesOrdered.concat(this.orderTiles(tile.tiles));
      } else {
        tilesOrdered.push(tile);
      }
    }

    return tilesOrdered.sort((a, b) => {
      for (const priority of this.config.tilesPriority) {
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
  deleteTiles(tiles, tileRoot) {
    for (let index = tiles.length; index > 0; index--) {
      tileRoot._avoidExtendChildTilesChanged = true;
      if (tiles[index - 1].parent !== null) {
        tiles[index - 1].parent._avoidExtendChildTilesChanged = true;
      }
      tiles[index - 1].remove();
    }
  }

  //Get all tiles from the actual desktop with all screens
  getTilesCurrentDesktop() {
    let tiles = [];
    for (const screen of this.workspace.screens) {
      tiles = tiles.concat(this.getOrderedTiles(undefined, screen));
    }
    return tiles;
  }

  //Exchange windows between tiles
  exchangeTiles(windowsExchange, tile) {
    for (const window of windowsExchange) {
      window._avoidMaximizeTrigger = true;
      window.setMaximize(false, false);

      if (tile._screen !== window.output) {
        this.workspace.sendClientToScreen(window, tile._screen);
      }

      if (tile._desktop !== this.workspace.currentDesktop) {
        window.desktops = [tile._desktop];
      }

      window._avoidTileChangedTrigger = true;
      window._tileShadow = tile;

      tile.manage(window);
    }
  }

  //Return the tile before maximize window
  getShadowTile(window) {
    if (window.tile !== null && window.tile !== undefined) {
      return window.tile;
    }

    if (window._tileShadow !== undefined) {
      return window._tileShadow;
    }

    return null;
  }

  //Disconect all signals
  disconnectSignals() {
    for (const screen of this.workspace.screens) {
      const rootTile = this.getRootTile(undefined, screen);

      for (const key in rootTile._signals) {
        rootTile[key].disconnect(rootTile._signals[key]);
      }
      rootTile._signals = undefined;
    }

    const tiles = this.getTilesCurrentDesktop();
    for (const tile of tiles) {
      for (const key in tile._signals) {
        tile[key].disconnect(tile._signals[key]);
      }
      tile._signals = undefined;
    }
  }
}
