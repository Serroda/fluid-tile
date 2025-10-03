//TODO: REFACTOR
//Get tiles, ordered by size (width) and from left to right
function orderTiles(tiles) {
  let tilesOrdered = [];

  for (let tile of tiles) {
    if (tile.tiles.length !== 0) {
      tilesOrdered = tilesOrdered.concat(orderTiles(tile.tiles));
    } else {
      tilesOrdered.push(tile);
    }
  }

  return tilesOrdered.sort((a, b) => {
    if (b.absoluteGeometry.width !== a.absoluteGeometry.width) {
      return b.absoluteGeometry.width - a.absoluteGeometry.width;
    } else if (b.absoluteGeometry.height !== a.absoluteGeometry.height) {
      return b.absoluteGeometry.height - a.absoluteGeometry.height;
    } else {
      return (
        b.absoluteGeometry.x - a.absoluteGeometry.x &&
        b.absoluteGeometry.y - a.absoluteGeometry.y
      );
    }
  });
}

//Get tiles from the screen and virtual desktop
function getOrderedTiles(desktop, screen) {
  const rootTile = workspace.rootTile(screen, desktop);
  return orderTiles(rootTile.tiles);
}
